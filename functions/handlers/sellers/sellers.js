// firebase
const { db, admin, storage } = require('../../firebase/admin');
const {
    storageBucket
} = require('../../firebase/firebaseConfig')

// node
const path = require('path');
const os = require('os');
const fs = require('fs');
// busboy
const BusBoy = require('busboy');
    

// post products in statics with only a .csv file
exports.postSeller = async (req, res) => {
    // check if the user can post on sellers collection
    if(req.user.type === "seller"){
        let sellerDetails = reduceUserDetails(req.body)
        
        // take data from user req
        // const { name, address } = req.body;

        try {
            const newSellerRef = await db.collection('sellers').add({
                createdAt:new Date().toISOString(),
                admin:{
                    username:"",
                    userId:""
                },
                coords:res.locals.coordsData.coords,
                companyData:{
                    name:"",
                    imgUrl:"",
                    standId:"",
                    pic360Url:""
                }
            });
            res.status(200).send({ id: newSellerRef.id });
        } catch (error) {
            res.status(500).send(error.message);
        }
    } else {
        res.status(500).json({ error: 'you must have the require permissions' });
    }
}

exports.postPic360UrlOnSellerDoc = (req, res) => {

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

        busboy.on('finish', () => {
            
            bucket
                .upload(imageToBeUploaded.filepath, {
                    resumable: false,
                    metadata: {
                        metadata: {
                        contentType: imageToBeUploaded.mimetype
                        }
                    }
                })  
                .then(() => {
                    const pic360Url = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${imageFileName}?alt=media`;
                    return db.doc(`/sellers/${req.user.username}`).update({ pic360Url });
                })
                .then(() => {
                    return res.json({ message: 'image uploaded successfully' });
                })
                .catch((err) => {
                    console.error(err);
                    return res.status(500).json({ error: 'something went wrong' });
                });
        });
        busboy.end(req.rawBody);
    } else {
        res.status(500).json({ error: 'you must have the require permissions' });
    }
};