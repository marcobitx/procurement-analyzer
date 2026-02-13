// frontend/src/components/HistoryView.tsx
// Analysis history — list of past analyses with status badges and actions
// Paginated card list with delete confirmation and empty state
// Related: api.ts (listAnalyses, deleteAnalysis), App.tsx

import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Clock, FileText, ChevronRight, Inbox } from 'lucide-react';
import { listAnalyses, deleteAnalysis, type AnalysisSummary } from '../lib/api';

interface Props {
  onSelect: (id: string) => void;
  onNew: () => void;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  QUEUED: { label: 'Eilėje', cls: 'badge-neutral' },
  PARSING: { label: 'Parsavimas', cls: 'badge-brand' },
  EXTRACTING: { label: 'Ištraukimas', cls: 'badge-brand' },
  AGGREGATING: { label: 'Agregavimas', cls: 'badge-brand' },
  EVALUATING: { label: 'Vertinimas', cls: 'badge-brand' },
  COMPLETED: { label: 'Pabaigta', cls: 'badge-success' },
  FAILED: { label: 'Klaida', cls: 'badge-error' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ką tik';
  if (min < 60) return `prieš ${min} min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `prieš ${h} val.`;
  const d = Math.floor(h / 24);
  if (d < 30) return `prieš ${d} d.`;
  return new Date(iso).toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' });
}

export default function HistoryView({ onSelect, onNew }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setAnalyses(await listAnalyses());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tikrai ištrinti šią analizę?')) return;
    setDeleting(id);
    try {
      await deleteAnalysis(id);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Analizių istorija
          </h1>
          <p className="text-[12px] text-surface-500 mt-1.5 font-bold uppercase tracking-widest">
            {loading ? '...' : `${analyses.length} analizių`}
          </p>
        </div>
        <button onClick={onNew} className="btn-primary flex items-center gap-2 group">
          <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
          Nauja
        </button>
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────── */}
      {!loading && analyses.length === 0 && (
        <div className="text-center py-24 animate-fade-in enterprise-card">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-brand-500/5 flex items-center justify-center border border-brand-500/10">
            <Inbox className="w-8 h-8 text-brand-400" />
          </div>
          <p className="text-xl font-bold text-white mb-2 tracking-tight">Analizių istorija tuščia</p>
          <p className="text-[14px] text-surface-500 mb-8 max-w-xs mx-auto">Pradėkite naują analizę įkeldami dokumentus pagrindiniame lange.</p>
          <button onClick={onNew} className="btn-professional">
            Pradėti naują analizę
          </button>
        </div>
      )}

      {/* ── List ──────────────────────────────────────────────── */}
      {!loading && analyses.length > 0 && (
        <div className="space-y-2">
          {analyses.map((a, i) => {
            const status = STATUS_META[a.status] || STATUS_META.QUEUED;
            const clickable = a.status === 'COMPLETED';

            return (
              <button
                key={a.id}
                onClick={() => clickable && onSelect(a.id)}
                disabled={!clickable}
                className={`enterprise-card enterprise-card-hover w-full flex items-center gap-4 px-5 py-4 text-left group
                           animate-stagger ${!clickable ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center flex-shrink-0
                               border border-white/[0.04] group-hover:border-brand-500/30 transition-all duration-300">
                  <FileText className="w-5 h-5 text-surface-400 group-hover:text-brand-400 transition-colors" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className="text-[14px] font-bold text-surface-50 truncate tracking-tight transition-colors group-hover:text-brand-300">
                      Analizė · {a.file_count} {a.file_count === 1 ? 'failas' : 'failai'}
                    </p>
                    <span className={status.cls}>{status.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-surface-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {timeAgo(a.created_at)}
                    </span>
                    {a.model && (
                      <span className="font-mono text-[10px] bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.05]">
                        {a.model.split('/').pop()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleDelete(a.id, e)}
                    disabled={deleting === a.id}
                    className="p-2 rounded-xl text-surface-600 hover:text-red-400 hover:bg-red-500/8
                             opacity-0 group-hover:opacity-100 transition-all duration-200"
                  >
                    {deleting === a.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                  {clickable && (
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
