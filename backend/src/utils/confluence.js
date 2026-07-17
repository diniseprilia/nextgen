import { config } from '../config.js';
import { fetchUrlText, htmlToPlainText } from './urlContent.js';

const FETCH_TIMEOUT_MS = 15000;

export function isConfluenceConfigured() {
  return Boolean(config.confluence.email && config.confluence.apiToken);
}

export function parseConfluencePageId(urlString) {
  try {
    const url = new URL(urlString);
    const pageIdFromQuery = url.searchParams.get('pageId');
    if (pageIdFromQuery && /^\d+$/.test(pageIdFromQuery)) return pageIdFromQuery;
    const pathMatch = url.pathname.match(/\/pages\/(\d+)(?:\/|$)/);
    if (pathMatch) return pathMatch[1];
    return null;
  } catch {
    return null;
  }
}

export function isConfluenceUrl(urlString) {
  try {
    const { hostname, pathname } = new URL(urlString);
    if (!pathname.includes('/wiki/')) return false;
    if (parseConfluencePageId(urlString)) return true;
    return pathname.includes('/wiki/x/') || pathname.includes('/display/');
  } catch {
    return false;
  }
}

function resolveConfluenceApiBase(urlString) {
  try {
    const url = new URL(urlString);
    const wikiIndex = url.pathname.indexOf('/wiki');
    if (wikiIndex >= 0) {
      return `${url.origin}${url.pathname.slice(0, wikiIndex + '/wiki'.length)}`;
    }
  } catch {
    /* fall through */
  }
  if (config.confluence.baseUrl) {
    return config.confluence.baseUrl.replace(/\/$/, '');
  }
  return `${new URL(urlString).origin}/wiki`;
}

function authHeaders(credentials) {
  return {
    Authorization: `Basic ${credentials}`,
    Accept: 'application/json',
  };
}

function extractStorageHtml(data) {
  const candidates = [
    data?.body?.storage?.value,
    data?.body?.value,
    data?.body?.storage?.representation === 'storage' ? data?.body?.storage?.value : null,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

async function resolveConfluenceUrl(urlString, credentials) {
  if (parseConfluencePageId(urlString)) return urlString;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(urlString, {
      headers: authHeaders(credentials),
      signal: controller.signal,
      redirect: 'follow',
    });
    return res.url || urlString;
  } catch {
    return urlString;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchConfluenceV1(pageId, apiBase, credentials) {
  const apiUrl = `${apiBase}/rest/api/content/${pageId}?expand=body.storage`;
  const res = await fetch(apiUrl, {
    headers: authHeaders(credentials),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`Confluence API v1 returned ${res.status} for page ${pageId}`);
    err.status = res.status;
    err.apiUrl = apiUrl;
    throw err;
  }
  const data = await res.json();
  const storageHtml = extractStorageHtml(data);
  if (!storageHtml) {
    throw new Error(`Confluence page ${pageId} has no storage body (v1)`);
  }
  return storageHtml;
}

async function fetchConfluenceV2(pageId, apiBase, credentials) {
  const apiUrl = `${apiBase}/api/v2/pages/${pageId}?body-format=storage`;
  const res = await fetch(apiUrl, {
    headers: authHeaders(credentials),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = new Error(`Confluence API v2 returned ${res.status} for page ${pageId}`);
    err.status = res.status;
    err.apiUrl = apiUrl;
    throw err;
  }
  const data = await res.json();
  const storageHtml = extractStorageHtml(data);
  if (!storageHtml) {
    throw new Error(`Confluence page ${pageId} has no storage body (v2)`);
  }
  return storageHtml;
}

export async function fetchConfluencePageText(urlString) {
  if (!isConfluenceConfigured()) {
    throw new Error('Confluence is not configured on the server');
  }

  const credentials = Buffer.from(
    `${config.confluence.email}:${config.confluence.apiToken}`,
  ).toString('base64');

  const resolvedUrl = await resolveConfluenceUrl(urlString, credentials);
  const pageId = parseConfluencePageId(resolvedUrl);
  if (!pageId) {
    throw new Error(
      'Could not parse Confluence page ID from URL. Use a link that contains /pages/123456789/ or ?pageId=123456789',
    );
  }

  const apiBase = resolveConfluenceApiBase(resolvedUrl);
  let storageHtml;
  let lastError;

  try {
    storageHtml = await fetchConfluenceV1(pageId, apiBase, credentials);
  } catch (err) {
    lastError = err;
    if (err.status === 404) {
      try {
        storageHtml = await fetchConfluenceV2(pageId, apiBase, credentials);
      } catch (v2Err) {
        lastError = v2Err;
        throw new Error(
          `Confluence page ${pageId} not found (v1/v2 returned 404). `
          + 'Check the URL opens in your browser, your API token can read that space, '
          + 'and use a classic Atlassian API token (email + token Basic auth).',
        );
      }
    } else {
      throw err;
    }
  }

  const plain = htmlToPlainText(storageHtml);
  if (!plain) {
    throw new Error('Confluence page body is empty after conversion');
  }
  return plain;
}

export async function fetchUrlMaterialText(urlString) {
  if (isConfluenceUrl(urlString) && isConfluenceConfigured()) {
    try {
      return await fetchConfluencePageText(urlString);
    } catch (err) {
      console.warn('Confluence content fetch failed:', err.message);
    }
  }
  return fetchUrlText(urlString);
}
