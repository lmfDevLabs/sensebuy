// // -- Imports de la Admin SDK (ES Modules) --
// import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
// import { getAuth } from 'firebase-admin/auth';
// import { getFirestore } from 'firebase-admin/firestore';
// import { getStorage } from 'firebase-admin/storage';
// import firebaseConfig from"./firebaseConfig.js"
// import serviceAccount from '../../sensebuy-e8add-firebase-adminsdk-e0lb2-1ddd888864.json' with { type: 'json' };

// // Necesitarías definir isEmulator y isRunningInGCP
// // Por ejemplo:
// const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIRESTORE_EMULATOR_HOST !== undefined;
// const isRunningInGCP = process.env.K_SERVICE !== undefined || process.env.GOOGLE_CLOUD_PROJECT !== undefined;

// // -- Tu configuración de serviceAccount y firebaseConfig (ejemplo) --
// // Para local/dev, descomenta y apunta a tu archivo de service account
// // const serviceAccount = require("../../sensebuy-e8add-firebase-adminsdk-e0lb2-1ddd888864.json");
// // const serviceAccount = null; // Reemplaza esto con la carga de tu service account para desarrollo local

// // firebaseConfig a menudo se auto-popula en Cloud Functions, pero si la necesitas explícitamente:
// // const firebaseConfig = {
// //     // databaseURL: 'https://DATABASE_NAME.firebaseio.com', // Ejemplo
// //     // storageBucket: 'PROJECT_ID.appspot.com', // Ejemplo
// //     projectId: 'sensebuy-e8add'
// // };

// // -- Inicialización de la aplicación Firebase Admin --
// let firebaseAdminApp;

// try {
    
//     if (!getApps().length) {
//         if (isEmulator || !isRunningInGCP) {
//             // Desarrollo local o testing con serviceAccount
//             if (!serviceAccount) {
//                 console.warn("⚠️ serviceAccount.json no definido para entorno local/dev. Esto podría causar problemas si no usas credenciales predeterminadas del entorno.");
//                 // Puedes optar por salir o intentar inicializar sin serviceAccount si el entorno de ejecución lo permite
//             }

//             firebaseAdminApp = initializeApp({
//                 credential: serviceAccount ? cert(serviceAccount) : undefined,
//                 ...firebaseConfig // Incluye otras configuraciones si son necesarias
//             });
//             console.log("✅ Firebase Admin initialized with **serviceAccount.json** (local/dev).");
//         } else {
//             // Producción (Firebase Functions, Cloud Run)
//             firebaseAdminApp = initializeApp(); // Auto-detecta credenciales y config
//             console.log("✅ Firebase Admin initialized with **default credentials** (GCP production).");
//         }
//     } else {
//         firebaseAdminApp = getApp();
//         console.log("✅ Firebase Admin app already initialized, retrieving existing instance.");
//     }
// } catch (error) {
//     console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
//     process.exit(1); // Sale si la inicialización falla
// }

// // -- Instancias de los servicios --
// const auth = getAuth(firebaseAdminApp);
// const db = getFirestore(firebaseAdminApp);
// const storage = getStorage(firebaseAdminApp);


// // -- Opcional: Configurar Firestore Emulator en dev --
// if (isEmulator && process.env.NODE_ENV === 'development') { // Usar isEmulator para asegurar que estamos en un entorno de emulación
//     try {
//         // connectFirestoreEmulator(db, 'localhost', 8080, { ssl: false });
//         console.log("✅ Firestore Emulator is set to use localhost:8080");
//     } catch (error) {
//         console.error("❌ Failed to set Firestore Emulator settings:", error.message);
//     }
// }

// // -- Exportaciones --
// export {
//     firebaseAdminApp, // Exporta la instancia de la app si otros módulos la necesitan
//     auth,
//     db,
//     storage,
//     // Si tus funciones de Cloud Functions están en el mismo archivo o necesitas exportar algo de ellas
//     // por ejemplo, si tu archivo es 'index.ts' y declaras funciones como 'export const myFunc = ...'
//     // no necesitas un 'functions' object aquí.
// };


import admin from 'firebase-admin';

/**
 * Inicialización única de Admin SDK:
 * - PROD (GCP: Cloud Functions/Run): initializeApp() sin credencial explícita (usa ADC).
 * - LOCAL: usa GOOGLE_APPLICATION_CREDENTIALS (ruta al .json) o FIREBASE_SERVICE_ACCOUNT_B64 (json base64).
 */
function buildInitOptions() {
  // Si corre en GCP/Functions/Run, ADC ya está disponible. No pases credential.
  const inGcp = !!(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
  if (inGcp) return {};

  // Local: si expones el JSON como base64, úsalo.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    const json = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
    return {
      credential: admin.credential.cert(json),
      projectId: json.project_id,
      storageBucket: `${json.project_id}.appspot.com`,
    };
  }

  // Local: si usas GOOGLE_APPLICATION_CREDENTIALS, admin la detecta sin options.
  return {};
}

// Evita doble init
if (!admin.apps.length) {
  admin.initializeApp(buildInitOptions());
}

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage();

db.settings({ ignoreUndefinedProperties: true });

// Logs útiles al arrancar
const projectId =
  admin.app().options.projectId ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  '(unknown)';

console.log('[admin] projectId:', projectId);
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  console.log('[admin] Using Auth Emulator:', process.env.FIREBASE_AUTH_EMULATOR_HOST);
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log('[admin] Using Firestore Emulator:', process.env.FIRESTORE_EMULATOR_HOST);
}
if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  console.log('[admin] Using Storage Emulator:', process.env.FIREBASE_STORAGE_EMULATOR_HOST);
}

export { admin, auth, db, storage, projectId };

