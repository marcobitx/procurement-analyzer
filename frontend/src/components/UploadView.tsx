// frontend/src/components/UploadView.tsx
// Upload view — centered hero with title and animated drop zone
// File management (list, submit) lives in RightPanel; this just shows the hero
// The drop zone here also accepts files and adds them to the store
// Related: RightPanel.tsx, store.ts

import { useState, useRef, useCallback } from 'react';
import { Upload, Cpu, FileText, ShieldCheck, History } from 'lucide-react';
import { appStore, useStore } from '../lib/store';

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
      {/* ── Page Header — Functional & Enterprise ────────────────── */}
      <div className="text-center mb-12 pt-4 md:pt-8">
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-brand-500/5 border border-brand-500/10 mb-6 transition-all duration-300">
          <Cpu className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-[10px] font-bold text-brand-300 tracking-[0.2em] uppercase">
            Sistemos statusas: Pro AI aktyvus
          </span>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tighter leading-tight mb-4">
          Intelektuali viešųjų pirkimų <span className="text-brand-400">analizė</span>
        </h1>

        <p className="text-surface-400 text-[14px] leading-relaxed max-w-lg mx-auto font-medium">
          Automatizuotas dokumentų vertinimas, rizikų nustatymas ir
          metrikų generavimas naudojant Claude Sonnet Enterprise modelį.
        </p>
      </div>

      {/* ── Drop Zone (large, animated) ───────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative group cursor-pointer transition-all duration-300 ${dragOver ? 'scale-[1.005]' : ''
          }`}
      >
        <div className={`absolute inset-0 rounded-2xl border-2 border-dashed transition-all duration-300 ${dragOver
          ? 'border-brand-500/40 bg-brand-500/5'
          : 'border-white/[0.04] bg-surface-900/60'
          }`} />

        <div
          className={`relative p-12 md:p-16 text-center transition-all duration-300 ${dragOver ? 'translate-y-[-2px]' : ''
            }`}
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
            className={`w-14 h-14 mx-auto mb-6 rounded-2xl flex items-center justify-center border transition-all duration-300 ${dragOver
              ? 'bg-brand-500/10 border-brand-500/30'
              : 'bg-surface-800 border-white/[0.04]'
              }`}
          >
            <Upload
              className={`w-6 h-6 transition-colors duration-300 ${dragOver ? 'text-brand-400' : 'text-surface-400'
                }`}
            />
          </div>

          <p className="text-[15px] font-semibold text-surface-200 mb-1.5 tracking-tight">
            {dragOver ? 'Paleiskite failus čia' : 'Nutempkite failus arba paspauskite'}
          </p>
          <p className="text-[12px] text-surface-500">
            PDF, DOCX, XLSX, PPTX, PNG, JPG, ZIP · Maks. {MAX_SIZE_MB}MB · Iki 20 failų
          </p>
        </div>
      </div>

      {/* ── File count indicator ── */}
      {state.files.length > 0 && (
        <div className="mt-8 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-brand-500/5 border border-brand-500/10">
            <FileText className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-[12px] font-bold text-brand-100">
              {state.files.length} {state.files.length === 1 ? 'failas paruoštas' : state.files.length < 10 ? 'failai paruošti' : 'failų paruošta'}
            </span>
          </div>
        </div>
      )}

      {/* ── Features row ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6 mt-20">
        {[
          { icon: Cpu, label: 'AI Variklis', desc: 'Sonnet Enterprise' },
          { icon: ShieldCheck, label: 'Saugi sistema', desc: 'Duomenų šifravimas' },
          { icon: History, label: 'Atsekamumas', desc: 'Pilnas žurnalas' },
        ].map(({ icon: Icon, label, desc }, i) => (
          <div
            key={label}
            className="enterprise-card py-6 px-4 text-center animate-stagger"
            style={{ animationDelay: `${300 + i * 150}ms` }}
          >
            <div className="w-10 h-10 mx-auto mb-4 rounded-xl bg-surface-800 flex items-center justify-center border border-white/[0.04]">
              <Icon className="w-5 h-5 text-brand-400" />
            </div>
            <p className="text-[13px] font-bold text-surface-200 mb-1">{label}</p>
            <p className="text-[11px] text-surface-500 font-medium">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
