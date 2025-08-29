import { z } from 'genkit';
import { gemini20Flash001 } from '@genkit-ai/vertexai';
import { devLocalRetrieverRef } from '@genkit-ai/dev-local-vectorstore';
import { ai } from '../config.js';

const ragChunksFlow = ai.defineFlow(
  {
    name: 'ragChunksFlow',
    inputSchema: z.object({
      query: z.string(),
    }),
    outputSchema: z.object({
      answer: z.string(),
    }),
  },
  async ({ query }) => {
    const docs = await ai.retrieve({
      retriever: devLocalRetrieverRef('chunks_embeddings'),
      query,
      options: { k: 5 },
    });

    const context = docs.map((doc, i) => `[${i + 1}] ${doc.content}`).join('\n');

    const result = await ai.generate({
      model: gemini20Flash001,
      prompt: `Usa los documentos proporcionados para responder la pregunta.\n\nDocumentos:\n${context}\n\nPregunta: ${query}\nRespuesta:`,
      config: { temperature: 0.3 },
    });

    return { answer: result.text ?? '' };
  }
);

export default ragChunksFlow;
