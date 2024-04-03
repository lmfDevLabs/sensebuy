// node modules
const fs = require('fs');
const path = require('path');
const os = require('os');
// libs
const Busboy = require('busboy');
// utils
// cloud storage
const {
    uploadFileToCloudStorage,
    downloadFileOfCloudStorage,
} = require('../../utilities/cloudStorage');
// csv
const {
    convertExcelToCSV,
    extractDataFromCSV,
    updateGlobalCsvFile
} = require('../../utilities/csv');
// firestore
const {
    addDataToFirestore,
    saveEmbeddingsOnFirestore
} = require('../../utilities/firestore');
// embedings
const {
    processCSVAndGenerateEmbeddings,
    createArrayWithEmbeddings,
    
} = require('../../utilities/embeddings');


//post products with only a .csv file
exports.xlsx = async (req, res) => {
    
    // upload file to firestore
    const uploadFileToBucket = async (filepath, mimetype) => {
        console.log('uploadFileToBucket');
        await bucket.upload(filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: mimetype
                }
            }
        });
    };

    // convert excel to csv
    const convertExcelToCSV = async (filepath) => {
        try {
            console.log('convertExcelToCSV');
            const xlsx = require('xlsx');
    
            // Lee el archivo Excel
            const workbook = xlsx.readFile(filepath);
    
            // Obtiene el nombre de la primera hoja
            const firstSheetName = workbook.SheetNames[0];
    
            // Convierte la hoja a formato CSV
            const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);
    
            // Crea el nuevo nombre del archivo, reemplazando la extensión
            const newFilepath = filepath.replace(/\.(xls|xlsx)$/, '.csv');
    
            // Escribe el archivo CSV
            fs.writeFileSync(newFilepath, csvData);
    
            return newFilepath;
        } catch (error) {
            console.error('Error converting Excel to CSV:', error);
            throw error;
        }
    };
        
    // extract csv data
    const extractDataFromCSV = (filepath) => {
        console.log('extractDataFromCSV');
        return new Promise((resolve, reject) => {
            const dataObject = [];
            fs.createReadStream(filepath)
                .pipe(csv())
                .on('data', (row) => {
                    let car = {
                        taxonomy:{}
                    };
                    for (const key in row) {
                        let value = row[key].trim();
    
                        // Convierte "true" o "false" a valores booleanos
                        if (value.toLowerCase() === "true") {
                            car.taxonomy[key] = true;
                        } else if (value.toLowerCase() === "false") {
                            car.taxonomy[key] = false;
                        } 
                        // Convierte "null" a null
                        else if (value.toLowerCase() === "null") {
                            car.taxonomy[key] = null;
                        } 
                        // Manejo especial para el campo "price"
                        else if (key === 'price' && /^[0-9.]+$/.test(value)) {
                            car.taxonomy[key] = parseInt(value.replace(/\./g, ''), 10);
                        } 
                        // Convierte números con puntos (decimales)
                        else if (/^-?\d+(\.\d+)?$/.test(value)) {
                            car.taxonomy[key] = parseFloat(value);
                        }
                        // Reemplaza espacios con guiones y convierte a minúsculas
                        else {
                            car.taxonomy[key] = value.toLowerCase();
                        }
                    }
                    dataObject.push(car);
                })
                .on('end', () => resolve(dataObject))
                .on('error', reject);
        });
    };
    
    // extract keys & values
    const outputCategoriesAndTags = (obj) => {
        console.log('outputTaxonomy');
        let arrKeys = [];
        let arrValues = [];
        // Define las llaves especiales que quieres tratar de manera diferente
        const specialKeys = ['turbo', 'abs', 'parking_sensor', 'used', 'financial_aid'];

        // Recorre cada par llave-valor en el objeto
        Object.entries(obj).forEach(([key, value]) => {
            // Agrega todas las llaves al arreglo de llaves, excepto 'shortDescription'
            if (key !== 'short_description') {
                arrKeys.push(key);
            }

            // Si la llave está en la lista de llaves especiales
            if (specialKeys.includes(key)) {
                // Si el valor es verdadero, agrega la llave al arreglo de valores
                if (value === true) {
                    arrValues.push(key);
                }
            } else {
                arrValues.push(value);
            }
        });

        return {
            arrKeys,
            arrValues
        };
    };

    // remove shortDescription
    const removeKeyValuePair = (obj, keys) => {
        // Clona el objeto para no modificar el original
        const newObj = { ...obj };
    
        // Elimina la clave
        keys.forEach(key => delete newObj[key]);
    
        // Retorna el nuevo objeto sin la clave especificada
        return newObj;
    }

    // add data to fb 
    const addProductsToFirestore = async (products) => {
        const batch = db.batch();
        const productCollection = db.collection('products');
        
        // loop over products
        products.forEach(async product => {
            let sd = product.taxonomy.short_description;
            let prize = product.taxonomy.price;
            const dataClean = removeKeyValuePair(product.taxonomy, ['short_description', 'price']);
            const productDoc = productCollection.doc(); 
            let dataObject = {
                // basic info
                name:product.taxonomy.name,
                shortDescription:sd,
                price:prize,
                // images
                imgUrl:[],
                // main data
                mainData:{
                    category:product.taxonomy.category,
                    brand:product.taxonomy.brand,
                    model:product.taxonomy.model,
                },
                // metadata
                tags:outputCategoriesAndTags(dataClean).arrValues, 
                categories:outputCategoriesAndTags(dataClean).arrKeys,
                taxonomy:dataClean,
                // showroom data
                showRoom:req.params.showRoomId,
                // date 
                createdAt:new Date().toISOString(),
                // company data
                sellerIdOwner:req.params.sellerId,
                companyName:res.locals.companyData.name,
                coords:res.locals.coordsData,
            }
            // pass data to the doc
            batch.set(productDoc, dataObject);
        });
        await batch.commit();
    }; 
    
    try {
        // check if the user can post on products collection
        if(req.user.type === "seller"){
            console.log("hi seller");
            // get data from req
            const busboy = Busboy({ headers: req.headers });
            let filepath;
            let mimetype;

            busboy.on('file', (fieldname, file, filename, encoding, mime) => {
                // Verifica que el campo sea "csvFile" y que el tipo de archivo sea correcto
                if (
                    //fieldname !== "csvFile" || mime !== 'text/csv'
                    fieldname !== "xlsxFile" && mime !== 'multipart/form-data'
                ) {
                    throw new Error('Wrong file type submitted');
                }
                
                // Verifica que el ID del vendedor esté definido
                if (!req.params.sellerId) {
                    throw new Error('Seller ID is undefined');
                }
            
                //const csvFileExtension = "csv";
                const newFileName = `${req.params.sellerId} - ${filename.filename}`;
                filepath = path.join(os.tmpdir(), newFileName);
                mimetype = mime;
            
                file.pipe(fs.createWriteStream(filepath));
            });
            // wait for the file to be uploaded
            await new Promise((resolve, reject) => {
                busboy.on('finish', resolve);
                busboy.on('error', reject);
                busboy.end(req.rawBody);
            });
            // run main methods
            await uploadFileToBucket(filepath, mimetype);
            // convert .xls en .csv
            const csvFilepath = await convertExcelToCSV(filepath);
            // extract data from csv
            const dataObjectTaxo = await extractDataFromCSV(csvFilepath);
            // print
            console.log('dataObjectTaxo:', dataObjectTaxo);
            // add data to firestore
            await addProductsToFirestore(dataObjectTaxo);
            // print
            console.log('List of Cars:', dataObjectTaxo);
            // erase temp file
            fs.unlink(filepath, (err) => {
                if (err) {
                    console.error('Error removing temp file:', err);
                }
            });
            // res
            res.json({ message: 'xlsx file was uploaded successfully' });
        } else {
            res.status(500).json({ error: 'you must have the require permissions' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}

// post products with only a .csv file and do the embbedings part
exports.xlsx2 = async (req, res) => {

    // main
    try {
        if(req.user.type === "seller"){
            console.log("Hi seller");
            // vars
            const busboy = Busboy({ headers: req.headers });
            const csvFileExtension = "csv";
            const newFileName = `${req.params.showRoomId} - `;
            let filepath = path.join(os.tmpdir(), newFileName);
            let mimetype;
            // on file
            busboy.on('file', (fieldname, file, filename, encoding, mime) => {
                // if(fieldname !== "xlsxFile" || !['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(mime)) 
                // if(fieldname !== "csvFile" || mime !== 'text/csv')
                if(fieldname !== "xlsxFile" && mime !== 'multipart/form-data')
                {
                    console.log('File type or fieldname is not supported:', fieldname, mime);
                    return; // Ignora el archivo si no coincide con los criterios
                }
                filepath += filename.filename
                mimetype = mime;
                file.pipe(fs.createWriteStream(filepath));
            });
            // on finish    
            busboy.on('finish', async () => {
                try {
                    // data from req
                    const sellerId = req.params.sellerId;
                    
                    // ** methods
                    // upload file to gcp bucket
                    await uploadFileToBucket(filepath, mimetype);
                    // convert .xls en .csv
                    const csvOfProductsFilepath = await convertExcelToCSVAndCreatePath(filepath);
                    // extract data from csv
                    const extractDataFromCSVFile = await extractDataFromCSV(csvOfProductsFilepath);
                    // add data of products to firestore
                    const productsToFirestore = await addProductsToFirestore(extractDataFromCSVFile);
                    // process csv and generate embeddings
                    const createEmbeddingsOfProducts = await processCSVAndGenerateEmbeddings(extractDataFromCSV,sellerId);
                    // save embeddings on firestore
                    const embbedingsToFirestore = saveEmbeddingsOnFirestore(createEmbeddingsOfProducts);
                    // 
                    const csvOfEmbeddingsToBucket = createCSVToEmbeddings(createEmbeddingsOfProducts,filepath,mimetype);
                    //const chromaSaveProccess = saveEmbeddingsOnChromaDB(embeddings);
                    // Sube el archivo CSV al bucket de GCP
                    uploadFileToBucket(csvFilePath,mimetype);
                    // erase temp file
                    fs.unlink(filepath, (err) => { // Elimina el archivo temporal
                        if (err) console.error('Error removing temp file:', err);
                    });
                    // send response
                    res.json({ message: 'XLSX file was processed and uploaded successfully' });
                } catch (error) {
                    console.error('Error inside busboy finish:', error);
                    res.status(500).json({ error: error.message });
                }
            });
            // on error
            busboy.on('error', error => console.log('Busboy error:', error));
            // wait for the file to be uploaded
            await new Promise((resolve, reject) => {
                busboy.on('file', resolve);
                busboy.on('finish', resolve);
                busboy.on('error', reject);
                busboy.end(req.rawBody);
            });
        } else {
            res.status(403).json({ error: 'You must have the required permissions' });
        }
    } catch (err) {
        console.error('Global error:', err);
        res.status(500).json({ error: err.message });
    }
}

// post products with only a .csv file and do the complete embbedings part
exports.xlsx3 = async (req, res) => {

    try {
        // check if the user can post on products collection
        if(req.user.type === "seller"){
            // req params
            let sellerId = req.params.sellerId; 
            let showRoomId = req.params.showRoomId
            // busboy
            const busboy = Busboy({ headers: req.headers });
            // file
            let mimetype = ''
            let newFileName = ''
            // path to global csv file of embeddings
            let showRoomCsvFilePath = `${showRoomId}/${showRoomId}_embedding.json`
            // on file
            busboy.on('file', (fieldname, file, filename, encoding, mime) => {
                // if (mime !== 'text/csv' && !mime.includes('spreadsheetml')) 
                if(fieldname !== "xlsxFile" && mime !== 'multipart/form-data')
                {
                    console.log('File type not supported:', mime);
                    return; // Ignora el archivo si no es CSV o XLSX
                }
                newFileName = `${req.params.sellerId} - ${filename.filename}`;
                // console.log('newFileName:', newFileName);
                tempFilePath = path.join(os.tmpdir(), newFileName);
                console.log('tempFilePath:', tempFilePath);
                mimetype = mime;
                file.pipe(fs.createWriteStream(tempFilePath));
            });
            // on finish
            busboy.on('finish', async () => {
                try {
                    // ** methods
                    // upload xlsx file to cloud storage
                    const uploadXlsxFileToBucket = await uploadFileToCloudStorage(tempFilePath, mimetype)
                    // convert .xls en .csv
                    const csvOfProductsFilepath = await convertExcelToCSV(tempFilePath);
                    // console.log('csvOfProductsFilepath:', csvOfProductsFilepath);
                    // extract data from csv
                    const extractDataFromCSVFile = await extractDataFromCSV(csvOfProductsFilepath)
                    // console.log('extractDataFromCSVFile:', extractDataFromCSVFile);
                    // add data of products to firestore
                    const optionsDB = {
                        data: extractDataFromCSVFile,
                        collection: 'products',
                        extras: {
                            sellerId: sellerId,
                            companyName: res.locals.companyData.name,
                            coords:res.locals.coordsData
                        }
                    }
                    const productsToFirestore = await addDataToFirestore(optionsDB);
                    // process csv and generate embeddings
                    const createEmbeddingsOfProducts = await processCSVAndGenerateEmbeddings(extractDataFromCSVFile, sellerId);
                    // check for if embeddings exist
                    if(createEmbeddingsOfProducts.length > 0) {
                        // print
                        // console.log("there are embeddings");
                        // save embeddings on firestore
                        const embbedingsToFirestore = await saveEmbeddingsOnFirestore(createEmbeddingsOfProducts,showRoomId);
                        // save embeddings on bucket
                        const arrayOfEmbeddings = await createArrayWithEmbeddings(createEmbeddingsOfProducts);
                        // print
                        // console.log({arrayOfEmbeddings});
                        // save embeddings on bucket
                        const downloadGlobalCsvFileFromBucket = await downloadFileOfCloudStorage(showRoomCsvFilePath);
                        // print
                        // console.log('downloadGlobalCsvFileFromBucket:', downloadGlobalCsvFileFromBucket);
                        // update global csv file
                        const updateGlobalCsv = await updateGlobalCsvFile(downloadGlobalCsvFileFromBucket,arrayOfEmbeddings);
                        // upload xlsx file to cloud storage
                        const uploadXlsxFileToBucket = await uploadFileToCloudStorage(downloadGlobalCsvFileFromBucket, mimetype, showRoomCsvFilePath);
                    }
                } catch (error) {
                    console.error('Error inside busboy finish:', error);
                    res.status(500).json({ error: error.message });
                } finally {
                    // Limpieza: elimina el archivo temporal
                    fs.unlink(tempFilePath, (err) => {
                        if (err) console.error('Error removing temp file:', err);
                    });
                }
            });

            // on error
            busboy.on('error', error => console.log('Busboy error:', error));

            // wait for the processes to finish
            await new Promise((resolve, reject) => {
                busboy.on('file', resolve);
                busboy.on('finish', resolve);
                busboy.on('error', reject);
                busboy.end(req.rawBody);
            });
            
            req.pipe(busboy);
        }
    } catch (err) {
        console.error('Global error:', err);
        res.status(500).json({ error: err.message });
    }
};
