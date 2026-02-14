// frontend/src/components/panels/AnalyzingPanel.tsx
// Timer display + collapsible document list during analysis
// Uses store timer (analysisElapsedSec) instead of independent timer to avoid drift
// Related: panelHelpers.ts, store.ts, AnalyzingView.tsx

import { useMemo, useState } from 'react';
import {
  Clock,
  Cpu,
  Loader2,
  ChevronRight,
  ChevronDown,
  Files,
  BookOpen,
  FolderOpen,
} from 'lucide-react';
import { appStore, useStore } from '../../lib/store';
import { formatSize, formatTime } from './panelHelpers';
import { FileTypeLogo } from '../FileTypeLogos';

export default function AnalyzingPanel() {
  const state = useStore(appStore);
  const [docsExpanded, setDocsExpanded] = useState(true);

  const totalFiles = state.files.length;
  const parsedCount = state.parsedDocs.length;
  const totalPages = state.parsedDocs.reduce((sum, d) => sum + d.pages, 0);

  const parsedMap = useMemo(
    () => new Map(state.parsedDocs.map((d) => [d.filename, d])),
    [state.parsedDocs],
  );

  return (
    <>
      <div className="px-6 h-16 flex items-center border-b border-surface-700/50 bg-surface-950/20 backdrop-blur-md">
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

        {/* Document section — collapsible with file/page summary */}
        {totalFiles > 0 && (
          <div className="rounded-xl bg-surface-950/40 border border-surface-700/50 overflow-hidden">
            <button
              onClick={() => setDocsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2">
                {docsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-surface-500 transition-transform" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-surface-500 transition-transform" />
                )}
                <FolderOpen className="w-3.5 h-3.5 text-brand-400" />
                <h4 className="text-[11px] font-bold text-surface-400 uppercase tracking-widest">
                  Dokumentai
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Files className="w-3 h-3 text-brand-400" />
                  <span className="text-[11px] font-mono font-bold text-brand-300">
                    {parsedCount}/{totalFiles}
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
              </div>
            </button>

            {docsExpanded && (
              <div className="px-3 pb-3 space-y-1.5 animate-fade-in">
                {state.files.map((f) => {
                  const ext = f.name.split('.').pop() || '';
                  const parsed = parsedMap.get(f.name);
                  const isParsed = !!parsed;

                  return (
                    <div
                      key={f.name}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300 ${
                        isParsed
                          ? 'bg-emerald-500/[0.04] border-emerald-500/10'
                          : 'bg-surface-950/40 border-surface-700/50'
                      }`}
                    >
                      <FileTypeLogo extension={ext} size={16} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-surface-200 font-semibold truncate leading-tight">{f.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-surface-600 font-mono uppercase tracking-tighter">
                            {formatSize(f.size)}
                          </span>
                          {isParsed && parsed.pages > 0 && (
                            <>
                              <span className="text-[10px] text-surface-700">·</span>
                              <span className="text-[10px] font-mono font-bold text-emerald-400/80">
                                {parsed.pages} psl.
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {isParsed ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        </div>
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 text-surface-600 animate-spin flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* AI indicator */}
        <div className="px-3.5 py-3 rounded-xl bg-surface-800/40 border border-surface-700/50">
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
