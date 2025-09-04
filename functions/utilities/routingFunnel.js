import { classifyChatSearchIntention } from './openAi.js';

export function defaultRouterState() {
  return {
    intent: 'unknown',
    advisory: {
      purpose: null,
      constraints: [],
      budget_min: null,
      budget_max: null,
      brand_pref: null,
      category_hint: null,
    },
    direct: {
      specified_traits: [],
      hard_filters: {},
    },
    missing: [],
  };
}

export function extractBudgetFromText(text) {
  const numbers = (text.match(/\d+[\d\.\,]*/g) || [])
    .map((n) => parseFloat(n.replace(/\./g, '').replace(/\,/g, '.')))
    .filter((n) => !isNaN(n));
  if (!numbers.length) return { budget_min: null, budget_max: null };
  if (numbers.length === 1) {
    const isMax = /hasta|maximo|tope|máximo/i.test(text);
    return {
      budget_min: isMax ? null : numbers[0],
      budget_max: isMax ? numbers[0] : null,
    };
  }
  numbers.sort((a, b) => a - b);
  return { budget_min: numbers[0], budget_max: numbers[numbers.length - 1] };
}

function isDecisiveLanguage(text) {
  return /(necesito|debo|tiene que|requiero|quiero|comp[aá]rame|busco)/i.test(text);
}

export function collectSpecifiedTraits(messages) {
  const traits = [];
  const last = messages[messages.length - 1];
  if (!last) return traits;
  const regex = /"([^\"]+)"/g;
  let m;
  while ((m = regex.exec(last.content))) {
    traits.push(m[1]);
  }
  return traits;
}

export async function assessPerceivedIntent(messages) {
  const last = messages[messages.length - 1]?.content || '';
  const prev = messages[messages.length - 2]?.content || '';
  const combined = `${prev} ${last}`.trim();
  let confidence = 0;
  const budget = extractBudgetFromText(combined);
  if (budget.budget_min != null || budget.budget_max != null) confidence += 0.2;
  const constraints = (last.match(/,| y | con /gi) || []).length;
  if (constraints >= 2) confidence += 0.3;
  if (isDecisiveLanguage(combined)) confidence += 0.3;
  try {
    const cls = await classifyChatSearchIntention(messages);
    if (cls?.intention === 'product_search') confidence += 0.1;
    if (cls?.intention === 'document_search') confidence -= 0.1;
  } catch {
    // ignore errors
  }
  confidence = Math.max(0, Math.min(1, confidence));
  const intent = confidence >= 0.6 ? 'direct_search' : 'advisory';
  return { intent, confidence };
}

