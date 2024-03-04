// FIREBASE
// functions
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
// db
const { 
  admin,
  auth,
  db,  
  storage,
  functions
} = require('./firebase/admin')

// EXPRESS
// const express = require('express');
// const app = express()
const app = require('express')()

// CORS
const cors = require('cors')
app.use(cors({ origin: true }))

// MIDDLEWARES
// app.use(express.json());
// middleware for auth
const firebaseAuth = require('./firebase/firebaseAuth')
// middleware for coords of statics
const coordsOfSellers = require('./utilities/coordsOfSellers')

// ////////////////////////////////////////// HANDLERS //////////////////////////////////////////////////
// auth
// const { 
//   signup,   
//   login,  
// } = require('./handlers/users/users');

// showrooms
// const {
//   getShowrooms,
//   getShowroom,
//   showrooms,
//   updateShowroom,
//   deleteShowroom,
// } = require('./handlers/showRooms/showRooms');

// // users
// const {
//   getUsers,
//   getUser,
//   users,
//   updateUser,
//   deleteUser
// } = require('./handlers/users/users');

// sellers
const {
  // getSellers,
  // getSeller,
  sellers,
  // updateSeller,
  // deleteSeller,
  coords,
  // localImage360
} = require('./handlers/sellers/sellers');

// products
const {
  // getProducts,
  // getProduct,
  // products,
  // updateProduct,
  // deleteProduct,
  // images,
  xlsx,
  xlsx2
} = require('./handlers/products/products');

// buyers
const {
//   getBuyers,
//   getBuyer,
  buyers,
//   updateBuyer,
//   deleteBuyer
} = require('./handlers/buyers/buyers');

// queries
const {
//   getQueries,
//   getQuery,
  queriesOpenAI,
  queriesOpenAIAndAlgolia,
//   getQueriesByUser,
//   getQueryByUser,
//   updateQuery,
//   deleteQuery
} = require('./handlers/queries/queries');

// //////////////////////////////////////////// +++++++ API REST ROUTES +++++++ ///////////////////////////////////////////

// API Version
const apiVersion = "v1"

// Set the maximum instances to 10 for all functions
setGlobalOptions({ maxInstances: 10 });

// test
app.get(`/${apiVersion}/test`, firebaseAuth, (req, res) => {
  res.send('Hello from API REST' + " " + req.user.uid)
})

// // git data from sensebuy
// // app.get(`/${apiVersion}/data`, sensebuyData); 

/* AUTH */
// signup user - test mode
// app.post(`/${apiVersion}/auth/signup`, signup);
// login user -test mode
// app.post(`/${apiVersion}/auth/login`, login);

// /* SHOWROOMS */
// // super admin
// // 1-GET /showrooms: Obtiene todos los showrooms.
// app.get(`/${apiVersion}/showrooms`, firebaseAuth, getShowrooms);
// // 2-GET /showrooms/:id: Obtiene un showroom específico.
// app.get(`/${apiVersion}/showrooms/:showroomId`, firebaseAuth, getShowroom);

// // user admin
// // 3-POST /showrooms: Crea un nuevo showroom.
// app.post(`/${apiVersion}/showrooms`, firebaseAuth, showrooms);
// // 4-PUT /showrooms/:id: Actualiza un showroom específico.
// app.put(`/${apiVersion}/showrooms/:showroomId`, firebaseAuth, updateShowroom);
// // 5-DELETE /showrooms/:id: Elimina un showroom específico.
// app.delete(`/${apiVersion}/showrooms/:showroomId`, firebaseAuth, deleteShowroom);


// /* USERS */ 
// // super admin
// // 1-GET /users: Obtiene todos los usuarios.
// app.get(`/${apiVersion}/users`, firebaseAuth, getUsers);
// // 2-GET /users/:id: Obtiene un usuario específico.
// app.get(`/${apiVersion}`, firebaseAuth, getUser);


// // user admin
// // 3-POST /users: Crea un nuevo usuario.
// app.post(`/${apiVersion}/users`, firebaseAuth, users);
// // 4-PUT /users/:id: Actualiza un usuario específico.
// app.put(`/${apiVersion}/users/me`, firebaseAuth, updateUser);
// // 5-DELETE /users/:id: Elimina un usuario específico.
// app.delete(`/${apiVersion}/users/me`, firebaseAuth, deleteUser);


/* SELLERS */
// // super admin
// // 1-GET /sellers: Obtiene todos los vendedores.
// app.get(`/${apiVersion}/sellers`, firebaseAuth, getSellers);
// // 2-GET /sellers/:id: Obtiene un vendedor específico.
// app.get(`/${apiVersion}/sellers/:sellerId`, firebaseAuth, getSeller);

// user admin
// 3-POST /sellers: Crea un nuevo vendedor asociado aun usuario tipo seller.
app.post(`/${apiVersion}/sellers`, firebaseAuth, sellers);
// // 4-PUT /sellers/:id: Actualiza un vendedor específico.
// app.put(`/${apiVersion}/sellers/:sellerId`, firebaseAuth, updateSeller);
// // 5-DELETE /sellers/:id: Elimina un vendedor específico.
// app.delete(`/${apiVersion}/sellers/:sellerId`, firebaseAuth, deleteSeller);
// 6-POST /sellers/:sellerId/coords: Para agregar coordenadas a un vendedor.
app.post(`/${apiVersion}/sellers/coords`, firebaseAuth, coords);
// // 7-POST /sellers/:sellerId/images/local360: Para agregar una imagen 360 del local en un vendedor.
// app.post(`/${apiVersion}/sellers/:sellerId/images/local360`, firebaseAuth, localImage360);


/* PRODUCTS */
// // super admin
// // 1-GET /products: Obtiene todos los productos.
// app.get(`/${apiVersion}/products`, firebaseAuth, getProducts);
// // 2-GET /products/:id: Obtiene un producto específico.
// app.get(`/${apiVersion}/products/:productId`, firebaseAuth, getProduct);

// // user admin
// // 3-POST /products: Crea un nuevo producto.
// app.post(`/${apiVersion}/products`, firebaseAuth, coordsOfSellers, products);
// // 4-PUT /products/:id: Actualiza un producto específico.
// app.put(`/${apiVersion}/products/:productId`, firebaseAuth, updateProduct);
// // 5-DELETE /products/:id: Elimina un producto específico.
// app.delete(`/${apiVersion}/products/:productId`, firebaseAuth, deleteProduct);
// // 6-POST /products/:productId/images: Para agregar imagenes a un producto.
// app.post(`/${apiVersion}/products/:productId/images`, firebaseAuth, images);
// 7-POST /products/csv: Para agregar productos a través de un archivo CSV.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/products/xlsx`, firebaseAuth, coordsOfSellers, xlsx);
// 8-POST /products/csv: Para agregar productos a través de un archivo CSV and embbeding stuff.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/products/xlsx2`, firebaseAuth, coordsOfSellers, xlsx2);

/* BUYERS */
// // super admin
// // 1-GET /buyers: Obtiene todos los compradores.
// app.get(`/${apiVersion}/buyers`, firebaseAuth, getBuyers);
// // 2-GET /buyers/:id: Obtiene un comprador específico.
// app.get(`/${apiVersion}/buyers/:buyerId`, firebaseAuth, getBuyer);

// // user admin
// 3-POST /buyers: Crea un nuevo comprador.
app.post(`/${apiVersion}/buyers`, firebaseAuth, buyers);
// // 4-PUT /buyers/:id: Actualiza un comprador específico.
// app.put(`/${apiVersion}/buyers/:buyerId`, firebaseAuth, updateBuyer);
// // 5-DELETE /buyers/:id: Elimina un comprador específico.
// app.delete(`/${apiVersion}/buyers/:buyerId`, firebaseAuth, deleteBuyer);


/* QUERIES */
// // super admin
// // 1-GET /queries: Obtiene todas las consultas realizadas.
// app.get(`/${apiVersion}/queries`, firebaseAuth, getQueries);
// // 2-GET /queries/:id: Obtiene una consulta específica.
// app.get(`/${apiVersion}/queries/:queryId`, firebaseAuth, getQuery);

// // user admin
// 3-POST /queries: Almacena una nueva consulta hecha por un usuario a OpenAI.
app.post(`/${apiVersion}/queries`, queriesOpenAI);
// 3a-POST /queries: Almacena una nueva consulta hecha por un usuario a OpenAI y Algolia.
app.post(`/${apiVersion}/queries2`, firebaseAuth, queriesOpenAIAndAlgolia);
// // 4-GET /queries: Obtiene todas las consultas hechas por un usuario.
// app.get(`/${apiVersion}/queries`, firebaseAuth, getQueriesByUser);
// // 5-GET /queries/:queryId: Obtiene una de las consultas hechas por un usuario.
// app.get(`/${apiVersion}/queries/:queryId`, firebaseAuth, getQueryByUser);
// // 6-PUT /queries/:id: Actualiza una consulta específica hecha por un usuario.
// app.put(`/${apiVersion}/queries/:queryId`, firebaseAuth, updateQuery);
// // 7-DELETE /queries/:id: Elimina una consulta específica hecha por un usuario.
// app.delete(`/${apiVersion}/queries/:queryId`, firebaseAuth, deleteQuery);


// /* PRODUCTS SUGESTIONS */
// // super admin
// // 1-GET /products/sugestions: Obtiene todos los productos sugeridos.
// app.get(`/${apiVersion}/products/sugestions`, firebaseAuth, getSugestions);
// // 2-GET /products/sugestions/:id: Obtiene un producto sugerido específico.
// app.get(`/${apiVersion}/products/sugestions/:sugestionId`, firebaseAuth, getSugestion);

// // user admin
// // 3-POST /products/sugestions: Crea un nuevo producto sugerido.
// app.post(`/${apiVersion}/products-sugestions`, firebaseAuth, sugestions);
// // 4-PUT /products/sugestions/:id: Actualiza un producto sugerido específico.
// app.put(`/${apiVersion}/products-sugestions/:sugestionId`, firebaseAuth, updateSugestion);
// // 5-DELETE /products/sugestions/:id: Elimina un producto sugerido específico.
// app.delete(`/${apiVersion}/products-sugestions/:sugestionId`, firebaseAuth, deleteSugestion);


// export functions
exports.api = onRequest(app);

// triggers - sin testear despues de el ultimo cambio en el que se especifico solo entraran strings en el array de tags
exports.updateShowRoomOnProductCreate = functions.firestore
    .document('products/{productId}')
    .onCreate(async (snap, context) => {
        console.log('updateShowRoomOnProductCreate');
        // Obtener los datos del producto recién creado
        const newProduct = snap.data();

        // Verificar si el campo 'tags' existe y es un array
        if (newProduct.tags && Array.isArray(newProduct.tags)) {
            try {
                // ID del showroom a actualizar
                const showRoomId = newProduct.showRoom;

                // Referencia al documento del showroom
                const showRoomRef = admin.firestore().doc(`showRooms/${showRoomId}`);

                // Obtener el documento actual del showroom
                const showRoomSnap = await showRoomRef.get();

                if (showRoomSnap.exists) {
                    const showRoomData = showRoomSnap.data();
                    let currentTags = showRoomData.tags || [];

                    // Convertir todos los tags a strings y filtrar tipos no deseados
                    const newTags = newProduct.tags
                        .map(tag => typeof tag === 'string' ? tag : tag.toString())
                        .filter(tag => typeof tag === 'string' && !currentTags.includes(tag));

                    if (newTags.length > 0) {
                        currentTags = [...currentTags, ...newTags];
                        await showRoomRef.update({ tags: currentTags });
                    }
                } else {
                    console.log('Showroom no encontrado:', showRoomId);
                }
            } catch (error) {
                console.error('Error al actualizar el showroom:', error);
            }
        }
    });
