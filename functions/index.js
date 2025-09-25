// Firebase Functions
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from 'firebase-admin';
// Fetch (Node 18+)
const fetch = globalThis.fetch;

// EXPRESS
import express from 'express';
const app = express();

// CORS
import cors from 'cors';
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// MIDDLEWARES
import firebaseAuth from './firebase/firebaseAuth.js';
import coordsOfSellers from './utilities/middlewares/coordsOfSellers.js';

// HANDLERS

// sellers
import {
  sellers,
  coords,
} from './handlers/sellers/sellers.js';

// products
import {
  xlsx,
  xlsx2,
  xlsx3,
  xlsx4,
  xlsx5,
  docsPdf,
  docsHtml,
} from './handlers/products/products.js';
import { postProductManual } from './handlers/products/postProductManual.js';
import { createPdfUploadUrl } from './handlers/pdfs/uploadUrl.js';

// buyers 
import {
  buyers,
  tokenBuyers,
} from './handlers/buyers/buyers.js';

// queries
import {
  queriesOpenAI,
  queriesOpenAIAndAlgolia,
} from './handlers/queries/queries.js';

// chats
import {
  chatsOnlyLLM,
  chatWithOpenAIAndAlgolia,
  chatsNlpApiForDocs,
  chatsNlpApiForComposeDescription,
} from './handlers/chats/chats.js';
import { sendMessage } from './handlers/chats/sendMessage.js';

// whatsapp
import {
  getWhats,
  postWhats,
} from './handlers/whatsapp/whatsapp.js';

// UTILITIES
import {
  downloadDocFromExternalUrl
} from './utilities/externalDocs.js';

// TRIGGERS
// ops
// import updateShowRoomOnProductCreate from './triggers/updateShowRoomOnProductCreate.js';
// import docsProcessingOnProductCreate from './triggers/docsProcessingOnProductCreate.js';
// import detectTelemetryEventsForAllDevices from './triggers/detectTelemetryEventsForAllDevices.js';

// flows
import saveActiveParagraphAsChunk from './triggers/saveActiveParagraphAsChunk.js';
import queueHtmlDocument from './triggers/queueHtmlDocument.js';
import processHtmlDocument from './triggers/processHtmlDocument.js';
import queuePdfDocument from './triggers/queuePdfDocument.js';
import processPdfDocument from './triggers/processPdfDocument.js';
import queueChunkPrepOnProductsPdfCreate from './triggers/onProductsPdfCreate.js';
import { queueChunkEmbeddingOnCreate, queueChunkEmbeddingOnUpdate } from './triggers/queueChunkEmbeddings.js';
import processChunkEmbedding from './triggers/processChunkEmbedding.js';
import processChunkIndexing from './triggers/processChunkIndexing.js';
import requeuePendingEmbeddings from './triggers/requeuePendingEmbeddings.js';
import processChatMessage from './triggers/processChatMessage.js';
import requeueStuckChatMessages from './triggers/requeueStuckChatMessages.js';
import chunkPrepFromPdf from './workers/chunkPrepFromPdf.js';
// import extractChunksFromProductUrlsOnCreate from './triggers/extractChunksFromProductUrlsOnCreate.js';


//////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////// API REST ROUTES ///////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////

// API Version
const apiVersion = "v1"

// dotenv
// require('dotenv').config()
import dotenv from 'dotenv';
dotenv.config();

// Set the maximum instances to 10 for all functions
setGlobalOptions({ maxInstances: 10 });

// test
app.get(`/${apiVersion}/test`, async (req, res) => {
  console.log("Test route")
  // const messageTest = await publishChatMessageForNlp('chats', { sessionId: '12345', userQuery: 'Hola, busco una camioneta 2024' });
  let time = admin.firestore.FieldValue.serverTimestamp()
  res.send(`hi time: ${time}`)
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
// 7-POST /products/xls: Para agregar productos a través de un archivo xlsx.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/products/xlsx`, firebaseAuth, coordsOfSellers, xlsx);
// 8-POST /products/xls2: Para agregar productos a través de un archivo xlsx and embbeding stuff.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/products/xlsx2`, firebaseAuth, coordsOfSellers, xlsx2);
// 9-POST /products/xls3: Para agregar productos a través de un archivo xlsx and embbeding complete cycle.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/products/xlsx3`, firebaseAuth, coordsOfSellers, xlsx3);
// 10-POST /products/xls4: Para agregar productos a través de un archivo xlsx con pipeline de embeddings.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/products/xlsx4`, firebaseAuth, coordsOfSellers, xlsx4);
// 11-POST /products/xls5: Para agregar productos a través de un archivo xlsx y embeddings con trazabilidad LangSmith.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/products/xlsx5`, firebaseAuth, coordsOfSellers, xlsx5);
// 11b-POST /products/manual: Para agregar un producto individual mediante JSON reutilizando el pipeline de xlsx5.
app.post(`/${apiVersion}/sellers/:sellerId/showrooms/:showRoomId/products/manual`, firebaseAuth, coordsOfSellers, postProductManual);
// 12-POST /products/:productId/docs: Para agregar documentos a un producto.
app.post(`/${apiVersion}/showroom/:showRoomId/seller/:sellerId/product/:productId/docsPdf`, docsPdf);
// 13-Test /testUrlPdf Para probar la creacion de los embeddings de un pdf
app.get(`/${apiVersion}/testUrlPdf`, async (req,res)=>{
  let result = await downloadDocFromExternalUrl(req.body.url)
  console.log({result})
}) 
// 14-POST /products/:productId/docs: Para agregar documentos html a un producto.
app.post(`/${apiVersion}/docsHtml`, firebaseAuth, docsHtml);
app.post(`/${apiVersion}/pdf/upload-url`, firebaseAuth, createPdfUploadUrl);

/* BUYERS */
// // super admin
// // 1-GET /buyers: Obtiene todos los compradores.
// app.get(`/${apiVersion}/buyers`, firebaseAuth, getBuyers);
// // 2-GET /buyers/:id: Obtiene un comprador específico.
// app.get(`/${apiVersion}/buyers/:buyerId`, firebaseAuth, getBuyer);

// // user admin
// 3-POST /buyers: Crea un nuevo comprador.
app.post(`/${apiVersion}/buyers`, firebaseAuth, buyers);
// get json token to publish messages over pubsub
app.get(`/${apiVersion}/buyersToken/:showRoomId`, firebaseAuth, tokenBuyers);
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

/* CHATS */
// // super admin
// // 1-GET /chats: Obtiene todos los chats.
// app.get(`/${apiVersion}/chats`, firebaseAuth, getChats);
// // 2-GET /chats/:id: Obtiene un chat específico.
// app.get(`/${apiVersion}/chats/:chatId`, firebaseAuth, getChat);

// // user admin
// // 3-POST /chats: Crea un nuevo chat para interactuar con llm.
app.post(`/${apiVersion}/chats`, firebaseAuth, chatsOnlyLLM);
app.post(`/${apiVersion}/chats/sendMessage`, firebaseAuth, sendMessage);
// // 3a-POST /chats-nlp-api: Crea un nuevo chat para interactuar con api nlp.
app.post(`/${apiVersion}/chats-nlp-api-docs`, firebaseAuth, chatsNlpApiForDocs);
// // 3b-POST /chats-nlp-api: Crea un nuevo chat para interactuar con api nlp.
app.post(`/${apiVersion}/chats-nlp-api-compose`, firebaseAuth, chatsNlpApiForComposeDescription);

// // 4-PUT /chats/:id: Actualiza un chat específico.
// app.put(`/${apiVersion}/chats/:chatId`, firebaseAuth, updateChat);
// // 5-DELETE /chats/:id: Elimina un chat específico.
// app.delete(`/${apiVersion}/chats/:chatId`, firebaseAuth, deleteChat);
// 6-POST /${apiVersion}/chats/:chatId/session/:sessionId accede a un chat ya creado con una busqueda en algolia
app.post('/${apiVersion}/chats/session/:sessionId',firebaseAuth, chatWithOpenAIAndAlgolia)

// /* WHATSAPP */
app.get(`/${apiVersion}/webhook`,getWhats)
app.post(`/${apiVersion}/webhook`,postWhats)

// export functions
const api = onRequest(app);

export {
  api,

  // triggers
  // triggers ops
  // updateShowRoomOnProductCreate,
  // docsProcessingOnProductCreate,
  // detectTelemetryEventsForAllDevices,

  // triggers flows
  saveActiveParagraphAsChunk,
  queueHtmlDocument,
  processHtmlDocument,
  queuePdfDocument,
  processPdfDocument,
  queueChunkPrepOnProductsPdfCreate,
  queueChunkEmbeddingOnCreate,
  queueChunkEmbeddingOnUpdate,
  processChunkEmbedding,
  processChunkIndexing,
  requeuePendingEmbeddings,
  processChatMessage,
  requeueStuckChatMessages,
  chunkPrepFromPdf,
  // extractChunksFromProductUrlsOnCreate
}