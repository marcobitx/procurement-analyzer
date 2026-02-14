// frontend/src/components/IconSidebar.tsx
// Minimal 60px icon-only sidebar — TRANSPARENT bg, lime green active indicator
// Sits over the unified page background
// Related: App.tsx, store.ts

import { clsx } from 'clsx';
import { ScanSearch, Layers, SlidersHorizontal, FlaskConical } from 'lucide-react';
import { appStore, useStore, type AppView } from '../lib/store';

interface Props {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const NAV_ITEMS: { view: AppView; icon: any; label: string }[] = [
  { view: 'upload', icon: ScanSearch, label: 'Nauja analizė' },
  { view: 'history', icon: Layers, label: 'Istorija' },
  { view: 'settings', icon: SlidersHorizontal, label: 'Nustatymai' },
];

function getActiveNav(view: AppView): AppView {
  if (view === 'analyzing' || view === 'results') return 'upload';
  return view;
}

const ACTIVE_STATUSES = new Set(['PARSING', 'EXTRACTING', 'AGGREGATING', 'EVALUATING']);

export default function IconSidebar({ currentView, onNavigate }: Props) {
  const state = useStore(appStore);
  const streamRunning = ACTIVE_STATUSES.has(state.streamStatus);
  const activeNav = getActiveNav(currentView);

  return (
    <aside className="hidden lg:flex flex-col w-[60px] h-full bg-transparent border-r border-surface-700/50 flex-shrink-0">
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-center h-16 border-b border-surface-700/50">
        <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center shadow-sm">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* ── Navigation — vertically centered ─────────────────── */}
      <nav className="flex-1 flex flex-col items-center gap-2 pt-8">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const active = activeNav === view;
          const showPulse = view === 'upload' && streamRunning && currentView !== 'analyzing';

          return (
            <div key={view} className="relative group">
              <button
                onClick={() => {
                  // When stream is running and clicking the upload/analysis icon, go to analyzing view
                  if (view === 'upload' && streamRunning) {
                    onNavigate('analyzing');
                  } else {
                    onNavigate(view);
                  }
                }}
                aria-label={label}
                className={clsx(
                  'relative w-10 h-10 rounded-xl flex items-center justify-center',
                  'transition-all duration-200',
                  active
                    ? 'bg-brand-500/10 text-brand-400'
                    : 'text-surface-500 hover:text-surface-200 hover:bg-white/[0.04]',
                )}
              >
                {/* Active indicator bar */}
                {active && (
                  <div className="absolute left-[0px] top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r-full bg-brand-500" />
                )}

                <Icon
                  className={clsx(
                    'w-[20px] h-[20px] transition-all duration-300',
                    active ? 'text-brand-400' : '',
                  )}
                />

                {/* Pulsing dot — analysis running indicator */}
                {showPulse && (
                  <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
                  </span>
                )}
              </button>

              {/* Tooltip */}
              <div
                className="absolute left-full top-1/2 -translate-y-1/2 ml-3
                           px-2.5 py-1.5 rounded-lg bg-surface-900/95 backdrop-blur-lg border border-surface-700/60
                           text-[11px] font-medium text-surface-200 whitespace-nowrap
                           opacity-0 pointer-events-none group-hover:opacity-100
                           transition-opacity duration-200 z-50 shadow-lg"
              >
                {label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-surface-900/95" />
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
