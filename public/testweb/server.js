const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
// Render จะกำหนด Port ให้ผ่าน process.env.PORT
const port = process.env.PORT || 3000;

// ตั้งค่า CORS ให้ยอมรับจากทุกที่ หรือเจาะจง Firebase ของคุณ
app.use(cors({
    origin: '*', // หรือเปลี่ยนเป็น 'https://cmfrozen-387fd.web.app' เพื่อความปลอดภัย
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static('public'));

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function startServer() {
    try {
        await client.connect();
        const db = client.db('testdb');
        const users = db.collection('users');
        console.log("✅ Connected to MongoDB Atlas");

        // API Endpoints
        app.get('/api/users', async (req, res) => {
            try {
                const data = await users.find({}).sort({ _id: -1 }).toArray();
                res.json(data);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.post('/api/users', async (req, res) => {
            try {
                const newUser = { ...req.body, createdAt: new Date() };
                const result = await users.insertOne(newUser);
                res.status(201).json(result);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.put('/api/users/:id', async (req, res) => {
            try {
                const result = await users.updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $set: { ...req.body, updatedAt: new Date() } }
                );
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.delete('/api/users/:id', async (req, res) => {
            try {
                const result = await users.deleteOne({ _id: new ObjectId(req.params.id) });
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // สั่งให้ Server ทำงาน
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Server is running on port ${port}`);
        });

    } catch (e) {
        console.error("❌ Connection Error:", e);
    }
}

startServer();
