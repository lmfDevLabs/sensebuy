const path = require('path');
const os = require('os');
const fs = require('fs');
// csv
const csv = require('csv-parser');
// libs
const BusBoy = require('busboy');
// firebase
// const admin = require('firebase-admin'); // Asumo que se requiere admin desde firebase-admin.
const bucket = admin.storage().bucket();
const { db } = require('../utilities/config');
// geofire
// const geofire = require('geofire-common')

// post products in statics with only a .csv file
exports.postProductsWithCsvFileToStaticDevices = async (req, res) => {
    
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
    
    const extractDataFromCSV = (filepath) => {
        return new Promise((resolve, reject) => {
            const dataObject = [];
            fs.createReadStream(filepath)
                .pipe(csv())
                .on('data', (row) => {
                    const car = {};
                    for (const key in row) {
                        if (key !== 'name' && key !== 'shortDescription') {
                            car[key] = row[key];
                        }
                    }
                    dataObject.push(car);
                })
                .on('end', () => resolve(dataObject))
                .on('error', reject);
        });
    };

    // extract keys & values
    let outputTaxonomy = (obj) => {
        let arrKeys = []
        let arrValues = []
        // loop
        Object
            .entries(obj.taxonomy)
            .map(([key,value]) => { 
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
            })
        // print
        console.log(`outputTaxonomy:${JSON.stringify(arrKeys)}-${JSON.stringify(arrValues)}`)
        return {
            arrKeys,
            arrValues
        }
    }

    // extract companyData
    const extractCompanyData = async (idProperty) => {
        // vars
        const outputList = []
        // extract userHandle
        const userHandle = idProperty.split("-").slice(0,1).toString()
        // db connection
        db
            .collection(`/users/${userHandle}/companyData`)
            .get()
            .then((snapshot) => {
                // check if exists
                if (snapshot.empty) {
                    console.log('No matching documents.')
                } else {
                    snapshot.forEach((doc) => {
                        outputList.push({
                            companyName:doc.data().companyName,
                            localPicUrl:doc.data().localPicUrl,
                        })
                    })
                    // print
                    console.log(`outputList:${JSON.stringify(outputList)}`)
                    return outputList
                }  
            })
    }

    const addProductsToFirestore = async (products) => {
        const batch = db.batch();
        const productCollection = db.collection('products');
        const productDoc = productCollection.doc(); 
        products.forEach(async product => {
            let dataObject = {
                name:product.name,
                description:product.description,
                price:product.price,
                taxonomy:product,

                tags:outputTaxonomy(product).arrValues, 
                categories:outputTaxonomy(product).arrKeys,
                
                staticDeviceProperty:req.body.staticDeviceProperty,
                familyOfDevices:req.body.familyOfDevices,
                // imgUrl:.imgUrl,
                createdAt:new Date().toISOString(),
                // this fields depends of if what search products for it location
                companyName:await extractCompanyData(idProperty).outputList[0],
                coords:res.locals.coordsData.coords,
            }
            batch.set(productDoc, dataObject);
        });
    
        await batch.commit();
    };
    

    try {
        const staticDeviceProperty = req.body.staticDeviceProperty;
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
        // run it
        await uploadFileToBucket(filepath, mimetype);
        const dataObjectTaxo = await extractDataFromCSV(filepath);
        await addProductsToFirestore(dataObjectTaxo);
        // print
        console.log('List of Cars:', dataObject);
        // erase temp file
        fs.unlink(filepath, (err) => {
            if (err) {
                console.error('Error removing temp file:', err);
            }
        });
        // res
        res.json({ message: 'csv file was uploaded successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}