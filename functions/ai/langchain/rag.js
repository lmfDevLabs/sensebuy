import { ChatOpenAI } from '@langchain/openai';

export async function answerWithRag(question, contexts = [], opts = {}) {
  const llm = new ChatOpenAI({
    model: opts.model || process.env.LLM_MODEL || 'gpt-4o-mini',
    temperature: 0.2,
  });

  const system = 'Responde SOLO con base en los contextos. Si no hay evidencia suficiente, dilo explícitamente y no inventes. Cita fragmentos.';
  const contextStr = contexts
    .map((c, i) => `#${i + 1}\n${c.text ?? ''}`)
    .join('\n\n');

  const messages = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Pregunta: ${question}\n\nContextos:\n${contextStr}`,
    },
  ];
  const res = await llm.invoke(messages);
  return typeof res?.content === 'string' ? res.content : JSON.stringify(res?.content);
}
