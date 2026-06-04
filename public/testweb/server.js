const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path');
const { onRequest } = require('firebase-functions/v2/https');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const port = process.env.PORT || 3000;
const databaseName = process.env.MONGODB_DB || 'testdb';
const collectionName = process.env.MONGODB_COLLECTION || 'users';

let client;
let usersCollection;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function getMongoUri() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
        throw new Error('MONGODB_URI is not defined');
    }

    return uri;
}

async function getUsersCollection() {
    if (usersCollection) {
        return usersCollection;
    }

    if (!client) {
        client = new MongoClient(getMongoUri());
    }

    await client.connect();
    usersCollection = client.db(databaseName).collection(collectionName);
    await usersCollection.createIndex({ email: 1 });

    return usersCollection;
}

function parseObjectId(id) {
    if (!ObjectId.isValid(id)) {
        return null;
    }

    return new ObjectId(id);
}

function cleanUserPayload(body) {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const ageValue = body.age === undefined || body.age === '' || body.age === null
        ? null
        : Number(body.age);

    if (!name || !email) {
        return { error: 'Name and email are required' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: 'Valid email is required' };
    }

    if (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 0 || ageValue > 150)) {
        return { error: 'Age must be a number from 0 to 150' };
    }

    return {
        user: {
            name,
            email,
            age: ageValue
        }
    };
}

function handleApiError(res, err) {
    console.error('API Error:', err);

    if (err && err.code === 11000) {
        return res.status(409).json({ error: 'Email already exists' });
    }

    return res.status(500).json({ error: err.message || 'Internal server error' });
}

app.get('/health', async (req, res) => {
    try {
        await getUsersCollection();
        res.json({
            status: 'ok',
            database: databaseName,
            collection: collectionName,
            connected: true
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            connected: false,
            message: err.message
        });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await getUsersCollection();
        const data = await users.find({}).sort({ createdAt: -1, _id: -1 }).toArray();
        res.json(data);
    } catch (err) {
        handleApiError(res, err);
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const _id = parseObjectId(req.params.id);

        if (!_id) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        const users = await getUsersCollection();
        const user = await users.findOne({ _id });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json(user);
    } catch (err) {
        handleApiError(res, err);
    }
});

app.post('/api/users', async (req, res) => {
    try {
        const { user, error } = cleanUserPayload(req.body);

        if (error) {
            return res.status(400).json({ error });
        }

        const users = await getUsersCollection();
        const newUser = {
            ...user,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await users.insertOne(newUser);

        return res.status(201).json({ _id: result.insertedId, ...newUser });
    } catch (err) {
        handleApiError(res, err);
    }
});

app.put('/api/users/:id', async (req, res) => {
    try {
        const _id = parseObjectId(req.params.id);

        if (!_id) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        const { user, error } = cleanUserPayload(req.body);

        if (error) {
            return res.status(400).json({ error });
        }

        const users = await getUsersCollection();
        const updatedAt = new Date();
        const result = await users.findOneAndUpdate(
            { _id },
            { $set: { ...user, updatedAt } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json(result);
    } catch (err) {
        handleApiError(res, err);
    }
});

app.delete('/api/users/:id', async (req, res) => {
    try {
        const _id = parseObjectId(req.params.id);

        if (!_id) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        const users = await getUsersCollection();
        const result = await users.deleteOne({ _id });

        if (!result.deletedCount) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.json({ deletedCount: result.deletedCount });
    } catch (err) {
        handleApiError(res, err);
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server is running on port ${port}`);
        console.log(`MongoDB database: ${databaseName}, collection: ${collectionName}`);
    });
}

exports.api = onRequest(
    {
        region: 'asia-southeast1',
        secrets: ['MONGODB_URI']
    },
    app
);
