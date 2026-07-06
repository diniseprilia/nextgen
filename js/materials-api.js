import { getMaterials as getLocalMaterials, saveMaterials as saveLocalMaterials } from './storage.js';

let materialsCache = [];
let apiAvailable = false;

const API_BASE = '/api/materials';
const API_OPTS = { credentials: 'include' };

export const ALLOWED_MATERIAL_EXTENSIONS = ['pdf', 'doc', 'docx', 'ppt', 'pptx'];
export const UNSUPPORTED_FILE_ERROR = 'File format is not supported.';

function isAllowedMaterialFile(file) {
  if (!file?.name) return false;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_MATERIAL_EXTENSIONS.includes(ext);
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, { ...API_OPTS, ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function isApiAvailable() {
  return apiAvailable;
}

export function getMaterialsList(teamId) {
  if (!teamId) return materialsCache;
  return materialsCache.filter((m) => m.teamId === teamId);
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function loadMaterials() {
  try {
    const health = await fetch('/api/health');
    if (!health.ok) throw new Error('API unavailable');
    materialsCache = await request('');
    apiAvailable = true;
  } catch {
    apiAvailable = false;
    materialsCache = getLocalMaterials();
  }
  return materialsCache;
}

export async function refreshMaterials(_teamId) {
  if (!apiAvailable) {
    materialsCache = getLocalMaterials();
    return materialsCache;
  }
  materialsCache = await request('');
  return materialsCache;
}

export async function createMaterial({ title, group, sourceType, sourceUrl, file, createdBy, teamId }) {
  if (sourceType === 'file' && file && !isAllowedMaterialFile(file)) {
    throw new Error(UNSUPPORTED_FILE_ERROR);
  }
  if (!apiAvailable) {
    const materials = getLocalMaterials();
    const entry = {
      id: `m_${Date.now()}`,
      title,
      group,
      sourceType,
      sourceUrl: sourceType === 'url' ? sourceUrl : '',
      content: sourceType === 'file' && file ? await file.text().catch(() => '') : null,
      teamId,
      updatedAt: new Date().toISOString(),
      createdBy,
    };
    materials.push(entry);
    saveLocalMaterials(materials);
    materialsCache = materials;
    return entry;
  }

  if (sourceType === 'url') {
    return request('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, group, sourceType: 'url', sourceUrl, createdBy, teamId }),
    });
  }

  const form = new FormData();
  form.append('title', title);
  form.append('group', group);
  form.append('sourceType', 'file');
  form.append('teamId', teamId);
  if (createdBy) form.append('createdBy', createdBy);
  form.append('file', file);
  return request('', { method: 'POST', body: form });
}

export async function updateMaterial(id, { title, group, sourceUrl, file }) {
  if (file && !isAllowedMaterialFile(file)) {
    throw new Error(UNSUPPORTED_FILE_ERROR);
  }
  if (!apiAvailable) {
    const materials = getLocalMaterials();
    const idx = materials.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error('Material not found');
    materials[idx] = {
      ...materials[idx],
      title: title ?? materials[idx].title,
      group: group ?? materials[idx].group,
      sourceUrl: sourceUrl ?? materials[idx].sourceUrl,
      content: file ? await file.text().catch(() => materials[idx].content) : materials[idx].content,
      updatedAt: new Date().toISOString(),
    };
    saveLocalMaterials(materials);
    materialsCache = materials;
    return materials[idx];
  }

  const material = materialsCache.find((m) => m.id === id);
  if (material?.sourceType === 'url') {
    return request(`/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, group, sourceUrl }),
    });
  }

  const form = new FormData();
  if (title) form.append('title', title);
  if (group) form.append('group', group);
  if (file) form.append('file', file);
  return request(`/${id}`, { method: 'PUT', body: form });
}

export async function deleteMaterial(id) {
  if (!apiAvailable) {
    const materials = getLocalMaterials().filter((m) => m.id !== id);
    saveLocalMaterials(materials);
    materialsCache = materials;
    return { ok: true, id };
  }
  return request(`/${id}`, { method: 'DELETE' });
}

export function getDownloadUrl(id) {
  return `${API_BASE}/${id}/download`;
}

export function getPreviewUrl(id) {
  return `${API_BASE}/${id}/preview`;
}

export function getContentUrl(id) {
  return `${API_BASE}/${id}/content`;
}

export async function fetchMaterialTextsForGeneration(materialIds) {
  const texts = [];
  for (const id of materialIds) {
    const m = materialsCache.find((x) => x.id === id);
    if (!m) continue;

    if (m.content?.trim()) {
      texts.push(m.content.trim());
      continue;
    }

    if (apiAvailable) {
      try {
        const res = await fetch(`${API_BASE}/${id}/content`, API_OPTS);
        if (res.ok) {
          const { content } = await res.json();
          if (content?.trim()) {
            texts.push(content.trim());
            m.content = content;
            continue;
          }
        }
      } catch {
        /* fall through to URL fallback */
      }
    }

    if (isUrlMaterial(m)) {
      const fallback = [m.title, m.group, m.sourceUrl].filter(Boolean).join('\n');
      if (fallback.trim()) texts.push(fallback.trim());
    }
  }
  return texts;
}

export function isUrlMaterial(m) {
  return m.sourceType === 'url' || (m.sourceUrl && !m.file && !m.content?.trim());
}

export function isFileMaterial(m) {
  return m.sourceType === 'file' || Boolean(m.file);
}
