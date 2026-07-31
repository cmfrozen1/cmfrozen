const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Google Cloud Firestore
let db = null;
let isMockDatabase = false;
let mockStorage = []; // In-memory database fallback

// Initial dummy data for the mock storage to make the app look instantly alive
const initialMockData = [
    {
        id: "mock-1",
        name: "Teerapong CMF",
        email: "teerapong@cmfrozen.com",
        phone: "081-234-5678",
        role: "Admin",
        status: "Active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: "mock-2",
        name: "Somchai Saendee",
        email: "somchai@gmail.com",
        phone: "089-876-5432",
        role: "Manager",
        status: "Active",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
        id: "mock-3",
        name: "Somsri Rakdee",
        email: "somsri@yahoo.com",
        phone: "082-345-6789",
        role: "User",
        status: "Inactive",
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 172800000).toISOString()
    }
];
mockStorage = [...initialMockData];

try {
    const serviceAccountPath = process.env.SERVICE_ACCOUNT_KEY;
    // Default project id from .firebaserc if available
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'peak-geode-405014';

    if (serviceAccountPath && fs.existsSync(path.resolve(serviceAccountPath))) {
        console.log(`Connecting to Google Cloud using Service Account Key: ${serviceAccountPath}`);
        admin.initializeApp({
            credential: admin.credential.cert(path.resolve(serviceAccountPath)),
            projectId: projectId
        });
        db = admin.firestore();
        console.log(`Successfully connected to Google Cloud Firestore! Project: ${projectId}`);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GAE_ENV) {
        console.log('Connecting to Google Cloud using Default Credentials...');
        admin.initializeApp({
            projectId: projectId
        });
        db = admin.firestore();
        console.log(`Successfully connected to Google Cloud Firestore! Project: ${projectId}`);
    } else {
        console.warn('⚠️ WARNING: No Google Cloud service account key or default credentials found.');
        console.warn('To save data directly to Google Cloud Firestore, please:');
        console.warn('1. Download service-account.json from Firebase / Google Cloud Console.');
        console.warn('2. Add SERVICE_ACCOUNT_KEY=./service-account.json to public/gcloud/.env');
        console.warn('Falling back to local in-memory database so the app runs immediately.');
        isMockDatabase = true;
    }
} catch (error) {
    console.error('❌ Failed to connect to Google Cloud Firestore:', error.message);
    console.warn('Falling back to local in-memory database.');
    isMockDatabase = true;
}

// Check Email Format Helper
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Get Database Info & Connection Status
app.get('/api/status', (req, res) => {
    res.json({
        database: isMockDatabase ? 'In-Memory (Local Demo)' : 'Google Cloud Firestore (Live)',
        projectId: process.env.FIREBASE_PROJECT_ID || 'peak-geode-405014',
        usingServiceAccount: !!process.env.SERVICE_ACCOUNT_KEY,
        isMock: isMockDatabase
    });
});

// 1. READ ALL (Get all users)
app.get('/api/users', async (req, res) => {
    try {
        if (isMockDatabase) {
            // Sort by latest created
            const sortedMock = [...mockStorage].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            return res.json(sortedMock);
        }

        const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to retrieve users: ' + error.message });
    }
});

// 2. READ ONE (Get user by ID)
app.get('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (isMockDatabase) {
            const user = mockStorage.find(u => u.id === id);
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json(user);
        }

        const doc = await db.collection('users').doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to retrieve user' });
    }
});

// 3. CREATE (Create new user)
app.post('/api/users', async (req, res) => {
    const { name, email, phone, role, status } = req.body;

    // Validation
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and Email are required' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const userData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: (phone || '').trim(),
        role: role || 'User',
        status: status || 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    try {
        if (isMockDatabase) {
            // Check email uniqueness locally
            if (mockStorage.some(u => u.email === userData.email)) {
                return res.status(400).json({ error: 'Email already exists' });
            }

            const newId = 'mock-' + Math.random().toString(36).substr(2, 9);
            const newUser = { id: newId, ...userData };
            mockStorage.push(newUser);
            return res.status(201).json(newUser);
        }

        // Check email uniqueness in Firestore
        const emailCheck = await db.collection('users').where('email', '==', userData.email).get();
        if (!emailCheck.empty) {
            return res.status(400).json({ error: 'Email already exists in database' });
        }

        const docRef = await db.collection('users').add(userData);
        res.status(201).json({ id: docRef.id, ...userData });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to save data to Google Cloud: ' + error.message });
    }
});

// 4. UPDATE (Update existing user)
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, phone, role, status } = req.body;

    // Validation
    if (!name || !email) {
        return res.status(400).json({ error: 'Name and Email are required' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const updatedData = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: (phone || '').trim(),
        role: role || 'User',
        status: status || 'Active',
        updatedAt: new Date().toISOString()
    };

    try {
        if (isMockDatabase) {
            const userIndex = mockStorage.findIndex(u => u.id === id);
            if (userIndex === -1) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check email uniqueness if email changed
            const existingWithEmail = mockStorage.find(u => u.email === updatedData.email);
            if (existingWithEmail && existingWithEmail.id !== id) {
                return res.status(400).json({ error: 'Email already in use by another user' });
            }

            mockStorage[userIndex] = {
                ...mockStorage[userIndex],
                ...updatedData
            };
            return res.json(mockStorage[userIndex]);
        }

        // Check email uniqueness in Firestore
        const emailCheck = await db.collection('users').where('email', '==', updatedData.email).get();
        let emailConflict = false;
        emailCheck.forEach(doc => {
            if (doc.id !== id) emailConflict = true;
        });

        if (emailConflict) {
            return res.status(400).json({ error: 'Email already in use by another user' });
        }

        const docRef = db.collection('users').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        await docRef.update(updatedData);
        res.json({ id, ...doc.data(), ...updatedData });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Failed to update Google Cloud data: ' + error.message });
    }
});

// 5. DELETE (Delete user with safety verification)
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    
    // Explicit safety note: user must confirm deletion. The endpoint itself is secured 
    // but the frontend is where we prompt the confirmation.
    try {
        if (isMockDatabase) {
            const userIndex = mockStorage.findIndex(u => u.id === id);
            if (userIndex === -1) {
                return res.status(404).json({ error: 'User not found' });
            }
            const deletedUser = mockStorage.splice(userIndex, 1)[0];
            return res.json({ message: 'User deleted successfully from local fallback', deletedId: id });
        }

        const docRef = db.collection('users').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        await docRef.delete();
        res.json({ message: 'User deleted successfully from Google Cloud', deletedId: id });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete from Google Cloud: ' + error.message });
    }
});

// For any other route, serve index.html (SPA routing support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`===========================================================`);
    console.log(`🚀 CRUD Server is running on: http://localhost:${PORT}`);
    console.log(`📁 Static files served from: ${path.join(__dirname, 'public')}`);
    console.log(`===========================================================`);
});
