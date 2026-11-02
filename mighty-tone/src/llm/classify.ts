import { engineKnowledge } from '../engine/knowledge.ts';

export type MessageKind = 'tone-request' | 'feedback' | 'conversation';

const FEEDBACK_TAGS = [
  'muddy', 'harsh', 'thin', 'boomy', 'too much gain', 'too little gain',
  'too wet', 'too dry', 'buried in mix', 'too bright', 'too dark',
];

const FEEDBACK_PATTERNS = [
  /^(?:too|way too)\s+\w+/i,
  /^(?:more|less|not enough|needs? more|needs? less)\s+\w+/i,
  /^make (?:it|this|the tone)\s+\w+/i,
  /^(?:can you|could you)?\s*(?:reduce|increase|add|remove|boost|cut|lower|raise|dial back|turn (?:up|down))\b/i,
  /^(?:it(?:'s| is|s)\s+(?:too|a (?:bit|little|touch)))\s+\w+/i,
  /^(?:not\s+(?:enough|quite|really))\b/i,
  /^(?:bring|pull)\s+(?:up|down|back)\b/i,
];

const QUESTION_STARTERS = [
  'what', 'how', 'why', 'which', 'can', 'do', 'does', 'is', 'are',
  'would', 'could', 'should', 'tell', 'explain', 'help', 'compare',
  'describe', 'show', 'list', 'where', 'who',
];

const CONVERSATION_PATTERNS = [
  /\bwhat (?:amp|model|effect|block|cab|pedal|delay|reverb|mod)/i,
  /\btell me (?:about|more)/i,
  /\bexplain\b/i,
  /\bhow (?:does|do|would|should|can)/i,
  /\bwhat(?:'s| is| are) (?:the|a|my|this)/i,
  /\bshould (?:i|we|it)\b/i,
  /\bwould (?:it|this|that|adding)\b/i,
  /\bhelp me\b/i,
  /\bwhat do you (?:think|suggest|recommend)/i,
  /\bany (?:tips|suggestions|advice|ideas)/i,
];

function hasVocabTerms(text: string): boolean {
  const lower = text.toLowerCase();
  const terms = engineKnowledge.vocabulary.terms;
  for (const key of Object.keys(terms)) {
    if (lower.includes(key)) return true;
    for (const syn of terms[key]!.synonyms ?? []) {
      if (lower.includes(syn)) return true;
    }
  }
  return false;
}

function classifyHeuristic(text: string, hasPreviousTone: boolean): MessageKind {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (hasPreviousTone) {
    if (FEEDBACK_TAGS.some(tag => lower === tag || lower.startsWith(tag + '.') || lower.startsWith(tag + ','))) {
      return 'feedback';
    }
    if (FEEDBACK_PATTERNS.some(p => p.test(trimmed))) {
      return 'feedback';
    }
  }

  if (trimmed.endsWith('?')) return 'conversation';

  const firstWord = lower.split(/\s+/)[0] ?? '';
  if (QUESTION_STARTERS.includes(firstWord)) return 'conversation';
  if (CONVERSATION_PATTERNS.some(p => p.test(trimmed))) return 'conversation';

  if (hasVocabTerms(lower)) return 'tone-request';

  const genreWords = ['blues', 'jazz', 'rock', 'metal', 'country', 'funk', 'pop', 'indie',
    'classical', 'folk', 'reggae', 'soul', 'rnb', 'punk', 'grunge', 'shoegaze',
    'post-rock', 'prog', 'fusion', 'gospel', 'worship'];
  if (genreWords.some(g => lower.includes(g))) return 'tone-request';

  if (hasPreviousTone && trimmed.split(/\s+/).length <= 5) return 'feedback';

  return 'tone-request';
}

async function classifyWithGemini(text: string, hasPreviousTone: boolean): Promise<MessageKind | null> {
  const apiKey = localStorage.getItem('gemini-key');
  if (!apiKey) return null;

  const model = localStorage.getItem('gemini-model') || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const prompt = `Classify this guitar amp tone generator app message. Context: user ${hasPreviousTone ? 'HAS' : 'does NOT have'} a previously generated tone.
Return JSON: {"kind":"tone-request"} or {"kind":"feedback"} or {"kind":"conversation"}
- tone-request: wants a NEW tone (e.g. "warm jazz clean", "heavy metal", "acoustic fingerpicking", "reed organ on guitar")
- feedback: wants to ADJUST the existing tone (e.g. "too bright", "more gain", "make it darker", "muddy")
- conversation: asking a question or chatting (e.g. "would delay help?", "what amps do you have?", "tell me about this")
Message: ${text}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const json = await response.json();
    const responseText = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const parsed = JSON.parse(responseText);
    if (['tone-request', 'feedback', 'conversation'].includes(parsed.kind)) {
      return parsed.kind as MessageKind;
    }
    return null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function classifyMessage(text: string, hasPreviousTone: boolean): Promise<MessageKind> {
  const geminiResult = await classifyWithGemini(text, hasPreviousTone);
  if (geminiResult) return geminiResult;
  return classifyHeuristic(text, hasPreviousTone);
}
