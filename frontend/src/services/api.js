/**
 * API client service for Project Nexus backend communication.
 */

export async function fetchHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`Health check failed with HTTP ${res.status}`);
  }
  return await res.json();
}

export async function connectRepo({ absolutePath, languages = ['python', 'cpp'], excludeFolders = ['node_modules', 'venv', 'build', '.git'] }) {
  const res = await fetch('/api/repo/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      absolute_path: absolutePath,
      languages,
      exclude_folders: excludeFolders,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail?.message || data.detail || 'Failed to connect repository');
  }
  return data;
}

export function subscribeToIngestion(sessionId, { onEvent, onError, onComplete }) {
  const eventSource = new EventSource(`/api/repo/ingest/status?session_id=${encodeURIComponent(sessionId)}`);

  eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (onEvent) onEvent(payload);
      if (payload.stage === 'COMPLETE') {
        eventSource.close();
        if (onComplete) onComplete(payload);
      } else if (payload.stage === 'ERROR') {
        eventSource.close();
        if (onError) onError(new Error(payload.message || 'Ingestion error'));
      }
    } catch (err) {
      console.error('Error parsing SSE event:', err);
    }
  };

  eventSource.onerror = (err) => {
    eventSource.close();
    if (onError) onError(err);
  };

  return () => {
    eventSource.close();
  };
}

export async function executeChatQuery(query, chatHistory = []) {
  const res = await fetch('/api/chat/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      chat_history: chatHistory,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail?.message || data.detail || 'Chat query failed');
  }
  return data;
}

export async function fetchGalaxyView(limit = 250) {
  const res = await fetch(`/api/graph/galaxy?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to load Galaxy View: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function fetchNodeImpact(nodeId) {
  const res = await fetch(`/api/graph/node-impact/${encodeURIComponent(nodeId)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch node impact: HTTP ${res.status}`);
  }
  return await res.json();
}

export async function fetchFileContent(filePath, startLine = null, endLine = null) {
  const params = new URLSearchParams({ file_path: filePath });
  if (startLine) params.append('start_line', startLine);
  if (endLine) params.append('end_line', endLine);

  const res = await fetch(`/api/repo/file-content?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch file content: HTTP ${res.status}`);
  }
  return await res.json();
}
