import { genkit, Document, z } from 'genkit';
import { devLocalIndexerRef } from '@genkit-ai/dev-local-vectorstore';
import { ProductItemSchema } from '../schemas.js';
import { ai } from '../config.js';

const indexProductItemsFlow = ai.defineFlow(
  {
    name: 'indexProductItemsFlow',
    inputSchema: z.array(ProductItemSchema),
    outputSchema: z.object({ rows: z.number() }),
  },
  async (productItems) => {
    // Store each document with its text indexed,
    // and its original JSON data as its metadata.
    const documents = productItems.map((productItem) => {
      const text = `${productItem.description}`;
      return Document.fromText(text, productItem);
    });
    await ai.index({
      indexer: devLocalIndexerRef('product-items'),
      documents,
    });
    return { rows: productItems.length };
  }
);

export default indexProductItemsFlow
