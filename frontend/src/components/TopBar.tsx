// frontend/src/components/TopBar.tsx
// Thin top bar — breadcrumb path + error banner
// Always visible at the top of the main content area
// Related: App.tsx, store.ts

import { AlertTriangle, X, Upload, History, Settings as SettingsIcon, FileText, Cpu, XCircle } from 'lucide-react';
import { appStore, useStore, type AppView } from '../lib/store';

interface Props {
  currentView: AppView;
  error: string | null;
  onDismissError: () => void;
  onCancel?: () => void;
}

const VIEW_META: Record<AppView, { label: string; icon: any; breadcrumb: string }> = {
  upload: { label: 'Nauja analizė', icon: Upload, breadcrumb: 'Pradžia / Nauja analizė' },
  analyzing: { label: 'Analizuojama', icon: Cpu, breadcrumb: 'Pradžia / Analizė' },
  results: { label: 'Ataskaita', icon: FileText, breadcrumb: 'Pradžia / Ataskaita' },
  history: { label: 'Istorija', icon: History, breadcrumb: 'Pradžia / Istorija' },
  settings: { label: 'Nustatymai', icon: SettingsIcon, breadcrumb: 'Pradžia / Nustatymai' },
};

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

export default function TopBar({ currentView, error, onDismissError, onCancel }: Props) {
  const state = useStore(appStore);
  const meta = VIEW_META[currentView] || VIEW_META.upload;
  const status = state.analysisStatus;

  return (
    <header className="flex-shrink-0 border-b border-white/[0.04] bg-surface-950/20 backdrop-blur-md">
      <div className="flex items-center justify-between h-16 px-6 md:px-10">
        {/* Left — breadcrumb path */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-surface-400 font-semibold tracking-tight uppercase letter-spacing-wider">
            {meta.breadcrumb}
          </span>
        </div>

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
              <div className="w-px h-3 bg-white/[0.1]" />
              <span className="text-[10px] font-mono font-bold text-surface-500 tracking-widest whitespace-nowrap">
                {formatTime(state.analysisElapsedSec)}
              </span>
            </div>
            
            <div className="w-64 h-[2px] bg-white/[0.04] rounded-full overflow-hidden relative">
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
          {currentView === 'analyzing' && !error && onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-4 py-2 rounded-xl
                       bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300
                       border border-red-500/10 transition-all text-xs font-bold uppercase tracking-wide"
            >
              <XCircle className="w-4 h-4" />
              Nutraukti
            </button>
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
