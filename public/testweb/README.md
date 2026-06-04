# MongoDB CRUD + Firebase Deploy

Simple Express CRUD app for MongoDB Atlas. The same Express app runs locally with `node server.js` and on Firebase Functions through the exported `api` function.

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace `<db_password>` in `MONGODB_URI`.
3. Run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Firebase setup

Select or create your Firebase project:

```bash
firebase login
firebase use --add
```

Store the MongoDB connection string as a Firebase Functions secret:

```bash
firebase functions:secrets:set MONGODB_URI
```

Deploy Hosting and Functions:

```bash
npm run deploy
```

Firebase Hosting serves `public/index.html`. Requests to `/api/**` and `/health` are rewritten to the `api` Cloud Function.
