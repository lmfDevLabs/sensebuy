// firebase
const { db, admin, storage } = require('../../firebase/admin');
const {
    storageBucket
} = require('../../firebase/firebaseConfig')

// post products in statics with only a .csv file
exports.buyers = async (req, res) => {
    try {
        // check if the user can post on sellers collection
        if(req.user.type === "buyer"){
            // validation
            // let {sellerDetails} = reduceSeller(req.body)
            // console.log(sellerDetails);
            const buyer = {   
                // admin user
                admin:{ 
                    username:req.user.username,
                    userId:req.user.uid
                },
                createdAt:new Date().toISOString(),
                // live
                liveCoords:{
                    lat:0,
                    lng:0,
                    hash:"",
                    nameOfPoint:""
                },
                liveFeed:{ 
                    matchQuality:{
                        color:"",
                        value:0
                    },
                    matrixDistance:{
                        color:"",
                        value:0
                    },
                },
                // queries relations
                queries:{
                    docsQueriesIds:[],
                    onDocQueryId:"",
                    docIdSelectedOfProductsSuggestions:"",
                },
            }  
            
            // create buyer
                const newBuyerRef = await db.collection('buyers').add(buyer);
                // res.status(200).send({ id: newSellerRef.id });
                res.status(200).send("Buyer created successfully");
            
        } else {
            res.status(500).json({ error: 'you must have the require permissions' });
        }
    } catch (error) {
        res.status(500).send(error.message);
    }
}