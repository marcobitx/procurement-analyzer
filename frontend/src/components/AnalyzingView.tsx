// frontend/src/components/AnalyzingView.tsx
// Real-time analysis progress — single-column expandable step cards
// Pure reader: all stream state comes from the global store (store.ts stream manager)
// Related: store.ts (startAnalysisStream), App.tsx

import { useEffect, useState, useRef, useMemo } from 'react';
import {
  AlertCircle,
  FileText,
  Brain,
  Layers,
  Shield,
  ChevronDown,
  ArrowRight,
} from 'lucide-react';
import { appStore, useStore } from '../lib/store';

interface Props {
  analysisId: string;
  error?: string | null;
  reviewMode?: boolean;
  onComplete: () => void;
  onError: (err: string) => void;
  onViewReport?: () => void;
}

interface StepInfo {
  icon: any;
  label: string;
  detail: string;
  status: 'waiting' | 'active' | 'done' | 'error';
}

const STEP_ORDER = ['PARSING', 'EXTRACTING', 'AGGREGATING', 'EVALUATING', 'COMPLETED'];

function getStepIndex(status: string): number {
  const idx = STEP_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

/** Maps SSE event_type to badge class + label */
function formatEvent(e: { event: string; data: any }) {
  const type = e.data?.event_type || e.event;
  switch (type) {
    case 'file_parsed':
      return { badge: 'event-badge-parse', label: 'PARSED', detail: e.data.filename };
    case 'extraction_started':
      return { badge: 'event-badge-extract', label: 'EXTRACT', detail: `${e.data.filename} — pradėta` };
    case 'extraction_completed':
      return { badge: 'event-badge-extract', label: 'EXTRACT', detail: `${e.data.filename} — baigta` };
    case 'aggregation_started':
      return { badge: 'event-badge-aggregate', label: 'AGGREGATE', detail: 'Kryžminė analizė pradėta' };
    case 'aggregation_completed':
      return { badge: 'event-badge-aggregate', label: 'AGGREGATE', detail: 'Kryžminė analizė baigta' };
    case 'evaluation_started':
      return { badge: 'event-badge-evaluate', label: 'EVALUATE', detail: 'QA tikrinimas pradėtas' };
    case 'evaluation_completed':
      return { badge: 'event-badge-evaluate', label: 'EVALUATE', detail: 'QA tikrinimas baigtas' };
    case 'metrics_update':
      return { badge: 'event-badge-metrics', label: 'METRICS', detail: e.data.message || 'Atnaujinta' };
    case 'error':
      return { badge: 'event-badge-error', label: 'ERROR', detail: e.data.message || e.data.error || 'Klaida' };
    case 'status_change':
      return { badge: 'event-badge-status', label: 'STATUS', detail: e.data.new_status || 'Pasikeitė' };
    default:
      return { badge: 'event-badge-status', label: type?.toUpperCase() || 'EVENT', detail: e.data?.message || e.data?.filename || '' };
  }
}

/** Route event types to step indices */
const EVENT_STEP_MAP: Record<string, number> = {
  file_parsed: 0,
  extraction_started: 1,
  extraction_completed: 1,
  aggregation_started: 2,
  aggregation_completed: 2,
  evaluation_started: 3,
  evaluation_completed: 3,
};

/** Static step definitions — hoisted to avoid re-creation on every render */
const STEP_DEFS = [
  { icon: FileText, label: 'Dokumentų parsavimas', detail: 'Docling konvertuoja failus' },
  { icon: Brain, label: 'Duomenų ištraukimas', detail: 'AI struktūrizuoja kiekvieną dokumentą' },
  { icon: Layers, label: 'Agregavimas', detail: 'Kryžminė dokumentų analizė' },
  { icon: Shield, label: 'Kokybės vertinimas', detail: 'Automatinis QA tikrinimas' },
] as const;

/** Active step icon — snake tracing a square path */
function ActiveStepIcon() {
  const perim = 60; // perimeter of rect(4,4,16,16,rx=2.5)

  return (
    <div className="relative w-5 h-5">
      <svg className="w-full h-full" viewBox="0 0 24 24" fill="none">
        {/* Faint square border — always visible */}
        <rect x="4" y="4" width="16" height="16" rx="2.5"
              stroke="rgba(245,158,11,0.1)" strokeWidth="1.5" />
        {/* Snake body — semi-transparent trailing tail */}
        <rect x="4" y="4" width="16" height="16" rx="2.5"
              className="snake-trail"
              stroke="rgba(251,191,36,0.2)" strokeWidth="1.5"
              strokeDasharray={`18 ${perim - 18}`} />
        {/* Snake head — bright leading segment with glow */}
        <rect x="4" y="4" width="16" height="16" rx="2.5"
              className="snake-head"
              stroke="#fbbf24" strokeWidth="2" strokeLinecap="round"
              strokeDasharray={`6 ${perim - 6}`} />
      </svg>
    </div>
  );
}

export default function AnalyzingView({ analysisId, error, reviewMode, onComplete, onError, onViewReport }: Props) {
  const state = useStore(appStore);

  // In review mode, read from snapshot. Otherwise read from live stream state.
  const snapshot = reviewMode ? state.analysisSnapshot : null;

  const currentStatus = snapshot ? snapshot.finalStatus : state.streamStatus;
  const events = snapshot ? snapshot.events : state.streamEvents;
  const elapsedSec = snapshot ? snapshot.elapsedSec : state.streamElapsedSec;
  const stepThinking = snapshot ? snapshot.stepThinking : state.streamThinking;
  const thinkingStreaming = snapshot ? false : state.streamThinkingActive;
  const stepTimesData = snapshot ? snapshot.stepTimes : state.streamStepTimes;

  // CoT collapsed map — local UI state only
  const [cotCollapsedMap, setCotCollapsedMap] = useState<Record<number, boolean>>(
    snapshot ? Object.fromEntries(Object.keys(snapshot.stepThinking).map((k) => [k, true])) : {},
  );

  const logEndRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active step's event log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // Auto-scroll thinking box
  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [stepThinking]);

  // Auto-expand CoT when thinking starts for a step, auto-collapse when done
  useEffect(() => {
    if (reviewMode) return;
    if (thinkingStreaming) {
      const idx = getStepIndex(currentStatus);
      setCotCollapsedMap((prev) => ({ ...prev, [idx]: false }));
    }
  }, [thinkingStreaming, currentStatus, reviewMode]);

  // Auto-collapse CoT when thinking finishes (streamThinkingActive goes false)
  const prevThinkingRef = useRef(false);
  useEffect(() => {
    if (reviewMode) return;
    if (prevThinkingRef.current && !thinkingStreaming) {
      const idx = getStepIndex(currentStatus);
      setCotCollapsedMap((prev) => ({ ...prev, [idx]: true }));
    }
    prevThinkingRef.current = thinkingStreaming;
  }, [thinkingStreaming, currentStatus, reviewMode]);

  // React to terminal statuses
  useEffect(() => {
    if (reviewMode) return;
    if (currentStatus === 'COMPLETED') {
      setTimeout(onComplete, 800);
    } else if (currentStatus === 'FAILED') {
      onError('Analizė nepavyko — bandykite dar kartą');
    } else if (currentStatus === 'CANCELED') {
      onError('Analizė atšaukta');
    }
  }, [currentStatus, onComplete, onError, reviewMode]);

  // Handle external cancel error
  useEffect(() => {
    if (reviewMode) return;
    if (error === 'Analizė atšaukta') {
      // Stream manager handles cleanup — nothing extra needed
    }
  }, [error, reviewMode]);

  // Derive step states from hoisted STEP_DEFS
  const activeIdx = getStepIndex(currentStatus);
  const steps: StepInfo[] = useMemo(() =>
    STEP_DEFS.map((def, i) => {
      let status: StepInfo['status'] = 'waiting';
      if (currentStatus === 'COMPLETED') status = 'done';
      else if (i < activeIdx) status = 'done';
      else if (i === activeIdx) status = currentStatus === 'FAILED' ? 'error' : 'active';
      return { ...def, status };
    }),
    [currentStatus, activeIdx],
  );

  // All displayable events (all 9 types)
  const displayEvents = events
    .filter((e) => e.data?.event_type || e.event === 'status')
    .slice(-50);

  // Route events to their step
  const stepEvents = [0, 1, 2, 3].map((idx) =>
    displayEvents.filter((e) => EVENT_STEP_MAP[e.data?.event_type] === idx)
  );

  // Counters and summaries
  const totalFiles = state.files.length;
  const parsedDocs = state.parsedDocs;
  const totalPages = parsedDocs.reduce((sum, d) => sum + d.pages, 0);

  function getStepDuration(idx: number): string | null {
    const t = stepTimesData[idx];
    if (!t || !t.end) return null;
    return formatTime(Math.round((t.end - t.start) / 1000));
  }

  function getStepCounter(idx: number): { value: string; label: string } | null {
    if (idx === 0) {
      const parsed = stepEvents[0].length;
      if (parsed > 0 || totalFiles > 0) return { value: `${parsed}/${totalFiles || '?'}`, label: 'dokumentų' };
    }
    if (idx === 1) {
      const completed = stepEvents[1].filter((e) => e.data?.event_type === 'extraction_completed').length;
      const total = parsedDocs.length || totalFiles;
      if (completed > 0 || total > 0) return { value: `${completed}/${total}`, label: 'dokumentų' };
    }
    return null;
  }

  function getCompletedSummary(idx: number): string {
    if (idx === 0) {
      const count = parsedDocs.length;
      return `${count} dok. · ${totalPages} psl.`;
    }
    if (idx === 1) {
      const count = stepEvents[1].filter((e) => e.data?.event_type === 'extraction_completed').length;
      return `${count} dok. apdorota`;
    }
    if (idx === 2) return 'Ataskaita suformuota';
    if (idx === 3) return 'QA patikrinimas baigtas';
    return '';
  }

  return (
    <div className="animate-fade-in-up pt-6" role="status" aria-label="Analizės progresas">
      {/* Review mode header */}
      {reviewMode && (
        <div className="flex items-center justify-between mb-4 px-1">
          <div>
            <h2 className="text-[18px] font-bold text-surface-100 tracking-tight">Analizės eiga</h2>
            <p className="text-[12px] text-surface-500 mt-0.5">
              Trukmė: {formatTime(elapsedSec)}
            </p>
          </div>
          {onViewReport && (
            <button
              onClick={onViewReport}
              className="btn-secondary-professional"
            >
              Peržiūrėti ataskaitą
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="rounded-2xl bg-white/[0.05] border border-surface-700/60 overflow-hidden shadow-lg shadow-black/20 py-2 space-y-3">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const eventsForStep = stepEvents[i];
        const counter = getStepCounter(i);
        const duration = getStepDuration(i);
        const summary = getCompletedSummary(i);

        // ── Completed step: summary row + collapsible CoT below ──
        if (step.status === 'done') {
          const hasCot = !!stepThinking[i];
          const isCotOpen = hasCot && cotCollapsedMap[i] === false;
          return (
            <div key={i} className="animate-fade-in">
              <div className="px-5 py-3 flex items-center gap-4">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                  <div className="w-[7px] h-[7px] rotate-45 bg-emerald-400 rounded-[1px]" />
                </div>
                <p className="text-[14px] font-bold text-emerald-300 tracking-tight flex-shrink-0">
                  {step.label}
                </p>
                <span className="text-[12px] font-mono text-surface-500 ml-auto">
                  {summary}
                </span>
                {duration && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 flex-shrink-0">
                    {duration}
                  </span>
                )}
              </div>
              {/* CoT bar — always visible when thinking was captured, content toggleable */}
              {hasCot && (
                <div className="ml-[4.5rem] mr-5 mb-1 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] backdrop-blur-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCotCollapsedMap((prev) => ({ ...prev, [i]: prev[i] === false ? true : false }))}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-violet-500/5 transition-colors cursor-pointer select-none"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400/30" />
                    <span className="text-[9px] font-black text-violet-400/50 uppercase tracking-widest">
                      Modelio mąstymas
                    </span>
                    <ChevronDown className={`w-3 h-3 text-violet-400/40 ml-auto transition-transform duration-200 ${isCotOpen ? '' : '-rotate-90'}`} />
                  </button>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isCotOpen ? 'max-h-[200px]' : 'max-h-0'
                  }`}>
                    <div
                      className="px-3 py-2 border-t border-violet-500/10 bg-violet-500/[0.03]
                                 max-h-[150px] overflow-y-auto scrollbar-thin
                                 text-[11px] text-surface-400 font-mono leading-relaxed
                                 whitespace-pre-wrap break-words"
                    >
                      {stepThinking[i]}
                    </div>
                  </div>
                </div>
              )}
              {/* Divider after completed step */}
              <div className="mx-5 h-px" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(94,86,79,0.5) 0, rgba(94,86,79,0.5) 12px, transparent 12px, transparent 20px)' }} />
            </div>
          );
        }

        // ── Active step: title standalone, CoT collapsible, event log separate ──
        if (step.status === 'active') {
          return (
            <div key={i} className="space-y-2 animate-fade-in">
              {/* Title — standalone heading (no card wrapper) */}
              <div className="flex items-center gap-4 px-5">
                <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
                  <ActiveStepIcon />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-[14px] font-bold tracking-tight shimmer-text">
                      {step.label}
                    </p>
                    <span className="font-mono text-[9px] text-brand-500 animate-pulse font-black">RUNNING...</span>
                  </div>
                  <p className="text-[12px] text-surface-500 mt-0.5 font-medium">{step.detail}</p>
                </div>
                {counter && (
                  <div className="text-right flex-shrink-0">
                    <span className="font-mono text-[15px] font-bold text-brand-300">{counter.value}</span>
                    <span className="block text-[10px] text-surface-500 font-medium">{counter.label}</span>
                  </div>
                )}
              </div>

              {/* CoT box — manually toggleable card */}
              {stepThinking[i] && (
                <div className="ml-[4.5rem] mr-5 rounded-xl border border-violet-500/15 bg-violet-500/[0.04] backdrop-blur-sm overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCotCollapsedMap((prev) => ({ ...prev, [i]: !prev[i] }))}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-violet-500/5 transition-colors cursor-pointer select-none"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${thinkingStreaming ? 'bg-violet-400 animate-pulse' : 'bg-violet-400/30'}`} />
                    <span className="text-[9px] font-black text-violet-400/70 uppercase tracking-widest">
                      Modelio mąstymas
                    </span>
                    <ChevronDown className={`w-3 h-3 text-violet-400/50 ml-auto transition-transform duration-200 ${cotCollapsedMap[i] ? '-rotate-90' : ''}`} />
                  </button>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    cotCollapsedMap[i] ? 'max-h-0' : 'max-h-[200px]'
                  }`}>
                    <div
                      ref={thinkingRef}
                      className="px-3 py-2 border-t border-violet-500/10 bg-violet-500/[0.03]
                                 max-h-[150px] overflow-y-auto scrollbar-thin
                                 text-[11px] text-surface-400 font-mono leading-relaxed
                                 whitespace-pre-wrap break-words"
                    >
                      {stepThinking[i]}
                      {thinkingStreaming && <span className="inline-block w-1.5 h-3 bg-violet-400/60 animate-pulse ml-0.5" />}
                    </div>
                  </div>
                </div>
              )}

              {/* Event log — separate card below CoT */}
              {eventsForStep.length > 0 && (
                <div className="ml-[4.5rem] mr-5 py-2">
                  <div className="max-h-[200px] overflow-y-auto scrollbar-thin space-y-1" aria-live="polite" aria-label="Analizės įvykiai">
                    {eventsForStep.map((e, j) => {
                      const fmt = formatEvent(e);
                      return (
                        <div key={j} className="flex items-start gap-2.5 font-mono text-[11px] group/line py-0.5">
                          <span className="text-surface-600 shrink-0">
                            [{new Date(e.ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                          </span>
                          <span className={`shrink-0 px-1.5 py-0 rounded text-[9px] font-black ${fmt.badge}`}>
                            {fmt.label}
                          </span>
                          <span className="text-surface-300 truncate group-hover/line:text-brand-300 transition-colors">
                            {fmt.detail}
                          </span>
                        </div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          );
        }

        // ── Error step ──
        if (step.status === 'error') {
          return (
            <div
              key={i}
              className="px-5 py-3 flex items-center gap-4 animate-fade-in"
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/15 border border-red-500/25 flex-shrink-0">
                <AlertCircle className="w-[18px] h-[18px] text-red-400" />
              </div>
              <p className="text-[14px] font-bold text-red-300 tracking-tight">{step.label}</p>
              <span className="font-mono text-[10px] text-red-400 font-black ml-auto">KLAIDA</span>
            </div>
          );
        }

        // ── Pending step: dimmed ──
        return (
          <div
            key={i}
            className="px-5 py-3 flex items-center gap-4 opacity-40"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface-950/50 border border-surface-700/50 flex-shrink-0">
              <Icon className="w-[18px] h-[18px] text-surface-700" />
            </div>
            <p className="text-[14px] font-bold text-surface-600 tracking-tight">{step.label}</p>
          </div>
        );
      })}
      </div>
    </div>
  );
}
