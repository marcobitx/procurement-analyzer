// frontend/src/components/panels/ResultsPanel.tsx
// Source documents, QA missing fields, QA score bar, and chat button
// Displayed in the right panel when viewing analysis results
// Related: panelHelpers.ts, ChatPanel.tsx, api.ts

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  MessageSquare,
  FileText,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { appStore, useStore } from '../../lib/store';
import { getAnalysis, type Analysis } from '../../lib/api';
import ChatPanel from '../ChatPanel';

export default function ResultsPanel({ analysisId }: { analysisId: string }) {
  const state = useStore(appStore);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    // Use cached analysis if ID matches
    const cached = appStore.getState().cachedAnalysis;
    if (cached && cached.id === analysisId) {
      setAnalysis(cached.data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await getAnalysis(analysisId);
        if (!cancelled) {
          setAnalysis(data);
          appStore.setState({ cachedAnalysis: { id: analysisId, data } });
        }
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
        <div className="px-5 h-12 flex items-center border-b border-surface-700/50">
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
      <div className="px-6 h-16 flex items-center border-b border-surface-700/50 bg-surface-950/20 backdrop-blur-md">
        <h3 className="text-[13px] font-bold text-surface-400 tracking-wider uppercase">Įrankiai</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 animate-fade-in">
        {/* Open sources panel button */}
        {r?.source_documents?.length > 0 && (
          <button
            onClick={() => appStore.setState({ sourcesPanelOpen: true })}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-800/20 border border-surface-700/30 hover:border-brand-500/30 hover:bg-brand-500/5 transition-all duration-200 group"
          >
            <BookOpen className="w-4 h-4 text-surface-500 group-hover:text-brand-400 transition-colors" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-[12px] font-semibold text-surface-300 group-hover:text-surface-200 transition-colors">
                Šaltiniai ({r.source_documents.length})
              </p>
              <p className="text-[10px] text-surface-500">Peržiūrėti dokumentus</p>
            </div>
            <span className="text-[10px] text-surface-600 group-hover:text-brand-400 transition-colors">&rsaquo;</span>
          </button>
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
          <div className="p-4 rounded-2xl bg-surface-950/40 border border-surface-700/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-surface-500 uppercase tracking-widest">Kokybės balas</span>
              <span className={`text-[15px] font-black font-mono tracking-tighter ${(qa.completeness_score ?? 0) >= 80 ? 'text-emerald-400' :
                (qa.completeness_score ?? 0) >= 50 ? 'text-accent-400' : 'text-red-400'
                }`}>
                {qa.completeness_score ?? 0}%
              </span>
            </div>
            <div
              className="w-full h-2 rounded-full bg-surface-900 overflow-hidden border border-surface-700/30"
              role="progressbar"
              aria-valuenow={qa.completeness_score ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Kokybės balas"
            >
              <div
                className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(0,0,0,0.5)] ${(qa.completeness_score ?? 0) >= 80 ? 'bg-emerald-500' :
                  (qa.completeness_score ?? 0) >= 50 ? 'bg-accent-500 shadow-glow-accent' : 'bg-red-500'
                  }`}
                style={{ width: `${Math.min(qa.completeness_score ?? 0, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Chat button */}
      <div className="p-4 border-t border-surface-700/50">
        <button
          onClick={() => setChatOpen(true)}
          className="btn-secondary-professional w-full"
        >
          <MessageSquare className="w-4 h-4" />
          AI Agentas
        </button>
      </div>

      {/* Chat overlay */}
      {chatOpen && <ChatPanel analysisId={analysisId} onClose={() => setChatOpen(false)} />}
    </>
  );
}
