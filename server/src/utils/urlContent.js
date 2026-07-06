const MAX_URL_TEXT = 12000;
const FETCH_TIMEOUT_MS = 15000;

export async function fetchUrlText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NextGen/1.0 (material-ingestion)' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Failed to fetch URL (${res.status})`);

    const contentType = res.headers.get('content-type') || '';
    const body = await res.text();

    if (contentType.includes('text/html') || body.trim().startsWith('<')) {
      return stripHtml(body);
    }
    return body.replace(/\s+/g, ' ').trim().slice(0, MAX_URL_TEXT);
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_URL_TEXT);
}
