// const { admin, db } = require('./admin');
// import { admin, db } from './admin'
import { auth, db } from './admin.js'

// const firebaseAuth = async (req, res, next) => {
//     let idToken;

//     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
//         idToken = req.headers.authorization.split('Bearer ')[1];
//     } else {
//         console.error('No token found');
//         return res.status(403).json({ error: 'Unauthorized' });
//     }

//     try {
//         const decodedToken = await admin.auth().verifyIdToken(idToken); // Ensure the second parameter is context-appropriate
//         req.user = decodedToken;
//         // console.log({decodedToken})
        
//         const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        

//         if (!userDoc.exists) {
//             throw new Error('User not found in the database');
//         }
        
//         const userData = userDoc.data();
//         req.user.uid = decodedToken.uid
//         req.user.username = userData.username;
//         req.user.type = userData.type;
//         // Additional user data...
//         // console.log({userData})
    
//         return next();
//     } catch (err) {
//         console.error('Error while verifying token ', err);
//         return res.status(403).json({ error: err.message });
//     }
// };

const firebaseAuth = async (req,res,next) => { // Considera tipar req, res, next
    let idToken

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('firebaseAuth: No token found in authorization header.');
        return res.status(401).json({ error: 'Unauthorized: No token provided or malformed header.' }); // 401 para "Unauthorized"
    }

    try {
        // Usa la instancia 'auth' importada directamente
        const decodedToken = await auth.verifyIdToken(idToken);
        req.user = decodedToken; // El objeto 'decodedToken' ya contiene 'uid'

        // console.log({decodedToken})

        // Usa la instancia 'db' importada directamente
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();

        if (!userDoc.exists) {
            // Si el usuario existe en Firebase Auth pero no en tu colección 'users'
            console.error(`firebaseAuth: User ${decodedToken.uid} found in Auth but not in Firestore /users collection.`);
            return res.status(404).json({ error: 'User profile not found.' }); // 404 para "Not Found"
        }

        const userData = userDoc.data();
        // Ya tienes decodedToken.uid, así que no necesitas reasignarlo
        // req.user.uid = decodedToken.uid;
        req.user.username = userData?.username; // Usa optional chaining por si userData es undefined
        req.user.type = userData?.type;
        // Agrega cualquier otro dato de usuario que necesites de Firestore a req.user

        // console.log({userData})

        return next(); // Pasa al siguiente middleware o a la función de ruta
    } catch (err) { // Tipa 'err' como 'any' o un tipo de error más específico
        let errorMessage = 'Error verifying token.';
        let statusCode = 403; // Default for Forbidden

        // Manejo de errores específicos de verifyIdToken
        // Puedes importar FirebaseAuthError desde 'firebase-admin/auth' para tipar mejor
        if (err.code === 'auth/id-token-expired') {
            errorMessage = 'Your session has expired. Please sign in again.';
            statusCode = 401; // Token expirado, requiere re-autenticación
        } else if (err.code === 'auth/invalid-id-token') {
            errorMessage = 'Invalid authentication token. Please sign in again.';
            statusCode = 401; // Token inválido
        } else if (err.message) {
            errorMessage = err.message;
        }

        console.error('firebaseAuth: Error while verifying token:', errorMessage, err);
        return res.status(statusCode).json({ error: errorMessage });
    }
};
 
export default firebaseAuth;
