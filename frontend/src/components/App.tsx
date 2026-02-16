// frontend/src/components/App.tsx
// Root application shell — 3-column layout with icon sidebar + main + right panel
// Entry point for the React island; mounted client-only in index.astro
// Related: store.ts, IconSidebar.tsx, RightPanel.tsx, TopBar.tsx

import { useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { Plus, Clock, Settings } from 'lucide-react';
import { appStore, useStore, stopAnalysisStream, resetForNewAnalysis, createNote, setNotesFilter, type AppView } from '../lib/store';
import { cancelAnalysis } from '../lib/api';
import IconSidebar from './IconSidebar';
import RightPanel from './RightPanel';
import TopBar from './TopBar';
import UploadView from './UploadView';
import AnalyzingView from './AnalyzingView';
import ResultsView from './ResultsView';
import HistoryView from './HistoryView';
import SettingsView from './SettingsView';
import NotesView from './NotesView';
import ModelPanel from './ModelPanel';
import FilesPanel from './FilesPanel';
import SourcesPanel from './SourcesPanel';
import HelpPanel from './HelpPanel';
import ErrorBoundary from './ErrorBoundary';
import { getModels, getSettings } from '../lib/api';

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
      previousView: state.view,
      view,
      currentAnalysisId: analysisId ?? state.currentAnalysisId,
      error: null,
    });
  }, [state.view, state.currentAnalysisId]);

  const handleNewAnalysis = useCallback(() => {
    resetForNewAnalysis();
  }, []);

  const handleCancel = useCallback(async () => {
    if (!state.currentAnalysisId) return;
    try {
      stopAnalysisStream();
      await cancelAnalysis(state.currentAnalysisId);
      appStore.setState({ error: 'Analizė atšaukta', analysisStatus: null });
    } catch (err) {
      console.error('Failed to cancel analysis:', err);
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
            reviewMode={state.reviewMode}
            onComplete={() => {
              appStore.setState({ reviewMode: false });
              navigate('results');
            }}
            onError={(err) => appStore.setState({ error: err })}
            onViewReport={() => {
              appStore.setState({ reviewMode: false });
              navigate('results');
            }}
          />
        );
      case 'results':
        return (
          <ResultsView
            analysisId={state.currentAnalysisId!}
            onBack={() => {
              const s = appStore.getState();
              if (s.analysisSnapshot) {
                appStore.setState({ reviewMode: true });
                navigate('analyzing');
              } else if (s.previousView === 'history') {
                navigate('history');
              } else {
                navigate('upload');
              }
            }}
          />
        );
      case 'history':
        return (
          <HistoryView
            onSelect={(id) => navigate('results', id)}
            onNew={handleNewAnalysis}
            onViewNotes={(analysisId) => {
              setNotesFilter({ analysisId });
              navigate('notes');
            }}
          />
        );
      case 'settings':
        return <SettingsView />;
      case 'notes':
        return <NotesView />;
      default:
        return <UploadView />;
    }
  };

  const activeNav = getActiveNav(state.view);

  const initModels = useCallback(async () => {
    try {
      const cached = appStore.getState().cachedModels;
      const models = cached && cached.length > 0 ? cached : await getModels();
      if (!cached || cached.length === 0) {
        appStore.setState({ cachedModels: models });
      }
      if (models.length > 0 && !state.selectedModel) {
        // Use default model from settings if configured
        let defaultModel = models[0];
        try {
          const settings = await getSettings();
          if (settings.default_model) {
            const match = models.find((m: any) => m.id === settings.default_model);
            if (match) defaultModel = match;
          }
        } catch { /* fall back to first model */ }
        appStore.setState({ selectedModel: defaultModel });
      }
    } catch (err) {
      console.error('Failed to init models:', err);
    }
  }, [state.selectedModel]);

  // ── Global keyboard shortcuts ──────────────────────────────────────
  // Using Alt+key to avoid conflicts with browser-reserved Ctrl shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore when typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewAnalysis();
      } else if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        navigate('history');
      } else if (e.altKey && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        navigate('notes');
      } else if (e.altKey && (e.key === ',' || e.key === '<')) {
        e.preventDefault();
        navigate('settings');
      } else if (e.altKey && e.key.toLowerCase() === 'j') {
        // New note — Alt+J (like "Jot")
        e.preventDefault();
        navigate('notes');
        createNote();
      } else if (e.key === 'Escape') {
        // Close note editor if open, then overlays
        const s = appStore.getState();
        if (s.activeNoteId) appStore.setState({ activeNoteId: null });
        else if (s.helpPanelOpen) appStore.setState({ helpPanelOpen: false });
        else if (s.modelPanelOpen) appStore.setState({ modelPanelOpen: false });
        else if (s.filesPanelOpen) appStore.setState({ filesPanelOpen: false });
        else if (s.sourcesPanelOpen) appStore.setState({ sourcesPanelOpen: false });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  // Handle initialization
  useEffect(() => {
    initModels();
  }, []);

  // Auto-navigate to results when analysis completes while user is on a different view
  useEffect(() => {
    const status = state.analysisStatus;
    if (status === 'COMPLETED' && state.view !== 'analyzing' && state.view !== 'results') {
      appStore.setState({ reviewMode: false, analysisStatus: null });
      navigate('results');
    }
  }, [state.analysisStatus, state.view, navigate]);

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      {/* ── Overlays ─────────────────────────────────────────── */}
      <ModelPanel />
      <FilesPanel />
      <SourcesPanel />
      <HelpPanel />

      {/* ── Left — Icon Sidebar (60px, desktop only) ────────── */}
      <IconSidebar currentView={state.view} onNavigate={navigate} />

      {/* ── Center + Right — Unified Panel ───────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 mt-14 mb-3 mr-3 rounded-2xl border border-surface-700/30 bg-[#342a24]">
        <TopBar
          currentView={state.view}
          error={state.error}
          onDismissError={() => appStore.setState({ error: null })}
          onNavigate={navigate}
          onCancel={handleCancel}
          onNewAnalysis={handleNewAnalysis}
        />

        <div className="flex-1 flex overflow-hidden min-h-0">
          <main className="flex-1 overflow-y-auto pb-24 lg:pb-0 scrollbar-thin">
            <div className="px-4 py-4 sm:px-6 sm:py-6 md:px-10 md:py-8 lg:px-12 animate-fade-in">
              <ErrorBoundary>
                {renderView()}
              </ErrorBoundary>
            </div>
          </main>

          {/* ── Right — Tools Panel (320px, desktop only) ─────────── */}
          <RightPanel currentView={state.view} analysisId={state.currentAnalysisId} />
        </div>
      </div>

      {/* ── Mobile Bottom Nav (< lg only) ─────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-20 bg-surface-950/80 backdrop-blur-2xl border-t border-surface-700/50 px-4 pb-4">
        {MOBILE_NAV.map(({ view, icon: Icon, label }) => {
          const active = activeNav === view;
          return (
            <button
              key={view}
              onClick={() => view === 'upload' ? handleNewAnalysis() : navigate(view)}
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
