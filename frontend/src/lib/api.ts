// API client for the Procurement Analyzer backend

const BASE = '/api';

export interface Analysis {
  id: string;
  status: string;
  model: string | null;
  file_count: number;
  total_pages: number;
  created_at: string;
  completed_at: string | null;
  report: any | null;
  qa: any | null;
  metrics: any | null;
  documents: any[] | null;
}

export interface AnalysisSummary {
  id: string;
  status: string;
  model: string | null;
  file_count: number;
  created_at: string;
  completed_at: string | null;
  project_title: string | null;
  project_summary: string | null;
  organization_name: string | null;
  estimated_value: number | null;
  currency: string;
  submission_deadline: string | null;
  completeness_score: number | null;
  procurement_type: string | null;
}

export interface SSEEvent {
  event: string;
  data: any;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Settings {
  default_model: string;
  api_key_set: boolean;
  api_key_preview: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  context_length: number;
  pricing_prompt: number;
  pricing_completion: number;
}

// ── Analysis endpoints ───────────────────────────────────────────────────────

export async function createAnalysis(files: File[], model?: string): Promise<{ id: string }> {
  const form = new FormData();
  for (const f of files) {
    form.append('files', f);
  }
  if (model) form.append('model', model);
  const res = await fetch(`${BASE}/analyze`, { method: 'POST', body: form });
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
}

export async function getAnalysis(id: string): Promise<Analysis> {
  const res = await fetch(`${BASE}/analyze/${id}`);
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.json();
}

export async function listAnalyses(limit = 50, offset = 0): Promise<AnalysisSummary[]> {
  const res = await fetch(`${BASE}/analyses?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function deleteAnalysis(id: string): Promise<void> {
  const res = await fetch(`${BASE}/analyze/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(res.statusText);
}

export async function cancelAnalysis(id: string): Promise<void> {
  const res = await fetch(`${BASE}/analyze/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error(res.statusText);
}

export async function exportAnalysis(id: string, format: 'pdf' | 'docx'): Promise<Blob> {
  const res = await fetch(`${BASE}/analyze/${id}/export?format=${format}`);
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
  return res.blob();
}

// ── SSE stream ───────────────────────────────────────────────────────────────

export function streamProgress(id: string, onEvent: (e: SSEEvent) => void, onDone: () => void): () => void {
  const es = new EventSource(`${BASE}/analyze/${id}/stream`);

  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      onEvent({ event: 'message', data });
    } catch { /* skip */ }
  };

  es.addEventListener('status', (msg: any) => {
    try {
      const data = JSON.parse(msg.data);
      onEvent({ event: 'status', data });
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        es.close();
        onDone();
      }
    } catch { /* skip */ }
  });

  es.addEventListener('progress', (msg: any) => {
    try {
      onEvent({ event: 'progress', data: JSON.parse(msg.data) });
    } catch { /* skip */ }
  });

  es.addEventListener('error_event', (msg: any) => {
    try {
      onEvent({ event: 'error', data: JSON.parse(msg.data) });
    } catch { /* skip */ }
  });

  es.addEventListener('metrics', (msg: any) => {
    try {
      onEvent({ event: 'metrics', data: JSON.parse(msg.data) });
    } catch { /* skip */ }
  });

  es.addEventListener('thinking', (msg: any) => {
    try {
      onEvent({ event: 'thinking', data: JSON.parse(msg.data) });
    } catch { /* skip */ }
  });

  es.onerror = () => {
    es.close();
    onDone();
  };

  return () => es.close();
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export async function* streamChat(id: string, question: string): AsyncGenerator<string> {
  const res = await fetch(`${BASE}/analyze/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: question }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || res.statusText);

  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop()!;
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        let parsed;
        try { parsed = JSON.parse(raw); } catch { continue; }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.chunk) yield parsed.chunk;
      }
    }
  }
}

export async function getChatHistory(id: string): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE}/analyze/${id}/chat/history`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const res = await fetch(`${BASE}/settings`);
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function updateSettings(data: { default_model?: string; openrouter_api_key?: string }): Promise<Settings> {
  const res = await fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
}

export async function getModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();
  return data.models || [];
}

export async function searchAllModels(query: string): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();
  return data.models || [];
}
