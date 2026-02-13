// frontend/src/components/App.tsx
// Root application shell — 3-column layout with icon sidebar + main + right panel
// Entry point for the React island; mounted client-only in index.astro
// Related: store.ts, IconSidebar.tsx, RightPanel.tsx, TopBar.tsx

import { useCallback } from 'react';
import { clsx } from 'clsx';
import { Plus, Clock, Settings } from 'lucide-react';
import { appStore, useStore, type AppView } from '../lib/store';
import IconSidebar from './IconSidebar';
import RightPanel from './RightPanel';
import TopBar from './TopBar';
import UploadView from './UploadView';
import AnalyzingView from './AnalyzingView';
import ResultsView from './ResultsView';
import HistoryView from './HistoryView';
import SettingsView from './SettingsView';

/** Maps workflow sub-views to their parent nav item */
function getActiveNav(view: AppView): AppView {
  if (view === 'analyzing' || view === 'results') return 'upload';
  return view;
}

const MOBILE_NAV: { view: AppView; icon: any; label: string }[] = [
  { view: 'upload', icon: Plus, label: 'Nauja' },
  { view: 'history', icon: Clock, label: 'Istorija' },
  { view: 'settings', icon: Settings, label: 'Nustatymai' },
];

export default function App() {
  const state = useStore(appStore);

  const navigate = useCallback((view: AppView, analysisId?: string) => {
    appStore.setState({
      view,
      currentAnalysisId: analysisId ?? state.currentAnalysisId,
      error: null,
    });
  }, [state.currentAnalysisId]);

  const renderView = () => {
    switch (state.view) {
      case 'upload':
        return <UploadView />;
      case 'analyzing':
        return (
          <AnalyzingView
            analysisId={state.currentAnalysisId!}
            onComplete={() => navigate('results')}
            onError={(err) => appStore.setState({ error: err })}
          />
        );
      case 'results':
        return (
          <ResultsView
            analysisId={state.currentAnalysisId!}
            onBack={() => navigate('upload')}
          />
        );
      case 'history':
        return (
          <HistoryView
            onSelect={(id) => navigate('results', id)}
            onNew={() => navigate('upload')}
          />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return <UploadView />;
    }
  };

  const activeNav = getActiveNav(state.view);

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      {/* ── Left — Icon Sidebar (60px, desktop only) ────────── */}
      <IconSidebar currentView={state.view} onNavigate={navigate} />

      {/* ── Center — Main Content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          currentView={state.view}
          error={state.error}
          onDismissError={() => appStore.setState({ error: null })}
        />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto px-5 py-6 md:px-8 md:py-8 lg:px-10">
            {renderView()}
          </div>
        </main>
      </div>

      {/* ── Right — Tools Panel (320px, desktop only) ─────────── */}
      <RightPanel currentView={state.view} analysisId={state.currentAnalysisId} />

      {/* ── Mobile Bottom Nav (< lg only) ─────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16 bg-surface-900/95 backdrop-blur-xl border-t border-white/[0.06]">
        {MOBILE_NAV.map(({ view, icon: Icon, label }) => {
          const active = activeNav === view;
          return (
            <button
              key={view}
              onClick={() => navigate(view)}
              className={clsx(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200',
                active ? 'text-accent-400' : 'text-surface-500',
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
