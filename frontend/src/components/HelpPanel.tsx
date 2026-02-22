// frontend/src/components/HelpPanel.tsx
// Slide-over help panel with documentation, shortcuts, and support info
// Opens from sidebar Help button — overlays main content
// Related: IconSidebar.tsx, store.ts

import { useState, useEffect, useCallback } from 'react';
import {
  X, FileText, Upload, MessageSquare, Download,
  Keyboard, ExternalLink, Mail, BookOpen, Zap,
} from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import Tooltip from './Tooltip';

const WORKFLOW_STEPS = [
  { icon: Upload, title: 'Įkelkite dokumentus', desc: 'PDF, DOCX, XLSX arba ZIP failai — iki 20 failų, maks. 50MB.' },
  { icon: Zap, title: 'AI analizė', desc: 'Sistema automatiškai ištraukia, agreguoja ir vertina duomenis.' },
  { icon: FileText, title: 'Peržiūrėkite ataskaitą', desc: 'Struktūruota ataskaita su visais rastais duomenimis.' },
  { icon: MessageSquare, title: 'Užduokite klausimus', desc: 'Pokalbio funkcija leidžia klausti apie dokumentų turinį.' },
  { icon: Download, title: 'Eksportuokite', desc: 'Atsisiųskite ataskaitą PDF arba DOCX formatu.' },
];

const SHORTCUTS = [
  { keys: 'Alt + N', desc: 'Nauja analizė' },
  { keys: 'Alt + H', desc: 'Istorija' },
  { keys: 'Alt + U', desc: 'Užrašai' },
  { keys: 'Alt + J', desc: 'Naujas užrašas' },
  { keys: 'Alt + ,', desc: 'Nustatymai' },
  { keys: 'Esc', desc: 'Uždaryti panelę / redaktorių' },
];

const SUPPORTED_FORMATS = ['PDF', 'DOCX', 'XLSX', 'PPTX', 'PNG', 'JPG', 'ZIP'];

export default function HelpPanel() {
  const state = useStore(appStore);
  const open = state.helpPanelOpen;
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  // Open: mount DOM then animate in
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    appStore.setState({ helpPanelOpen: false });
  }, []);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, handleClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${animating ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={`relative ml-auto w-full max-w-md h-full bg-surface-950 border-l border-surface-800/60 overflow-y-auto
                       transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
                       ${animating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-surface-950/95 backdrop-blur-lg border-b border-surface-800/40">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-brand-400" />
            <h2 className="text-[16px] font-bold text-surface-100 tracking-tight">Pagalba</h2>
          </div>
          <Tooltip content="Uždaryti pagalbą" side="bottom">
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800/50 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </Tooltip>
        </div>

        <div className="px-6 py-6 space-y-8">
          {/* ── Workflow ──────────────────────────────────── */}
          <section>
            <h3 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest mb-4">
              Kaip naudotis
            </h3>
            <div className="space-y-1">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg hover:bg-surface-800/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <step.icon className="w-4 h-4 text-brand-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-surface-600">{i + 1}.</span>
                      <h4 className="text-[13px] font-semibold text-surface-100">{step.title}</h4>
                    </div>
                    <p className="text-[12px] text-surface-400 mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Supported Formats ────────────────────────── */}
          <section>
            <h3 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest mb-3">
              Palaikomi formatai
            </h3>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_FORMATS.map((fmt) => (
                <span
                  key={fmt}
                  className="px-2.5 py-1 rounded-md bg-surface-800/60 text-[11px] font-bold text-surface-300 border border-surface-700/30"
                >
                  .{fmt}
                </span>
              ))}
            </div>
          </section>

          {/* ── Keyboard Shortcuts ───────────────────────── */}
          <section>
            <h3 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest mb-3">
              Spartieji klavišai
            </h3>
            <div className="enterprise-card p-0 overflow-hidden divide-y divide-surface-700/20">
              {SHORTCUTS.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[12px] text-surface-300 font-medium">{s.desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-surface-800/80 text-[11px] font-mono font-bold text-surface-400 border border-surface-700/40">
                    {s.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </section>

          {/* ── Contact ──────────────────────────────────── */}
          <section>
            <h3 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest mb-3">
              Reikia pagalbos?
            </h3>
            <div className="space-y-2">
              <a
                href="mailto:marcobitx@gmail.com"
                className="flex items-center gap-3 p-3 rounded-lg enterprise-card hover:bg-surface-800/40 transition-colors"
              >
                <Mail className="w-4 h-4 text-brand-400" />
                <div>
                  <p className="text-[13px] font-semibold text-surface-200">Rašykite mums</p>
                  <p className="text-[11px] text-surface-500">marcobitx@gmail.com</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-surface-600 ml-auto" />
              </a>
            </div>
          </section>

          {/* ── Version ──────────────────────────────────── */}
          <div className="pt-4 border-t border-surface-800/40">
            <p className="text-[10px] text-surface-600 font-medium text-center">
              foxDoc v1.0 — Viešųjų pirkimų dokumentų analizatorius
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
