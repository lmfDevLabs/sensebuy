// node modules
import os from 'os';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

// firebase 
import { storage } from '../firebase/admin.js';
// bucket cs
const bucket = storage.bucket("gs://sensebuy-e8add.appspot.com/");

const DEFAULT_FIREBASE_DOWNLOAD_TIMEOUT_MS = 20000;

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1']);

let loggedInvalidEmulatorHost = null;

const sanitizeUrlForLogs = (urlObj) => {
    const clone = new URL(urlObj.toString());
    if (clone.searchParams.has('token')) {
        clone.searchParams.set('token', '[redacted]');
    }
    return clone.toString();
};

const getStorageEmulatorConfig = () => {
    const rawHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
    if (!rawHost) {
        return null;
    }

    try {
        const url = rawHost.includes('://') ? new URL(rawHost) : new URL(`http://${rawHost}`);
        return {
            host: url.hostname,
            port: url.port || '9199',
        };
    } catch (error) {
        if (rawHost !== loggedInvalidEmulatorHost) {
            loggedInvalidEmulatorHost = rawHost;
            console.warn(`[Firebase Storage] Ignoring invalid FIREBASE_STORAGE_EMULATOR_HOST value "${rawHost}": ${error.message}`);
        }
        return null;
    }
};

const isFirebaseStorageHost = (hostname) => {
    if (!hostname) {
        return false;
    }

    if (hostname === 'firebasestorage.googleapis.com' || hostname === 'storage.googleapis.com') {
        return true;
    }

    if (hostname.endsWith('.storage.googleapis.com') || hostname.endsWith('.appspot.com')) {
        return true;
    }

    return false;
};

const prepareFirebaseStorageRequest = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') {
        throw new Error('A Firebase Storage download URL must be provided.');
    }

    let candidateUrl = rawUrl.trim();

    if (candidateUrl.startsWith('gs://')) {
        const withoutScheme = candidateUrl.slice('gs://'.length);
        const slashIndex = withoutScheme.indexOf('/');

        if (slashIndex === -1) {
            throw new Error(`Invalid gs:// URL "${rawUrl}". Expected format gs://<bucket>/<path>.`);
        }

        const bucketName = withoutScheme.slice(0, slashIndex);
        const objectPath = withoutScheme.slice(slashIndex + 1);
        const encodedPath = encodeURIComponent(objectPath);
        candidateUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media`;
    }

    let urlObj;

    try {
        urlObj = new URL(candidateUrl);
    } catch (error) {
        throw new Error(`Invalid Firebase Storage URL "${rawUrl}": ${error.message}`);
    }

    const emulatorConfig = getStorageEmulatorConfig();
    let isEmulator = false;

    if (emulatorConfig) {
        const emulatorHostMatches = urlObj.hostname === emulatorConfig.host;
        const shouldForceEmulator = emulatorHostMatches || LOCALHOST_NAMES.has(urlObj.hostname) || isFirebaseStorageHost(urlObj.hostname);

        if (shouldForceEmulator) {
            urlObj.protocol = 'http:';
            urlObj.hostname = emulatorConfig.host;
            urlObj.port = emulatorConfig.port;
            isEmulator = true;
        }
    } else if (LOCALHOST_NAMES.has(urlObj.hostname) && urlObj.protocol === 'https:') {
        urlObj.protocol = 'http:';
    }

    if (isEmulator && !urlObj.port) {
        urlObj.port = emulatorConfig.port;
    }

    const sanitizedUrl = sanitizeUrlForLogs(urlObj);

    return { url: urlObj, sanitizedUrl, isEmulator };
};

const isFirebaseStorageUrl = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return false;
    }

    const trimmed = rawUrl.trim();

    if (trimmed.startsWith('gs://')) {
        return true;
    }

    try {
        const urlObj = new URL(trimmed);
        const emulatorConfig = getStorageEmulatorConfig();

        if (emulatorConfig && urlObj.hostname === emulatorConfig.host) {
            return true;
        }

        if (LOCALHOST_NAMES.has(urlObj.hostname)) {
            return urlObj.pathname.includes('/o/') || urlObj.pathname.includes('/b/');
        }

        return isFirebaseStorageHost(urlObj.hostname);
    } catch (error) {
        return false;
    }
};

const createNetworkError = (source, error, sanitizedUrl, timeoutMs) => {
    if (error.name === 'AbortError') {
        const abortError = new Error(`[${source}] Request to ${sanitizedUrl} timed out after ${timeoutMs}ms.`);
        abortError.code = 'ETIMEDOUT';
        abortError.cause = error;
        return abortError;
    }

    if (error.code === 'ECONNREFUSED') {
        const connError = new Error(`[${source}] Connection refused while calling ${sanitizedUrl}. Verify that the Firebase Storage emulator is running and the host/port are correct.`);
        connError.code = 'ECONNREFUSED';
        connError.cause = error;
        return connError;
    }

    if (error.code === 'ETIMEDOUT') {
        const socketTimeoutError = new Error(`[${source}] Network timeout while requesting ${sanitizedUrl}.`);
        socketTimeoutError.code = 'ETIMEDOUT';
        socketTimeoutError.cause = error;
        return socketTimeoutError;
    }

    const genericError = new Error(`[${source}] Network error while fetching ${sanitizedUrl}: ${error.message}`);
    if (error.code) {
        genericError.code = error.code;
    }
    genericError.cause = error;
    return genericError;
};

const downloadFileBufferFromFirebaseUrl = async (rawUrl, options = {}) => {
    const { timeoutMs = DEFAULT_FIREBASE_DOWNLOAD_TIMEOUT_MS } = options;
    const { url, sanitizedUrl, isEmulator } = prepareFirebaseStorageRequest(rawUrl);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response;

    try {
        response = await fetch(url.toString(), {
            method: 'GET',
            headers: isEmulator ? { Authorization: 'Bearer owner' } : undefined,
            signal: controller.signal,
        });
    } catch (error) {
        clearTimeout(timeoutHandle);
        const networkError = createNetworkError('Firebase Storage', error, sanitizedUrl, timeoutMs);
        console.error(networkError.message);
        throw networkError;
    }

    clearTimeout(timeoutHandle);

    if (!response.ok) {
        let message = `[Firebase Storage] HTTP ${response.status} ${response.statusText} while fetching ${sanitizedUrl}.`;
        if (response.status === 403) {
            message += ' Confirm that the download token is valid or that the emulator rules allow access.';
        }

        const httpError = new Error(message);
        httpError.status = response.status;
        httpError.code = `HTTP_${response.status}`;
        console.error(httpError.message);
        throw httpError;
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();

    return {
        buffer: Buffer.from(arrayBuffer),
        contentType,
        sanitizedUrl,
    };
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
    isFirebaseStorageUrl,
};

