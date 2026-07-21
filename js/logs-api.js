export async function fetchSystemLogs({ level, category, search, page = 1, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (level) params.append('level', level);
  if (category) params.append('category', category);
  if (search) params.append('search', search);
  params.append('page', page);
  params.append('limit', limit);

  const res = await fetch(`/api/admin/logs?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch system logs (${res.status})`);
  }

  return res.json();
}

export async function toggleDebugMode(enabled) {
  const res = await fetch('/api/admin/logs/debug-mode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to toggle debug mode');
  }

  return res.json();
}

export async function clearSystemLogs() {
  const res = await fetch('/api/admin/logs', {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to clear system logs');
  }

  return res.json();
}

export function connectLogStream(onMessage, onError) {
  const eventSource = new EventSource('/api/admin/logs/stream');

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.error('Error parsing SSE log payload:', e);
    }
  };

  eventSource.onerror = (err) => {
    if (onError) onError(err);
  };

  return eventSource;
}
