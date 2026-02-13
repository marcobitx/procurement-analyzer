// frontend/src/components/AnalyzingView.tsx
// Real-time analysis progress view — vertical timeline with animated steps
// Listens to SSE stream and shows pipeline stages with live events
// Related: api.ts (streamProgress), App.tsx

import { useEffect, useState, useRef } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Brain,
  Layers,
  Shield,
  Clock,
  XCircle,
  Ban,
  Activity,
  Terminal,
  Cpu,
} from 'lucide-react';
import { streamProgress, type SSEEvent } from '../lib/api';
import { appStore } from '../lib/store';

interface Props {
  analysisId: string;
  error?: string | null;
  onComplete: () => void;
  onError: (err: string) => void;
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

export default function AnalyzingView({ analysisId, error, onComplete, onError }: Props) {
  const [currentStatus, setCurrentStatus] = useState('QUEUED');
  const [events, setEvents] = useState<Array<{ event: string; data: any; ts: number }>>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const startRef = useRef(Date.now());

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsedSec(elapsed);
      appStore.setState({ analysisElapsedSec: elapsed });
    }, 1000);
    return () => {
      clearInterval(timer);
      appStore.setState({ analysisElapsedSec: 0 });
    };
  }, []);

  // SSE stream
  useEffect(() => {
    const close = streamProgress(
      analysisId,
      (e: SSEEvent) => {
        setEvents((prev) => [...prev, { ...e, ts: Date.now() }]);
        if (e.event === 'status' && e.data?.status) setCurrentStatus(e.data.status);
        if (e.data?.event_type === 'status_change' && e.data?.new_status) setCurrentStatus(e.data.new_status);
      },
      () => { },
    );
    return close;
  }, [analysisId]);

  useEffect(() => {
    if (error === 'Analizė atšaukta') {
      setCurrentStatus('CANCELED');
    }
  }, [error]);

  // Sync global status
  useEffect(() => {
    appStore.setState({ analysisStatus: currentStatus });
    return () => appStore.setState({ analysisStatus: null });
  }, [currentStatus]);

  // Completion/failure
  useEffect(() => {
    if (currentStatus === 'COMPLETED') setTimeout(onComplete, 800);
    else if (currentStatus === 'FAILED') onError('Analizė nepavyko — bandykite dar kartą');
    else if (currentStatus === 'CANCELED') onError('Analizė atšaukta');
  }, [currentStatus, onComplete, onError]);

  // Build step states
  const steps: StepInfo[] = [
    { icon: FileText, label: 'Dokumentų parsavimas', detail: 'Docling konvertuoja failus', status: 'waiting' },
    { icon: Brain, label: 'Duomenų ištraukimas', detail: 'AI struktūrizuoja kiekvieną dokumentą', status: 'waiting' },
    { icon: Layers, label: 'Agregavimas', detail: 'Kryžminė dokumentų analizė', status: 'waiting' },
    { icon: Shield, label: 'Kokybės vertinimas', detail: 'Automatinis QA tikrinimas', status: 'waiting' },
  ];

  const activeIdx = getStepIndex(currentStatus);
  steps.forEach((step, i) => {
    if (i < activeIdx) step.status = 'done';
    else if (i === activeIdx && currentStatus !== 'COMPLETED') step.status = 'active';
    if (currentStatus === 'COMPLETED') step.status = 'done';
    if (currentStatus === 'FAILED' && i === activeIdx) step.status = 'error';
  });

  const isDone = currentStatus === 'COMPLETED';
  const isFailed = currentStatus === 'FAILED';
  const isCanceled = currentStatus === 'CANCELED';

  // Progress events for detail log
  const fileEvents = events.filter(
    (e) => e.data?.event_type === 'file_parsed' || e.data?.event_type === 'extraction_completed',
  );

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up pt-10">

      {/* ── Pipeline Steps — Enterprise Card ──────────────────── */}
      <div className="enterprise-card p-6 mb-8">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/[0.04]">
          <span className="text-[11px] font-bold text-surface-500 uppercase tracking-widest">Sistemos statusas</span>
          <div className="flex items-center gap-1.5 opacity-60">
            <div className="w-1 h-1 rounded-full bg-emerald-500" />
            <span className="font-mono text-[9px] text-surface-400 uppercase tracking-widest">Aktyvus ryšys</span>
          </div>
        </div>
        <div className="space-y-0 relative">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === steps.length - 1;

            return (
              <div key={i} className="flex gap-4">
                {/* Vertical timeline */}
                <div className="flex flex-col items-center">
                  {/* Node */}
                  <div
                    className={`relative w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0
                               transition-all duration-500 ${step.status === 'done'
                        ? 'bg-emerald-500/15 border border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                        : step.status === 'active'
                          ? 'bg-brand-500/15 border border-brand-500/30 shadow-glow-brand'
                          : step.status === 'error'
                            ? 'bg-red-500/15 border border-red-500/25'
                            : 'bg-surface-950/50 border border-white/[0.04]'
                      }`}
                  >
                    {step.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : step.status === 'active' ? (
                      <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                    ) : step.status === 'error' ? (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : (
                      <Icon className="w-5 h-5 text-surface-700" />
                    )}
                  </div>

                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className={`w-[2px] flex-1 my-1.5 rounded-full transition-all duration-700 ${step.status === 'done' ? 'bg-emerald-500/20 shadow-glow-emerald' : 'bg-white/[0.04]'
                        }`}
                      style={{ minHeight: '24px' }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-6 ${isLast ? 'pb-0' : ''} flex-1`}>
                  <div className="flex items-center justify-between">
                    <p
                      className={`text-[15px] font-bold tracking-tight transition-colors duration-300 ${step.status === 'done'
                        ? 'text-emerald-300'
                        : step.status === 'active'
                          ? 'text-brand-300'
                          : step.status === 'error'
                            ? 'text-red-300'
                            : 'text-surface-600'
                        }`}
                    >
                      {step.label}
                    </p>
                    {step.status === 'active' && (
                      <span className="font-mono text-[9px] text-brand-500 animate-pulse font-black">RUNNING...</span>
                    )}
                  </div>
                  <p className="text-[12px] text-surface-500 mt-0.5 font-medium">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Event Log — Terminal Output ───────────────────────── */}
      {fileEvents.length > 0 && (
        <div className="mt-8 cyber-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-brand-500/20 shadow-glow-brand animate-prism-shift" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[10px] font-black text-surface-400 uppercase tracking-[0.2em]">Live.Telemetry</span>
            </div>
            <div className="flex gap-1">
              <div className="w-1 h-1 rounded-full bg-surface-800" />
              <div className="w-1 h-1 rounded-full bg-surface-800" />
              <div className="w-1 h-1 rounded-full bg-surface-800" />
            </div>
          </div>

          <div className="space-y-2 max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-surface-800">
            {fileEvents.slice(-12).map((e, i) => (
              <div key={i} className="flex items-start gap-3 font-mono text-[11px] group/line">
                <span className="text-surface-600 shrink-0">[{new Date(e.ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                <span className="text-emerald-500/80 shrink-0">EXEC</span>
                <span className="text-surface-300 truncate group-hover/line:text-brand-300 transition-colors">
                  {e.data.event_type === 'file_parsed'
                    ? `PARSED: ${e.data.filename}`
                    : e.data.event_type === 'extraction_completed'
                      ? `EXTRACT: ${e.data.filename}`
                      : `${e.event.toUpperCase()}: IN_PROGRESS`}
                </span>
              </div>
            ))}
          </div>

          {/* Subtle Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]" />
        </div>
      )}
    </div>
  );
}
