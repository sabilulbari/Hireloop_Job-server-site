const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const logger = (req, res, next) => {
  console.log("logger midlsewere logged", req.params);
  next();
};


const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("hireloop_db");
    const jobCollection = database.collection("jobs");
    const userCollections = database.collection("user");
    const companyCollection = database.collection("companies");
    const applicationsCollection = database.collection("application");
    const plansCollection = database.collection("plans");
    const subscriptionsCollection = database.collection("subscriptions");
    const sessionCollection = database.collection("session");
    

    //verification related
    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers?.authorization;

      if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      const query = {token: token}

      const getSession = await sessionCollection.findOne(query)

      const userId =  getSession.userId

      const userQuery = {_id: userId}

      const user = await userCollections.findOne(userQuery)

      //set this user dat in req object

      req.user = user;


      next();
    };

    const seekerVerify = async(req, res, next)=>{
      if(req.user?.role !== 'seeker'){
        res.status(403).send({message: "Forbidden access"})
      }
      next()
    }
    const recruiterVerify = async(req, res, next)=>{
      if(req.user?.role !== 'recruiter'){
        res.status(403).send({message: "Forbidden access"})
      }
      next()
    }


    app.get("/api/jobs", async (req, res) => {
      const query = {};
      if (req.query.companyId) {
        query.companyId = req.query.companyId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }

      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();

      console.log(result);
      res.send(result);
    });

    app.get("/api/recruiter/post/jobs", verifyToken, recruiterVerify, async (req, res) => {
      const query = {};
      if (req.query.companyId) {
        query.companyId = req.query.companyId;

        //check same id
        console.log(req.query.companyId, req.user);
      }
      if (req.query.status) {
        query.status = req.query.status;
      }

      const cursor = jobCollection.find(query);
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/api/my/companies", async (req, res) => {
      const query = {};
      if (req.query.recruiterId) {
        query.recruiterId = req.query.recruiterId;
      }
      const result = await companyCollection.findOne(query);

      res.send(result || {});
    });

    // app.get("/api/admin/all/companies", async (req, res)=>{
    //   const  cursor = await companyCollection.find()
    //   const companies = await cursor.toArray();

    //   for(const company of companies){

    //     const filter = {
    //       companyId: company._id.toString()
    //     }

    //     const jobCount = await jobCollection.countDocuments(filter)
    //     company.jobCount = jobCount
    //   }
    //   res.send(companies || {});
    // });

    app.get("/api/admin/all/companies", logger, verifyToken, async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: "jobs",
            let: {
              companyId: { $toString: "$_id" },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$companyId", "$$companyId"],
                  },
                },
              },
              {
                $count: "totalJobs",
              },
            ],
            as: "jobStats",
          },
        },
        {
          $addFields: {
            jobCount: {
              $ifNull: [{ $arrayElemAt: ["$jobStats.totalJobs", 0] }, 0],
            },
          },
        },
        {
          $project: {
            jobStats: 0,
          },
        },
      ];

      const companies = await companyCollection.aggregate(pipeline).toArray();

      res.send(companies);
    });

    app.get("/api/jobs/:jobId", async (req, res) => {
      const { jobId } = req.params;

      const query = { _id: new ObjectId(jobId) };

      const result = await jobCollection.findOne(query);
      res.send(result);
    });

    app.get("/api/my/applications",verifyToken, seekerVerify, async (req, res) => {
      const query = {};
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;
      }

      console.log(req.user, req.query.applicantId);

      const result = await applicationsCollection.find(query).toArray();

      res.send(result || {});
    });

    //for page details page 
    app.get("/api/my/applications/jobId", async (req, res) => {
      const query = {};
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;
        query.jobId = req.query.jobId;
      }

      const result = await applicationsCollection.findOne(query);

      res.send(result || {});
    });

    // plans

    app.get("/api/plans", async (req, res) => {
      const query = {};

      if (req.query.plan_id) {
        query.plan_id = req.query.plan_id;
      }

      const result = await plansCollection.findOne(query);
      res.send(result || {});
    });

    // All post api
    app.post("/api/jobs", async (req, res) => {
      const job = req.body;
      const newJob = {
        ...job,
        createdAt: new Date(),
      };
      const result = await jobCollection.insertOne(newJob);
      res.send(result);
    });

    app.post("/api/companies", async (req, res) => {
      const company = req.body;

      const newCompany = {
        ...company,
        createdAt: new Date(),
      };
      const result = await companyCollection.insertOne(newCompany);
      res.send(result);
    });

    app.post("/api/applications", async (req, res) => {
      const application = req.body;

      const newApplication = {
        ...application,
        appliedAt: new Date(),
      };
      const result = await applicationsCollection.insertOne(newApplication);
      res.send(result);
    });

    app.post("/api/subscription", async (req, res) => {
      const subsData = req.body;

      const newSubsData = {
        ...subsData,
        subsAt: new Date(),
      };

      const result = await subscriptionsCollection.insertOne(newSubsData);

      // update the user planId
      // filter  with email
      const filter = { email: subsData.email };
      // update document query
      const updateDocument = {
        $set: {
          plan: subsData.planId,
        },
      };

      const updateResult = await userCollections.updateOne(filter, updateDocument);
      res.send({ result, updateResult });
    });

    // All Patch API

    // company related api
    app.patch("/api/companies/:id", logger, verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const updatedData = req.body;

        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: updatedData,
        };

        const result = await companyCollection.updateOne(filter, updateDoc);

        res.send(result);
      } catch (error) {
        console.error("Error updating company:", error);
        res.status(500).send({ message: "Internal server error", error: error.message });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
