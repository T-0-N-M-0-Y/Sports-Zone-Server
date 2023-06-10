const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT | 5000

app.use(cors());
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.ddbcqih.mongodb.net/?retryWrites=true&w=majority`;

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
        await client.connect();

        // database collection 

        const usersCollection = client.db('sportsZone').collection('users');
        const classCollection = client.db('sportsZone').collection('classes');
        const instructorCollection = client.db('sportsZone').collection('instructors');
        const selectedClassCollection = client.db('sportsZone').collection('selectedclass');

        // users Collection

        app.post('/users', async (req, res) => {
            const users = req.body;
            const query = { email: users.email }
            const loggedInUser = await usersCollection.findOne(query);
            if (loggedInUser) {
                return res.send({ message: 'user already Exist' })
            }
            const result = await usersCollection.insertOne(users);
            res.send(result)
        })

        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        // classes collection 

        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        })

        // instructor collection 

        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result)
        })

        // Selected class collection 

        app.post('/selectedclass', async (req, res) => {
            const selected = req.body;
            const result = await selectedClassCollection.insertOne(selected);
            res.send(result);
        })

        app.get('/selectedclass', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            const query = { email: email }
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result)
        })


        app.delete('/selectedclass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result)
          })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        //await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})