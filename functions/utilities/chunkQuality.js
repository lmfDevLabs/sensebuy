// chunk-quality.js
// ---------------------------------------------------------
// Evalúa calidad semántica de chunks (prosa, ficha técnica) y filtra ruido.
// Devuelve score 0..1, categoría y razones para auditar.
// ---------------------------------------------------------

const STOP_EN = new Set([
  'the','of','and','to','in','a','for','is','on','with','as','by','that','this',
  'are','it','from','or','at','an','be','but','we','our','more'
]);
const STOP_ES = new Set([
  'de','la','que','el','en','y','a','los','del','se','las','por','un','para','con',
  'no','una','su','al','lo','como','más','pero','sus','le'
]);

const COMMON_BOILERPLATE = [
  'subscribe','privacy notice','terms of use','newsletter','about us','contact us',
  'shopping tools','what’s my car worth','insurance marketplace','auto loans',
  'hearst digital media','all rights reserved'
];

const SPEC_UNITS = [
  'hp','kW','rpm','Nm','lb-ft','km/h','km/hr','mph','mm','cm','cm3','L','kg',
  'mpg','km/l','g/km','in','ft³','°','V'
];

// -------- helper básicos
const count = (s, re) => (s.match(re) || []).length;

function alphaDigitSymbolRatios(s) {
  let a=0,d=0,o=0;
  for (const ch of s) {
    if (/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ch)) a++;
    else if (/[0-9]/.test(ch)) d++;
    else if (!/\s/.test(ch)) o++;
  }
  const n = s.length || 1;
  return { alpha: a/n, digit: d/n, other: o/n };
}

function splitSentences(s) {
  // corte simple por puntuación fuerte
  return s
    .replace(/\s+/g,' ')
    .split(/(?<=[\.?\!])\s+(?=[A-ZÁÉÍÓÚÜÑ]|[“"(\[]|[0-9])/)
    .map(x => x.trim())
    .filter(Boolean);
}

function stopwordCoverage(s) {
  const toks = s.toLowerCase().split(/\W+/).filter(Boolean);
  if (toks.length === 0) return {lang:null, cov:0};
  const en = toks.filter(t => STOP_EN.has(t)).length / toks.length;
  const es = toks.filter(t => STOP_ES.has(t)).length / toks.length;
  if (en === 0 && es === 0) return {lang:null, cov:0};
  return en >= es ? {lang:'en', cov:en} : {lang:'es', cov:es};
}

function looksLikeSpecTable(s) {
  const lines = s.split(/\n/).map(l=>l.trim()).filter(Boolean);
  if (lines.length < 3) return 0;

  const colonRatio = lines.filter(l => /:/.test(l)).length / lines.length;
  const unitHits = SPEC_UNITS.reduce((acc,u)=>acc + count(s, new RegExp(`\\b${u}\\b`, 'i')), 0);
  const numDensity = (s.match(/[0-9]/g)||[]).length / Math.max(1, s.length);

  // tabla/ficha típica: muchos ':' y unidades, números moderados/altos
  let score = 0;
  if (colonRatio > 0.25) score += 0.35;
  if (unitHits >= 3)     score += 0.35;
  if (numDensity > 0.06) score += 0.20;
  // líneas cortas con "clave  valor"
  const kvLines = lines.filter(l => /^\S.{0,32}[:|-]\s*\S/.test(l)).length;
  if (kvLines >= 3) score += 0.15;

  return Math.min(1, score);
}

function looksLikeMenuOrNav(s) {
  const lines = s.split(/\n/).map(l=>l.trim()).filter(Boolean);
  if (lines.length === 0) return 0;

  const shortLines = lines.filter(l => l.length <= 30).length / lines.length;
  const bullets    = lines.filter(l => /^(\*|•|-|\d+\.)\s/.test(l)).length / lines.length;
  const viewDetails = count(s, /view \d{4} .* details/i) > 1 ? 1 : 0;

  let score = 0;
  if (shortLines > 0.5) score += 0.4;
  if (bullets    > 0.3) score += 0.2;
  if (viewDetails)      score += 0.4;
  return Math.min(1, score);
}

function hasGibberishBlocks(s) {
  // patrones tipo "SSS OSS OOS ..." o tokens mayúsculos cortos repetidos
  const rep = /(?!\b[A-Z]{1}\b)\b([A-Z]{2,4})\b(?:\s+\1\b){2,}/g; // AAA AAA AAA
  const mix = /\b([A-Z]{2,4})\b(?:\s+\b([A-Z]{2,4})\b){2,}/g;     // AAA BBB CCC ...
  return rep.test(s) || mix.test(s);
}

function boilerplateScore(s) {
  let score = 0;
  for (const term of COMMON_BOILERPLATE) {
    if (s.toLowerCase().includes(term)) score += 0.2;
  }
  return Math.min(1, score);
}

// -------- scoring principal
export function scoreChunkQuality(text, opts = {}) {
  const {
    minChars = 200,
    maxChars = 12000,
    preferLang = null, // 'es' | 'en' | null
  } = opts;

  const rawLen = text?.length ?? 0;
  const lengthOk = rawLen >= minChars && rawLen <= maxChars;

  const { alpha, digit, other } = alphaDigitSymbolRatios(text);
  const sentences = splitSentences(text);
  const words = text.trim().split(/\s+/).filter(Boolean);
  const avgSentLen = sentences.length ? (words.length / sentences.length) : 0;
  const longishSentRatio = sentences.length
    ? sentences.filter(s => s.split(/\s+/).length >= 6).length / sentences.length
    : 0;

  const { lang, cov } = stopwordCoverage(text);

  const tableLike   = looksLikeSpecTable(text);
  const menuLike    = looksLikeMenuOrNav(text);
  const boilerLike  = boilerplateScore(text);
  const gibberish   = hasGibberishBlocks(text);

  // Prosa coherente: buena proporción alfabética, frases con >=6 palabras, puntuación presente
  const punct = count(text, /[\.!\?]/g);
  const proseSignal =
    (alpha > 0.55 ? 0.35 : 0) +
    (longishSentRatio > 0.4 ? 0.35 : 0) +
    (punct >= Math.max(1, sentences.length * 0.4) ? 0.2 : 0) +
    (cov > 0.01 ? 0.1 : 0);

  // Penalizaciones
  let penalty = 0;
  if (!lengthOk)          penalty += 0.25;
  if (menuLike > 0.5)     penalty += 0.35;
  if (boilerLike > 0.4)   penalty += 0.25;
  if (gibberish)          penalty += 0.35;
  if (other > 0.20)       penalty += 0.1; // demasiados símbolos

  // Preferencia de idioma (opcional)
  let langBonus = 0;
  if (preferLang && lang === preferLang) langBonus = 0.05;

  // Ficha técnica útil también suma, aunque no sea prosa
  const specBonus = tableLike * 0.55;

  // Score total
  let score = proseSignal + specBonus + langBonus - penalty;
  score = Math.max(0, Math.min(1, score));

  // Categoría heurística
  let category = 'UNKNOWN';
  if (score < 0.35) {
    category = (menuLike > 0.5 || boilerLike > 0.5) ? 'BOILERPLATE/NAV' :
               gibberish ? 'GIBBERISH' : 'LOW_VALUE';
  } else if (tableLike >= 0.55 && proseSignal < 0.45) {
    category = 'SPEC_TABLE';
  } else if (proseSignal >= 0.55) {
    category = 'PROSE';
  } else {
    category = 'MIXED';
  }

  const reasons = [];
  if (category === 'SPEC_TABLE') reasons.push('estructura tipo ficha técnica');
  if (category === 'BOILERPLATE/NAV') reasons.push('patrones de navegación/boilerplate');
  if (gibberish) reasons.push('patrones mayúsculas repetitivas (ej. SSS/OSS)');
  if (boilerLike > 0.4) reasons.push('boilerplate editorial');
  if (menuLike > 0.5) reasons.push('menú/listado corto predominante');
  if (tableLike > 0.55) reasons.push('muchos ":" y unidades técnicas');
  if (proseSignal > 0.6) reasons.push('prosa con frases largas y puntuación');
  if (!lengthOk) reasons.push('longitud atípica para chunk');

  return {
    score,
    category,
    reasons,
    lang,
    features: {
      rawLen, alpha, digit, other,
      sentences: sentences.length,
      avgSentLen: Number(avgSentLen.toFixed(2)),
      longishSentRatio: Number(longishSentRatio.toFixed(2)),
      tableLike: Number(tableLike.toFixed(2)),
      menuLike: Number(menuLike.toFixed(2)),
      boilerLike: Number(boilerLike.toFixed(2)),
      punct,
      stopwordCov: Number(cov.toFixed(3)),
    }
  };
}

// -------- filtro por umbral y estrategia por categoría
export function filterChunksByQuality(chunks, opts = {}) {
  const {
    minScore = 0.55,
    acceptSpecTables = true,
    preferLang = null, // 'es'|'en'|null
    log = false,
  } = opts;

  const kept = [];
  const dropped = [];

  for (let i = 0; i < chunks.length; i++) {
    const text = typeof chunks[i] === 'string' ? chunks[i] : (chunks[i]?.pageContent ?? '');
    const r = scoreChunkQuality(text, { preferLang });
    const accept =
      r.score >= minScore ||
      (acceptSpecTables && r.category === 'SPEC_TABLE' && r.score >= 0.40);

    const item = { index: i, text, ...r };
    (accept ? kept : dropped).push(item);

    if (log) {
      const badge = accept ? '✅ KEEP' : '🗑 DROP';
      console.log(`${badge} #${i} [${r.category}] score=${r.score.toFixed(2)} lang=${r.lang} len=${r.features.rawLen}`);
      if (!accept) console.log('  reasons:', r.reasons.join('; '));
    }
  }
  return { kept, dropped };
}

