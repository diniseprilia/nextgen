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
  if (q?.format) return q.format === 'short';
  return Boolean(!q?.options?.length && typeof q?.correctAnswer === 'string' && !q?.matchingPairs && !q?.referenceAnswer);
}

export function isAnswerCorrect(q, userAnswer) {
  return evaluateQuestionFraction(q, userAnswer) >= 0.999;
}

export function evaluateEssaySimilarity(referenceText, rubricPoints, userText) {
  const given = normalizeText(userText);
  if (!given) return 0;

  const tokenize = (str) => String(str || '').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter((w) => w.length > 2);
  const userWords = new Set(tokenize(given));
  const targetWords = tokenize(referenceText);
  if (!targetWords.length && (!rubricPoints || !rubricPoints.length)) return 1.0;

  let matchedTarget = 0;
  targetWords.forEach((w) => { if (userWords.has(w)) matchedTarget++; });
  const refCoverage = targetWords.length ? matchedTarget / targetWords.length : 0;

  let rubricCoverage = 1.0;
  if (Array.isArray(rubricPoints) && rubricPoints.length) {
    let matchedRubric = 0;
    rubricPoints.forEach((pt) => {
      const ptWords = tokenize(pt);
      if (ptWords.some((w) => userWords.has(w))) matchedRubric++;
    });
    rubricCoverage = matchedRubric / rubricPoints.length;
  }

  const similarity = Math.min(1.0, (refCoverage * 0.6) + (rubricCoverage * 0.4));
  return similarity >= 0.80 ? similarity : 0;
}

export function evaluateQuestionFraction(q, userAnswer) {
  if (!q) return 0;

  if (q.format === 'essay') {
    return evaluateEssaySimilarity(q.referenceAnswer || q.correctAnswer, q.rubricPoints, userAnswer);
  }

  if (q.format === 'matching') {
    if (!q.matchingPairs || !q.matchingPairs.length) return 1.0;
    if (!userAnswer || typeof userAnswer !== 'object') return 0;
    let correctCount = 0;
    q.matchingPairs.forEach((pair) => {
      const selectedRight = String(userAnswer[pair.left] ?? '').trim().toLowerCase();
      const expectedRight = String(pair.right ?? '').trim().toLowerCase();
      if (selectedRight && selectedRight === expectedRight) {
        correctCount++;
      }
    });
    return correctCount / q.matchingPairs.length;
  }

  if (q.format === 'multi_select') {
    const expected = Array.isArray(q.correctAnswers) ? q.correctAnswers : [];
    if (!expected.length) return 1.0;
    const selected = Array.isArray(userAnswer) ? userAnswer : [];
    if (!selected.length) return 0;

    const expectedSet = new Set(expected);
    let correctSelected = 0;
    let incorrectSelected = 0;

    selected.forEach((idx) => {
      if (expectedSet.has(idx)) correctSelected++;
      else incorrectSelected++;
    });

    const netScore = (correctSelected - incorrectSelected) / expected.length;
    return Math.max(0, Math.min(1.0, netScore));
  }

  if (isShortAnswerQuestion(q)) {
    const given = normalizeText(userAnswer);
    if (!given) return 0;
    const expected = normalizeText(q.correctAnswer);
    if (given === expected) return 1.0;
    const acceptable = (q.acceptableAnswers || []).map(normalizeText);
    return acceptable.includes(given) ? 1.0 : 0.0;
  }

  return userAnswer === q.correctAnswer ? 1.0 : 0.0;
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
    } else if (format === 'essay') {
      const rubricWords = sentence.split(/\s+/).filter((w) => w.length > 5).slice(0, 3);
      questions.push({
        id: uid('q'),
        question: `In a brief paragraph, explain the main concept described here:\n\n"${sentence.slice(0, 150)}…"`,
        referenceAnswer: sentence,
        rubricPoints: rubricWords,
        explanation: `A thorough response should address key points: ${rubricWords.join(', ')}.`,
        format: 'essay',
      });
    } else if (format === 'matching') {
      const pairs = sentences.slice(i, i + 3).map((s) => {
        const { masked, answer } = maskWord(s);
        return { left: masked.slice(0, 80) + '…', right: answer };
      });
      questions.push({
        id: uid('q'),
        question: 'Match each incomplete sentence with its correct missing term.',
        matchingPairs: pairs.length ? pairs : [{ left: 'Process step 1', right: 'Start' }, { left: 'Process step 2', right: 'Finish' }],
        explanation: 'Each term matches its corresponding sentence context in the material.',
        format: 'matching',
      });
    } else if (format === 'multi_select') {
      const { masked, answer } = maskWord(sentence);
      const others = wordPool.filter((w) => w.toLowerCase() !== answer.toLowerCase()).slice(0, 2);
      const options = [answer, wordPool[0] || 'Key Term', ...others].sort(() => Math.random() - 0.5);
      const correctAnswers = [options.indexOf(answer), options.indexOf(wordPool[0] || 'Key Term')].filter((idx) => idx !== -1);
      questions.push({
        id: uid('q'),
        question: `Select ALL terms that are relevant to this material context:\n\n"${sentence.slice(0, 120)}…"`,
        options,
        correctAnswers: correctAnswers.length ? correctAnswers : [0],
        explanation: 'The selected correct terms are directly mentioned in the material context.',
        format: 'multi_select',
      });
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
  if (!questions || !questions.length) return { score: 0, correct: 0, total: questions.length };
  let totalFraction = 0;
  let fullCorrectCount = 0;

  questions.forEach((q) => {
    const fraction = evaluateQuestionFraction(q, answers[q.id]);
    totalFraction += fraction;
    if (fraction >= 0.999) fullCorrectCount++;
  });

  const pointsPerQuestion = 100 / questions.length;
  const score = Math.round(totalFraction * pointsPerQuestion);
  return { score, correct: fullCorrectCount, total: questions.length };
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) return `${h}h ${m}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export { normalizeFormats };
