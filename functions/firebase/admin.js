const admin = require('firebase-admin');
const firebaseConfig = require("./firebaseConfig");
let serviceAccount;
require('dotenv').config();

try {
    serviceAccount = require("../sensebuy-e8add-firebase-adminsdk-e0lb2-1ddd888864.json");
} catch (error) {
    console.error("Failed to load serviceAccount. Ensure the file exists and is configured correctly.");
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        ...firebaseConfig
    });
} catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error.message);
    process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage();
const functions = require('firebase-functions');

if (process.env.NODE_ENV === 'development') {
    try {
        db.settings({
            host: "localhost:8080",
            ssl: false
        });
        console.log("Firestore Emulator is set to use localhost:8080");
    } catch (error) {
        console.error("Failed to set Firestore Emulator settings:", error.message);
    }
}

module.exports = { 
    admin,
    auth,
    db,
    storage,
    functions,
};
