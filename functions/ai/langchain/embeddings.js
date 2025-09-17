import { OpenAIEmbeddings } from '@langchain/openai';

export function makeEmbedder() {
  return new OpenAIEmbeddings({
    model: process.env.EMBED_MODEL || 'text-embedding-3-small',
  });
}
