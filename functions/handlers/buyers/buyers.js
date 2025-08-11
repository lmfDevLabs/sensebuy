// node modules
import fs from 'fs';
// firebase
// import { db, admin, storage } from '../../firebase/admin.js';
import { db, storage } from '../../firebase/admin.js';
// cloud storage
import { downloadFileOfCloudStorage } from '../../utilities/cloudStorage.js';


// post buyer
const buyers = async (req, res) => {
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
                // live from smartphone
                dataMobilDevice:{
					lastMessageReceived:new Date().toISOString(),
					liveCoords: {
						hash: '',
						lat: 0,
						lng: 0,
						nameOfPoint:''
					},
					liveFeed: {
						matchQuality: {
							color: '',
							value:{r:0,g:0,b:0}
						},
						matrixDistance: {
							color: '',
							value:{r:0,g:0,b:0}
						},
						
					},
				},
                // data from bracelet
				statusOfBracelet:{
                    active:false,
					connectionStatus:0,
					batteryLife:0,
                    motorSpeed:0,
                    colorSigns:{
                        matchQuality: {
							color: '',
							value:{r:0,g:0,b:0}
						},
						matrixDistance: {
							color: '',
							value:{r:0,g:0,b:0}
						},
                    }
				}
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

// get token buyer to publisb over pubsub
const tokenBuyers = async (req, res) => {
    let showRoomId = req.params.showRoomId
    let showRoomCsvFilePath = `${showRoomId}/sensebuy-e8add-482dddf1f0e3.json`
    const downloadTokenJsonFileOfCloudStorage = await downloadFileOfCloudStorage(showRoomCsvFilePath);
    const fileContent = fs.readFileSync(downloadTokenJsonFileOfCloudStorage, {encoding: 'utf8'});
    console.log({fileContent})
    res.send(fileContent)
}

export{
    buyers,
    tokenBuyers
}