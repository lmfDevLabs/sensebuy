import { db } from '../../firebase/admin.js';
import firebaseConfig from '../../firebase/firebaseConfig.js';

// node
import path from 'path';
import os from 'os';
import fs from 'fs';

// busboy
import BusBoy from 'busboy';

// validate data
import {
    reduceSeller,
    validateCoordsData
} from '../../utilities/sanitizers/validation.js';


// Crea un nuevo vendedor asociado aun usuario tipo seller.
const sellers = async (req, res) => { 
    try {
        // check if the user can post on sellers collection
        if(req.user.type === "seller"){
            // validation
            // let {sellerDetails} = reduceSeller(req.body)
            // console.log(sellerDetails);
            // create seller
                const newSellerRef = await db.collection('sellers').add({
                    createdAt:new Date().toISOString(),
                    admin:{ 
                        username:req.user.username,
                        userId:req.user.uid
                    },
                    coords:{},
                    companyData:{
                        name:req.body.companyData.name,
                        //name:sellerDetails.companyData.name,
                        imgUrl:"", 
                        standId:req.body.companyData.standId,
                        //standId:sellerDetails.companyData.standId,
                        pic360Url:""
                    }
                });
                // res.status(200).send({ id: newSellerRef.id });
                res.status(200).send("seller created successfully");
            
        } else {
            res.status(500).json({ error: 'you must have the require permissions' });
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
}

const coords = async (req, res) => {

    try {
        
        // Check user type
        if (req.user.type !== "seller") {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        // Validate coords data
        // const { coordsValidate, valid, errors } = validateCoordsData(coords);
        // if (!valid) {
        //     return res.status(400).json(errors);
        // }

        const sellerRef = db.collection('sellers').where('admin.userId', '==', req.user.uid);
        const sellerSnapshot = await sellerRef.get();

        if (!sellerSnapshot.empty) {
            // geofirestore
            const geofire = require('geofire-common');
            // Utilizando un array para almacenar todas las promesas de actualización
            const updates = [];

            sellerSnapshot.forEach(doc => {
                const coords = req.body.coords;

                // Utilizando async/await para realizar la actualización
                const updatePromise = (async () => {
                    await doc.ref.update({
                        coords:{
                            lat: coords.lat,
                            lng: coords.lng,
                            pointName: coords.pointName,
                            hash: geofire.geohashForLocation([
                                coords.lat,
                                coords.lng
                            ])
                        }
                    });
                })();
                
                updates.push(updatePromise);
            });

            // Esperando a que todas las actualizaciones se completen
            await Promise.all(updates);
            return res.status(200).json({ message: "Coords updated successfully" });
        } else {
            return res.status(404).json({ error: 'Seller not found' });
        }

        
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};
    
const postPic360UrlOnSellerDoc = (req, res) => {
    try {
        // check if the user can post on sellers collection
        if(req.user.type === "seller"){

            const busboy = new BusBoy({ headers: req.headers });

            let imageToBeUploaded = {};
            let imageFileName;

            busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
                console.log(fieldname, file, filename, encoding, mimetype);
                if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
                    return res.status(400).json({ error: 'Wrong file type submitted' });
                }
                // my.image.png => ['my', 'image', 'png']
                const imageExtension = filename.split('.')[filename.split('.').length - 1];
                // 32756238461724837.png
                imageFileName = `${Math.round(Math.random() * 1000000000000).toString()}.${imageExtension}`;
                const filepath = path.join(os.tmpdir(), imageFileName);
                imageToBeUploaded = { filepath, mimetype };
                file.pipe(fs.createWriteStream(filepath));
            });

            busboy.on('finish', async () => {
                try {
                    await bucket.upload(imageToBeUploaded.filepath, {
                        resumable: false,
                        metadata: {
                            metadata: {
                                contentType: imageToBeUploaded.mimetype
                            }
                        }
                    });
                    
                    const pic360Url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
                    // const pic360Url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${imageFileName}?alt=media`;
                    await db.doc(`/sellers/${req.user.username}`).update({ pic360Url });
                    
                    return res.json({ message: 'image uploaded successfully' });
                } catch (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'something went wrong' });
                }
            });
            busboy.end(req.rawBody);
        } else {
            res.status(500).json({ error: 'you must have the require permissions' });
        }
    } catch (error) {
        console.log(error);
    }
};

export {
    sellers,
    coords,
    postPic360UrlOnSellerDoc
};

