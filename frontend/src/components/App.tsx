// frontend/src/components/App.tsx
// Root application shell — 3-column layout with icon sidebar + main + right panel
// Entry point for the React island; mounted client-only in index.astro
// Related: store.ts, IconSidebar.tsx, RightPanel.tsx, TopBar.tsx

import { useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { Plus, Clock, Settings } from 'lucide-react';
import { appStore, useStore, type AppView } from '../lib/store';
import { cancelAnalysis } from '../lib/api';
import IconSidebar from './IconSidebar';
import RightPanel from './RightPanel';
import TopBar from './TopBar';
import UploadView from './UploadView';
import AnalyzingView from './AnalyzingView';
import ResultsView from './ResultsView';
import HistoryView from './HistoryView';
import SettingsView from './SettingsView';
import ModelPanel from './ModelPanel';
import { getModels } from '../lib/api';

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

  const handleCancel = useCallback(async () => {
    if (!state.currentAnalysisId) return;
    try {
      await cancelAnalysis(state.currentAnalysisId);
      appStore.setState({ error: 'Analizė atšaukta' });
    } catch (err) {
      console.error('Failed to cancel analysis:', err);
      // Optional: set error to something else if cancellation fails
    }
  }, [state.currentAnalysisId]);

  const renderView = () => {
    switch (state.view) {
      case 'upload':
        return <UploadView />;
      case 'analyzing':
        return (
          <AnalyzingView
            analysisId={state.currentAnalysisId!}
            error={state.error}
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

  const initModels = useCallback(async () => {
    try {
      const models = await getModels();
      if (models.length > 0 && !state.selectedModel) {
        appStore.setState({ selectedModel: models[0] });
      }
    } catch (err) {
      console.error('Failed to init models:', err);
    }
  }, [state.selectedModel]);

  // Handle initialization
  useEffect(() => {
    initModels();
  }, []);

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      {/* ── Overlays ─────────────────────────────────────────── */}
      <ModelPanel />

      {/* ── Left — Icon Sidebar (60px, desktop only) ────────── */}
      <IconSidebar currentView={state.view} onNavigate={navigate} />

      {/* ── Center — Main Content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-transparent">
        <TopBar
          currentView={state.view}
          error={state.error}
          onDismissError={() => appStore.setState({ error: null })}
          onCancel={handleCancel}
        />

        <div className="flex-1 flex overflow-hidden min-h-0">
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-0 scrollbar-hide">
            <div className="mx-auto px-6 py-8 md:px-10 md:py-10 lg:px-12 animate-fade-in">
              {renderView()}
            </div>
          </main>

          {/* ── Right — Tools Panel (320px, desktop only) ─────────── */}
          <RightPanel currentView={state.view} analysisId={state.currentAnalysisId} />
        </div>
      </div>

      {/* ── Mobile Bottom Nav (< lg only) ─────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-20 bg-surface-950/80 backdrop-blur-2xl border-t border-white/[0.05] px-4 pb-4">
        {MOBILE_NAV.map(({ view, icon: Icon, label }) => {
          const active = activeNav === view;
          return (
            <button
              key={view}
              onClick={() => navigate(view)}
              className={clsx(
                'flex flex-col items-center gap-1.5 px-6 py-2 rounded-xl transition-all duration-200',
                active
                  ? 'text-brand-400 bg-brand-500/5'
                  : 'text-surface-500 hover:text-surface-300',
              )}
            >
              <Icon className={clsx('w-5 h-5 transition-transform', active && 'scale-110')} />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
