export function setupLangSmith() {
  if (!process.env.LANGCHAIN_TRACING_V2) {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
  }
  if (!process.env.LANGCHAIN_PROJECT) {
    process.env.LANGCHAIN_PROJECT = 'sensebuy-rag';
  }
  if (!process.env.LANGSMITH_API_KEY) {
    console.warn('[LangSmith] Missing LANGSMITH_API_KEY — tracing disabled/limited.');
  }
}
