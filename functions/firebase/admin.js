const admin = require('firebase-admin');
const firebaseConfig = require("./firebaseConfig")
let serviceAccount = require("../sensebuy-e8add-firebase-adminsdk-e0lb2-1ddd888864.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    ...firebaseConfig
});

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage(); 

module.exports = { 
    admin,
    auth,
    db,
    storage 
}; 