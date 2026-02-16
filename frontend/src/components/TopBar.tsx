// frontend/src/components/TopBar.tsx
// Thin top bar — interactive breadcrumb path + error banner
// Always visible at the top of the main content area
// Related: App.tsx, store.ts

import { AlertTriangle, X, ChevronRight, Home, XCircle, Plus } from 'lucide-react';
import { appStore, useStore, type AppView } from '../lib/store';
import Tooltip from './Tooltip';

interface Props {
  currentView: AppView;
  error: string | null;
  onDismissError: () => void;
  onNavigate: (view: AppView) => void;
  onCancel?: () => void;
  onNewAnalysis?: () => void;
}

/** Breadcrumb trail segments per view */
type BreadcrumbSegment = { label: string; view?: AppView };

function getBreadcrumbs(view: AppView, reviewMode: boolean): BreadcrumbSegment[] {
  switch (view) {
    case 'upload':
      return [{ label: 'Nauja analizė' }];
    case 'analyzing':
      return [{ label: 'Nauja analizė', view: 'upload' }, { label: 'Analizė' }];
    case 'results':
      return reviewMode
        ? [{ label: 'Istorija', view: 'history' }, { label: 'Ataskaita' }]
        : [{ label: 'Nauja analizė', view: 'upload' }, { label: 'Ataskaita' }];
    case 'history':
      return [{ label: 'Istorija' }];
    case 'settings':
      return [{ label: 'Nustatymai' }];
    case 'notes':
      return [{ label: 'Užrašai' }];
    default:
      return [{ label: 'Pradžia' }];
  }
}

const STATUS_LABELS: Record<string, string> = {
  QUEUED: 'Laukiama eilėje',
  PARSING: 'Parsuojami dokumentai',
  EXTRACTING: 'Ištraukiami duomenys',
  AGGREGATING: 'Agreguojama informacija',
  EVALUATING: 'Vertinama kokybė',
  COMPLETED: 'Analizė baigta',
  FAILED: 'Klaida',
  CANCELED: 'Atšaukta',
};

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export default function TopBar({ currentView, error, onDismissError, onNavigate, onCancel, onNewAnalysis }: Props) {
  const state = useStore(appStore);
  const status = state.analysisStatus;
  const crumbs = getBreadcrumbs(currentView, state.reviewMode);

  return (
    <header className="flex-shrink-0 border-b border-surface-700/20">
      <div className="flex items-center justify-between h-16 pl-6 pr-4 md:pl-10 md:pr-5">
        {/* Left — interactive breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-0 min-w-0">
          {/* Home root */}
          <Tooltip content="Pradžia" side="bottom">
            <button
              onClick={() => onNavigate('upload')}
              className="flex items-center gap-1 text-surface-500 hover:text-brand-400
                         transition-colors duration-200 group shrink-0"
              aria-label="Pradžia"
            >
              <Home className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-200" />
            </button>
          </Tooltip>

          {/* Segments */}
          {crumbs.map((seg, i) => {
            const isLast = i === crumbs.length - 1;
            return (
              <span key={i} className="flex items-center gap-0 min-w-0">
                <ChevronRight className="w-3 h-3 text-surface-700 mx-1.5 shrink-0" />
                {isLast ? (
                  <span className="text-[13px] font-semibold text-surface-200 tracking-tight truncate">
                    {seg.label}
                  </span>
                ) : (
                  <button
                    onClick={() => seg.view && onNavigate(seg.view)}
                    className="text-[13px] font-medium text-surface-500 hover:text-brand-400
                               transition-colors duration-200 tracking-tight truncate"
                  >
                    {seg.label}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        {/* Center — Analysis Status (Sleek Aesthetic) */}
        {status && (
          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse shadow-glow-brand" />
                <span className="text-[11px] font-bold text-white uppercase tracking-[0.2em]">
                  {STATUS_LABELS[status] || 'Analizuojama...'}
                </span>
              </div>
              <div className="w-px h-3 bg-surface-700/50" />
              <span className="text-[10px] font-mono font-bold text-surface-500 tracking-widest whitespace-nowrap">
                {formatTime(state.analysisElapsedSec)}
              </span>
            </div>
            
            <div
              className="w-64 h-[2px] bg-surface-700/30 rounded-full overflow-hidden relative"
              role="progressbar"
              aria-valuenow={
                status === 'COMPLETED' ? 100 :
                status === 'EVALUATING' ? 80 :
                status === 'AGGREGATING' ? 60 :
                status === 'EXTRACTING' ? 40 :
                status === 'PARSING' ? 20 : 5
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Analizės progresas"
            >
               <div 
                 className="absolute inset-0 bg-brand-500/10 blur-[2px]"
                 style={{ 
                   width: status === 'COMPLETED' ? '100%' : 
                          status === 'EVALUATING' ? '80%' :
                          status === 'AGGREGATING' ? '60%' :
                          status === 'EXTRACTING' ? '40%' :
                          status === 'PARSING' ? '20%' : '5%' 
                 }}
               />
               <div 
                 className="h-full bg-brand-500 shadow-glow-brand transition-all duration-700 ease-in-out relative z-10"
                 style={{ 
                   width: status === 'COMPLETED' ? '100%' : 
                          status === 'EVALUATING' ? '80%' :
                          status === 'AGGREGATING' ? '60%' :
                          status === 'EXTRACTING' ? '40%' :
                          status === 'PARSING' ? '20%' : '5%' 
                 }}
               />
            </div>
          </div>
        )}

        {/* Right — actions */}
        <div className="flex items-center gap-4">
          {status && !['COMPLETED', 'FAILED', 'CANCELED'].includes(status) && !error && onCancel && (
            <Tooltip content="Nutraukti vykdomą analizę" side="bottom">
              <button
                onClick={onCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                         border border-red-500/10 transition-all text-[12px] font-semibold"
              >
                <XCircle className="w-3.5 h-3.5" />
                Nutraukti
              </button>
            </Tooltip>
          )}
          {(currentView === 'results' || (currentView === 'analyzing' && state.reviewMode)) && (
            <Tooltip content="Pradėti naują analizę (Alt+N)" side="bottom">
              <button
                onClick={() => onNewAnalysis ? onNewAnalysis() : onNavigate('upload')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg
                         bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 hover:text-brand-300
                         border border-brand-500/20 transition-all text-[12px] font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Nauja analizė
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Error banner — slides in when error exists */}
      {error && (
        <div className="flex items-center gap-3 px-6 md:px-10 py-2.5 bg-red-500/10 border-t border-red-500/20 animate-fade-in">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-[13px] text-red-200 font-medium flex-1 truncate">{error}</span>
          <button
            onClick={onDismissError}
            className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}
