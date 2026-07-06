const SYSTEM_INSTRUCTION = `You are an educational assistant. Your task is to generate high-quality reading comprehension questions based ONLY on the provided text from the selected materials.

Strict Rules:
1. The answer to every question must be explicitly stated or directly inferable from the provided text.
2. Do not use external knowledge or make assumptions not supported by the text.`;

const MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash'];
const MAX_TEXT_LENGTH = 12000;

function formatInstruction(format) {
  if (format === 'truefalse') {
    return 'Each question must be True/False with options ["True", "False"] and correctAnswer as 0 or 1.';
  }
  if (format === 'short') {
    return 'Each question must be a short answer (open-ended). The learner will type a free-text answer. Do NOT include options. correctAnswer must be exactly one or two words from the material (no sentences or phrases longer than two words). Questions should expect brief factual answers.';
  }
  return 'Each question is multiple choice with exactly 4 options and correctAnswer as the 0-based index.';
}

function buildUserPrompt(count, format, materialText) {
  if (format === 'short') {
    return `Generate ${count} short answer quiz questions from this training material.
${formatInstruction(format)}
Return ONLY a valid JSON array with this shape:
[{"question":"...","correctAnswer":"expected answer text","explanation":"..."}]

Material:
${materialText}`;
  }
  return `Generate ${count} quiz questions from this training material.
${formatInstruction(format)}
Return ONLY a valid JSON array with this shape:
[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"..."}]
correctAnswer is the 0-based index of the correct option.

Material:
${materialText}`;
}

function normalizeFormats(formats) {
  if (Array.isArray(formats) && formats.length) return formats;
  if (typeof formats === 'string') return [formats];
  return ['multiple'];
}

function splitCount(total, parts) {
  const base = Math.floor(total / parts);
  const remainder = total % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

function parseQuestionsJson(text, format) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((q, i) => {
    if (format === 'short') {
      const words = String(q.correctAnswer ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      const acceptable = (Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [])
        .map((a) => String(a).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' '))
        .filter(Boolean);
      return {
        id: `q_${Date.now()}_${i}`,
        question: q.question,
        correctAnswer: words.join(' '),
        acceptableAnswers: acceptable,
        explanation: q.explanation || '',
        format,
      };
    }
    return {
      id: `q_${Date.now()}_${i}`,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      format,
    };
  });
}

async function callGemini(apiKey, userPrompt) {
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) continue;
      return text;
    } catch {
      /* try next model */
    }
  }
  return null;
}

export async function generateQuestionsWithGemini(apiKey, materialTexts, format, count) {
  if (!apiKey || count <= 0) return [];

  const combined = materialTexts.join('\n\n---\n\n').slice(0, MAX_TEXT_LENGTH);
  const userPrompt = buildUserPrompt(count, format, combined);
  const raw = await callGemini(apiKey, userPrompt);
  if (!raw) return [];

  try {
    return parseQuestionsJson(raw, format).slice(0, count);
  } catch {
    return [];
  }
}

export async function generateQuestionsBatch(apiKey, materialTexts, formats, count) {
  const formatList = normalizeFormats(formats);
  const counts = splitCount(count, formatList.length);
  const all = [];

  for (let i = 0; i < formatList.length; i++) {
    const fmt = formatList[i];
    const n = counts[i];
    if (n <= 0) continue;
    const batch = await generateQuestionsWithGemini(apiKey, materialTexts, fmt, n);
    all.push(...batch);
  }

  return all.slice(0, count);
}
