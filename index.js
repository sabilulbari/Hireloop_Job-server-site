const express = require('express')
const cors = require('cors');
const app = express()
const port = 5000
require('dotenv').config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.get('/', (req, res) => {
    res.send('Hello World!')
})




const uri = process.env.MONGO_DB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();


        const database = client.db("hireloop_db");
        const jobCollection = database.collection("jobs");
        const companyCollection = database.collection("companies");

        app.get('/api/jobs', async(req, res) =>{
            const query = {};
            if(req.query.companyId){
                query.companyId = req.query.companyId;
            }
            if(req.query.status){
                query.status = req.query.status;
            }

            const cursor = jobCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get("/api/my/companies", async (req, res) => {
          const query = {};
          if (req.query.recruiterId) {
            query.recruiterId = req.query.recruiterId;
          }
          const result = await companyCollection.findOne(query);

          res.send(result || {});
        });

        app.get("/api/jobs/:jobId", async(req, res)=>{
            const { jobId }= req.params;

            const query = {_id: new ObjectId(jobId)}

            const result = await jobCollection.findOne(query);
            res.send(result)
        })



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
          const job = req.body;
          const result = await companyCollection.insertOne(job);
          res.send(result);
        });


        // company related api
        app.patch("/api/companies/:id", async (req, res) => {
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
    console.log(`Example app listening on port ${port}`)
})