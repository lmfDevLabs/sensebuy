// 🧩 Node built-in modules
import fs from 'fs';
import path from 'path';
import os from 'os';

// 🧪 External libraries
import Busboy from 'busboy';
import pdfParse from 'pdf-parse';

// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

// cheerio
import * as cheerio from 'cheerio';

// ⚙️ Utilities

// Cloud Storage
import {
	uploadFileToCloudStorage,
	downloadFileOfCloudStorage,
} from '../../utilities/cloudStorage.js';

// CSV
import {
	extractDataFromCSV,
} from '../../utilities/csv.js';

// Firestore
import {
	addDataToFirestore,
	saveEmbeddingsOnFirestore,
	saveUrlFromEmbeddingsAndDocsOfProductsFromSellers
} from '../../utilities/firestore.js';

// Embeddings
import {
	processCSVAndGenerateEmbeddings,
	getEmbeddingsFromOpenAI,
	createArrayWithEmbeddings,
	updateGlobalEmbeddingsFile
} from '../../utilities/embeddings.js';

// External Docs
import { 
	convertExcelToCSV,  
} from '../../utilities/externalDocs.js';

// LLM
import { 
	generateParagraphForProduct,  
	generateParagraphForProductWithLangChain
} from '../../utilities/openAi.js';

// Text Processing
import { 
	generateListOfKeyWordsOfProduct
} from '../../utilities/textProcessing.js';


//post products with only a .csv file
const xlsx = async (req, res) => {
	// upload file to firestore
	const uploadFileToBucket = async (filepath, mimetype) => {
			console.log('uploadFileToBucket');
			await bucket.upload(filepath, {
				resumable: false,
				metadata: {
					metadata: {
						contentType: mimetype
					}
				}
		});
	};

	// convert excel to csv
	const convertExcelToCSV = async (filepath) => {
			try {
				console.log('convertExcelToCSV');
				const xlsx = require('xlsx');
	
				// Lee el archivo Excel
				const workbook = xlsx.readFile(filepath);

				// Obtiene el nombre de la primera hoja
				const firstSheetName = workbook.SheetNames[0];

				// Convierte la hoja a formato CSV
				const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);

				// Crea el nuevo nombre del archivo, reemplazando la extensión
				const newFilepath = filepath.replace(/\.(xls|xlsx)$/, '.csv');

				// Escribe el archivo CSV
				fs.writeFileSync(newFilepath, csvData);

				return newFilepath;
			} catch (error) {
				console.error('Error converting Excel to CSV:', error);
				throw error;
			}
	};
			
	// extract csv data
	const extractDataFromCSV = (filepath) => {
		console.log('extractDataFromCSV');
		return new Promise((resolve, reject) => {
			const dataObject = [];
			fs.createReadStream(filepath)
				.pipe(csv())
				.on('data', (row) => {
					let car = {
							taxonomy:{}
					};
					for (const key in row) {
						let value = row[key].trim();

						// Convierte "true" o "false" a valores booleanos
						if (value.toLowerCase() === "true") {
							car.taxonomy[key] = true;
						} else if (value.toLowerCase() === "false") {
							car.taxonomy[key] = false;
						} 
						// Convierte "null" a null
						else if (value.toLowerCase() === "null") {
							car.taxonomy[key] = null;
						} 
						// Manejo especial para el campo "price"
						else if (key === 'price' && /^[0-9.]+$/.test(value)) {
							car.taxonomy[key] = parseInt(value.replace(/\./g, ''), 10);
						} 
						// Convierte números con puntos (decimales)
						else if (/^-?\d+(\.\d+)?$/.test(value)) {
							car.taxonomy[key] = parseFloat(value);
						}
						// Reemplaza espacios con guiones y convierte a minúsculas
						else {
							car.taxonomy[key] = value.toLowerCase();
						}
					}
					dataObject.push(car);
				})
			.on('end', () => resolve(dataObject))
			.on('error', reject);
		});
	};
	
	// extract keys & values
	const outputCategoriesAndTags = (obj) => {
		console.log('outputTaxonomy');
		let arrKeys = [];
		let arrValues = [];
		// Define las llaves especiales que quieres tratar de manera diferente
		const specialKeys = ['turbo', 'abs', 'parking_sensor', 'used', 'financial_aid'];

		// Recorre cada par llave-valor en el objeto
		Object.entries(obj).forEach(([key, value]) => {
			// Agrega todas las llaves al arreglo de llaves, excepto 'shortDescription'
			if (key !== 'short_description') {
				arrKeys.push(key);
			}	

			// Si la llave está en la lista de llaves especiales
			if (specialKeys.includes(key)) {
				// Si el valor es verdadero, agrega la llave al arreglo de valores
				if (value === true) {
					arrValues.push(key);
				}
			} else {
				arrValues.push(value);
			}
		});

		return {
			arrKeys, 
			arrValues
		};
	};

	// remove shortDescription
	const removeKeyValuePair = (obj, keys) => {
		// Clona el objeto para no modificar el original
		const newObj = { ...obj };

		// Elimina la clave
		keys.forEach(key => delete newObj[key]);

		// Retorna el nuevo objeto sin la clave especificada
		return newObj;
	}

	// add data to fb 
	const addProductsToFirestore = async (products) => {
		const batch = db.batch();
		const productCollection = db.collection('products_one');
		
		// loop over products
		products.forEach(async product => {
			let sd = product.taxonomy.short_description;
			let prize = product.taxonomy.price;
			const dataClean = removeKeyValuePair(product.taxonomy, ['short_description', 'price']);
			const productDoc = productCollection.doc(); 
			let dataObject = {
				// basic info
				name:product.taxonomy.name,
				shortDescription:sd,
				price:prize,
				// images
				imgUrl:[],
				// main data
				mainData:{
					category:product.taxonomy.category,
					brand:product.taxonomy.brand,
					model:product.taxonomy.model,
				},
				// metadata
				tags:outputCategoriesAndTags(dataClean).arrValues, 
				categories:outputCategoriesAndTags(dataClean).arrKeys,
				taxonomy:dataClean,
				// showroom data
				showRoom:req.params.showRoomId,
				// date 
				createdAt:new Date().toISOString(),
				// company data
				sellerIdOwner:req.params.sellerId,
				companyName:res.locals.companyData.name,
				coords:res.locals.coordsData,
			}
			// pass data to the doc
			batch.set(productDoc, dataObject);
		});
		await batch.commit();
	}; 
	
	try {
		// check if the user can post on products collection
		if(req.user.type === "seller"){
			console.log("hi seller");
			// get data from req
			const busboy = Busboy({ headers: req.headers });
			let filepath;
			let mimetype;

			busboy.on('file', (fieldname, file, filename, encoding, mime) => {
				// Verifica que el campo sea "csvFile" y que el tipo de archivo sea correcto
				if (
					//fieldname !== "csvFile" || mime !== 'text/csv'
					fieldname !== "xlsxFile" && mime !== 'multipart/form-data'
				) {
					throw new Error('Wrong file type submitted');
				}
				
				// Verifica que el ID del vendedor esté definido
				if (!req.params.sellerId) {
					throw new Error('Seller ID is undefined');
				}
		
				//const csvFileExtension = "csv";
				const newFileName = `${req.params.sellerId} - ${filename.filename}`;
				filepath = path.join(os.tmpdir(), newFileName);
				mimetype = mime;
		
				file.pipe(fs.createWriteStream(filepath));
			});
			// wait for the file to be uploaded
			await new Promise((resolve, reject) => {
				busboy.on('finish', resolve);
				busboy.on('error', reject);
				busboy.end(req.rawBody);
			});
			// run main methods
			await uploadFileToBucket(filepath, mimetype);
			// convert .xls en .csv
			const csvFilepath = await convertExcelToCSV(filepath);
			// extract data from csv
			const dataObjectTaxo = await extractDataFromCSV(csvFilepath);
			// print
			console.log('dataObjectTaxo:', dataObjectTaxo);
			// add data to firestore
			await addProductsToFirestore(dataObjectTaxo);
			// print
			console.log('List of Cars:', dataObjectTaxo);
			// erase temp file
			fs.unlink(filepath, (err) => {
				if (err) {
					console.error('Error removing temp file:', err);
				}
			});
			// res
			res.json({ message: 'xlsx file was uploaded successfully' });
		} else {
			res.status(500).json({ error: 'you must have the require permissions' });
		}
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: err.message });
	}
}

// post products with only a .csv file and do the embbedings part
const xlsx2 = async (req, res) => {
	// main
	try {
		if(req.user.type === "seller"){
			console.log("Hi seller");
			// vars
			const busboy = Busboy({ headers: req.headers });
			const csvFileExtension = "csv";
			const newFileName = `${req.params.showRoomId} - `;
			let filepath = path.join(os.tmpdir(), newFileName);
			let mimetype;
			// on file
			busboy.on('file', (fieldname, file, filename, encoding, mime) => {
				// if(fieldname !== "xlsxFile" || !['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(mime)) 
				// if(fieldname !== "csvFile" || mime !== 'text/csv')
				if(fieldname !== "xlsxFile" && mime !== 'multipart/form-data')
				{
					console.log('File type or fieldname is not supported:', fieldname, mime);
					return; // Ignora el archivo si no coincide con los criterios
				}
				filepath += filename.filename
				mimetype = mime;
				file.pipe(fs.createWriteStream(filepath));
			});
			// on finish    
			busboy.on('finish', async () => {
				try {
					// data from req
					const sellerId = req.params.sellerId;
					
					// ** methods
					// upload file to gcp bucket
					await uploadFileToBucket(filepath, mimetype);
					// convert .xls en .csv
					const csvOfProductsFilepath = await convertExcelToCSVAndCreatePath(filepath);
					// extract data from csv
					const extractDataFromCSVFile = await extractDataFromCSV(csvOfProductsFilepath);
					// add data of products to firestore
					const productsToFirestore = await addProductsToFirestore(extractDataFromCSVFile);
					// process csv and generate embeddings
					const createEmbeddingsOfProducts = await processCSVAndGenerateEmbeddings(extractDataFromCSV,sellerId);
					// save embeddings on firestore
					const embbedingsToFirestore = saveEmbeddingsOnFirestore(createEmbeddingsOfProducts);
					// 
					const csvOfEmbeddingsToBucket = createCSVToEmbeddings(createEmbeddingsOfProducts,filepath,mimetype);
					//const chromaSaveProccess = saveEmbeddingsOnChromaDB(embeddings);
					// Sube el archivo CSV al bucket de GCP
					uploadFileToBucket(csvFilePath,mimetype);
					// erase temp file
					fs.unlink(filepath, (err) => { // Elimina el archivo temporal
							if (err) console.error('Error removing temp file:', err);
					});
					// send response
					res.json({ message: 'XLSX file was processed and uploaded successfully' });
				} catch (error) {
					console.error('Error inside busboy finish:', error);
					res.status(500).json({ error: error.message });
				}
			});
			// on error
			busboy.on('error', error => console.log('Busboy error:', error));
			// wait for the file to be uploaded
			await new Promise((resolve, reject) => {
				busboy.on('file', resolve);
				busboy.on('finish', resolve);
				busboy.on('error', reject);
				busboy.end(req.rawBody);
			});
		} else {
			res.status(403).json({ error: 'You must have the required permissions' });
		}
	} catch (err) {
		console.error('Global error:', err);
		res.status(500).json({ error: err.message });
	}
}

// post products with only a .csv file and do the complete embbedings part
const xlsx3 = async (req, res) => {
	try {
		// check if the user can post on products collection
		if(req.user.type === "seller"){
			// req params
			let sellerId = req.params.sellerId; 
			let showRoomId = req.params.showRoomId
			// busboy
			const busboy = Busboy({ headers: req.headers });
			// file
			let mimetype = ''
			let newFileName = ''
			let cloudStoragePath = ''
			let tempFilePath = ''
			// path to global csv file of embeddings
			let showRoomCsvFilePath = `${showRoomId}/${showRoomId}_embedding.json`
			// on file
			busboy.on('file', (fieldname, file, filename, encoding, mime) => {
				// if (mime !== 'text/csv' && !mime.includes('spreadsheetml')) 
				if(fieldname !== "xlsxFile" && mime !== 'multipart/form-data')
				{
					console.log('File type not supported:', mime);
					return; // Ignora el archivo si no es CSV o XLSX
				}
				newFileName = `${req.params.sellerId}-${filename.filename}`;
				// console.log('newFileName:', newFileName);
				tempFilePath = path.join(os.tmpdir(),newFileName)
				// console.log('tempFilePath:', tempFilePath);
				cloudStoragePath = path.join(showRoomId,"docs_sellers",sellerId,newFileName)
				// console.log('cloudStoragePath:', cloudStoragePath);
				mimetype = mime;
				file.pipe(fs.createWriteStream(tempFilePath));
			}); 
			// on finish
			busboy.on('finish', async () => {
				try {
					// ** methods
					// upload xlsx file to cloud storage
					// const uploadXlsxFileToBucket = await uploadFileToCloudStorage(tempFilePath,mimetype)
					const uploadXlsxFileToBucket = await uploadFileToCloudStorage(tempFilePath, cloudStoragePath, mimetype);
					// convert .xls en .csv
					const csvOfProductsFilepath = await convertExcelToCSV(tempFilePath);
					// console.log('csvOfProductsFilepath:', csvOfProductsFilepath);
					// extract data from csv
					const extractDataFromCSVFile = await extractDataFromCSV(csvOfProductsFilepath)
					// console.log('extractDataFromCSVFile:', extractDataFromCSVFile);
					// add data of products to firestore
					const optionsDB = {
						data: extractDataFromCSVFile,
						collection: 'products',
						extras: {
							sellerId:sellerId,
							companyName:res.locals.companyData.name,
							coords:res.locals.coordsData,
							showRoomId 
						}
					} 
					const productIdToFirestore = await addDataToFirestore(optionsDB); 
					// process csv and generate embeddings
					const createEmbeddingsOfProducts = await processCSVAndGenerateEmbeddings(
						extractDataFromCSVFile, 
						// new
						optionsDB.extras.sellerId,
						optionsDB.extras.companyName,
						productIdToFirestore
					);
					// check for if embeddings exist
					if(createEmbeddingsOfProducts.length > 0) {
						// print 
						// console.log("there are embeddings");
						// save embeddings on firestore
						const embbedingsToFirestore = await saveEmbeddingsOnFirestore(
							createEmbeddingsOfProducts,
							showRoomId,
							// // new
							// optionsDB.extras.sellerId,
							// optionsDB.extras.companyName,
							// productIdToFirestore
						);
						// save embeddings on bucket
						const arrayOfEmbeddings = await createArrayWithEmbeddings(createEmbeddingsOfProducts);
						// print
						// console.log({arrayOfEmbeddings});
						// save embeddings on bucket
						const downloadGlobalEmbeddingsFileFromBucket = await downloadFileOfCloudStorage(showRoomCsvFilePath);
						// print
						// console.log('downloadGlobalCsvFileFromBucket:', downloadGlobalCsvFileFromBucket);
						// update global json file
						const updateGlobalEmbeddingJsonFile = await updateGlobalEmbeddingsFile(downloadGlobalEmbeddingsFileFromBucket,arrayOfEmbeddings);
						// upload xlsx file to cloud storage
						const uploadJsonFileJustUpdatedToBucket = await uploadFileToCloudStorage(downloadGlobalEmbeddingsFileFromBucket, showRoomCsvFilePath, mimetype);
						// Guardar la ruta del archivo en la colección de sellers en Firestore
						saveUrlFromEmbeddingsAndDocsOfProductsFromSellers(cloudStoragePath,sellerId)
					}
				} catch (error) {
					console.error('Error inside busboy finish:', error);
					res.status(500).json({ error: error.message });
				} finally {
					// Limpieza: elimina el archivo temporal
					fs.unlink(tempFilePath, (err) => {
						if (err) console.error('Error removing temp file:', err);
					});
				}
			});

			// on error
			busboy.on('error', error => console.log('Busboy error:', error));

			// wait for the processes to finish
			await new Promise((resolve, reject) => {
				busboy.on('file', resolve);
				busboy.on('finish', resolve);
				busboy.on('error', reject);
				busboy.end(req.rawBody);
			});
			
			req.pipe(busboy);
		}
	} catch (err) {
		console.error('Global error:', err);
		res.status(500).json({ error: err.message });
	}
};

// post products with only a .csv file and do the complete embeddings part with LangChain <--------
const xlsx4 = async (req, res) => {
	try {
		console.log("xlsx4")
		if (req.user.type === "seller") {
			// tracers langsmith
			const tracedUploadFileToCloudStorage = traceable(uploadFileToCloudStorage, { 
				name: "uploadFileToCloudStorage", 
				run_type: "tool",
				metadata: { sellerId: "123", environment: "production" }
			});
			
			// req data
			let sellerId = req.params.sellerId;
			let showRoomId = req.params.showRoomId;
			const busboy = Busboy({ headers: req.headers });
			let mimetype = "";
			let newFileName = "";
			let cloudStoragePath = "";
			let tempFilePath = "";

			// data events
			busboy.on("file", (fieldname, file, filename, encoding, mime) => {
				if (fieldname !== "xlsxFile" && mime !== "multipart/form-data") return;
				newFileName = `${req.params.sellerId}-${filename.filename}`;
				tempFilePath = path.join(os.tmpdir(), newFileName);
				cloudStoragePath = path.join(showRoomId, "docs_sellers", sellerId, newFileName);
				mimetype = mime;
				file.pipe(fs.createWriteStream(tempFilePath));
			});

			busboy.on("finish", async () => {
				try {
					await uploadFileToCloudStorage(tempFilePath, cloudStoragePath, mimetype);
					const csvOfProductsFilepath = await convertExcelToCSV(tempFilePath);
					const extractDataFromCSVFile = await extractDataFromCSV(csvOfProductsFilepath);
	
					for (const product of extractDataFromCSVFile.data) {
						const exampleParagraph = `El ${product['productData_Make'] || 'N/A'} ${product['productData_Model'] || 'N/A'} del año ${product['Year'] || 'N/A'} ...`;
						// parrafo activo generacion
						const activeParagraph = await generateParagraphForProductWithLangChain(
							product,
							product.name || 'Producto sin nombre',
							extractDataFromCSVFile.descriptions,
							exampleParagraph
						);
			
						product.activeParagraph = activeParagraph;
						product.keyWords = generateListOfKeyWordsOfProduct(activeParagraph);
					}
			
					const optionsDB = {
						data: extractDataFromCSVFile.data,
						collection: 'products',
						extras: {
							sellerId,
							companyName: res.locals.companyData.name,
							coords: res.locals.coordsData,
							showRoomId
						}
					};
		
					await addDataToFirestore(optionsDB);
					res.status(200).send({ message: 'Productos subidos y procesados correctamente.' });
				} catch (error) {
					console.error(error);
					res.status(500).send({ error: 'Error al procesar el archivo.' });
				}
			});
	
			req.pipe(busboy);
		} else {
			res.status(403).send({ error: 'Permiso denegado: solo los vendedores pueden subir productos.' });
		}
	} catch (error) {
		console.error(error);
		res.status(500).send({ error: 'Error interno del servidor.' });
	}
};

// post products with only a .csv file and do the complete embeddings part with LangChain y eco lang <--------
const xlsx5 = async (req, res) => {
	try {
		console.log("xlsx5");
	
		if (req.user.type !== "seller") {
			return res.status(403).send({ error: 'Permiso denegado: solo los vendedores pueden subir productos.' });
		}
	
		const sellerId = req.params.sellerId;
		const showRoomId = req.params.showRoomId;
	
		const busboy = Busboy({ headers: req.headers });
		let mimetype = "";
		let newFileName = "";
		let cloudStoragePath = "";
		let tempFilePath = "";
	
		busboy.on("file", (fieldname, file, filename, encoding, mime) => {
			if (fieldname !== "xlsxFile" && mime !== "multipart/form-data") return;
			newFileName = `${sellerId}-${filename.filename}`;
			tempFilePath = path.join(os.tmpdir(), newFileName);
			cloudStoragePath = path.join(showRoomId, "docs_sellers", sellerId, newFileName);
			mimetype = mime;
			file.pipe(fs.createWriteStream(tempFilePath));
		});
	
		busboy.on("finish", async () => {
			try { 

				// 1. Upload file to cloud storage
				const tracedUploadFileToCloudStorage = traceable(
					uploadFileToCloudStorage, 
					{
						name: "uploadFileToCloudStorage",
						run_type: "tool",
						extractInputs: (tempFilePath, cloudStoragePath, mimetype) => ({
							tempFilePath,
							cloudStoragePath,
							mimetype,
						}),
						extractOutputs: (output) => output,
						metadata: { sellerId, showRoomId },
						tags: ['1. upload xlsx'],
					}
				);

				// run it tracer tracedUploadFileToCloudStorage
				const { success, path, mime, uploadedAt } = await tracedUploadFileToCloudStorage(
					tempFilePath,
					cloudStoragePath,
					mimetype
				);

				// console.log({ success, path, mime, uploadedAt });

				// 2. Convert to CSV
				const tracedConvertExcelToCSV = traceable(
					convertExcelToCSV,
					{
						name: "convertExcelToCSV",
						run_type: "tool",
						extractInputs: (tempFilePath) =>({
							tempFilePath
						}),
						extractOutputs: (output) => output,
						metadata: { sellerId, showRoomId },
						tags: ['2. convert xlsx to csv'],
					}
					
				);

				// console.log({tempFilePath})

				// run it tracer tracedConvertExcelToCSV
				const { csvFilePath } = await tracedConvertExcelToCSV(
					tempFilePath
				)

				// console.log({ csvFilePath });

				// 3. Extract data from CSV
				const tracedExtractDataFromCSV = traceable(
					extractDataFromCSV,
					{

						name: "extractDataFromCSV",
						run_type: "tool",
						extractInputs: (csvFilePath) =>({
							csvFilePath
						}),
						extractOutputs: (output) => output,
						metadata: { sellerId, showRoomId },
						tags: ['3. extract data from csv']
					}
				);

				// run it tracer tracedExtractDataFromCSV
				const { 
					data,
                    descriptions,
                    count,
                    keys
				} = await tracedExtractDataFromCSV(
					csvFilePath
				)

				// console.log({ data, descriptions, count, keys });

				// parrafo ejemplo
				const exampleParagraph = 
					` 
						El Ford Escape del año 2023 es un vehículo SUV disponible en color Blue, 
						White, Black. Está equipado con un motor de 1.5 litros, que funciona con 
						Gasoline, generando 181 caballos de fuerza y 190 Nm de torque. Este modelo 
						puede acelerar de 0 a 60 mph en 7.1 segundos, con una velocidad máxima de 130 mph 
						y un rendimiento de combustible de 30 millas por galón. En cuanto a la seguridad, 
						incluye ABS, Airbags, Ford Co-Pilot360, Rear View Camera. El interior cuenta con 
						Cloth Seats, Keyless Entry, Power Windows, ofreciendo confort y tecnología, mientras 
						que el exterior destaca por LED Headlights, 18-inch Alloy Wheels, aportando estilo y 
						funcionalidad. Además, incluye características de entretenimiento como 8-inch 
						Touchscreen Display. El precio del vehículo es de $27650, y tiene una calificación 
						promedio de los clientes de 4.6.
					`

				// 4. Generacion de parrafo activo
				const tracedGenerateParagraphForProductWithLangChain = traceable(
					generateParagraphForProductWithLangChain,
					{
						name: "generateParagraphForProductWithLangChain",
						run_type: "llm",
						extractInputs: (product, productName, descriptions, exampleParagraph ) =>({
							product,
							productName,
							descriptions,
							exampleParagraph
						}),
						extractOutputs: (output) => output,
						metadata: { sellerId, showRoomId },
						tags: ['4. generate active paragraph'],
					}
				)

				// Procesamiento de cada producto
				for (const product of data) {
					// console.log({product})
					// run it tracer tracedGenerateParagraphForProductWithLangChain
					const { activeParagraph } = await tracedGenerateParagraphForProductWithLangChain(
						product, `${product.car_make} - ${product.car_model}`, descriptions, exampleParagraph
					)
					// console.log({activeParagraph})
					// extract and assign
					product.activeParagraph = activeParagraph;
					console.log(JSON.stringify(product.activeParagraph))

					// 5. obtener keywords
					const tracedGenerateListOfKeyWordsOfProduct = traceable(
						generateListOfKeyWordsOfProduct,
						{
							name: "generateListOfKeyWordsOfProduct",
							run_type: "tool",
							extractInputs: (activeParagraph) =>({
								activeParagraph
							}),
							extractOutputs: (output) => output,
							metadata: { sellerId, showRoomId },
							tags: ['5. generate list of keywords']
						}
					)

					// run it tracer tracedGenerateListOfKeyWordsOfProduct
					const { listOfKeyWords } = await tracedGenerateListOfKeyWordsOfProduct(
						product.activeParagraph
					)

					product.keyWords = listOfKeyWords;
				}
	
				// 6. Guardar en Firestore
				// props for db part
				const optionsDB = {
					data,
					collection: 'products',
					extras: {
						sellerId,
						companyName: res.locals.companyData.name,
						coords: res.locals.coordsData,
						showRoomId
					}
				};

				const tracedAddDataToFirestore = traceable(
					addDataToFirestore,
					{
						name: "addDataToFirestore",
						run_type: "tool",
						extractInputs: (optionsDB) =>({
							optionsDB
						}),
						extractOutputs: (output) => output,
						metadata: { sellerId, showRoomId },
						tags: ['6. firestore save data']
					}
				);

				// run it tracer tracedAddDataToFirestore
				const { documentIds } = await tracedAddDataToFirestore(
					optionsDB
				)
				
				console.log({documentIds})
				// res
				res.status(200).send({ message: 'Productos subidos y procesados correctamente.' });
	
			} catch (error) {
				console.error("Error en flujo de procesamiento:", error);
				res.status(500).send({ error: 'Error al procesar el archivo.' });
			}
		});

		// on error
		busboy.on('error', error => console.log('Busboy error:', error));

		// wait for the processes to finish
		await new Promise((resolve, reject) => {
			busboy.on('file', resolve);
			busboy.on('finish', resolve);
			busboy.on('error', reject);
			busboy.end(req.rawBody);
		});

		req.pipe(busboy);
	} catch (error) {
		console.error("Error general en ruta xlsx5", error);
		res.status(500).send({ error: 'Error interno del servidor.' });
	}
};



////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////// DOCS //////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////

// para subir documentos .pdf a los productos de los vendedores
const docsPdf = async (req, res) => {
	try {
		// params
		const { sellerId, showRoomId, productId } = req.params;
		// ask for params
		if (!sellerId || !showRoomId || !productId) {
			return res.status(400).send('Missing required query parameters');
		} 
		// Subida del PDF
		let filePath = '';
		let filename = '';
		let mimetype = '';
		// pdf upload
		await new Promise((resolve, reject) => {
			const busboy = Busboy({
				headers: req.headers,
				limits: {
					fileSize: 10 * 1024 * 1024, // Límite de tamaño de archivo de 10MB
				},
			});

			busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
				console.log(`Received file: ${JSON.stringify(filename)}`);
				
				// Ensure filename is a string
				if (typeof filename === 'object' && filename !== null && 'filename' in filename) {
					filename = filename.filename;
					console.log('Uploading to: ' + filePath);
				}

				if (typeof filename !== 'string') {
					const errMsg = `Invalid filename type: ${typeof filename}`;
					console.error(errMsg);
					return reject(new Error(errMsg));
				}

				filePath = path.join(os.tmpdir(), path.basename(filename));
				console.log('Uploading to: ' + filePath);
				const writeStream = fs.createWriteStream(filePath);

				file.pipe(writeStream);

				writeStream.on('close', () => {
					console.log(`File [${fieldname}] Finished uploading to: ${filePath}`);
					resolve();
				});

				writeStream.on('error', (err) => {
					console.error('Error writing file:', err);
					reject(err);
				});

				file.on('end', () => {
					console.log('File stream ended');
				});
			});

			busboy.on('finish', () => {
				console.log('Upload complete');
			});

			busboy.on('error', (err) => {
				console.error('Error handling file upload:', err);
				reject(err);
			});

			busboy.end(req.body);
		});
		// Leer y procesar el PDF
		const pdfBuffer = fs.readFileSync(filePath);
		const pdfData = await pdfParse(pdfBuffer);
		const pdfText = pdfData.text;
		// Generar embeddings desde OpenAI
		const newEmbeddings = await getEmbeddingsFromOpenAI(pdfText);
		// Ruta para guardar el archivo JSON
		const jsonFilePath = `${showRoomId}/docs_sellers/${sellerId}/${sellerId}-embeddings.json`;
		// Leer el archivo JSON existente o crear uno nuevo
		let embeddingsData = [];
		try {
			const [fileExists] = await storage.bucket(bucketName).file(jsonFilePath).exists();
			if (fileExists) {
				const tempFilePath = path.join(os.tmpdir(), `${sellerId}.json`);
				await storage.bucket(bucketName).file(jsonFilePath).download({ destination: tempFilePath });
				const fileContent = fs.readFileSync(tempFilePath, 'utf8');
				embeddingsData = JSON.parse(fileContent);
			}
		} catch (error) {
			console.log('No se encontró un archivo existente, se creará uno nuevo.');
		} 
		// Actualizar array de embeddings con data
		embeddingsData.push({ productId, embeddings: newEmbeddings });
		const tempFilePath = path.join(os.tmpdir(), `${sellerId}.json`);
		fs.writeFileSync(tempFilePath, JSON.stringify(embeddingsData, null, 2));
		// Subir archivo actualizado con embeddings
		await uploadFileToCloudStorage(tempFilePath, jsonFilePath);
		console.log('Embeddings actualizados y subidos con éxito.');
		// send res
		res.status(200).send("Embeddings generados y archivo subido con éxito.");
	} catch (err) {
		console.error('Unexpected error:', err);
		res.status(500).send('Unexpected error');
	}
}

// para subir documentos .html a los productos de los vendedores, procesarlos y almacenarlos en el index
const docsHtml = async (req, res) => {
	const { url } = req.body;

	if (!url) {
		return res.status(400).json({ error: 'Missing URL in request body' });
	}

	try {
		// 1. Descargar HTML
		const response = await fetch(url);
		if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
		const html = await response.text();

		// 2. Parsear HTML
		const $ = cheerio.load(html);

		// 3. Eliminar elementos irrelevantes
		$('nav, footer, aside, script, style, noscript').remove();
		$('[aria-hidden="true"], [style*="display: none"]').remove();

		// 4. Selectores candidatos
		const candidates = [
			'main',
			'article',
			'section',
			'div.content',
			'div.main',
			'div.post',
			'div.description',
			'div.body',
		];

		let extractedBlocks = [];

		for (const selector of candidates) {
		const el = $(selector);
		if (el.length > 0) {
			const text = el.text().trim().replace(/\s+/g, ' ');
			const wordCount = text.split(' ').length;
			const sentenceCount = (text.match(/\./g) || []).length;

			if (wordCount > 50) {
			extractedBlocks.push({
				selector,
				wordCount,
				sentenceCount,
				text,
			});
			}
		}
		}

		// 5. Ordenar por score (word count + sentence weight)
		extractedBlocks.sort((a, b) => {
			const aScore = a.wordCount + a.sentenceCount * 10;
			const bScore = b.wordCount + b.sentenceCount * 10;
			return bScore - aScore;
		});

		// 6. Enviar los 3 más representativos
		const topBlocks = extractedBlocks.slice(0, 3);

		return res.status(200).json({ blocks: topBlocks });
	} catch (err) {
		console.error('Error extracting HTML:', err);
		return res.status(500).json({ error: 'Failed to extract text from URL' });
	}
}


// module exports
export {
    xlsx,
	xlsx2,
	xlsx3,
	xlsx4, 
	xlsx5, // <----------
	docsPdf,
	docsHtml 
};