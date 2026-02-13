// frontend/src/components/RightPanel.tsx
// Context-dependent right sidebar (320px) — shows different content per view
// Upload: file drop zone + file list + submit
// Analyzing: uploaded docs list + elapsed timer
// Results: source docs + QA missing fields + "Klausti AI" chat button
// History/Settings: tips
// Related: App.tsx, store.ts, api.ts, ChatPanel.tsx

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  X,
  Zap,
  Loader2,
  FileText,
  Archive,
  Image,
  Table2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { appStore, useStore, type AppView } from '../lib/store';
import { createAnalysis, getAnalysis, type Analysis } from '../lib/api';
import ChatPanel from './ChatPanel';

/* ── Shared helpers ──────────────────────────────────────────────────────── */

const ACCEPTED = '.pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.zip';
const MAX_SIZE_MB = 50;

const FILE_ICONS: Record<string, { icon: any; color: string }> = {
  pdf: { icon: FileText, color: 'text-red-400' },
  docx: { icon: FileText, color: 'text-blue-400' },
  xlsx: { icon: Table2, color: 'text-emerald-400' },
  pptx: { icon: FileText, color: 'text-orange-400' },
  zip: { icon: Archive, color: 'text-amber-400' },
  png: { icon: Image, color: 'text-violet-400' },
  jpg: { icon: Image, color: 'text-violet-400' },
  jpeg: { icon: Image, color: 'text-violet-400' },
};

function getFileInfo(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || { icon: FileText, color: 'text-surface-400' };
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

/* ── Main RightPanel ─────────────────────────────────────────────────────── */

interface Props {
  currentView: AppView;
  analysisId: string | null;
}

export default function RightPanel({ currentView, analysisId }: Props) {
  return (
    <aside className="hidden lg:flex flex-col w-[320px] h-full bg-surface-900/40 backdrop-blur-sm border-l border-white/[0.04] flex-shrink-0">
      {currentView === 'upload' && <UploadPanel />}
      {currentView === 'analyzing' && <AnalyzingPanel />}
      {currentView === 'results' && analysisId && <ResultsPanel analysisId={analysisId} />}
      {(currentView === 'history' || currentView === 'settings') && <TipsPanel view={currentView} />}
    </aside>
  );
}

/* ── Upload Panel ────────────────────────────────────────────────────────── */

function UploadPanel() {
  const state = useStore(appStore);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${f.name} per didelis (maks. ${MAX_SIZE_MB}MB)`);
        return false;
      }
      return true;
    });
    const currentFiles = appStore.getState().files;
    const names = new Set(currentFiles.map((f) => f.name));
    const uniqueNew = valid.filter((f) => !names.has(f.name));
    if (uniqueNew.length) {
      appStore.setState({ files: [...currentFiles, ...uniqueNew] });
      setError(null);
    }
  }, []);

  const removeFile = (name: string) => {
    appStore.setState({ files: appStore.getState().files.filter((f) => f.name !== name) });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleSubmit = async () => {
    const files = appStore.getState().files;
    if (!files.length || appStore.getState().uploading) return;
    appStore.setState({ uploading: true });
    setError(null);
    try {
      const result = await createAnalysis(files);
      appStore.setState({
        view: 'analyzing',
        currentAnalysisId: result.id,
        uploading: false,
        error: null,
      });
    } catch (e: any) {
      setError(e.message || 'Nepavyko įkelti failų');
      appStore.setState({ uploading: false });
    }
  };

  return (
    <>
      {/* Header */}
      <div className="px-5 h-12 flex items-center border-b border-white/[0.04]">
        <h3 className="text-[13px] font-bold text-surface-200 tracking-tight">Dokumentai</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed cursor-pointer p-6 text-center transition-all duration-200 ${
            dragOver
              ? 'border-accent-400/40 bg-accent-500/5'
              : 'border-white/[0.06] hover:border-white/[0.12] hover:bg-surface-800/20'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="hidden"
          />
          <Upload className={`w-5 h-5 mx-auto mb-2 transition-colors ${dragOver ? 'text-accent-400' : 'text-surface-500'}`} />
          <p className="text-[12px] text-surface-400 font-medium">
            {dragOver ? 'Paleiskite čia' : 'Nutempkite arba paspauskite'}
          </p>
          <p className="text-[10px] text-surface-600 mt-1">
            PDF, DOCX, XLSX, PNG, ZIP · Maks. {MAX_SIZE_MB}MB
          </p>
        </div>

        {/* File list */}
        {state.files.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[12px] font-semibold text-surface-400">
                {state.files.length} {state.files.length === 1 ? 'failas' : state.files.length < 10 ? 'failai' : 'failų'}
              </span>
              <button
                onClick={() => appStore.setState({ files: [] })}
                className="text-[11px] text-surface-600 hover:text-surface-300 font-medium transition-colors"
              >
                Išvalyti
              </button>
            </div>

            <div className="space-y-1">
              {state.files.map((f, i) => {
                const info = getFileInfo(f.name);
                const FileIcon = info.icon;
                return (
                  <div
                    key={f.name}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-800/30 border border-white/[0.04]
                               hover:bg-surface-800/50 transition-colors duration-200 animate-stagger"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <FileIcon className={`w-3.5 h-3.5 flex-shrink-0 ${info.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-surface-200 font-medium truncate">{f.name}</p>
                      <p className="text-[10px] text-surface-600 font-mono">{formatSize(f.size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                      className="p-1 rounded-md text-surface-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/15 text-[12px] text-red-300 animate-fade-in">
            {error}
          </div>
        )}
      </div>

      {/* Submit */}
      {state.files.length > 0 && (
        <div className="p-4 border-t border-white/[0.04] animate-fade-in">
          <button
            onClick={handleSubmit}
            disabled={state.uploading}
            className="btn-primary w-full flex items-center justify-center gap-2.5 py-2.5 text-[13px]"
          >
            {state.uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Įkeliama...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Pradėti analizę</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

/* ── Analyzing Panel ─────────────────────────────────────────────────────── */

function AnalyzingPanel() {
  const state = useStore(appStore);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <div className="px-5 h-12 flex items-center border-b border-white/[0.04]">
        <h3 className="text-[13px] font-bold text-surface-200 tracking-tight">Analizė</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-fade-in">
        {/* Elapsed timer */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-brand-500/6 border border-brand-500/10">
          <Clock className="w-4 h-4 text-brand-400" />
          <div>
            <p className="text-[10px] text-surface-500 font-semibold uppercase tracking-wider">Laikas</p>
            <span className="text-[14px] font-mono font-semibold text-brand-300">{formatTime(elapsed)}</span>
          </div>
        </div>

        {/* Uploaded files */}
        {state.files.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-2.5">
              Įkelti dokumentai ({state.files.length})
            </h4>
            <div className="space-y-1.5">
              {state.files.map((f) => {
                const info = getFileInfo(f.name);
                const FileIcon = info.icon;
                return (
                  <div key={f.name} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-surface-800/20 border border-white/[0.03]">
                    <FileIcon className={`w-3.5 h-3.5 flex-shrink-0 ${info.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-surface-300 font-medium truncate">{f.name}</p>
                      <p className="text-[10px] text-surface-600 font-mono">{formatSize(f.size)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI indicator */}
        <div className="px-3.5 py-3 rounded-xl bg-surface-800/20 border border-white/[0.03]">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-[11px] font-semibold text-brand-300 tracking-tight">AI analizė vykdoma</span>
          </div>
          <p className="text-[10px] text-surface-500 leading-relaxed">
            Claude Sonnet 4 apdoroja jūsų dokumentus ir generuoja struktūrizuotą ataskaitą.
          </p>
        </div>
      </div>
    </>
  );
}

/* ── Results Panel ───────────────────────────────────────────────────────── */

function ResultsPanel({ analysisId }: { analysisId: string }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAnalysis(analysisId);
        if (!cancelled) setAnalysis(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [analysisId]);

  if (loading) {
    return (
      <>
        <div className="px-5 h-12 flex items-center border-b border-white/[0.04]">
          <h3 className="text-[13px] font-bold text-surface-200 tracking-tight">Įrankiai</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
        </div>
      </>
    );
  }

  const r = analysis?.report;
  const qa = analysis?.qa;

  return (
    <>
      <div className="px-5 h-12 flex items-center border-b border-white/[0.04]">
        <h3 className="text-[13px] font-bold text-surface-200 tracking-tight">Įrankiai</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 animate-fade-in">
        {/* Source documents */}
        {r?.source_documents?.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-2.5">
              Šaltiniai ({r.source_documents.length})
            </h4>
            <div className="space-y-2">
              {r.source_documents.map((doc: any, i: number) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-surface-800/20 border border-white/[0.03]">
                  <FileText className="w-3.5 h-3.5 text-surface-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-surface-300 leading-tight truncate">{doc.filename}</p>
                    <p className="text-[10px] text-surface-500">{doc.doc_type || 'other'} · {doc.page_count || '?'} psl.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QA Missing fields */}
        {qa?.missing_fields?.length > 0 && (
          <div>
            <h4 className="text-[11px] font-bold text-surface-500 uppercase tracking-wider mb-2.5">
              Trūkstami laukai
            </h4>
            <div className="space-y-1.5">
              {qa.missing_fields.map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-[12px] text-amber-400/90">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{f}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* QA Score mini */}
        {qa && (
          <div className="px-3.5 py-3 rounded-xl bg-surface-800/20 border border-white/[0.03]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-wider">Kokybės balas</span>
              <span className={`text-[14px] font-bold font-mono ${
                (qa.completeness_score ?? 0) >= 80 ? 'text-emerald-400' :
                (qa.completeness_score ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {qa.completeness_score ?? 0}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-surface-700/40 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  (qa.completeness_score ?? 0) >= 80 ? 'bg-emerald-500' :
                  (qa.completeness_score ?? 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(qa.completeness_score ?? 0, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Chat button */}
      <div className="p-4 border-t border-white/[0.04]">
        <button
          onClick={() => setChatOpen(true)}
          className="btn-secondary w-full flex items-center justify-center gap-2.5 py-2.5 text-[13px]"
        >
          <MessageSquare className="w-4 h-4" />
          Klausti AI
        </button>
      </div>

      {/* Chat overlay */}
      {chatOpen && <ChatPanel analysisId={analysisId} onClose={() => setChatOpen(false)} />}
    </>
  );
}

/* ── Tips Panel ──────────────────────────────────────────────────────────── */

function TipsPanel({ view }: { view: AppView }) {
  const tips = view === 'history'
    ? [
        'Pasirinkite užbaigtą analizę norėdami peržiūrėti ataskaitą',
        'Galite ištrinti nebereikalingas analizes',
        'Kiekviena analizė saugoma su pilna ataskaita ir dokumentais',
      ]
    : [
        'Nustatykite OpenRouter API raktą prieš pradedant',
        'Rekomenduojamas modelis: Claude Sonnet 4',
        'API raktas saugomas tik jūsų serveryje',
      ];

  return (
    <>
      <div className="px-5 h-12 flex items-center border-b border-white/[0.04]">
        <h3 className="text-[13px] font-bold text-surface-200 tracking-tight">Patarimai</h3>
      </div>

      <div className="flex-1 p-4 space-y-3 animate-fade-in">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-surface-800/15 border border-white/[0.03] animate-stagger"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Lightbulb className="w-3.5 h-3.5 text-accent-400/60 mt-0.5 flex-shrink-0" />
            <span className="text-[12px] text-surface-400 leading-relaxed">{tip}</span>
          </div>
        ))}
      </div>
    </>
  );
}
