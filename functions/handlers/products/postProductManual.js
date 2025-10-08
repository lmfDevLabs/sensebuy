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

const ARRAY_FIELDS_TO_JOIN = [
  'color_options',
  'safety_features',
  'entertainment_features',
  'interior_features',
  'exterior_features',
  'pics',
  'pdf',
];

const normalizeDictionaryEntry = (entry) => {
  if (!entry) {
    return undefined;
  }

  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof entry === 'object') {
    const { descripcion, description } = entry;
    const resolved = descripcion?.trim() || description?.trim();
    return resolved && resolved.length > 0 ? resolved : undefined;
  }

  return undefined;
};

const keyToReadableLabel = (key) =>
  key
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const buildAttributeDictionary = (product, customDictionary = {}) => {
  const dictionary = {};
  Object.keys(product).forEach((key) => {
    const customDescription = normalizeDictionaryEntry(customDictionary[key]);
    const fallbackLabel = keyToReadableLabel(key);
    const description = customDescription || fallbackLabel;
    dictionary[key] = {
      descripcion: description,
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
    const attributeDictionary = buildAttributeDictionary(productForLlm, res.locals.dataDictionary);
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
    product.attributeDictionary = attributeDictionary;

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
