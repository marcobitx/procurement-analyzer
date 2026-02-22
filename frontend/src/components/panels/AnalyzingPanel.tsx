// frontend/src/components/panels/AnalyzingPanel.tsx
// Timer display + collapsible document list during analysis
// Uses store timer (analysisElapsedSec) instead of independent timer to avoid drift
// Related: panelHelpers.ts, store.ts, AnalyzingView.tsx

import {
  Clock,
  Cpu,
  Files,
  BookOpen,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import { appStore, useStore } from '../../lib/store';
import { formatTime } from './panelHelpers';

export default function AnalyzingPanel() {
  const state = useStore(appStore);

  // Show parsed doc count (extracted from ZIP) when available, otherwise original file count
  const totalFiles = state.parsedDocs.length > 0 ? state.parsedDocs.length : state.files.length;
  const totalPages = state.parsedDocs.reduce((sum, d) => sum + d.pages, 0);

  return (
    <>
      <div className="px-6 h-14 flex items-center border-b border-surface-700/20">
        <h3 className="text-[13px] font-bold text-surface-400 tracking-wider uppercase">Analizė</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 animate-fade-in">
        {/* Elapsed timer — reads from store (single source of truth) */}
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-brand-500/5 border border-brand-500/10">
          <Clock className="w-4 h-4 text-brand-400" />
          <div>
            <p className="text-[9px] text-surface-500 font-bold uppercase tracking-widest">Analizės laikas</p>
            <span className="text-[14px] font-mono font-bold text-white leading-none">
              {formatTime(state.analysisElapsedSec)}
            </span>
          </div>
        </div>

        {/* Document summary card — opens FilesPanel on click */}
        {totalFiles > 0 && (
          <button
            onClick={() => appStore.setState({ filesPanelOpen: true })}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-950/40 border border-surface-700/30 hover:border-surface-600/50 hover:bg-white/[0.03] transition-all group"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[11px] font-bold text-surface-400 uppercase tracking-widest">
                Dokumentai
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Files className="w-3 h-3 text-brand-400" />
                <span className="text-[11px] font-mono font-bold text-brand-300">
                  {totalFiles}
                </span>
              </div>
              {totalPages > 0 && (
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-accent-400" />
                  <span className="text-[11px] font-mono font-bold text-accent-300">
                    {totalPages} psl.
                  </span>
                </div>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
            </div>
          </button>
        )}

        {/* AI indicator */}
        <div className="px-3.5 py-3 rounded-xl bg-surface-800/40 border border-surface-700/30">
          <div className="flex items-center gap-2 mb-1.5">
            <Cpu className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-[11px] font-bold text-brand-300 uppercase tracking-widest">Vykdymas</span>
          </div>
          <p className="text-[10px] text-surface-500 leading-relaxed">
            Claude Sonnet 4 apdoroja jūsų dokumentus ir generuoja struktūrizuotą ataskaitą.
          </p>
        </div>
      </div>
    </>
  );
}
