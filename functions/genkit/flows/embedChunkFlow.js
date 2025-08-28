import { z } from 'genkit';
import { ai } from '../config.js';
import { embedText } from '../../utilities/vertexEmbeddingBatcher.js';

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
    const embedding = await embedText(content);
    return { embedding, model: 'text-embedding-004' };
  }
);

export default embedChunkFlow
