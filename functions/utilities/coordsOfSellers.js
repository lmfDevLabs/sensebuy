// firebase
const { db } = require('../firebase/admin');
// busboy
const Busboy = require('busboy');

module.exports = async (req, res, next) => {
    try { 
        //const data = JSON.parse(req.body); // Parsea el JSON, ya que viene como un string
        // console.log({data});
        //console.log('sellerId: ', data.sellerId);

        // Fetch data from Firestore
        const doc = await db.doc(`/sellers/${req.params.sellerId}`).get();
        
        // Check if document exists
        if (!doc.exists) {
            console.error('No document found with id: ', sellerId);
            return res.status(404).json({ error: 'Seller not found' });
        }

        // Extract and pass data to the next middleware
        const sellerData = {
            coords: doc.data().coords,
            companyData: doc.data().companyData

        };
        console.log('sellerData: ', sellerData);
        res.locals.coordsData = sellerData.coords;
        res.locals.companyData = sellerData.companyData;
        return next();
    } catch (err) {
        console.error('Error while fetching seller data: ', err);
        return res.status(500).json({ error: 'Something went wrong' });
    }
};




