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
  if (format === 'essay') {
    return 'Each question must be an open-ended essay question requiring a short paragraph response. Do NOT include options. Provide referenceAnswer (a concise reference paragraph answering the question) and rubricPoints (an array of 2-3 key points/concepts expected in the answer).';
  }
  if (format === 'matching') {
    return 'Each question must be a Mix and Match question. Do NOT include options. Provide matchingPairs as an array of 3 to 4 objects, each with "left" (term or concept) and "right" (definition or matching pair).';
  }
  if (format === 'multi_select') {
    return 'Each question must be a multiple answer question with exactly 4 options where MORE THAN ONE option is correct. Provide correctAnswers as an array of 0-based indices of all correct options (e.g. [0, 2]).';
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
  if (format === 'essay') {
    return `Generate ${count} essay quiz questions from this training material.
${formatInstruction(format)}
Return ONLY a valid JSON array with this shape:
[{"question":"...","referenceAnswer":"reference answer text","rubricPoints":["key point 1","key point 2"],"explanation":"..."}]

Material:
${materialText}`;
  }
  if (format === 'matching') {
    return `Generate ${count} mix and match quiz questions from this training material.
${formatInstruction(format)}
Return ONLY a valid JSON array with this shape:
[{"question":"Match each term with its correct definition.","matchingPairs":[{"left":"Term 1","right":"Definition 1"},{"left":"Term 2","right":"Definition 2"}],"explanation":"..."}]

Material:
${materialText}`;
  }
  if (format === 'multi_select') {
    return `Generate ${count} multiple answer quiz questions (select all that apply) from this training material.
${formatInstruction(format)}
Return ONLY a valid JSON array with this shape:
[{"question":"...","options":["Option A","Option B","Option C","Option D"],"correctAnswers":[0,2],"explanation":"..."}]

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

function extractJsonText(rawText) {
  let str = String(rawText || '').trim();
  str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = str.indexOf('[');
  const end = str.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    str = str.substring(start, end + 1);
  }
  return str;
}

function parseQuestionsJson(text, format) {
  const cleaned = extractJsonText(text);
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) return [];
  return parsed.map((q, i) => {
    const uidStr = `q_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
    if (format === 'short') {
      const words = String(q.correctAnswer ?? q.answer ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      const acceptable = (Array.isArray(q.acceptableAnswers) ? q.acceptableAnswers : [])
        .map((a) => String(a).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' '))
        .filter(Boolean);
      return {
        id: uidStr,
        question: q.question,
        correctAnswer: words.join(' '),
        acceptableAnswers: acceptable,
        explanation: q.explanation || '',
        format,
      };
    }
    if (format === 'essay') {
      const ref = String(q.referenceAnswer || q.correctAnswer || q.answer || q.reference_answer || '').trim();
      const rubric = Array.isArray(q.rubricPoints)
        ? q.rubricPoints.map(String)
        : (typeof q.rubricPoints === 'string' ? q.rubricPoints.split(',').map((s) => s.trim()) : []);
      return {
        id: uidStr,
        question: q.question,
        referenceAnswer: ref,
        rubricPoints: rubric,
        explanation: q.explanation || '',
        format,
      };
    }
    if (format === 'matching') {
      const rawPairs = q.matchingPairs || q.pairs || q.matching_pairs || [];
      const pairs = Array.isArray(rawPairs)
        ? rawPairs.map((p) => {
            if (!p || typeof p !== 'object') return null;
            const left = String(p.left || p.term || p.item || p.key || '').trim();
            const right = String(p.right || p.definition || p.match || p.value || '').trim();
            if (left && right) return { left, right };
            return null;
          }).filter(Boolean)
        : [];
      return {
        id: uidStr,
        question: q.question || 'Match each concept or term with its corresponding description.',
        matchingPairs: pairs,
        explanation: q.explanation || '',
        format,
      };
    }
    if (format === 'multi_select') {
      const options = Array.isArray(q.options) ? q.options.map(String) : [];
      const rawCorrect = q.correctAnswers || q.correct_answers || q.correctAnswer;
      let correctAnswers = [];
      if (Array.isArray(rawCorrect)) {
        correctAnswers = rawCorrect.map((val) => {
          if (typeof val === 'number') return val;
          const idx = options.findIndex((opt) => opt.toLowerCase() === String(val).toLowerCase());
          if (idx !== -1) return idx;
          const parsedNum = parseInt(val, 10);
          return isNaN(parsedNum) ? null : parsedNum;
        }).filter((n) => n !== null && n >= 0 && n < options.length);
      }
      if (!correctAnswers.length && options.length) correctAnswers = [0];
      return {
        id: uidStr,
        question: q.question,
        options,
        correctAnswers,
        explanation: q.explanation || '',
        format,
      };
    }
    return {
      id: uidStr,
      question: q.question,
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
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
