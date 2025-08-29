import { genkit } from 'genkit';
import { vertexAI, gemini20Flash001, textEmbedding004 } from '@genkit-ai/vertexai';
import { devLocalVectorstore } from '@genkit-ai/dev-local-vectorstore';
import { enableGoogleCloudTelemetry } from '@genkit-ai/google-cloud';
import { logger } from 'genkit/logging';

const ai = genkit({
    plugins: [
        vertexAI({ location: 'us-central1' }),
        devLocalVectorstore([
            {
                indexName: 'product-items',
                embedder: textEmbedding004,
                embedderOptions: { taskType: 'RETRIEVAL_DOCUMENT' },
            },
            {
                indexName: 'chunks_embeddings',
                embedder: textEmbedding004,
                embedderOptions: { taskType: 'RETRIEVAL_DOCUMENT' },
            },
        ]),
    ],
});

enableGoogleCloudTelemetry();
logger.setLogLevel('debug');

export { ai };
