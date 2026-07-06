import { generateQuestionsViaApi } from './questions-api.js';
import { isApiAvailable } from './materials-api.js';
import { uid } from './storage.js';

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

function pickSentences(text, count) {
  const sentences = text.split(SENTENCE_SPLIT).filter((s) => s.trim().length > 40);
  const shuffled = [...sentences].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function maskWord(sentence) {
  const words = sentence.replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 4);
  if (!words.length) return { masked: sentence, answer: words[0] || 'process' };
  const answer = words[Math.floor(Math.random() * words.length)];
  const masked = sentence.replace(new RegExp(`\\b${answer}\\b`, 'i'), '_______');
  return { masked, answer };
}

function pickShortAnswer(sentence) {
  const words = sentence.replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length >= 3);
  if (words.length >= 2) {
    const i = Math.floor(Math.random() * (words.length - 1));
    return `${words[i]} ${words[i + 1]}`;
  }
  return words[0] || 'process';
}

export function normalizeShortAnswer(q) {
  if (!isShortAnswerQuestion(q)) return q;
  const words = String(q.correctAnswer ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const answer = words.join(' ');
  const acceptable = (q.acceptableAnswers || [])
    .map((a) => String(a).trim().split(/\s+/).filter(Boolean).slice(0, 2).join(' '))
    .filter(Boolean);
  return { ...q, correctAnswer: answer, acceptableAnswers: acceptable };
}

function buildDistractors(answer, pool) {
  const others = pool.filter((w) => w.toLowerCase() !== answer.toLowerCase());
  const picks = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
  while (picks.length < 3) picks.push(`Option ${picks.length + 1}`);
  const options = [answer, ...picks].sort(() => Math.random() - 0.5);
  return { options, correctAnswer: options.indexOf(answer) };
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

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isShortAnswerQuestion(q) {
  return q.format === 'short' || (!q.options?.length && typeof q.correctAnswer === 'string');
}

export function isAnswerCorrect(q, userAnswer) {
  if (isShortAnswerQuestion(q)) {
    const given = normalizeText(userAnswer);
    if (!given) return false;
    const expected = normalizeText(q.correctAnswer);
    if (given === expected) return true;
    const acceptable = (q.acceptableAnswers || []).map(normalizeText);
    return acceptable.includes(given);
  }
  return userAnswer === q.correctAnswer;
}

export async function generateQuestions(materialTexts, formats, count) {
  const formatList = normalizeFormats(formats);
  const combinedText = materialTexts.join(' ');
  const counts = splitCount(count, formatList.length);

  if (isApiAvailable()) {
    try {
      const aiQuestions = await generateQuestionsViaApi(materialTexts, formatList, count);
      if (aiQuestions.length) {
        return aiQuestions.slice(0, count).map((q) => normalizeShortAnswer(q));
      }
    } catch (err) {
      console.warn('AI question generation failed, using local parser:', err.message);
    }
  }

  const all = [];
  for (let i = 0; i < formatList.length; i++) {
    const fmt = formatList[i];
    const n = counts[i];
    if (n <= 0) continue;
    all.push(...generateLocalQuestions(combinedText, fmt, n));
  }

  return all.slice(0, count).map((q) => normalizeShortAnswer(q));
}

function generateLocalQuestions(text, format, count) {
  const sentences = pickSentences(text, count * 2);
  const wordPool = text.split(/\W+/).filter((w) => w.length > 4);
  const questions = [];

  for (let i = 0; i < count && i < sentences.length; i++) {
    const sentence = sentences[i].trim();

    if (format === 'truefalse') {
      const isTrue = Math.random() > 0.35;
      const qText = isTrue
        ? sentence
        : sentence.replace(/\d+/g, (n) => String(Number(n) + 2));
      questions.push({
        id: uid('q'),
        question: `True or False: ${qText}`,
        options: ['True', 'False'],
        correctAnswer: isTrue ? 0 : 1,
        explanation: isTrue ? 'This statement matches the material.' : 'This statement was altered and is false.',
        format: 'truefalse',
      });
    } else if (format === 'short') {
      const answer = pickShortAnswer(sentence);
      const prompt = sentence.length > 120
        ? `Based on the training material, what is the answer (one or two words)?\n\n"${sentence.slice(0, 120)}…"`
        : `Based on the training material: ${sentence.replace(/\.$/, '')}? (Answer in one or two words.)`;
      questions.push(normalizeShortAnswer({
        id: uid('q'),
        question: prompt,
        correctAnswer: answer,
        explanation: `The correct answer is "${answer}".`,
        format: 'short',
      }));
    } else {
      const { masked, answer } = maskWord(sentence);
      const { options, correctAnswer } = buildDistractors(answer, wordPool);
      questions.push({
        id: uid('q'),
        question: `Complete the statement: ${masked}`,
        options,
        correctAnswer,
        explanation: `The correct term is "${answer}".`,
        format: 'multiple',
      });
    }
  }

  return questions;
}

export function scoreAttempt(questions, answers) {
  let correct = 0;
  questions.forEach((q) => {
    if (isAnswerCorrect(q, answers[q.id])) correct++;
  });
  const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
  return { score, correct, total: questions.length };
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export { normalizeFormats };
