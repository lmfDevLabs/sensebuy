# Functions

## Environment variables

- `OPENAI_API_KEY`: API key used by the OpenAI plugin.
- `EMBED_BATCH_SIZE`: Number of texts processed per batch (default `16`).
- `EMBED_QPM`: Shared quota of embedding requests per minute (default `60`).
- `EMBED_CONCURRENCY`: Parallel batches allowed (default `1`).
- `EMBED_RETRIES`: Maximum retries for 429 responses (default `5`).

The embedding batcher stores the global quota in the Firestore document
`embeddingQuota/global`, with the fields `tokens` and `updatedAt` refreshed
once per minute.
