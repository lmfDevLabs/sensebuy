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
// const bucket = admin.storage().bucket();

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