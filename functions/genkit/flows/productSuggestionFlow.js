import { ai } from '../config.js';
import { z } from 'genkit';
import { gemini20Flash001 } from '@genkit-ai/vertexai';

// flow 1 - not use 
const productSuggestionFlow = ai.defineFlow(
  {
    name: 'productSuggestionFlow',
    inputSchema: z.string(),
    outputSchema: z.string(),
  },
  async (subject) => {
    const llmResponse = await ai.generate({
      prompt: `Suggests products (cars) for the interested customer named ${subject}`,
      model: gemini20Flash001,
      config: {
        temperature: 1,
      },
    });
  
    return llmResponse.text;
  }
);

export default productSuggestionFlow