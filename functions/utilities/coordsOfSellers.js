// firebase
const { db } = require('../../firebase')

// extract companyData
module.exports = async (req,res,next) => {
    // extract userHandle
    const thingId = req.params.coords
    const sellerId = thingId.split("-").slice(2).toString()
    // db connection
    db
        .doc(`/sellers/:sellerId`)
        .get()
        .then((doc) => {
            const coordsOfStatic = {
                coords:doc.data().coords
            }
            // data to pass to the next middleware
            res.locals.coordsData = coordsOfStatic
            return next()
        })
        .catch((err) => {
            console.error('Error while pass the coords of static ', err)
            return res.status(403).json(err)
        })
}