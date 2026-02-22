// frontend/src/components/IconSidebar.tsx
// Full sidebar — smooth collapse/expand with opacity transitions on all text
// Structure follows Flow sidebar pattern adapted to procurement analyzer
// Related: App.tsx, store.ts, HelpPanel.tsx

import { clsx } from 'clsx';
import { useState, useRef, useEffect } from 'react';
import {
  ScanSearch, Layers, Settings, HelpCircle,
  PanelLeftClose, PanelLeftOpen, StickyNote,
  LogOut, Activity, Bookmark, ChevronUp,
} from 'lucide-react';
import { appStore, useStore, resetForNewAnalysis, type AppView } from '../lib/store';
import Tooltip from './Tooltip';
import AnimatedLogo from './AnimatedLogo';

interface Props {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const MAIN_NAV: { view: AppView; icon: any; label: string }[] = [
  { view: 'upload', icon: ScanSearch, label: 'Nauja analizė' },
  { view: 'history', icon: Layers, label: 'Istorija' },
  { view: 'notes', icon: StickyNote, label: 'Užrašai' },
];

const BOTTOM_NAV: { view: AppView; icon: any; label: string }[] = [
  { view: 'settings', icon: Settings, label: 'Nustatymai' },
];

function getActiveNav(view: AppView): AppView {
  if (view === 'analyzing' || view === 'results') return 'upload';
  return view;
}

const ACTIVE_STATUSES = new Set(['PARSING', 'EXTRACTING', 'AGGREGATING', 'EVALUATING']);

/** Reusable fade wrapper — text smoothly appears/disappears with the sidebar */
function FadeText({ expanded, children, className }: { expanded: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        'whitespace-nowrap overflow-hidden transition-[opacity,max-width,margin] duration-300 ease-out',
        expanded ? 'opacity-100 max-w-[160px] ml-3' : 'opacity-0 max-w-0 ml-0',
        className,
      )}
    >
      {children}
    </span>
  );
}

export default function IconSidebar({ currentView, onNavigate }: Props) {
  const state = useStore(appStore);
  const streamRunning = ACTIVE_STATUSES.has(state.streamStatus);
  const activeNav = getActiveNav(currentView);
  const expanded = state.sidebarOpen;

  const toggle = () => appStore.setState({ sidebarOpen: !expanded });

  return (
    <aside
      className={clsx(
        'hidden lg:flex flex-col h-full flex-shrink-0 overflow-hidden',
        'bg-surface-950/80',
        'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        expanded ? 'w-[240px]' : 'w-[60px]',
      )}
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="flex items-center flex-shrink-0 h-14 px-4">
        <div className="flex-shrink-0 transition-transform duration-300">
          <AnimatedLogo size={expanded ? 32 : 28} animate={expanded} />
        </div>
        <FadeText expanded={expanded}>
          <span className="text-[17px] font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <span style={{ background: 'linear-gradient(135deg, #fcd34d, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>fox</span>
            <span className="text-surface-100">Doc</span>
          </span>
        </FadeText>
      </div>

      {/* ── Controls — toggle ────────────────────────────── */}
      <div className="flex items-center h-10 flex-shrink-0 mb-1 px-3 transition-all duration-300">
        <Tooltip content={expanded ? 'Suskleisti' : 'Išskleisti'} side="right">
          <button
            onClick={toggle}
            aria-label={expanded ? 'Suskleisti' : 'Išskleisti'}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800/50 transition-all duration-200 flex-shrink-0"
          >
            <div className="relative w-[18px] h-[18px] overflow-hidden">
              <PanelLeftClose
                className={clsx(
                  'w-[18px] h-[18px] absolute inset-0 transition-all duration-300',
                  expanded ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90',
                )}
              />
              <PanelLeftOpen
                className={clsx(
                  'w-[18px] h-[18px] absolute inset-0 transition-all duration-300',
                  expanded ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0',
                )}
              />
            </div>
          </button>
        </Tooltip>
      </div>

      {/* ── Main Navigation ───────────────────────────────────── */}
      <nav className="flex flex-col gap-0.5 pt-2 px-2.5 transition-[padding] duration-300">
        {MAIN_NAV.map(({ view, icon: Icon, label }) => {
          const active = activeNav === view;
          const showPulse = view === 'upload' && streamRunning && currentView !== 'analyzing';

          return (
            <Tooltip key={view} content={label} side="right" disabled={expanded}>
              <button
                onClick={() => {
                  if (view === 'upload' && streamRunning) {
                    onNavigate('analyzing');
                  } else if (view === 'upload') {
                    resetForNewAnalysis();
                  } else {
                    onNavigate(view);
                  }
                }}
                className={clsx(
                  'relative flex items-center w-full py-2.5 px-3 rounded-lg',
                  'transition-all duration-200 group',
                  active
                    ? 'bg-surface-800/80 text-surface-100'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/40',
                )}
              >
                <Icon
                  className={clsx(
                    'w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200',
                    active ? 'text-brand-400' : 'text-surface-500 group-hover:text-surface-300',
                  )}
                />
                <FadeText expanded={expanded} className={active ? 'text-surface-100' : ''}>
                  <span className="text-[13px] font-semibold tracking-tight">{label}</span>
                </FadeText>

                {/* Pulsing dot — analysis running */}
                {showPulse && (
                  <span className={clsx(
                    'flex h-2 w-2 transition-all duration-300',
                    expanded ? 'ml-auto' : 'absolute top-1.5 right-1.5',
                  )}>
                    <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-brand-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                  </span>
                )}
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* ── Spacer ────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Bottom — Help + Settings ──────────────────────────── */}
      <nav className="flex flex-col gap-0.5 pb-4 px-2.5 transition-[padding] duration-300">
        {/* Help button */}
        <Tooltip content="Pagalba" side="right" disabled={expanded}>
          <button
            onClick={() => appStore.setState({ helpPanelOpen: true })}
            className="relative flex items-center w-full py-2.5 px-3 rounded-lg transition-all duration-200 text-left text-surface-400 hover:text-surface-200 hover:bg-surface-800/40 group"
          >
            <HelpCircle className="w-[18px] h-[18px] flex-shrink-0 text-surface-500 group-hover:text-surface-300 transition-colors duration-200" />
            <FadeText expanded={expanded}>
              <span className="text-[13px] font-semibold tracking-tight">Pagalba</span>
            </FadeText>
          </button>
        </Tooltip>

        {/* Settings + other bottom nav */}
        {BOTTOM_NAV.map(({ view, icon: Icon, label }) => {
          const active = activeNav === view;

          return (
            <Tooltip key={view} content={label} side="right" disabled={expanded}>
              <button
                onClick={() => onNavigate(view)}
                className={clsx(
                  'relative flex items-center w-full py-2.5 px-3 rounded-lg',
                  'transition-all duration-200 group',
                  active
                    ? 'bg-surface-800/80 text-surface-100'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/40',
                )}
              >
                <Icon
                  className={clsx(
                    'w-[18px] h-[18px] flex-shrink-0 transition-colors duration-200',
                    active ? 'text-brand-400' : 'text-surface-500 group-hover:text-surface-300',
                  )}
                />
                <FadeText expanded={expanded} className={active ? 'text-surface-100' : ''}>
                  <span className="text-[13px] font-semibold tracking-tight">{label}</span>
                </FadeText>
              </button>
            </Tooltip>
          );
        })}
      </nav>

      {/* ── Profile Section ─────────────────────────────────── */}
      <ProfileSection expanded={expanded} onNavigate={onNavigate} />
    </aside>
  );
}

/* ── Profile dropdown at the bottom of sidebar ────────────────────────────── */

const PROFILE_MENU = [
  { key: 'settings', icon: Settings, label: 'Nustatymai', view: 'settings' as AppView },
  { key: 'activity', icon: Activity, label: 'Veikla', view: null },
  { key: 'saved', icon: Bookmark, label: 'Išsaugoti', view: null },
] as const;

function ProfileSection({ expanded, onNavigate }: { expanded: boolean; onNavigate: (v: AppView) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);

  // Calculate fixed position for collapsed dropdown
  useEffect(() => {
    if (!open || expanded || !triggerRef.current) { setMenuPos(null); return; }
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ left: rect.right + 8, bottom: window.innerHeight - rect.top });
  }, [open, expanded]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const menuContent = (
    <>
      {/* Menu header */}
      <div className="px-3 pt-3 pb-2 border-b border-surface-800/60">
        <p className="text-[13px] font-bold text-surface-100 truncate">Marco</p>
        <p className="text-[11px] text-surface-500 font-medium truncate">marcobitx@gmail.com</p>
      </div>

      {/* Menu items */}
      <div className="py-1.5">
        {PROFILE_MENU.map(({ key, icon: Icon, label, view }) => (
          <button
            key={key}
            onClick={() => {
              setOpen(false);
              if (view) onNavigate(view);
            }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-surface-300 hover:text-surface-100 hover:bg-surface-800/60 transition-colors duration-150"
          >
            <Icon className="w-3.5 h-3.5 text-surface-500" />
            <span className="text-[12px] font-medium">{label}</span>
          </button>
        ))}
      </div>

      {/* Divider + sign out */}
      <div className="border-t border-surface-800/60 py-1.5">
        <button
          onClick={() => setOpen(false)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left text-surface-400 hover:text-red-400 hover:bg-surface-800/60 transition-colors duration-150"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="text-[12px] font-medium">Atsijungti</span>
        </button>
      </div>
    </>
  );

  return (
    <div ref={ref} className="relative flex-shrink-0 border-t border-surface-800/60">
      {/* Dropdown — absolute inside sidebar when expanded, fixed when collapsed */}
      {expanded ? (
        <div
          className={clsx(
            'absolute left-2 right-2 z-50 rounded-xl overflow-hidden',
            'bg-surface-900 border border-surface-700/50 shadow-xl shadow-black/30',
            'transition-all duration-200 ease-out',
            open
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none',
          )}
          style={{ bottom: '100%', marginBottom: 4 }}
        >
          {menuContent}
        </div>
      ) : (
        <div
          className={clsx(
            'fixed z-[9999] w-[200px] rounded-xl overflow-hidden',
            'bg-surface-900 border border-surface-700/50 shadow-xl shadow-black/30',
            'transition-all duration-200 ease-out',
            open && menuPos
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none',
          )}
          style={menuPos ? { left: menuPos.left, bottom: menuPos.bottom } : { left: 68, bottom: 60 }}
        >
          {menuContent}
        </div>
      )}

      {/* Profile trigger button */}
      <Tooltip content="Profilis" side="right" disabled={expanded}>
        <button
          ref={triggerRef}
          onClick={() => setOpen(!open)}
          className={clsx(
            'flex items-center w-full gap-3 transition-all duration-200',
            'hover:bg-surface-800/50',
            expanded ? 'px-4 py-3' : 'px-0 py-3 justify-center',
          )}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0 ring-2 ring-surface-800 shadow-sm">
            <span className="text-[12px] font-bold text-white leading-none">M</span>
          </div>

          {/* Name + email — only when expanded */}
          <div
            className={clsx(
              'flex-1 min-w-0 text-left overflow-hidden transition-[opacity,max-width] duration-300 ease-out',
              expanded ? 'opacity-100 max-w-[140px]' : 'opacity-0 max-w-0',
            )}
          >
            <p className="text-[13px] font-semibold text-surface-200 truncate leading-tight">Marco</p>
            <p className="text-[10px] text-surface-500 truncate leading-tight mt-0.5">Pro planas</p>
          </div>

          {/* Chevron — only when expanded */}
          <div
            className={clsx(
              'overflow-hidden transition-[opacity,max-width] duration-300 ease-out flex-shrink-0',
              expanded ? 'opacity-100 max-w-[20px]' : 'opacity-0 max-w-0',
            )}
          >
            <ChevronUp
              className={clsx(
                'w-4 h-4 text-surface-500 transition-transform duration-200',
                open ? 'rotate-0' : 'rotate-180',
              )}
            />
          </div>
        </button>
      </Tooltip>
    </div>
  );
}
