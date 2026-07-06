import { getSettings } from './storage.js';

export async function generateQuestionsViaApi(texts, formats, count) {
  const { geminiApiKey } = getSettings();
  const res = await fetch('/api/questions/generate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      texts,
      formats,
      count,
      apiKey: geminiApiKey || undefined,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  const data = await res.json();
  return data.questions || [];
}
