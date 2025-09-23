// node modules
import http from 'http';
import https from 'https';
import os from 'os';
import fs from 'fs';
import path from 'path';

// firebase 
import { storage } from '../firebase/admin.js';
// bucket cs
const bucket = storage.bucket("gs://sensebuy-e8add.appspot.com/");

const FIREBASE_STORAGE_HOST = 'firebasestorage.googleapis.com';
const FIREBASE_API_VERSION = 'v0';

const parseFirebaseStorageUrl = (rawUrl) => {
    if (!rawUrl) {
        return null;
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(rawUrl);
    } catch (error) {
        return null;
    }

    if (parsedUrl.hostname !== FIREBASE_STORAGE_HOST) {
        return null;
    }

    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    if (segments.length < 5) {
        return null;
    }

    const [version, bucketSegmentLabel, bucketName, objectSegmentLabel, ...objectSegments] = segments;
    if (version !== FIREBASE_API_VERSION || bucketSegmentLabel !== 'b' || objectSegmentLabel !== 'o' || !bucketName || objectSegments.length === 0) {
        return null;
    }

    const encodedObjectPath = objectSegments.join('/');

    let decodedObjectPath;
    try {
        decodedObjectPath = decodeURIComponent(encodedObjectPath);
    } catch (error) {
        decodedObjectPath = encodedObjectPath;
    }

    return {
        bucket: bucketName,
        encodedObjectPath,
        objectPath: decodedObjectPath,
        url: parsedUrl,
    };
};

const downloadFileBufferFromFirebaseUrl = async (firebaseUrl, parsedInfo = null) => {
    const parsed = parsedInfo ?? parseFirebaseStorageUrl(firebaseUrl);
    if (!parsed) {
        throw new Error('Invalid Firebase Storage download URL');
    }

    const { bucket: bucketName, encodedObjectPath, url: parsedUrl } = parsed;
    const searchParams = new URLSearchParams(parsedUrl.searchParams);
    if (!searchParams.has('alt')) {
        searchParams.set('alt', 'media');
    }

    const queryString = searchParams.toString();
    const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    const useEmulator = Boolean(emulatorHost);
    const requestProtocol = useEmulator ? 'http:' : 'https:';
    const requestHost = useEmulator ? emulatorHost : FIREBASE_STORAGE_HOST;
    const requestPath = `/${FIREBASE_API_VERSION}/b/${bucketName}/o/${encodedObjectPath}`;
    const requestUrl = `${requestProtocol}//${requestHost}${requestPath}${queryString ? `?${queryString}` : ''}`;

    const client = requestProtocol === 'http:' ? http : https;

    return new Promise((resolve, reject) => {
        const req = client.get(requestUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Request Failed. Status Code: ${response.statusCode}`));
                response.resume();
                return;
            }

            const data = [];
            response.on('data', (chunk) => data.push(chunk));
            response.on('end', () => {
                resolve({
                    buffer: Buffer.concat(data),
                    contentType: response.headers['content-type'],
                });
            });
            response.on('error', reject);
        });

        req.on('error', reject);
    });
};

// upload files to cloud storage
const uploadFileToCloudStorage = async (tempFilePath, cloudStoragePath, mimetype) => {
    try {
        console.log('uploadFileToBucket');

        await bucket.upload(tempFilePath, {
            destination: cloudStoragePath,
            resumable: false,
            metadata: {
                contentType: mimetype
            }
        });

        console.log(`Archivo subido con éxito a ${cloudStoragePath}`);

        // Retorno útil
        return {
            success: true,
            path: cloudStoragePath,
            mime: mimetype,
            uploadedAt: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error en uploadFileToCloudStorage:', error);
        throw error; // Importante: relanza para que el tracer capture el fallo
    }
};

// download files from cloud storage
const downloadFileOfCloudStorage = async (file) => {
    try {
        console.log('downloadFileOfCloudStorage');

        // Extrae el nombre del archivo y la ruta del directorio del path completo
        const filePathParts = file.split('/');
        const fileName = filePathParts.pop();
        const directoryPath = filePathParts.join('/');

        // Verificar si el archivo es .csv, .json, o .xlsx
        const isCSVFile = file.endsWith('.csv');
        const isJsonFile = file.endsWith('.json');
        const isXlsxFile = file.endsWith('.xlsx');

        if (isXlsxFile) {
            console.log('isXlsx');
            // El archivo es .xlsx, realizar las operaciones necesarias
        } else if (isCSVFile) {
            console.log('isCSV');
            // El archivo es .csv, realizar las operaciones necesarias
        } else if (isJsonFile) {
            // print
            console.log('isJson');

            // Crea un directorio temporal que refleje la estructura del path
            const tempDirPath = path.join(os.tmpdir(), directoryPath);
            fs.mkdirSync(tempDirPath, { recursive: true });

            // Crea un camino temporal para el archivo, asegurándose de que el nombre del archivo no contenga rutas que no existan
            const tempFilePath = path.join(tempDirPath, fileName);
            
            // Referencia al archivo en Cloud Storage
            const fileRef = bucket.file(file);
            
            // Asegurarse de que el directorio donde vas a guardar el archivo exista
            await fileRef.download({destination: tempFilePath});
            console.log(`Archivo JSON descargado correctamente en ${tempFilePath}`);

            try {
                // Intenta leer el archivo para confirmar que fue descargado correctamente
                const fileContent = fs.readFileSync(tempFilePath, {encoding: 'utf8'});
                // console.log('Contenido del archivo antes de parsear:', fileContent);
                const parsedJson = JSON.parse(fileContent);
                console.log('Contenido del archivo JSON:', parsedJson);
            } catch (error) {
                console.error(`Error al leer el archivo descargado: ${error.message}`);
            }

            try {
                // Verifica si el archivo temporal existe y si es un archivo
                const stats = fs.statSync(tempFilePath);
                console.log(`Archivo temporal verificado correctamente: ${tempFilePath}`);
            } catch (error) {
                console.error(`Error al verificar el archivo temporal: ${error.message}`);
            }
            return tempFilePath;
        }
    } catch (error) {
        console.error('downloadFileOfCloudStorage:', error);
    }
}

// delete files from cloud storage
const deleteFileToCloudStorage = async () => {
}

export {
    uploadFileToCloudStorage,
    downloadFileOfCloudStorage,
    deleteFileToCloudStorage,
    downloadFileBufferFromFirebaseUrl,
    parseFirebaseStorageUrl
};

