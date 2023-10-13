// firebase
const { db } = require('../../firebase');

module.exports = async (req, res, next) => {
    try { 
        const userId = req.params.userId;
        const sellerId = thingId.split("-").slice(2).toString();

        // Fetch data from Firestore
        const doc = await db.doc(`/sellers/${sellerId}`).get();
        
        // Check if document exists
        if (!doc.exists) {
            console.error('No document found with id: ', sellerId);
            return res.status(404).json({ error: 'Seller not found' });
        }

        // Extract and pass data to the next middleware
        const coordsOfStatic = {
            coords: doc.data().coords
        };
        res.locals.coordsData = coordsOfStatic;
        return next();
    } catch (err) {
        console.error('Error while fetching seller data: ', err);
        return res.status(500).json({ error: 'Something went wrong' });
    }
};
