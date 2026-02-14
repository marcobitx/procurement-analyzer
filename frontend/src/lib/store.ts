// frontend/src/lib/store.ts
// Global reactive store + stream manager for persistent SSE during navigation
// The stream manager lives at module level (not React) so it survives component unmounts
// Related: api.ts (streamProgress), AnalyzingView.tsx, App.tsx

import { useState, useEffect } from 'react';
import { streamProgress, type SSEEvent } from './api';

type Listener = () => void;

function createStore<T>(initialState: T) {
  let state = initialState;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    setState: (partial: Partial<T> | ((prev: T) => Partial<T>)) => {
      const update = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...update };
      listeners.forEach((l) => l());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

/** SSR-safe hook — avoids useSyncExternalStore server snapshot issues */
export function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  const [snapshot, setSnapshot] = useState(() => store.getState());
  useEffect(() => {
    // Sync in case state changed between render and effect
    setSnapshot(store.getState());
    return store.subscribe(() => setSnapshot(store.getState()));
  }, [store]);
  return snapshot;
}

export type AppView = 'upload' | 'analyzing' | 'results' | 'history' | 'settings';

export interface ParsedDocInfo {
  filename: string;
  pages: number;
  format: string;
  size_kb: number;
  token_estimate: number;
}

export interface AnalysisSnapshot {
  events: Array<{ event: string; data: any; ts: number }>;
  stepThinking: Record<number, string>;
  stepTimes: Record<number, { start: number; end?: number }>;
  finalStatus: string;
  elapsedSec: number;
}

export interface AppState {
  view: AppView;
  currentAnalysisId: string | null;
  sidebarOpen: boolean;
  events: Array<{ event: string; data: any; ts: number }>;
  error: string | null;
  files: File[];
  uploading: boolean;
  rightPanelOpen: boolean;
  selectedModel: any | null;
  modelPanelOpen: boolean;
  filesPanelOpen: boolean;
  sourcesPanelOpen: boolean;
  analysisStatus: string | null;
  analysisElapsedSec: number;
  parsedDocs: ParsedDocInfo[];
  cachedModels: any[] | null;
  cachedAnalysis: { id: string; data: any } | null;
  reviewMode: boolean;
  analysisSnapshot: AnalysisSnapshot | null;
  // Stream state — managed by the global stream manager, read by AnalyzingView
  streamEvents: Array<{ event: string; data: any; ts: number }>;
  streamStatus: string;
  streamThinking: Record<number, string>;
  streamThinkingActive: boolean;
  streamStepTimes: Record<number, { start: number; end?: number }>;
  streamElapsedSec: number;
  streamStartTime: number | null;
}

export const appStore = createStore<AppState>({
  view: 'upload',
  currentAnalysisId: null,
  sidebarOpen: true,
  events: [],
  error: null,
  files: [],
  uploading: false,
  rightPanelOpen: true,
  selectedModel: null,
  modelPanelOpen: false,
  filesPanelOpen: false,
  sourcesPanelOpen: false,
  analysisStatus: null,
  analysisElapsedSec: 0,
  parsedDocs: [],
  cachedModels: null,
  cachedAnalysis: null,
  reviewMode: false,
  analysisSnapshot: null,
  streamEvents: [],
  streamStatus: 'QUEUED',
  streamThinking: {},
  streamThinkingActive: false,
  streamStepTimes: {},
  streamElapsedSec: 0,
  streamStartTime: null,
});

// ── Step helpers (shared with AnalyzingView) ──────────────────────────────────

const STEP_ORDER = ['PARSING', 'EXTRACTING', 'AGGREGATING', 'EVALUATING', 'COMPLETED'];

function getStepIndex(status: string): number {
  const idx = STEP_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

// ── Global Stream Manager ─────────────────────────────────────────────────────
// Pure JS — no React. Survives component unmounts.

let closeStream: (() => void) | null = null;
let timerInterval: ReturnType<typeof setInterval> | null = null;

function clearTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

export function stopAnalysisStream() {
  if (closeStream) {
    closeStream();
    closeStream = null;
  }
  clearTimer();
}

export function isStreamActive(): boolean {
  return closeStream !== null;
}

export function startAnalysisStream(analysisId: string) {
  // Close any existing stream first — prevents duplicates
  stopAnalysisStream();

  const startTime = Date.now();

  // Reset stream state
  appStore.setState({
    parsedDocs: [],
    streamEvents: [],
    streamStatus: 'QUEUED',
    streamThinking: {},
    streamThinkingActive: false,
    streamStepTimes: {},
    streamElapsedSec: 0,
    streamStartTime: startTime,
    analysisStatus: 'QUEUED',
    analysisElapsedSec: 0,
  });

  // Start elapsed timer
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    appStore.setState({ streamElapsedSec: elapsed, analysisElapsedSec: elapsed });
  }, 1000);

  // Local mutable step times (not React state, just a plain object)
  const stepTimes: Record<number, { start: number; end?: number }> = {};

  function updateStepTimes(status: string) {
    const activeIdx = getStepIndex(status);
    const now = Date.now();
    if (status !== 'COMPLETED' && status !== 'FAILED' && status !== 'CANCELED' && status !== 'QUEUED') {
      if (!stepTimes[activeIdx]) {
        stepTimes[activeIdx] = { start: now };
      }
      for (let i = 0; i < activeIdx; i++) {
        if (stepTimes[i] && !stepTimes[i].end) {
          stepTimes[i].end = now;
        }
      }
    }
    if (status === 'COMPLETED') {
      for (let i = 0; i <= 3; i++) {
        if (stepTimes[i] && !stepTimes[i].end) {
          stepTimes[i].end = now;
        }
      }
    }
    appStore.setState({ streamStepTimes: { ...stepTimes } });
  }

  function handleStatusChange(newStatus: string) {
    appStore.setState({ streamStatus: newStatus, analysisStatus: newStatus });
    updateStepTimes(newStatus);

    if (newStatus === 'COMPLETED') {
      clearTimer();
      const s = appStore.getState();
      appStore.setState({
        analysisSnapshot: {
          events: s.streamEvents,
          stepThinking: s.streamThinking,
          stepTimes: { ...stepTimes },
          finalStatus: 'COMPLETED',
          elapsedSec: s.streamElapsedSec,
        },
      });
    } else if (newStatus === 'FAILED') {
      clearTimer();
      appStore.setState({ error: 'Analizė nepavyko — bandykite dar kartą' });
    } else if (newStatus === 'CANCELED') {
      clearTimer();
    }
  }

  closeStream = streamProgress(
    analysisId,
    (e: SSEEvent) => {
      // Handle thinking stream events
      if (e.event === 'thinking') {
        if (e.data?.type === 'thinking_done') {
          appStore.setState({ streamThinkingActive: false });
        } else if (e.data?.text) {
          appStore.setState({ streamThinkingActive: true });
          const currentStatus = appStore.getState().streamStatus;
          const idx = getStepIndex(currentStatus);
          const prev = appStore.getState().streamThinking;
          const cur = prev[idx] || '';
          const updated = cur + e.data.text;
          appStore.setState({
            streamThinking: {
              ...prev,
              [idx]: updated.length > 2000 ? updated.slice(-2000) : updated,
            },
          });
        }
        return;
      }

      // Append event
      const prevEvents = appStore.getState().streamEvents;
      appStore.setState({ streamEvents: [...prevEvents, { ...e, ts: Date.now() }] });

      // Handle status changes
      if (e.event === 'status' && e.data?.status) {
        handleStatusChange(e.data.status.toUpperCase());
      }
      if (e.data?.event_type === 'status_change' && e.data?.new_status) {
        handleStatusChange(e.data.new_status.toUpperCase());
      }

      // Handle parsed docs
      if (e.data?.event_type === 'file_parsed') {
        const prev = appStore.getState().parsedDocs;
        const already = prev.some((d) => d.filename === e.data.filename);
        if (!already) {
          appStore.setState({
            parsedDocs: [...prev, {
              filename: e.data.filename,
              pages: e.data.pages ?? 0,
              format: e.data.format ?? '',
              size_kb: e.data.size_kb ?? 0,
              token_estimate: e.data.token_estimate ?? 0,
            }],
          });
        }
      }
    },
    () => {
      // onDone — stream closed (error or server-side close)
      closeStream = null;
      clearTimer();
    },
  );
}
