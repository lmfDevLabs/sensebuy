import { algoliasearch } from 'algoliasearch';

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID,
  process.env.ALGOLIA_ADMIN_KEY
);
const index = client.initIndex('products');

// Devuelve los hits crudos desde Algolia
const searchAlgoliaHits = async (searchTerms) => {
  const response = await index.search(searchTerms, {
    // Opciones adicionales aquí si es necesario
  });
  return response.hits || [];
};

// Búsqueda en Algolia que devuelve un texto descriptivo
const searchInAlgolia = async (searchTerms) => {
  try {
    const hits = await searchAlgoliaHits(searchTerms);
    if (hits.length === 0) {
      return '';
    }

    let algoliaResultsText = 'Acá algunos resultado que te podrían interesar:\n\n';
    hits.forEach((result, index) => {
      algoliaResultsText += `Resultado ${index + 1}:\n`;
      algoliaResultsText += `Marca: ${result.car_make}\n`;
      algoliaResultsText += `Modelo: ${result.car_model}\n`;
      algoliaResultsText += `Descripción: ${result.description}\n`;
      algoliaResultsText += `Tipo de Carrocería: ${result.body_type}\n`;
      algoliaResultsText += `Color(es): ${result.color_options}\n`;
      algoliaResultsText += `Año: ${result.year}\n`;
      algoliaResultsText += `Precio: $${result['price_($)']}\n`;
      algoliaResultsText += `Aceleración (0-60 mph): ${result['acceleration_(0-60 mph)']} segundos\n`;
      algoliaResultsText += `Tamaño del Motor (L): ${result['engine_size_(l)']} L\n`;
      algoliaResultsText += `Potencia: ${result.horsepower} HP\n`;
      algoliaResultsText += `Torque: ${result['torque_(nm)']} Nm\n`;
      algoliaResultsText += `Transmisión: ${result.transmission_type}\n`;
      algoliaResultsText += `Consumo de Combustible: ${result['mileage_(mpg)']} mpg\n`;
      algoliaResultsText += `Combustible: ${result.fuel_type}\n`;
      algoliaResultsText += `Puntuación de los Clientes: ${result.customer_ratings}\n`;
      algoliaResultsText += `Características de Seguridad: ${result.safety_features}\n`;
      algoliaResultsText += `Características del Interior: ${result.interior_features}\n`;
      algoliaResultsText += `Características del Exterior: ${result.exterior_features}\n`;
      algoliaResultsText += `Características de Entretenimiento: ${result.entertainment_features}\n`;
      algoliaResultsText += `Concesionario: ${result.sellerData?.companyName}\n`;
    });

    return algoliaResultsText;
  } catch (error) {
    console.error('Error al buscar en Algolia:', error);
    throw error;
  }
};

export { searchInAlgolia, searchAlgoliaHits };
