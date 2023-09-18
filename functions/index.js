// FIREBASE
// functions
const {onRequest} = require("firebase-functions/v2/https");
// db
const { db } = require('./utilities/config')

// EXPRESS
const app = require('express')()

// CORS
const cors = require('cors')
app.use(cors({ origin: true }))

// MIDDLEWARES
// middleware for auth
// const FBAuth = require('./utilities/fbAuth')
// middleware for coords of statics
const CoordsOfStatics = require('./utilities/coordsOfStatics')

// SELLERS
const {
  postProductsWithCsvFileToStaticDevices
} = require('./handlers/products/products');

// SELLERS
app.post('/', CoordsOfStatics, postProductsWithCsvFileToStaticDevices);

// export functions
exports.api = onRequest(app);