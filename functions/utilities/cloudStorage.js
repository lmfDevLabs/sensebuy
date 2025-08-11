// node modules
import os from 'os';
import fs from 'fs';
import path from 'path';

// firebase 
import { storage } from '../firebase/admin.js';
// bucket cs
const bucket = storage.bucket("gs://sensebuy-e8add.appspot.com/");

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
    deleteFileToCloudStorage
};

