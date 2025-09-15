import { genkit } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { devLocalVectorstore } from '@genkit-ai/dev-local-vectorstore';
import { enableGoogleCloudTelemetry } from '@genkit-ai/google-cloud';
import { logger } from 'genkit/logging';

// --- Flags de entorno útiles ---
const isFirebaseFunctions = !!process.env.FUNCTION_TARGET || !!process.env.K_SERVICE;
const isEmulator = !!process.env.FUNCTIONS_EMULATOR || !!process.env.FIREBASE_EMULATOR_HUB;

// ⚠️ Clave: NO levantar Reflection en Functions (prod o emulador)
// Puedes forzarlo también con GENKIT_REFLECTION=false en tu .env/.runtimeconfig
const reflectionEnabled =
  process.env.GENKIT_REFLECTION
    ? process.env.GENKIT_REFLECTION === 'true'
    : !isFirebaseFunctions && !isEmulator; // solo en procesos standalone

export const ai = genkit({
  // 👇 apaga el Reflection Server aquí
  reflection: reflectionEnabled, // ← pon 'false' si quieres matar cualquier duda
  plugins: [
    openAI(),
    devLocalVectorstore([
      {
        indexName: 'product-items',
        embedder: openAI.embedder('text-embedding-3-small'),
      },
      {
        indexName: 'chunks_embeddings',
        embedder: openAI.embedder('text-embedding-3-small'),
      },
    ]),
  ],
});

enableGoogleCloudTelemetry();
logger.setLogLevel('debug');

