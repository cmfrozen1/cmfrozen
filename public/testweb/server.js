const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const uri = process.env.MONGODB_URI;
if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
}

// Log connection attempt (masked for safety)
console.log('🔌 Attempting to connect to MongoDB...');

const client = new MongoClient(uri);

async function startServer() {
    try {
        await client.connect();
        // Force database name to 'testdb' if not specified in URI to ensure consistency
        const db = client.db('testdb');
        const users = db.collection('users');
        console.log(`✅ Connected to MongoDB Atlas (Database: testdb)`);

        // Health Check
        app.get('/health', (req, res) => res.json({ 
            status: 'ok', 
            database: 'testdb',
            connected: true 
        }));

        // API Endpoints
        app.get('/api/users', async (req, res) => {
            try {
                const data = await users.find({}).sort({ _id: -1 }).toArray();
                res.json(data);
            } catch (err) {
                console.error('API GET Error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        app.post('/api/users', async (req, res) => {
            try {
                const { name, email } = req.body;
                if (!name || !email) {
                    return res.status(400).json({ error: 'Name and email are required' });
                }
                const newUser = { name, email, createdAt: new Date() };
                const result = await users.insertOne(newUser);
                res.status(201).json({ _id: result.insertedId, ...newUser });
            } catch (err) {
                console.error('API POST Error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        app.put('/api/users/:id', async (req, res) => {
            try {
                const { name, email } = req.body;
                const result = await users.updateOne(
                    { _id: new ObjectId(req.params.id) },
                    { $set: { name, email, updatedAt: new Date() } }
                );
                res.json(result);
            } catch (err) {
                console.error('API PUT Error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        app.delete('/api/users/:id', async (req, res) => {
            try {
                const result = await users.deleteOne({ _id: new ObjectId(req.params.id) });
                res.json(result);
            } catch (err) {
                console.error('API DELETE Error:', err);
                res.status(500).json({ error: err.message });
            }
        });

        // Fallback for SPA
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Server is running on port ${port}`);
        });

    } catch (e) {
        console.error("❌ Connection Error Detail:", e.message);
        // Keep server running but API will fail with 500
        app.get('/health', (req, res) => res.json({ status: 'error', message: e.message }));
        app.listen(port, '0.0.0.0', () => {
            console.log(`🚀 Server started in ERROR mode on port ${port}`);
        });
    }
}

startServer();
