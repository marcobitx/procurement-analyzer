// frontend/src/lib/store.ts
// Global reactive store + stream manager for persistent SSE during navigation
// The stream manager lives at module level (not React) so it survives component unmounts
// Related: api.ts (streamProgress), AnalyzingView.tsx, App.tsx

import { useState, useEffect } from 'react';
import {
  streamProgress,
  type SSEEvent,
  listNotes,
  createNoteApi,
  updateNoteApi,
  deleteNoteApi,
  bulkDeleteNotes as bulkDeleteNotesApi,
  bulkUpdateNotesStatus as bulkUpdateNotesStatusApi,
  type NoteData,
} from './api';

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

export type AppView = 'upload' | 'analyzing' | 'results' | 'history' | 'settings' | 'notes';

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

export type NoteStatus = 'idea' | 'in_progress' | 'done' | 'archived';
export type NotePriority = 'low' | 'medium' | 'high';
export type NoteColor = 'default' | 'amber' | 'emerald' | 'blue' | 'red' | 'purple';
export type NotesViewMode = 'grid' | 'list' | 'kanban';

export interface Note {
  id: string;
  title: string;
  content: string;
  status: NoteStatus;
  priority: NotePriority;
  tags: string[];
  color: NoteColor;
  pinned: boolean;
  analysisId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface NotesFilters {
  search: string;
  status: NoteStatus | 'all';
  priority: NotePriority | 'all';
  tags: string[];
  dateFrom: number | null;
  dateTo: number | null;
  analysisId: string | 'all';
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
  helpPanelOpen: boolean;
  notesList: Note[];
  activeNoteId: string | null;
  notesLoading: boolean;
  notesError: string | null;
  notesViewMode: NotesViewMode;
  notesFilters: NotesFilters;
  notesSortField: 'updated_at' | 'created_at' | 'title' | 'priority';
  notesSortDir: 'asc' | 'desc';
  notesSelectedIds: Set<string>;
  notesPage: number;
  notesPerPage: number;
  tipsPanelOpen: boolean;
  previousView: AppView | null;
  // Stream state — managed by the global stream manager, read by AnalyzingView
  streamEvents: Array<{ event: string; data: any; ts: number }>;
  streamStatus: string;
  streamThinking: Record<number, string>;
  streamThinkingActive: boolean;
  streamStepTimes: Record<number, { start: number; end?: number }>;
  streamElapsedSec: number;
  streamStartTime: number | null;
}

// ── NoteData → Note mapper ────────────────────────────────────────────────────

function mapNoteData(d: NoteData): Note {
  return {
    id: d._id,
    title: d.title,
    content: d.content,
    status: (d.status || 'idea') as NoteStatus,
    priority: (d.priority || 'medium') as NotePriority,
    tags: d.tags || [],
    color: (d.color || 'default') as NoteColor,
    pinned: d.pinned,
    analysisId: d.analysis_id || null,
    createdAt: d._creationTime,
    updatedAt: d.updated_at,
  };
}

export const appStore = createStore<AppState>({
  view: 'upload',
  currentAnalysisId: null,
  sidebarOpen: true,
  events: [],
  error: null,
  files: [],
  uploading: false,
  rightPanelOpen: false,
  selectedModel: null,
  modelPanelOpen: false,
  filesPanelOpen: false,
  sourcesPanelOpen: false,
  helpPanelOpen: false,
  notesList: [],
  activeNoteId: null,
  notesLoading: false,
  notesError: null,
  notesViewMode: 'grid',
  notesFilters: { search: '', status: 'all', priority: 'all', tags: [], dateFrom: null, dateTo: null, analysisId: 'all' },
  notesSortField: 'updated_at',
  notesSortDir: 'desc',
  notesSelectedIds: new Set<string>(),
  notesPage: 0,
  notesPerPage: 10,
  tipsPanelOpen: false,
  previousView: null,
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

// ── Notes CRUD helpers (API-backed with optimistic updates) ───────────────────

let _notesMigrated = false;

export async function loadNotesFromServer() {
  appStore.setState({ notesLoading: true, notesError: null });
  try {
    // One-time migration from localStorage
    if (!_notesMigrated) {
      _notesMigrated = true;
      try {
        const raw = localStorage.getItem('procurement-analyzer-notes');
        if (raw) {
          const old = JSON.parse(raw) as Array<{
            id: string; title: string; content: string;
            createdAt: number; updatedAt: number; pinned: boolean;
          }>;
          if (old.length > 0) {
            for (const n of old) {
              await createNoteApi({
                title: n.title,
                content: n.content,
                pinned: n.pinned,
                status: 'idea',
                priority: 'medium',
                tags: [],
                color: 'default',
              });
            }
            localStorage.removeItem('procurement-analyzer-notes');
          }
        }
      } catch { /* ignore migration errors */ }
    }

    const data = await listNotes(200, 0);
    appStore.setState({ notesList: data.map(mapNoteData), notesLoading: false });
  } catch (e: any) {
    appStore.setState({ notesError: e.message || 'Nepavyko užkrauti užrašų', notesLoading: false });
  }
}

export async function createNote(analysisId?: string): Promise<string | null> {
  try {
    const { id } = await createNoteApi({
      title: '',
      content: '',
      status: 'idea',
      priority: 'medium',
      tags: [],
      color: 'default',
      pinned: false,
      analysis_id: analysisId || null,
    });
    await loadNotesFromServer();
    appStore.setState({ activeNoteId: id });
    return id;
  } catch (e: any) {
    appStore.setState({ notesError: e.message });
    return null;
  }
}

export async function updateNote(
  id: string,
  patch: Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'status' | 'priority' | 'tags' | 'color' | 'analysisId'>>,
) {
  // Optimistic update
  const updated = appStore.getState().notesList.map((n) =>
    n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
  );
  appStore.setState({ notesList: updated });

  try {
    // Map analysisId → analysis_id for the API
    const { analysisId, ...rest } = patch as any;
    const apiPatch: Record<string, any> = { ...rest };
    if (analysisId !== undefined) {
      apiPatch.analysis_id = analysisId;
    }
    await updateNoteApi(id, apiPatch);
  } catch (e: any) {
    // Revert on failure — reload from server
    await loadNotesFromServer();
  }
}

export async function deleteNote(id: string) {
  // Optimistic remove
  const prev = appStore.getState().notesList;
  const activeId = appStore.getState().activeNoteId;
  appStore.setState({
    notesList: prev.filter((n) => n.id !== id),
    activeNoteId: activeId === id ? null : activeId,
    notesSelectedIds: (() => {
      const s = new Set(appStore.getState().notesSelectedIds);
      s.delete(id);
      return s;
    })(),
  });

  try {
    await deleteNoteApi(id);
  } catch {
    await loadNotesFromServer();
  }
}

export async function togglePinNote(id: string) {
  const note = appStore.getState().notesList.find((n) => n.id === id);
  if (note) await updateNote(id, { pinned: !note.pinned });
}

export async function bulkDeleteSelectedNotes() {
  const ids = [...appStore.getState().notesSelectedIds];
  if (ids.length === 0) return;

  // Optimistic
  const remaining = appStore.getState().notesList.filter((n) => !ids.includes(n.id));
  appStore.setState({ notesList: remaining, notesSelectedIds: new Set() });

  try {
    await bulkDeleteNotesApi(ids);
  } catch {
    await loadNotesFromServer();
  }
}

export async function bulkChangeStatus(status: NoteStatus) {
  const ids = [...appStore.getState().notesSelectedIds];
  if (ids.length === 0) return;

  // Optimistic
  const updated = appStore.getState().notesList.map((n) =>
    ids.includes(n.id) ? { ...n, status, updatedAt: Date.now() } : n,
  );
  appStore.setState({ notesList: updated, notesSelectedIds: new Set() });

  try {
    await bulkUpdateNotesStatusApi(ids, status);
  } catch {
    await loadNotesFromServer();
  }
}

// ── Notes filter/sort/selection helpers ───────────────────────────────────────

export function setNotesFilter(patch: Partial<NotesFilters>) {
  const cur = appStore.getState().notesFilters;
  appStore.setState({ notesFilters: { ...cur, ...patch } });
}

export function resetNotesFilters() {
  appStore.setState({
    notesFilters: { search: '', status: 'all', priority: 'all', tags: [], dateFrom: null, dateTo: null, analysisId: 'all' },
  });
}

export function setNotesSort(field: AppState['notesSortField'], dir?: 'asc' | 'desc') {
  const s = appStore.getState();
  if (field === s.notesSortField && !dir) {
    appStore.setState({ notesSortDir: s.notesSortDir === 'asc' ? 'desc' : 'asc' });
  } else {
    appStore.setState({ notesSortField: field, notesSortDir: dir ?? 'desc' });
  }
}

export function toggleNoteSelection(id: string) {
  const s = new Set(appStore.getState().notesSelectedIds);
  if (s.has(id)) s.delete(id); else s.add(id);
  appStore.setState({ notesSelectedIds: s });
}

export function clearNoteSelection() {
  appStore.setState({ notesSelectedIds: new Set() });
}

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

/** Reset all analysis-related state for starting a fresh analysis */
export function resetForNewAnalysis() {
  stopAnalysisStream();
  appStore.setState({
    view: 'upload',
    currentAnalysisId: null,
    files: [],
    error: null,
    analysisStatus: null,
    analysisElapsedSec: 0,
    parsedDocs: [],
    analysisSnapshot: null,
    cachedAnalysis: null,
    reviewMode: false,
    streamEvents: [],
    streamStatus: 'QUEUED',
    streamThinking: {},
    streamThinkingActive: false,
    streamStepTimes: {},
    streamElapsedSec: 0,
    streamStartTime: null,
  });
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
