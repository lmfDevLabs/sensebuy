const path = require('path');
const os = require('os');
const fs = require('fs');
// csv
const csv = require('csv-parser');
// libs
const BusBoy = require('busboy');
// firebase 
const { db, admin, storage } = require('../../firebase/admin');
const bucket = storage.bucket();
// const bucket = admin.storage().bucket();

// post products in statics with only a .csv file
exports.postProductsWithCsvFileToStaticDevices = async (req, res) => {
    
    // upload file to firestore
    const uploadFileToBucket = async (filepath, mimetype) => {
        await bucket.upload(filepath, {
            resumable: false,
            metadata: {
                metadata: {
                    contentType: mimetype
                }
            }
        });
    };
    
    // extract csv data
    const extractDataFromCSV = (filepath) => {
        return new Promise((resolve, reject) => {
            const dataObject = [];
            fs.createReadStream(filepath)
                .pipe(csv())
                .on('data', (row) => {
                    let car = {
                        taxonomy:{}
                    };
                    for (const key in row) {
                        // if (
                        //     key !== 'name' && 
                        //     key !== 'shortDescription'
                        // ) {
                            car.taxonomy[key] = row[key];
                        //}
                    }
                    dataObject.push(car);
                })
                .on('end',()=>resolve(dataObject))
                .on('error', reject);
        });
    };

    // extract keys & values
    const outputTaxonomy = (obj) => {
        let arrKeys = []
        let arrValues = []
        // loop
        Object
            .entries(obj.taxonomy)
            .map(([key,value]) => { 
                if(key != 'shortDescription'){
                    if(
                        key == 'turbo' && 
                        key == 'ABS' &&
                        key == 'parking sensor' &&
                        key == 'used' &&
                        key == 'financialAid' 
                    ){
                        arrValues.push(key)
                    } else {
                        arrKeys.push(key)
                        arrValues.push(value)
                    }
                }
            })
        // print
        console.log(`outputTaxonomy:${JSON.stringify(arrKeys)}-${JSON.stringify(arrValues)}`)
        return {
            arrKeys,
            arrValues
        }
    }

    // extract companyData
    const extractCompanyData = async (sellerIdOwner) => {
        // vars
        let companyData
        
        // db connection
        db
            .doc(`/sellers/${sellerIdOwner}`)
            .get()
            .then((doc) => {
                if (doc.exists) {
                    companyData = doc.data() 
                    return companyData
                } else {
                    return res.status(404).json({ error: 'userDevice not found' });
                }
            })
            .catch((err) => {
                console.error(err);
                res.status(500).json({ error: err.code });
            }); 
    }

    // add data to fb
    const addProductsToFirestore = async (products) => {
        const batch = db.batch();
        const productCollection = db.collection('products');
        const productDoc = productCollection.doc(); 
        // vars from req
        const showRoom = req.body.showRoom
        const sellerIdOwner = req.body.sellerIdOwner
        // loop over products
        products.forEach(async product => {
            let dataObject = {
                // basic info
                name:product.taxonomy.name,
                shortDescription:product.taxonomy.shortDescription,
                price:product.taxonomy.price,
                // images
                imgUrl:[],
                // metadata
                tags:outputTaxonomy(product.taxonomy).arrValues, 
                categories:outputTaxonomy(product.taxonomy).arrKeys,
                taxonomy:product.taxonomy,
                // showroom data
                showRoom,
                // date 
                createdAt:new Date().toISOString(),
                // company data
                sellerIdOwner,
                companyName:await extractCompanyData(sellerIdOwner),
                coords:res.locals.coordsData.coords,
            }
            // pass data to the doc
            batch.set(productDoc, dataObject);
        });
    
        await batch.commit();
    };
    
    try {
        // check if the user can post on products collection
        if(req.user.type === "seller"){
            // get data from req
            const busboy = new BusBoy({ headers: req.headers });
            let filepath;
            let mimetype;

            // busboy events set.
            busboy.on('file', (fieldname, file, filename, encoding, mime) => {
                if (mime !== 'text/csv') {
                    throw new Error('Wrong file type submitted');
                }

                const imageExtension = filename.split('.').pop();
                const newFileName = `${staticDeviceProperty} - ${Date.now()} - ${filename}.${imageExtension}`;
                filepath = path.join(os.tmpdir(), newFileName);
                mimetype = mime;

                file.pipe(fs.createWriteStream(filepath));
            });

            await new Promise((resolve, reject) => {
                busboy.on('finish', resolve);
                busboy.on('error', reject);
                busboy.end(req.rawBody);
            });
            // run main methods
            await uploadFileToBucket(filepath, mimetype);
            const dataObjectTaxo = await extractDataFromCSV(filepath);
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
            res.json({ message: 'csv file was uploaded successfully' });
        } else {
            res.status(500).json({ error: 'you must have the require permissions' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}