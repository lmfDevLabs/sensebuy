import { z } from 'genkit';
import { gemini20Flash001 } from '@genkit-ai/vertexai';
import { ai } from '../config.js';
import { searchAlgoliaHits } from '../../utilities/algolia.js';

const algoliaChatFlow = ai.defineFlow(
  {
    name: 'algoliaChatFlow',
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: z.object({
      answer: z.string(),
    }),
  },
  async ({ query }) => {
    const hits = await searchAlgoliaHits(query);
    if (hits.length === 0) {
      return {
        answer:
          'No encontré resultados con coincidencia de palabras. Prueba afinando términos o usa el modo "semantic".',
      };
    }

    const context = hits
      .map(
        (result, i) =>
          `Producto ${i + 1}:
Marca: ${result.car_make}
Modelo: ${result.car_model}
Descripción: ${result.description}
Precio: $${result['price_($)']}`
      )
      .join('\n\n');

    const prompt = `Eres un asistente de ventas de automóviles. Utiliza la información de los productos para responder la pregunta del usuario.\n\nPregunta: ${query}\n\nProductos:\n${context}\n\nRespuesta:`;

    const result = await ai.generate({
      model: gemini20Flash001,
      prompt,
      config: { temperature: 0.3 },
    });

    return { answer: result.text ?? '' };
  }
);

export default algoliaChatFlow;
