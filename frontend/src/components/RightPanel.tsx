// frontend/src/components/RightPanel.tsx
// Context-dependent right sidebar (320px) — orchestrates sub-panels per view
// Pure orchestrator — all panel logic lives in panels/ directory
// Related: App.tsx, panels/

import type { AppView } from '../lib/store';
import UploadPanel from './panels/UploadPanel';
import AnalyzingPanel from './panels/AnalyzingPanel';
import ResultsPanel from './panels/ResultsPanel';
import TipsPanel from './panels/TipsPanel';
import SectionModelSelector from './panels/SectionModelSelector';

interface Props {
  currentView: AppView;
  analysisId: string | null;
}

export default function RightPanel({ currentView, analysisId }: Props) {
  return (
    <aside className="hidden lg:flex flex-col w-[320px] h-full bg-transparent border-l border-surface-700/50 flex-shrink-0 overflow-y-auto scrollbar-hide">
      <div className="p-3 space-y-3">
        <div className="rounded-2xl bg-white/[0.05] border border-surface-700/60 overflow-hidden shadow-lg shadow-black/20">
          {currentView === 'upload' && <UploadPanel />}
          {currentView === 'analyzing' && <AnalyzingPanel />}
          {currentView === 'results' && analysisId && <ResultsPanel analysisId={analysisId} />}
          {(currentView === 'history' || currentView === 'settings') && <TipsPanel view={currentView} />}
        </div>

        <div className="rounded-2xl bg-white/[0.05] border border-surface-700/60 overflow-hidden shadow-lg shadow-black/20">
          <SectionModelSelector />
        </div>
      </div>
    </aside>
  );
}
