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
  Check,
  Loader2,
} from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import Tooltip from './Tooltip';
import { FileTypeLogo } from './FileTypeLogos';

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

/** Extraction document status for the checklist */
type ExtractionDocStatus = 'pending' | 'active' | 'done';

interface ExtractionDoc {
  filename: string;
  pages: number;
  status: ExtractionDocStatus;
  startTime?: number;
  endTime?: number;
}

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

  // Event log collapsed map — collapsed for done steps, open for active
  const [logCollapsedMap, setLogCollapsedMap] = useState<Record<number, boolean>>(
    snapshot ? { 0: true, 1: true, 2: true, 3: true } : {},
  );

  const logEndRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

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

  // Auto-collapse event log when step transitions to done
  const prevActiveIdxRef = useRef(0);
  useEffect(() => {
    if (reviewMode) return;
    const newIdx = getStepIndex(currentStatus);
    if (newIdx > prevActiveIdxRef.current) {
      // Previous step just completed — collapse its event log
      setLogCollapsedMap((prev) => ({ ...prev, [prevActiveIdxRef.current]: true }));
    }
    prevActiveIdxRef.current = newIdx;
  }, [currentStatus, reviewMode]);

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

  // Top & bottom fade on page scroll
  useEffect(() => {
    let scrollParent = fadeRef.current?.parentElement;
    while (scrollParent) {
      const ov = getComputedStyle(scrollParent).overflowY;
      if (ov === 'auto' || ov === 'scroll') break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent) return;
    const sp = scrollParent;
    const update = () => {
      setShowTopFade(sp.scrollTop > 30);
      setShowBottomFade(sp.scrollHeight - sp.scrollTop - sp.clientHeight > 30);
    };
    update();
    sp.addEventListener('scroll', update, { passive: true });
    return () => sp.removeEventListener('scroll', update);
  }, []);

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

  // Extraction checklist — derive per-document status from events
  const extractionDocs: ExtractionDoc[] = useMemo(() => {
    const started = new Map<string, number>();
    const completed = new Map<string, number>();
    for (const e of events) {
      const type = e.data?.event_type;
      const fname = e.data?.filename;
      if (!fname) continue;
      if (type === 'extraction_started' && !started.has(fname)) started.set(fname, e.ts);
      if (type === 'extraction_completed' && !completed.has(fname)) completed.set(fname, e.ts);
    }
    return state.parsedDocs.map((d) => ({
      filename: d.filename,
      pages: d.pages,
      status: completed.has(d.filename)
        ? 'done' as const
        : started.has(d.filename)
          ? 'active' as const
          : 'pending' as const,
      startTime: started.get(d.filename),
      endTime: completed.get(d.filename),
    }));
  }, [events, state.parsedDocs]);

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

  /** Color scheme per step for the collapsible event log card — border only, no bg */
  const LOG_COLORS = [
    { border: 'border-emerald-500/15', dot: 'bg-emerald-400/30', dotActive: 'bg-emerald-400 animate-pulse', text: 'text-emerald-400/50', textActive: 'text-emerald-400/70', hoverBg: 'hover:bg-emerald-500/5', borderInner: 'border-emerald-500/10', chevron: 'text-emerald-400/40', chevronActive: 'text-emerald-400/50' },
    { border: 'border-amber-500/15', dot: 'bg-amber-400/30', dotActive: 'bg-amber-400 animate-pulse', text: 'text-amber-400/50', textActive: 'text-amber-400/70', hoverBg: 'hover:bg-amber-500/5', borderInner: 'border-amber-500/10', chevron: 'text-amber-400/40', chevronActive: 'text-amber-400/50' },
    { border: 'border-orange-500/15', dot: 'bg-orange-400/30', dotActive: 'bg-orange-400 animate-pulse', text: 'text-orange-400/50', textActive: 'text-orange-400/70', hoverBg: 'hover:bg-orange-500/5', borderInner: 'border-orange-500/10', chevron: 'text-orange-400/40', chevronActive: 'text-orange-400/50' },
    { border: 'border-violet-500/15', dot: 'bg-violet-400/30', dotActive: 'bg-violet-400 animate-pulse', text: 'text-violet-400/50', textActive: 'text-violet-400/70', hoverBg: 'hover:bg-violet-500/5', borderInner: 'border-violet-500/10', chevron: 'text-violet-400/40', chevronActive: 'text-violet-400/50' },
  ];

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
      {/* Sticky top fade — content dissolves when scrolled up */}
      <div
        ref={fadeRef}
        className={`sticky top-0 h-20 -mb-20 z-20 pointer-events-none transition-opacity duration-300 ${showTopFade ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(to bottom, #342a24 0%, transparent 100%)' }}
        aria-hidden="true"
      />
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
            <Tooltip content="Atidaryti sugeneruotą ataskaitą" side="bottom">
              <button
                onClick={onViewReport}
                className="btn-secondary-professional"
              >
                Peržiūrėti ataskaitą
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      )}
      <div className="rounded-2xl bg-surface-800/55 border border-surface-600/30 overflow-hidden py-2 space-y-3">
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
                <div className="ml-[4.5rem] mr-5 mb-1 rounded-xl border border-surface-500/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCotCollapsedMap((prev) => ({ ...prev, [i]: prev[i] === false ? true : false }))}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400/30" />
                    <span className="text-[9px] font-black text-surface-500 uppercase tracking-widest">
                      Galvoju
                    </span>
                    <ChevronDown className={`w-3 h-3 text-surface-500 ml-auto transition-transform duration-200 ${isCotOpen ? '' : '-rotate-90'}`} />
                  </button>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isCotOpen ? 'max-h-[200px]' : 'max-h-0'
                  }`}>
                    <div
                      className="px-3 py-2 border-t border-surface-500/50
                                 max-h-[150px] overflow-y-auto scrollbar-thin
                                 text-[11px] text-surface-400 font-mono leading-relaxed
                                 whitespace-pre-wrap break-words"
                    >
                      {stepThinking[i]}
                    </div>
                  </div>
                </div>
              )}
              {/* Extraction step (i===1): collapsible document checklist */}
              {/* Other steps: collapsible event log */}
              {i === 1 && extractionDocs.length > 0 ? (() => {
                const isLogOpen = logCollapsedMap[i] === false;
                return (
                  <div className="ml-[4.5rem] mr-5 mb-1 rounded-xl border border-surface-500/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLogCollapsedMap((prev) => ({ ...prev, [i]: isLogOpen }))}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/30" />
                      <span className="text-[9px] font-black text-surface-500 uppercase tracking-widest">
                        Dokumentai
                      </span>
                      <span className="text-[9px] font-mono text-surface-500 ml-1">
                        ({extractionDocs.length})
                      </span>
                      <ChevronDown className={`w-3 h-3 text-surface-500 ml-auto transition-transform duration-200 ${isLogOpen ? '' : '-rotate-90'}`} />
                    </button>
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isLogOpen ? 'max-h-[280px]' : 'max-h-0'
                    }`}>
                      <div className="px-3 py-2 border-t border-surface-500/50 max-h-[230px] overflow-y-auto scrollbar-thin space-y-1">
                        {extractionDocs.map((doc) => {
                          const ext = doc.filename.split('.').pop() || '';
                          const durationMs = doc.startTime && doc.endTime ? doc.endTime - doc.startTime : null;
                          return (
                            <div key={doc.filename} className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
                              <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                                <Check className="w-2.5 h-2.5 text-emerald-400" strokeWidth={3} />
                              </div>
                              <FileTypeLogo extension={ext} size={12} />
                              <span className="text-[11px] font-medium text-emerald-300/80 truncate flex-1 min-w-0">
                                {doc.filename}
                              </span>
                              {doc.pages > 0 && (
                                <span className="text-[9px] font-mono text-surface-500 flex-shrink-0">{doc.pages} psl.</span>
                              )}
                              {durationMs && (
                                <span className="text-[9px] font-mono font-bold text-emerald-400/60 flex-shrink-0">
                                  {formatTime(Math.round(durationMs / 1000))}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })() : eventsForStep.length > 0 && i !== 1 ? (() => {
                const c = LOG_COLORS[i];
                const isLogOpen = logCollapsedMap[i] === false;
                return (
                  <div className="ml-[4.5rem] mr-5 mb-1 rounded-xl border border-surface-500/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLogCollapsedMap((prev) => ({ ...prev, [i]: isLogOpen }))}
                      className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      <span className="text-[9px] font-black text-surface-500 uppercase tracking-widest">
                        Įvykių žurnalas
                      </span>
                      <span className="text-[9px] font-mono text-surface-500 ml-1">
                        ({eventsForStep.length})
                      </span>
                      <ChevronDown className="w-3 h-3 text-surface-500 ml-auto transition-transform duration-200" style={{ transform: isLogOpen ? 'none' : 'rotate(-90deg)' }} />
                    </button>
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isLogOpen ? 'max-h-[250px]' : 'max-h-0'
                    }`}>
                      <div className="px-3 py-2 border-t border-surface-500/50 max-h-[200px] overflow-y-auto scrollbar-thin space-y-1">
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
                      </div>
                    </div>
                  </div>
                );
              })() : null}
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
                <div className="ml-[4.5rem] mr-5 rounded-xl border border-surface-500/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCotCollapsedMap((prev) => ({ ...prev, [i]: !prev[i] }))}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${thinkingStreaming ? 'bg-violet-400 animate-pulse' : 'bg-violet-400/30'}`} />
                    <span className="text-[9px] font-black text-surface-500 uppercase tracking-widest">
                      Galvoju
                    </span>
                    <ChevronDown className={`w-3 h-3 text-surface-500 ml-auto transition-transform duration-200 ${cotCollapsedMap[i] ? '-rotate-90' : ''}`} />
                  </button>
                  <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    cotCollapsedMap[i] ? 'max-h-0' : 'max-h-[200px]'
                  }`}>
                    <div
                      ref={thinkingRef}
                      className="px-3 py-2 border-t border-surface-500/50
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

              {/* Extraction step (i===1): document checklist instead of event log */}
              {/* Other steps: standard event log */}
              {i === 1 && extractionDocs.length > 0 ? (
                <div className="ml-[4.5rem] mr-5 rounded-xl border border-surface-500/50 overflow-hidden">
                  <div className="px-3 py-2 max-h-[280px] overflow-y-auto scrollbar-thin space-y-1" aria-live="polite" aria-label="Dokumentų ištraukimo progresas">
                    {extractionDocs.map((doc) => {
                      const ext = doc.filename.split('.').pop() || '';
                      const durationMs = doc.startTime && doc.endTime ? doc.endTime - doc.startTime : null;
                      return (
                        <div
                          key={doc.filename}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                            doc.status === 'pending' ? 'opacity-40' : ''
                          }`}
                        >
                          {/* Status indicator */}
                          {doc.status === 'done' ? (
                            <div className="w-5 h-5 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3 text-emerald-400" strokeWidth={3} />
                            </div>
                          ) : doc.status === 'active' ? (
                            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-md border border-surface-600/40 flex items-center justify-center flex-shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-surface-600/30" />
                            </div>
                          )}
                          {/* File icon */}
                          <FileTypeLogo extension={ext} size={14} />
                          {/* Filename */}
                          <span className={`text-[12px] font-medium truncate flex-1 min-w-0 ${
                            doc.status === 'done' ? 'text-emerald-300/90' : doc.status === 'active' ? 'text-amber-200' : 'text-surface-500'
                          }`}>
                            {doc.filename}
                          </span>
                          {/* Pages */}
                          {doc.pages > 0 && (
                            <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                              {doc.pages} psl.
                            </span>
                          )}
                          {/* Duration for completed */}
                          {durationMs && (
                            <span className="text-[10px] font-mono font-bold text-emerald-400/70 flex-shrink-0">
                              {formatTime(Math.round(durationMs / 1000))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    <div ref={logEndRef} />
                  </div>
                </div>
              ) : eventsForStep.length > 0 && i !== 1 ? (() => {
                const c = LOG_COLORS[i];
                const isLogOpen = logCollapsedMap[i] !== true; // open by default for active step
                return (
                  <div className="ml-[4.5rem] mr-5 rounded-xl border border-surface-500/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLogCollapsedMap((prev) => ({ ...prev, [i]: isLogOpen }))}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${c.dotActive}`} />
                      <span className="text-[9px] font-black text-surface-500 uppercase tracking-widest">
                        Įvykių žurnalas
                      </span>
                      <span className="text-[9px] font-mono text-surface-500 ml-1">
                        ({eventsForStep.length})
                      </span>
                      <ChevronDown className={`w-3 h-3 text-surface-500 ml-auto transition-transform duration-200 ${isLogOpen ? '' : '-rotate-90'}`} />
                    </button>
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isLogOpen ? 'max-h-[250px]' : 'max-h-0'
                    }`}>
                      <div className="px-3 py-2 border-t border-surface-500/50 max-h-[200px] overflow-y-auto scrollbar-thin space-y-1" aria-live="polite" aria-label="Analizės įvykiai">
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
                  </div>
                );
              })() : null}
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
      {/* Sticky bottom fade — content dissolves at the bottom */}
      <div
        className={`sticky bottom-0 h-20 -mt-20 z-20 pointer-events-none transition-opacity duration-300 ${showBottomFade ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(to top, #342a24 0%, transparent 100%)' }}
        aria-hidden="true"
      />
    </div>
  );
}
