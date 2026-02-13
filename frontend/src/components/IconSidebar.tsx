// frontend/src/components/IconSidebar.tsx
// Minimal 60px icon-only sidebar — logo, nav icons with tooltips
// Replaces the old collapsible Sidebar.tsx for the 3-column layout
// Related: App.tsx, store.ts

import { clsx } from 'clsx';
import { Plus, Clock, Settings, FileSearch } from 'lucide-react';
import type { AppView } from '../lib/store';

interface Props {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const NAV_ITEMS: { view: AppView; icon: any; label: string }[] = [
  { view: 'upload', icon: Plus, label: 'Nauja analizė' },
  { view: 'history', icon: Clock, label: 'Istorija' },
  { view: 'settings', icon: Settings, label: 'Nustatymai' },
];

/** Maps active workflow states back to the parent nav item */
function getActiveNav(view: AppView): AppView {
  if (view === 'analyzing' || view === 'results') return 'upload';
  return view;
}

export default function IconSidebar({ currentView, onNavigate }: Props) {
  const activeNav = getActiveNav(currentView);

  return (
    <aside className="hidden lg:flex flex-col w-[60px] h-full bg-gradient-sidebar border-r border-white/[0.04] flex-shrink-0">
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-center h-14 border-b border-white/[0.04]">
        <div
          className="w-8 h-8 rounded-[10px] bg-gradient-accent flex items-center justify-center
                     shadow-[0_2px_8px_rgba(255,140,10,0.25)]"
        >
          <FileSearch className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <nav className="flex-1 flex flex-col items-center gap-1.5 pt-5">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const active = activeNav === view;

          return (
            <div key={view} className="relative group">
              <button
                onClick={() => onNavigate(view)}
                className={clsx(
                  'relative w-10 h-10 rounded-xl flex items-center justify-center',
                  'transition-all duration-200 ease-out-expo',
                  active
                    ? 'bg-brand-500/12'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-700/30',
                )}
              >
                {/* Active indicator bar — left edge */}
                {active && (
                  <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-accent-500" />
                )}

                <Icon
                  className={clsx(
                    'w-[18px] h-[18px] transition-colors duration-200',
                    active ? 'text-accent-400' : '',
                  )}
                />
              </button>

              {/* Tooltip */}
              <div
                className="absolute left-full top-1/2 -translate-y-1/2 ml-3
                           px-2.5 py-1.5 rounded-lg bg-surface-800 border border-white/[0.08]
                           text-[11px] font-medium text-surface-200 whitespace-nowrap
                           opacity-0 pointer-events-none group-hover:opacity-100
                           transition-opacity duration-200 z-50 shadow-lg"
              >
                {label}
                {/* Arrow */}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-surface-800" />
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
