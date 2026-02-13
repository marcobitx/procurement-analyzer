// frontend/src/components/UploadView.tsx
// Upload view — centered hero with title and animated drop zone
// File management (list, submit) lives in RightPanel; this just shows the hero
// The drop zone here also accepts files and adds them to the store
// Related: RightPanel.tsx, store.ts

import { useState, useRef, useCallback } from 'react';
import { Upload, Zap, FileText, Sparkles } from 'lucide-react';
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
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="text-center mb-10 pt-4 md:pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-500/8 border border-brand-500/12 mb-5">
          <Zap className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-[12px] font-semibold text-brand-300 tracking-tight">
            AI dokumentų analizė
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-surface-50 tracking-tighter leading-[1.1] mb-3">
          Viešųjų pirkimų
          <br />
          <span className="bg-gradient-to-r from-accent-400 to-accent-600 bg-clip-text text-transparent">
            analizatorius
          </span>
        </h1>

        <p className="text-surface-400 text-[15px] leading-relaxed max-w-md mx-auto">
          Įkelkite pirkimo dokumentus — AI sistema juos išanalizuos
          ir pateiks struktūrizuotą ataskaitą per kelias minutes.
        </p>
      </div>

      {/* ── Drop Zone (large, animated) ───────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-2xl cursor-pointer transition-all duration-300 ease-out-expo ${
          dragOver ? 'scale-[1.01]' : ''
        }`}
      >
        {/* Animated gradient border */}
        <div
          className={`absolute inset-0 rounded-2xl transition-opacity duration-300 ${
            dragOver ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            padding: '1.5px',
            background: 'linear-gradient(135deg, #8b5cf6, #ff8c0a, #8b5cf6)',
            backgroundSize: '200% 200%',
            animation: 'borderFlow 2s linear infinite',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />

        <div
          className={`glass-card p-10 md:p-14 text-center transition-colors duration-300 ${
            dragOver ? 'bg-brand-500/5' : ''
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
            className={`w-14 h-14 mx-auto mb-5 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              dragOver
                ? 'bg-brand-500/15 scale-110'
                : 'bg-surface-700/40'
            }`}
          >
            <Upload
              className={`w-6 h-6 transition-colors duration-300 ${
                dragOver ? 'text-brand-400' : 'text-surface-500'
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

      {/* ── File count indicator (files managed in RightPanel) ── */}
      {state.files.length > 0 && (
        <div className="mt-5 text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500/8 border border-accent-500/12">
            <FileText className="w-3.5 h-3.5 text-accent-400" />
            <span className="text-[13px] font-semibold text-accent-300">
              {state.files.length} {state.files.length === 1 ? 'failas paruoštas' : state.files.length < 10 ? 'failai paruošti' : 'failų paruošta'}
            </span>
            <span className="text-[12px] text-surface-500 hidden lg:inline">
              · žr. dešinėje →
            </span>
          </div>
        </div>
      )}

      {/* ── Features row ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mt-10">
        {[
          { icon: Sparkles, label: 'AI analizė', desc: 'Claude Sonnet 4' },
          { icon: FileText, label: 'Struktūrizuota', desc: 'Pilna ataskaita' },
          { icon: Zap, label: 'Greita', desc: '2-5 minutės' },
        ].map(({ icon: Icon, label, desc }, i) => (
          <div
            key={label}
            className="text-center py-4 px-3 rounded-xl bg-surface-800/15 border border-white/[0.03] animate-stagger"
            style={{ animationDelay: `${300 + i * 100}ms` }}
          >
            <Icon className="w-4 h-4 text-brand-400 mx-auto mb-2" />
            <p className="text-[12px] font-semibold text-surface-300 mb-0.5">{label}</p>
            <p className="text-[10px] text-surface-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
