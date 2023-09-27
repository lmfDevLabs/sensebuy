// FIREBASE
// functions
const {onRequest} = require("firebase-functions/v2/https");
// db
const { 
  auth,
  db,  
  storage,
} = require('./firebase/admin')

// EXPRESS
const app = require('express')()

// CORS
// const cors = require('cors')
// app.use(cors({ origin: true }))

// MIDDLEWARES
// middleware for auth
const firebaseAuth = require('./firebase/firebaseAuth')
// middleware for coords of statics
const CoordsOfSellers = require('./utilities/coordsOfSellers')

////////////////////////////////////////// HANDLERS //////////////////////////////////////////////////
// users
const { 
  signup,   
  login,  
} = require('./handlers/users/users');

// products
const {
  postProductsWithCsvFileToStaticDevices
} = require('./handlers/products/products');

// sellers
const {
  postSeller,
  postSellerLocal360Image
} = require('./handlers/sellers/sellers');

//////////////////////////////////////////// +++++++ API REST ROUTES +++++++ ///////////////////////////////////////////
///////////////////////////////////////////////// USERS /////////////////////////////////////////////////////////////
// test
app.get('/',firebaseAuth, (req, res) =>{
  console.log("hi")
}); 


/* USERS */ 

// signup user
app.post('/signup', signup);
// login user   
app.post('/login', login);
// post user extra details


/* PRODUCTS */

// post or create products of sellers with a .csv file
app.post('/postCsv', 
  firebaseAuth, 
  CoordsOfSellers, 
  postProductsWithCsvFileToStaticDevices
);

/* SELLERS */

// post or create a new one seller
app.post('/postSeller',
  firebaseAuth,
  CoordsOfSellers,
  postSeller
)

// post or create a 360 image in seller doc
app.post('/postPic360UrlOnSellerDoc',
  firebaseAuth,
  postPic360UrlOnSellerDoc
)

// export functions
exports.api = onRequest(app);
