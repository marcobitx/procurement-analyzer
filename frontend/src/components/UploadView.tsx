// frontend/src/components/UploadView.tsx
// Upload view — centered hero with title and animated drop zone
// File management (list, submit) lives in RightPanel; this just shows the hero
// The drop zone here also accepts files and adds them to the store
// Related: RightPanel.tsx, store.ts

import { useState, useRef, useCallback } from 'react';
import { Upload, Cpu, FileText, ExternalLink, ShieldCheck, ScrollText, BrainCircuit } from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import ModelCarousel from './ModelCarousel';
import { FileTypeStrip } from './FileTypeLogos';

const ACCEPTED = '.pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.zip';
const MAX_SIZE_MB = 50;

export default function UploadView() {
  const state = useStore(appStore);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    const currentFiles = appStore.getState().files;
    const names = new Set(currentFiles.map((f) => f.name));
    const uniqueNew = valid.filter((f) => !names.has(f.name));
    if (uniqueNew.length) {
      appStore.setState({ files: [...currentFiles, ...uniqueNew] });
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
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
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400/80 tracking-wide uppercase">
              AI aktyvus
            </span>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tighter leading-[1.1] mb-3">
          Viešųjų pirkimų <span className="text-brand-400">analizė</span>
        </h1>

        <p className="text-surface-400 text-[13px] md:text-[14px] leading-relaxed max-w-lg mx-auto font-medium">
          Automatizuotas dokumentų vertinimas, rizikų nustatymas ir metrikų generavimas naudojant AI.
        </p>
      </div>

      {/* ── Drop Zone — primary focal point ────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative group cursor-pointer transition-all duration-300 ${dragOver ? 'scale-[1.005]' : ''}`}
      >
        <div className={`absolute inset-0 rounded-2xl border-2 border-dashed transition-all duration-300 ${dragOver
          ? 'border-brand-500/40 bg-brand-500/5'
          : 'border-surface-700/50 bg-surface-900/60 group-hover:border-surface-600/60 group-hover:bg-surface-900/80'
          }`} />

        <div
          className={`relative px-8 py-10 md:px-12 md:py-14 text-center transition-all duration-300 ${dragOver ? 'translate-y-[-2px]' : ''}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="hidden"
          />

          <div
            className={`w-12 h-12 md:w-14 md:h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center border transition-all duration-300 ${dragOver
              ? 'bg-brand-500/10 border-brand-500/30'
              : 'bg-surface-800 border-surface-700/50 group-hover:border-surface-600/60'
              }`}
          >
            <Upload
              className={`w-5 h-5 md:w-6 md:h-6 transition-colors duration-300 ${dragOver ? 'text-brand-400' : 'text-surface-400 group-hover:text-surface-300'}`}
            />
          </div>

          <p className="text-[14px] md:text-[15px] font-semibold text-surface-200 mb-2.5 tracking-tight">
            {dragOver ? 'Paleiskite failus čia' : 'Nutempkite failus arba paspauskite'}
          </p>
          <FileTypeStrip iconSize={16} />
          <p className="text-[11px] text-surface-600 mt-2.5">
            Maks. {MAX_SIZE_MB}MB · Iki 20 failų
          </p>
        </div>
      </div>

      {/* ── File count indicator — click to open files panel ──── */}
      {state.files.length > 0 && (
        <div className="mt-5 text-center animate-fade-in">
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
        </div>
      )}

      {/* ── Features — clear cards, responsive grid ────────────── */}
      <div className="mt-8 md:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '300ms' }}>
        <div className="flex sm:flex-col items-center sm:items-center gap-2.5 sm:gap-2 px-4 py-3 sm:py-4 rounded-xl bg-surface-900/50 border border-surface-700/30">
          <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400/80 flex-shrink-0" />
          <div className="flex sm:flex-col items-center sm:items-center gap-1.5 sm:gap-1 min-w-0">
            <span className="text-[12px] font-semibold text-surface-300 whitespace-nowrap">AI analizė</span>
            <span className="text-[11px] text-surface-500 font-medium truncate">{state.selectedModel?.name?.split(':').pop()?.trim() || 'Claude'}</span>
          </div>
        </div>
        <div className="flex sm:flex-col items-center sm:items-center gap-2.5 sm:gap-2 px-4 py-3 sm:py-4 rounded-xl bg-surface-900/50 border border-surface-700/30">
          <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-brand-400/80 flex-shrink-0" />
          <span className="text-[12px] font-semibold text-surface-300">Šifruota sesija</span>
        </div>
        <div className="flex sm:flex-col items-center sm:items-center gap-2.5 sm:gap-2 px-4 py-3 sm:py-4 rounded-xl bg-surface-900/50 border border-surface-700/30">
          <ScrollText className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400/80 flex-shrink-0" />
          <span className="text-[12px] font-semibold text-surface-300">Pilnas žurnalas</span>
        </div>
      </div>

      {/* ── Model Logo Carousel — subtle footer ────────────────── */}
      <ModelCarousel />
    </div>
  );
}
