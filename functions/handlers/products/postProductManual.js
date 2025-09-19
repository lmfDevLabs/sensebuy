import { traceable } from 'langsmith/traceable';

import { ProductManualSchema } from '../../schemas/productManual.js';
import { generateParagraphForProductWithLangChain } from '../../utilities/openAi.js';
import { generateListOfKeyWordsOfProduct } from '../../utilities/textProcessing.js';
import { addDataToFirestore } from '../../utilities/firestore.js';

const exampleParagraph = `
El Ford Escape del año 2023 es un vehículo SUV disponible en color Blue,
White, Black. Está equipado con un motor de 1.5 litros, que funciona con
Gasoline, generando 181 caballos de fuerza y 190 Nm de torque. Este modelo
puede acelerar de 0 a 60 mph en 7.1 segundos, con una velocidad máxima de 130 mph
y un rendimiento de combustible de 30 millas por galón. En cuanto a la seguridad,
incluye ABS, Airbags, Ford Co-Pilot360, Rear View Camera. El interior cuenta con
Cloth Seats, Keyless Entry, Power Windows, ofreciendo confort y tecnología, mientras
que el exterior destaca por LED Headlights, 18-inch Alloy Wheels, aportando estilo y
funcionalidad. Además, incluye características de entretenimiento como 8-inch Touchscreen Display.
El precio del vehículo es de $27650, y tiene una calificación promedio de 4.6.
`.trim();

const ATTRIBUTE_LABELS = {
  car_make: 'Marca del vehículo',
  car_model: 'Modelo del vehículo',
  description: 'Descripción',
  year: 'Año',
  body_type: 'Tipo de carrocería',
  color_options: 'Opciones de color',
  fuel_type: 'Tipo de combustible',
  engine_size_l: 'Motor (L)',
  horsepower: 'Caballos de fuerza',
  torque_nm: 'Torque (Nm)',
  transmission_type: 'Tipo de transmisión',
  acceleration_0_60_mph: 'Aceleración 0 a 60 mph (s)',
  top_speed_mph: 'Velocidad máxima (mph)',
  mileage_mpg: 'Rendimiento de combustible (mpg)',
  safety_features: 'Características de seguridad',
  entertainment_features: 'Características de entretenimiento',
  interior_features: 'Equipamiento interior',
  exterior_features: 'Equipamiento exterior',
  price: 'Precio (USD)',
  customer_ratings: 'Calificación de clientes',
  pics: 'Imágenes del producto',
  pdf: 'Documentos PDF',
  product_url: 'URL del producto',
  notes_seller: 'Notas del vendedor',
};

const ARRAY_FIELDS_TO_JOIN = [
  'color_options',
  'safety_features',
  'entertainment_features',
  'interior_features',
  'exterior_features',
  'pics',
  'pdf',
];

const buildAttributeDictionary = (product) => {
  const dictionary = {};
  Object.keys(product).forEach((key) => {
    dictionary[key] = {
      descripcion: ATTRIBUTE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
    };
  });
  return dictionary;
};

const prepareProductForLlm = (product) => {
  const formatted = { ...product };
  ARRAY_FIELDS_TO_JOIN.forEach((field) => {
    if (Array.isArray(formatted[field])) {
      formatted[field] = formatted[field].join(', ');
    }
  });
  return formatted;
};

export const postProductManual = async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'seller') {
      return res.status(403).send({
        error: 'Permiso denegado: solo los vendedores pueden subir productos.',
      });
    }

    const { sellerId, showRoomId } = req.params;
    if (!sellerId || !showRoomId) {
      return res.status(400).send({
        error: 'sellerId y showRoomId son requeridos en la URL.',
      });
    }

    const rawPayload = req.body?.product ?? req.body ?? {};
    const payload = typeof rawPayload === 'object' && rawPayload !== null ? rawPayload : {};

    const parseResult = ProductManualSchema.safeParse(payload);
    if (!parseResult.success) {
      return res.status(400).send({
        error: 'Payload inválido',
        details: parseResult.error.flatten(),
      });
    }

    const product = parseResult.data;
    const productForLlm = prepareProductForLlm(product);
    const attributeDictionary = buildAttributeDictionary(productForLlm);
    const productNameParts = [product.car_make, product.car_model].filter((value) => value);
    const productName = productNameParts.join(' - ') || 'Producto';

    const tracedGenerateParagraph = traceable(
      generateParagraphForProductWithLangChain,
      {
        name: 'generateParagraphForProductWithLangChain',
        run_type: 'llm',
        extractInputs: (productData, name, descriptions, example) => ({
          productData,
          productName: name,
          descriptions,
          exampleParagraph: example,
        }),
        extractOutputs: (output) => output,
        metadata: { sellerId, showRoomId },
        tags: ['4. generate active paragraph'],
      },
    );

    const { activeParagraph } = await tracedGenerateParagraph(
      productForLlm,
      productName,
      attributeDictionary,
      exampleParagraph,
    );
    product.activeParagraph = activeParagraph;

    const tracedGenerateKeywords = traceable(
      generateListOfKeyWordsOfProduct,
      {
        name: 'generateListOfKeyWordsOfProduct',
        run_type: 'tool',
        extractInputs: (paragraph) => ({ activeParagraph: paragraph }),
        extractOutputs: (output) => output,
        metadata: { sellerId, showRoomId },
        tags: ['5. generate list of keywords'],
      },
    );

    const { listOfKeyWords } = await tracedGenerateKeywords(product.activeParagraph);
    product.keyWords = listOfKeyWords;

    const optionsDB = {
      data: [product],
      collection: 'products',
      extras: {
        sellerId,
        companyName: res.locals.companyData?.name,
        coords: res.locals.coordsData,
        showRoomId,
      },
    };

    const tracedAddToFirestore = traceable(
      addDataToFirestore,
      {
        name: 'addDataToFirestore',
        run_type: 'tool',
        extractInputs: (options) => ({ optionsDB: options }),
        extractOutputs: (output) => output,
        metadata: { sellerId, showRoomId },
        tags: ['6. firestore save data'],
      },
    );

    const { documentIds } = await tracedAddToFirestore(optionsDB);

    return res.status(200).send({
      message: 'Producto subido y procesado correctamente.',
      documentId: Array.isArray(documentIds) ? documentIds[0] : documentIds,
    });
  } catch (error) {
    console.error('Error en postProductManual:', error);
    return res.status(500).send({ error: 'Error interno del servidor.' });
  }
};
