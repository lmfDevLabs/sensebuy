import { genkit, z } from 'genkit';
import { devLocalRetrieverRef } from '@genkit-ai/dev-local-vectorstore';
import { ProductItemSchema, TextProductQuestionInputSchema } from '../schemas.js';
import { ragDataProductPrompt } from '../prompts.js'
import { ai } from '../config.js';

// flow 3 - retrieval and generate
const ragProductQuestionFlow = ai.defineFlow(
  {
    name: 'ragProductQuestionFlow',
    inputSchema: TextProductQuestionInputSchema,
    outputSchema: z.object({
      recommended: z.array(
        z.object({
          reason: z.string(),
          product: ProductItemSchema
        })
      )
    }),
  },
  async (input) => {
    const docs = await ai.retrieve({
      retriever: devLocalRetrieverRef('product-items'),
      query: input.question,
      options: { k: 5 },
    });

    const productData = docs.map(doc => doc.metadata);
    // const productData = docs.map(doc => doc.metadata as ProductItem);

    const response = await ragDataProductPrompt({
      productData,
      question: input.question,
    });

    return response.output ?? { recommended: [] }; // ✅ nunca devuelve null
  }
);

export default ragProductQuestionFlow
