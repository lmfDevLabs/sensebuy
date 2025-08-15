import { z } from 'genkit';
import { textEmbedding004 } from '@genkit-ai/vertexai';
import { ai } from '../config.js';

const embedChunkFlow = ai.defineFlow(
  {
    name: 'embedChunkFlow',
    inputSchema: z.string(),
    outputSchema: z.object({
      embedding: z.array(z.number()),
      model: z.string(),
    }),
  },
  async (content) => {
    const [res] = await ai.embed({
      embedder: textEmbedding004,
      content,
    });
    return { embedding: res.embedding, model: 'text-embedding-004' };
  }
);

export default embedChunkFlow
