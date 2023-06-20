const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_TEST_API_KEY);
const app = express()
const port = process.env.PORT | 5000

app.use(cors());
app.use(express.json())

const verifyAccessWithJwtToken = (req, res, next) => {

    const authorization = req.headers.authorization;

    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    const accessToken = authorization.split(' ')[1];

    jwt.verify(accessToken, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}

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
        client.connect();

        // database collection 
        const usersCollection = client.db('sportsZone').collection('users');
        const classCollection = client.db('sportsZone').collection('classes');
        const instructorCollection = client.db('sportsZone').collection('instructors');
        const selectedClassCollection = client.db('sportsZone').collection('selectedclass');
        const paymentsCollection = client.db('sportsZone').collection('payment');

        // Verify Admin Middleware 
        const checkAdminOrInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin' && user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access!' })
            }
            next();
        }

        // Create jwt token
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ accessToken });
        })

        // users Collection Works
        app.post('/users', async (req, res) => {
            const users = req.body;
            const query = { email: users.email }
            const loggedInUser = await usersCollection.findOne(query);
            if (loggedInUser) {
                return res.send({ message: 'Already logged In' })
            }
            const result = await usersCollection.insertOne(users);
            res.send(result)
        })

        app.get('/users', verifyAccessWithJwtToken, checkAdminOrInstructor, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result)
        })

        // Verify admin by email 
        app.get('/users/admin/:email', verifyAccessWithJwtToken, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ admin: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })

        // Verify instructor by email 
        app.get('/users/instructor/:email', verifyAccessWithJwtToken, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.send({ instructor: false })
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result)
        })

        // classes collection Works
        app.post('/classes', verifyAccessWithJwtToken, checkAdminOrInstructor, async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass);
            res.send(result)
        })

        // load all class for users
        app.get('/classes', async (req, res) => {
            const query = { status: "Approved" };
            const result = await classCollection.find(query).toArray();
            res.send(result)
        })

        // load sorted class in home
        app.get('/popularClasses', async (req, res) => {
            const query = { status: "Approved" };
            const result = await classCollection.find(query).sort({ numStudents: -1 }).limit(6).toArray();
            res.send(result)
        })

        // manage  all classes by admin 
        app.get('/manageClasses', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        })

        // my classes for instructor 
        app.get('/classes/email', verifyAccessWithJwtToken, checkAdminOrInstructor, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await classCollection.find(query).toArray();
            res.send(result)
        })

        app.patch('/manageClasses/pending/:id', verifyAccessWithJwtToken, checkAdminOrInstructor, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateData = {
                $set: {
                    status: 'Approved',
                },
            };
            const result = await classCollection.updateOne(filter, updateData);
            res.send(result);
        })

        app.patch('/manageClasses/denied/:id', verifyAccessWithJwtToken, checkAdminOrInstructor, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateData = {
                $set: {
                    status: 'Denied'
                },
            };
            const result = await classCollection.updateOne(filter, updateData);
            res.send(result);
        })

        app.patch('/classes-update-enroll', verifyAccessWithJwtToken, async (req, res) => {
            const _ids = req.body.map(id => new ObjectId(id));
            try {
                const updatedClasses = await classCollection.updateMany(
                    { _id: { $in: _ids } },
                    { $inc: { numStudents: 1, availableSeats: -1 } }
                );
                res.send(updatedClasses);
            } catch (err) {
                console.error(err);
                res.status(500).json({ message: 'Server Error' });
            }
        })

        app.delete('/classes/:id', verifyAccessWithJwtToken, checkAdminOrInstructor, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classCollection.deleteOne(query);
            res.send(result)
        })

        // instructor collection Works
        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().sort({ numStudents: -1 }).toArray();
            res.send(result)
        })

        // Selected class collection Works
        app.post('/selectedclass', async (req, res) => {
            const selected = req.body;
            const result = await selectedClassCollection.insertOne(selected);
            res.send(result);
        })

        app.get('/selectedclass', verifyAccessWithJwtToken, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([])
            }
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
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

        // Payment Works 

        app.post('/create-payment-intent', verifyAccessWithJwtToken, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payment', verifyAccessWithJwtToken, async (req, res) => {
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);
            const query = { _id: { $in: payment.class.map(id => new ObjectId(id)) } }
            const deleteResult = await selectedClassCollection.deleteMany(query)
            res.send({ result, deleteResult });
        })

        app.get('/payment', verifyAccessWithJwtToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const options = {
                sort: { date: -1 }
            };
            const result = await paymentsCollection.find(query, options).toArray();
            res.send(result);
        })

        app.get('/paymentInfo', verifyAccessWithJwtToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const options = {
                projection: { _id: 1, classImage: 1, className: 1, date: 1, classID: 1 },
            };
            const result = await paymentsCollection.find(query, options).toArray();
            res.send(result);
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