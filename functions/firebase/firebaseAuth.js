// const { admin, db } = require('./admin');
// import { admin, db } from './admin'

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

// import { auth, db } from './admin.js'
// const firebaseAuth = async (req,res,next) => { // Considera tipar req, res, next
//     let idToken

//     if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
//         idToken = req.headers.authorization.split('Bearer ')[1];
//     } else {
//         console.error('firebaseAuth: No token found in authorization header.');
//         return res.status(401).json({ error: 'Unauthorized: No token provided or malformed header.' }); // 401 para "Unauthorized"
//     }

//     try {
//         // Usa la instancia 'auth' importada directamente
//         const decodedToken = await auth.verifyIdToken(idToken);
//         req.user = decodedToken; // El objeto 'decodedToken' ya contiene 'uid'

//         // console.log({decodedToken})

//         // Usa la instancia 'db' importada directamente
//         const userDoc = await db.collection('users').doc(decodedToken.uid).get();

//         if (!userDoc.exists) {
//             // Si el usuario existe en Firebase Auth pero no en tu colección 'users'
//             console.error(`firebaseAuth: User ${decodedToken.uid} found in Auth but not in Firestore /users collection.`);
//             return res.status(404).json({ error: 'User profile not found.' }); // 404 para "Not Found"
//         }

//         const userData = userDoc.data();
//         // Ya tienes decodedToken.uid, así que no necesitas reasignarlo
//         // req.user.uid = decodedToken.uid;
//         req.user.username = userData?.username; // Usa optional chaining por si userData es undefined
//         req.user.type = userData?.type;
//         // Agrega cualquier otro dato de usuario que necesites de Firestore a req.user

//         // console.log({userData})

//         return next(); // Pasa al siguiente middleware o a la función de ruta
//     } catch (err) { // Tipa 'err' como 'any' o un tipo de error más específico
//         let errorMessage = 'Error verifying token.';
//         let statusCode = 403; // Default for Forbidden

//         // Manejo de errores específicos de verifyIdToken
//         // Puedes importar FirebaseAuthError desde 'firebase-admin/auth' para tipar mejor
//         if (err.code === 'auth/id-token-expired') {
//             errorMessage = 'Your session has expired. Please sign in again.';
//             statusCode = 401; // Token expirado, requiere re-autenticación
//         } else if (err.code === 'auth/invalid-id-token') {
//             errorMessage = 'Invalid authentication token. Please sign in again.';
//             statusCode = 401; // Token inválido
//         } else if (err.message) {
//             errorMessage = err.message;
//         }

//         console.error('firebaseAuth: Error while verifying token:', errorMessage, err);
//         return res.status(statusCode).json({ error: errorMessage });
//     }
// };
 
// export default firebaseAuth;

// functions/firebase/firebaseAuth.js
// import { auth, db, projectId } from './admin.js';

// function decodeJwtPayload(token) {
//   const parts = token.split('.');
//   if (parts.length !== 3) return null;
//   try {
//     return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
//   } catch {
//     return null;
//   }
// }

// const firebaseAuth = async (req, res, next) => {
//   const h = req.headers.authorization || '';
//   const m = h.match(/^Bearer\s+(.+)$/i);
//   if (!m) {
//     return res.status(401).json({ error: 'Unauthorized: Bearer <ID_TOKEN> required.' });
//   }
//   const idToken = m[1];

//   // Detección de mezcla emulador/prod antes de verificar
//   const p = decodeJwtPayload(idToken) || {};
//   const iss = p.iss || '';
//   const aud = p.aud || '';
//   const serverUsesEmu = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;
//   const tokenLooksEmu =
//     iss.includes('localhost') || iss.includes('securetoken.emulator') || aud === 'demo-project';

//   if (tokenLooksEmu && !serverUsesEmu) {
//     return res.status(401).json({
//       error: 'Emulator token sent to production verifier',
//       details: 'El token proviene del Auth Emulator, pero el backend no tiene FIREBASE_AUTH_EMULATOR_HOST.',
//     });
//   }
//   if (!tokenLooksEmu && serverUsesEmu) {
//     return res.status(401).json({
//       error: 'Production token sent to emulator verifier',
//       details: 'El token es de producción, pero el backend tiene FIREBASE_AUTH_EMULATOR_HOST activo.',
//     });
//   }

//   try {
//     // Verificación del ID token
//     const decoded = await auth.verifyIdToken(idToken /* , true */);

//     // Extra sanity check: proyecto consistente
//     if (decoded.aud && projectId && decoded.aud !== projectId) {
//       return res.status(401).json({
//         error: 'Token project mismatch',
//         details: `aud=${decoded.aud} pero Admin usa projectId=${projectId}`,
//       });
//     }

//     // Carga de perfil
//     const snap = await db.collection('users').doc(decoded.uid).get();
//     if (!snap.exists) return res.status(404).json({ error: 'User profile not found.' });

//     const userData = snap.data() || {};
//     req.user = {
//       uid: decoded.uid,
//       email: decoded.email || null,
//       ...decoded,
//       username: userData.username,
//       type: userData.type,
//     };

//     return next();
//   } catch (err) {
//     const code = err?.code || '';
//     let status = 403;
//     let msg = 'Error verifying token.';
//     if (code === 'auth/id-token-expired') { status = 401; msg = 'Your session has expired. Please sign in again.'; }
//     else if (code === 'auth/invalid-id-token') { status = 401; msg = 'Invalid authentication token. Please sign in again.'; }
//     else if (err?.message) { msg = err.message; }
//     console.error('firebaseAuth: verifyIdToken failed:', code || err?.name, msg);
//     return res.status(status).json({ error: msg });
//   }
// };

// export default firebaseAuth;


import { auth, db, projectId } from './admin.js';

const firebaseAuth = async (req, res, next) => {
  
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'Unauthorized: Bearer <ID_TOKEN> required.' });
  const idToken = m[1];

  // ==============================================
  // MODIFICAR ESTAS LÍNEAS PARA DEBUGGING
  console.log('[firebaseAuth] Token recibido (COMPLETO):', idToken);
  console.log('[firebaseAuth] Longitud del token recibido:', idToken.length);
  // ==============================================

  try {
    // Deja que el Admin SDK verifique según el entorno:
    // - Si tienes FIREBASE_AUTH_EMULATOR_HOST => acepta tokens del emulador
    // - Si no, verifica contra prod
    const decoded = await auth.verifyIdToken(idToken /* , true */);
    // ... el resto de tu código
    // Sanity check de proyecto (evita mezclar apps)
    if (decoded.aud && projectId && decoded.aud !== projectId) {
      return res.status(401).json({
        error: 'Token project mismatch',
        details: `aud=${decoded.aud} pero Admin usa projectId=${projectId}`,
      });
    }

    // Carga perfil
    const snap = await db.collection('users').doc(decoded.uid).get();
    if (!snap.exists) return res.status(404).json({ error: 'User profile not found.' });

    const userData = snap.data() || {};
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      ...decoded,
      username: userData.username,
      type: userData.type,
    };

    return next();
  } catch (err) {
    // Si realmente mandaste un token de prod al verificador de emulador (o viceversa),
    // aquí verás "invalid signature" o similar.
    const code = err?.code || '';
    let status = 403;
    let msg = 'Error verifying token.';
    if (code === 'auth/id-token-expired') { status = 401; msg = 'Your session has expired. Please sign in again.'; }
    else if (code === 'auth/invalid-id-token') { status = 401; msg = 'Invalid authentication token. Please sign in again.'; }
    else if (err?.message) { msg = err.message; }
    console.error('firebaseAuth: verifyIdToken failed:', code || err?.name, msg);
    return res.status(status).json({ error: msg });
  }
};

export default firebaseAuth;
