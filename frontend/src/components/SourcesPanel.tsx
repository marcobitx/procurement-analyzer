// frontend/src/components/SourcesPanel.tsx
// Slide panel for viewing analysis source documents — always accessible from results
// Mirrors FilesPanel pattern: fixed overlay with backdrop, animated slide-in from right
// Related: FilesPanel.tsx, ResultsPanel.tsx, store.ts

import { useEffect, useState, useCallback } from 'react';
import { X, FileText, BookOpen } from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import { useFocusTrap } from '../lib/useFocusTrap';
import { getAnalysis, type Analysis } from '../lib/api';
import { clsx } from 'clsx';

export default function SourcesPanel() {
  const state = useStore(appStore);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    if (state.sourcesPanelOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [state.sourcesPanelOpen]);

  // Load analysis data when panel opens
  useEffect(() => {
    if (!state.sourcesPanelOpen || !state.currentAnalysisId) return;

    const cached = appStore.getState().cachedAnalysis;
    if (cached && cached.id === state.currentAnalysisId) {
      setAnalysis(cached.data);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const data = await getAnalysis(state.currentAnalysisId!);
        setAnalysis(data);
        appStore.setState({ cachedAnalysis: { id: state.currentAnalysisId!, data } });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [state.sourcesPanelOpen, state.currentAnalysisId]);

  const handleClose = useCallback(() => {
    appStore.setState({ sourcesPanelOpen: false });
  }, []);

  useEffect(() => {
    if (!state.sourcesPanelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.sourcesPanelOpen, handleClose]);

  if (!visible) return null;

  const r = analysis?.report;
  const docs = r?.source_documents || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={clsx(
          "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          animating ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        ref={trapRef}
        className={clsx(
          "relative flex gap-2 my-2 mr-2",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          animating
            ? "translate-x-0 opacity-100"
            : "translate-x-[105%] opacity-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Šaltiniai"
      >
        <div
          className={clsx(
            "w-[440px] flex flex-col shadow-2xl",
            "bg-surface-950 border border-surface-700/60",
            "rounded-[10px] overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-5 border-b border-surface-700/50 bg-surface-950/80 backdrop-blur-md flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-brand-400" />
              <h2 className="text-[14px] font-bold text-white uppercase tracking-wider">
                Šaltiniai
              </h2>
              {docs.length > 0 && (
                <span className="text-[11px] font-mono text-surface-500 ml-1">
                  ({docs.length})
                </span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-16 gap-4">
                <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-[13px] text-surface-500">Kraunama...</p>
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 gap-4 px-8">
                <div className="w-16 h-16 rounded-2xl bg-surface-800/60 border border-surface-700/50 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-surface-600" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-surface-400 mb-1">Nera saltinių</p>
                  <p className="text-[11px] text-surface-600">Šaltiniai bus rodomi kai analizė bus baigta</p>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-1">
                {docs.map((doc: any, i: number) => (
                  <div
                    key={i}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-surface-900/40 border-surface-700/40 hover:border-surface-600/60 hover:bg-surface-800/40 transition-all duration-200"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-500/8 border border-brand-500/15 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-surface-200 truncate">
                        {doc.filename}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-surface-500">
                          {doc.doc_type || 'other'}
                        </span>
                        <span className="text-[10px] text-surface-600">·</span>
                        <span className="text-[10px] font-mono text-surface-500">
                          {doc.page_count || '?'} psl.
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-surface-700/40 bg-surface-950/50 flex-shrink-0">
            <p className="text-[10px] text-surface-500 leading-relaxed italic">
              Dokumentai naudoti analizėje
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
