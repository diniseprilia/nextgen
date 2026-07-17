import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { generateQuestionsBatch } from '../services/gemini.js';

const router = Router();

router.use(requireAuth);

router.post('/generate', async (req, res) => {
  try {
    if (!['Master', 'Admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Master or Admin can generate questions' });
    }

    const { texts, formats, count, apiKey } = req.body;

    if (!Array.isArray(texts) || !texts.some((t) => typeof t === 'string' && t.trim())) {
      return res.status(400).json({ error: 'texts array with at least one non-empty string is required' });
    }

    const questionCount = Number(count);
    if (!Number.isFinite(questionCount) || questionCount < 1) {
      return res.status(400).json({ error: 'count must be a positive number' });
    }

    const key = (apiKey?.trim() || config.geminiApiKey || '').trim();
    if (!key) {
      return res.status(400).json({
        error: 'Gemini API key not configured. Set GEMINI_API_KEY in .env or add a key in Settings.',
      });
    }

    const cleanTexts = texts.map((t) => t.trim()).filter(Boolean);
    const questions = await generateQuestionsBatch(key, cleanTexts, formats, questionCount);

    if (!questions.length) {
      return res.status(502).json({ error: 'AI could not generate questions from the provided text' });
    }

    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate questions' });
  }
});

export default router;
