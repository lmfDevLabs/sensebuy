const path = require('path');
const os = require('os');
const fs = require('fs');
// csv
const csv = require('csv-parser');
// libs
const Busboy = require('busboy');
// firebase 
const { db, admin, storage } = require('../../firebase/admin');
const bucket = storage.bucket();
// open ai
const { OpenAI } = require('openai');
// langchain
const { Chroma } = require("@langchain/community/vectorstores/chroma");
// const { ChromaClient } = require("chromadb");



// post products with only a .csv file
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



exports.xlsx3 = async (req, res) => {

    // ** Cloud storage
    // upload file to bucket gcp
    const uploadFileToBucket = async (filepath, mimetype) => {
        try {
            console.log('uploadFileToBucket');
            await bucket.upload(filepath, {
                resumable: false,
                metadata: {
                    metadata: {
                        contentType: mimetype
                    }
                }
            });
        } catch (error) {
            console.error('Error uploadFileToBucket:', error);
        }
    };
    // Función para descargar el archivo CSV desde Cloud Storage
    const downloadCsvFile = async (fileName) => {
        
        try {
            console.log('downloadCsvFile');
            // Descarga el archivo CSV desde Cloud Storage
            let showRoomFileTempPath = os.tmpdir() + fileName
            await bucket.file(fileName).download({ destination: fs.createWriteStream(showRoomFileTempPath) });
            return showRoomFileTempPath;
        } catch (error) {
            console.error('Error downloadCsvFile:', error);
        }
    }

    // ** .CSV data and files
    // convert excel to csv
    const convertExcelToCSVAndCreateNewPath = async (filepath) => {
        try {
            console.log('convertExcelToCSVAndCreateNewPath');
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
            console.error('Error convertExcelToCSVAndCreateNewPath:', error);
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
                    let car = {};
                    for (const key in row) {
                        // to trim the values
                        let value = row[key].trim();
                        // to lower case keys and trim the values
                        let newKey = key.toLowerCase().trim();
                        // Convierte "null" a null
                        if (value.toLowerCase() === "null") {
                            car[newKey] = null;
                        } 
                        // Manejo especial para el campo "price"
                        else if (newKey === 'price' && /^[0-9.]+$/.test(value)) {
                            car[newKey] = parseInt(value.replace(/\./g, ''), 10);
                        } 
                        // Convierte números con puntos (decimales)
                        else if (/^-?\d+(\.\d+)?$/.test(value)) {
                            car[newKey] = parseFloat(value);
                        }
                        // convierte a minúsculas
                        else {
                            car[newKey] = value.toLowerCase();
                        }
                    }
                    dataObject.push(car);
                })
                .on('end', () => resolve(dataObject))
                .on('error extractDataFromCSV:', reject);
        });
    };
    // update global csv file
    const updateGlobalCsvFile = async (embeddingsFilePath,embeddings) => {
        
        try{
            // print
            console.log('updateGlobalCsvFile:');
            fs.writeFileSync(embeddingsFilePath, embeddings);
        }catch(err){
            console.error('Error updateGlobalCsvFile', err);
        }
    };

    // ** Firebase
    // add data to fb
    const addProductsToFirestore = async (products) =>  {
        const commitBatches = [];
        try {
            console.log('addProductsToFirestore');
            const MAX_BATCH_SIZE = 500; // Firestore batch write limit
            let batch = db.batch();
            // Loop over products
            products.forEach((product, index) => {
                const docRef = db.collection('products').doc(); // Crea un nuevo documento para cada producto
                let dataObject = {
                    selleData:{
                        sellerId:req.params.sellerId,
                        companyName:res.locals.companyData.name
                    },
                    coords:res.locals.coordsData,
                    createdAt:new Date().toISOString(),
                    ...product
                }
                // pass data to the doc
                batch.set(docRef, dataObject);

                // Si alcanzamos el límite del batch o es el último elemento, preparamos para enviar
                if ((index + 1) % MAX_BATCH_SIZE === 0 || index === products.length - 1) {
                    commitBatches.push(batch.commit()); // Añade la promesa del commit a la lista
                    batch = db.batch(); // Reinicia el batch para el siguiente grupo de documentos
                }
            });
        } catch (error) {
            console.error('Error addProductsToFirestore:', error);
        }

        // Espera a que todos los batches se hayan enviado
        await Promise.all(commitBatches);
    }
    // save embeddings in firestore
    const saveEmbeddingsOnFirestore = async (embeddings) => {
        // Aquí deberías guardar los embeddings en Vertex AI
        console.log('saveEmbeddingsOnFirestore:');
        // Aquí deberías guardar los embeddings en Firestore
        const commitBatches = [];
        const batch = db.batch();
        try{
            const embeddingsCollectionRef = db
                .collection('showRooms')
                .doc(req.params.showRoomId)
                .collection('embeddings');

            embeddings.forEach((embedding) => {
                const docRef = embeddingsCollectionRef.doc(); // Create a new document for each embedding
                batch.set(docRef, embedding);
            });
        }catch(err){
            console.error('Error saveEmbeddingsOnFirestore:', err);
        }
        commitBatches.push(batch.commit());
    };

    // ** Embeddigs
    // remueve las claves que no queremos en el embedding
    const prepareProductTextForEmbedding = (productData) => {
        try {
            console.log('prepareProductTextForEmbedding');
            const excludedKeys = ['pics', 'pdf']; // Claves que quieres excluir
            let textParts = [];

            // Recorrer todas las claves y valores del objeto productData
            for (const [key, value] of Object.entries(productData)) {
                // Comprobar si la clave no está excluida y el valor no es nulo ni vacío
                if (!excludedKeys.includes(key) && value) {
                    // Convertir la clave de formato snake_case a texto legible
                    const readableKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Convierte snake_case a Title Case
                    // Agregar la parte de texto al array
                    textParts.push(`${readableKey}: ${value}`);
                }
            }

            // Unir todas las partes con un punto y espacio como separador.
            return textParts.join('. ');
        } catch (error) {
            console.error('Error prepareProductTextForEmbedding:', error);
            return ''; // Devuelve una cadena vacía en caso de error.
        }
    };
    // Función para obtener embeddings con OpenAI
    const getEmbeddingsFromOpenAI = async (text) => {
        
        try {
            // print
            console.log('getEmbeddingsFromOpenAI:');
            // Instancia de OpenAI
            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
            // Obtiene el embedding del texto
            const response = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: text,
                encoding_format: "float",
            });
            // Asegúrate de acceder correctamente a la respuesta para obtener el embedding
            // console.log('Embedding:', response);
            return response // Ajusta según la estructura de la respuesta
        } catch (error) {
            console.error('Error getEmbeddingsFromOpenAI:', error);
            return null; // O maneja el error según prefieras
        }
    };
    // Función para procesar el CSV y generar embeddings
    const processCSVAndGenerateEmbeddings = async (data,sellerId) => {
        try {  
            // print 
            console.log('processCSVAndGenerateEmbeddings:');
            // Array para almacenar los embeddings
            const embeddings = [];
            // Procesa cada producto y obtiene su embedding
            for (const productData of data) {
                // console.log('Product data:', productData);
                // Prepara el texto del producto para el embedding y obtén el embedding
                // const {textParts} = await prepareProductTextForEmbedding(productData);
                const embedding = await getEmbeddingsFromOpenAI(await prepareProductTextForEmbedding(productData));
                if (embedding) {
                    embeddings.push({ sellerId, embedding }); // Asocia el embedding con el ID del vendedor
                }
            }

            // // Guarda los embeddings en un nuevo archivo CSV
            // const embeddingsFilePath = filepath.replace('.csv', '_embeddings.csv');
            // let csvContent = "sellerId,embedding\n"; // Encabezados del CSV

            // try{
            //     // Procesa cada embedding y agrégalo al archivo CSV
            //     await embeddings.forEach((item,i) => {
            //         console.log('Item:', item);
            //         // Asegúrate de que item.data sea un array y tenga elementos antes de continuar
            //         if (Array.isArray(item.embedding.data) && item.embedding.data.length > 0) {
            //             // Accede al primer elemento de data (o iterar a través de todos si es necesario)
            //             const firstEmbeddingObject = item.embedding.data; // Asumiendo que quieres el primer objeto embedding
            //             // Ahora verifica que firstEmbeddingObject.embedding sea un array
            //             if (Array.isArray(firstEmbeddingObject)) {
            //                 const embeddingStr = firstEmbeddingObject.join(','); // Convierte el array del embedding a string
            //                 // console.log('Embedding string:', embeddingStr);
            //                 csvContent += `${item.sellerId},${embeddingStr}\n`;
                            
            //             } else {
            //                 console.error('Error: firstEmbeddingObject.embedding is not an array', firstEmbeddingObject.embedding);
            //             }
            //         } else {
            //             console.error('Error: item.data is not an array or is empty', item.data);
            //         }
            //     });
            // }catch (err) {
            //     console.error('Error processing embeddings:', err);
            // }

            // // Escribe el archivo CSV
            // fs.writeFileSync(embeddingsFilePath, csvContent);
            // console.log({csvContent});
            
            return embeddings; // Retorna el embedding
        } catch (error) {
            console.error('Error processCSVAndGenerateEmbeddings:', error);
        }
    };
    // make array with embeddings to save on bucket
    const createArrayWithEmbeddings = async (embeddings) => {
        try {
            console.log('createArrayWithEmbeddings:');
            let csvContent = "embedding\n"; // Encabezado del CSV
            // Procesa cada embedding y agrégalo al archivo CSV
            embeddings.forEach((item) => {
                // Asegúrate de que item.embedding.data sea un array y tenga elementos antes de continuar
                if (Array.isArray(item.embedding.data) && item.embedding.data.length > 0) {
                    // Accede al primer elemento de data (o itera a través de todos si es necesario)
                    const embeddingStr = item.embedding.data.join(','); // Convierte el array del embedding a string
                    csvContent += `${embeddingStr}\n`;
                } else {
                    console.error('Error: item.embedding.data is not an array or is empty', item.embedding.data);
                }
            });
        } catch (err) {
            console.error('Error createArrayWithEmbeddings:', err);
        }
    }

    try{
        // check if the user can post on products collection
        if(req.user.type === "seller"){
            // req params
            let sellerId = req.params.sellerId; 
            let showRoomId = req.params.showRoomId
            // busboy
            const busboy = Busboy({ headers: req.headers });
            // temp path
            let tempFilePath;
            // paths gcp
            let showRoomPathFolder = `gs://sensebuy-e8add.appspot.com/${showRoomId}`;
            let showRoomCsvFilePath = `gs://sensebuy-e8add.appspot.com/${showRoomId}/${showRoomId}_embedding.json`
            
            // file
            let mimetype = '';

            // on file
            busboy.on('file', (fieldname, file, filename, encoding, mime) => {
                // if (mime !== 'text/csv' && !mime.includes('spreadsheetml')) 
                if(fieldname !== "xlsxFile" && mime !== 'multipart/form-data')
                {
                    console.log('File type not supported:', mime);
                    return; // Ignora el archivo si no es CSV o XLSX
                }
                const newFileName = `${req.params.sellerId} - ${filename.filename}`;
                tempFilePath = path.join(os.tmpdir(), newFileName);
                mimetype = mime;
                file.pipe(fs.createWriteStream(tempFilePath));
            });
            
            // on finish
            busboy.on('finish', async () => {
                try {
                    // ** methods
                    // upload file to gcp bucket
                    await uploadFileToBucket(tempFilePath, mimetype)
                    // convert .xls en .csv
                    const csvOfProductsFilepath = await convertExcelToCSVAndCreateNewPath(tempFilePath);
                    // extract data from csv
                    const extractDataFromCSVFile = await extractDataFromCSV(csvOfProductsFilepath);
                    // add data of products to firestore
                    const productsToFirestore = await addProductsToFirestore(extractDataFromCSVFile);
                    // process csv and generate embeddings
                    const createEmbeddingsOfProducts = await processCSVAndGenerateEmbeddings(extractDataFromCSVFile, sellerId);
                    // check for if embeddings exist
                    if(createEmbeddingsOfProducts.length > 0) {
                        // save embeddings on firestore
                        const embbedingsToFirestore = await saveEmbeddingsOnFirestore(createEmbeddingsOfProducts);
                        // save embeddings on bucket
                        const arrayOfEmbeddings = createArrayWithEmbeddings(createEmbeddingsOfProducts);
                        // download global csv file
                        const fileName = `${showRoomId}_embedding.json`
                        const globalCsvFilePath = await downloadCsvFile(fileName);
                        // update global csv file
                        const updateGlobalCsv = await updateGlobalCsvFile(globalCsvFilePath,arrayOfEmbeddings);
                        // upload global csv file
                        let mimetype = "text/csv"
                        // Sube el archivo CSV al bucket de GCP
                        await uploadFileToBucket(globalCsvFilePath, mimetype);
                        // Responde al cliente
                        res.json({ message: 'CSV file processed and uploaded successfully' });
                    } else {
                        return res.status(400).json({ error: 'There´s any embeddnigs available to save' });
                    }
                    // Responde al cliente
                    // res.json({ message: 'File processed and uploaded successfully' });
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
        } else {
            // responde al cliente
            res.status(403).json({ error: 'You must have the required permissions' });
        }
    }
    catch (err) {
        console.error('Global error:', err);
        res.status(500).json({ error: err.message });
    }
};
