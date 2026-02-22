// frontend/src/components/UploadView.tsx
// Upload view — centered hero with title, features grid, and model carousel
// File upload handled via FilesPanel; this shows the landing page
// Related: FilesPanel.tsx, RightPanel.tsx, store.ts

import { FileText, ExternalLink, ShieldCheck, ScrollText, BrainCircuit } from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import ModelCarousel from './ModelCarousel';
import Tooltip from './Tooltip';

export default function UploadView() {
  const state = useStore(appStore);

  return (
    <div className="w-full animate-fade-in-up">
      {/* ── Compact Header — title + subtitle tightly grouped ──── */}
      <div className="text-center mb-6 pt-2 md:pt-4">
        {/* Brand + status — single compact row */}
        <div className="flex items-center justify-center gap-3 mb-4">
          <a
            href="https://viesiejipirkimai.lt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-surface-700/30 hover:border-surface-600/50 hover:bg-white/[0.05] transition-all duration-200 group"
          >
            <img src="/cvpis-logo.png" alt="CVP IS" className="h-5 w-auto" />
            <span className="text-[10px] font-semibold text-surface-500 group-hover:text-surface-300 transition-colors hidden sm:inline">
              CVP IS
            </span>
            <ExternalLink className="w-2.5 h-2.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
          </a>
          <div className="h-4 w-px bg-surface-700/40" />
          <Tooltip content="AI modelis paruoštas analizei" side="bottom">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400/80 tracking-wide uppercase">
                AI aktyvus
              </span>
            </div>
          </Tooltip>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tighter leading-[1.1] mb-3">
          Viešųjų pirkimų <span className="text-brand-400">analizė</span>
        </h1>

        <p className="text-surface-400 text-[13px] md:text-[14px] leading-relaxed max-w-lg mx-auto font-medium">
          Automatizuotas dokumentų vertinimas, rizikų nustatymas ir metrikų generavimas naudojant AI.
        </p>
      </div>

      {/* ── File count indicator — click to open files panel ──── */}
      {state.files.length > 0 && (
        <div className="mt-5 text-center animate-fade-in">
          <Tooltip content="Atidaryti failų sąrašą" side="top">
            <button
              onClick={() => appStore.setState({ filesPanelOpen: true })}
              className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-brand-500/5 border border-brand-500/10 hover:border-brand-500/25 hover:bg-brand-500/8 transition-all duration-200 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[12px] font-bold text-brand-100">
                {state.files.length} {state.files.length === 1 ? 'failas paruoštas' : state.files.length < 10 ? 'failai paruošti' : 'failų paruošta'}
              </span>
              <span className="text-[10px] text-brand-500/60 group-hover:text-brand-400 transition-colors">Peržiūrėti &rarr;</span>
            </button>
          </Tooltip>
        </div>
      )}

      {/* ── Features — clear cards, responsive grid ────────────── */}
      <div className="mt-8 md:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
        <Tooltip content="Dokumentai analizuojami AI modeliu" side="top">
          <div className="flex sm:flex-col items-center sm:items-center gap-2.5 sm:gap-2 px-4 py-3 sm:py-4 rounded-xl bg-surface-800/60 border border-surface-600/25 w-full">
            <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400/80 flex-shrink-0" />
            <div className="flex sm:flex-col items-center sm:items-center gap-1.5 sm:gap-1 min-w-0">
              <span className="text-[12px] font-semibold text-surface-300 whitespace-nowrap">AI analizė</span>
              <span className="text-[11px] text-surface-500 font-medium truncate">{state.selectedModel?.name?.split(':').pop()?.trim() || 'Claude'}</span>
            </div>
          </div>
        </Tooltip>
        <Tooltip content="Duomenys perduodami šifruotu kanalu" side="top">
          <div className="flex sm:flex-col items-center sm:items-center gap-2.5 sm:gap-2 px-4 py-3 sm:py-4 rounded-xl bg-surface-800/60 border border-surface-600/25 w-full">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400/80 flex-shrink-0" />
            <span className="text-[12px] font-semibold text-surface-300">Šifruota sesija</span>
          </div>
        </Tooltip>
        <Tooltip content="Visa analizės eiga matoma realiu laiku" side="top">
          <div className="flex sm:flex-col items-center sm:items-center gap-2.5 sm:gap-2 px-4 py-3 sm:py-4 rounded-xl bg-surface-800/60 border border-surface-600/25 w-full">
            <ScrollText className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400/80 flex-shrink-0" />
            <span className="text-[12px] font-semibold text-surface-300">Pilnas žurnalas</span>
          </div>
        </Tooltip>
      </div>

      {/* ── Model Logo Carousel — subtle footer ────────────────── */}
      <ModelCarousel />
    </div>
  );
}
