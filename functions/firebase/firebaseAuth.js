
const { admin, db } = require('./admin');

module.exports = async (req, res, next) => {
    let idToken;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No token found');
        return res.status(403).json({ error: 'Unauthorized' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken); // Ensure the second parameter is context-appropriate
        req.user = decodedToken;
        // console.log({decodedToken})
        
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        

        if (!userDoc.exists) {
            throw new Error('User not found in the database');
        }
        
        const userData = userDoc.data();
        req.user.uid = decodedToken.uid
        req.user.username = userData.username;
        req.user.type = userData.type;
        // Additional user data...
        // console.log({userData})
    
        return next();
    } catch (err) {
        console.error('Error while verifying token ', err);
        return res.status(403).json({ error: err.message });
    }
};
