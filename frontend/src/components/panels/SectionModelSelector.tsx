// frontend/src/components/panels/SectionModelSelector.tsx
// Compact model selector card shown in the right panel
// Shows provider logo, full model name with brand color, and pricing
// Related: ModelPanel.tsx, ProviderLogos.tsx, store.ts

import { ChevronRight, Sparkles } from 'lucide-react';
import { appStore, useStore } from '../../lib/store';
import { ProviderLogo } from '../ProviderLogos';

export default function SectionModelSelector() {
  const state = useStore(appStore);
  const m = state.selectedModel;

  return (
    <div className="p-4 bg-transparent">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <h3 className="text-[11px] font-bold text-surface-500 uppercase tracking-widest">Modelis</h3>
        </div>
        <button
          onClick={() => appStore.setState({ modelPanelOpen: true })}
          className="text-[10px] text-brand-400 hover:text-brand-300 font-bold uppercase tracking-tight transition-colors flex items-center gap-1 group"
        >
          Keisti
          <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <button
        onClick={() => appStore.setState({ modelPanelOpen: true })}
        className="w-full text-left p-3 rounded-xl border border-surface-700/50 bg-surface-900/40 hover:bg-surface-800/50 hover:border-surface-600/60 transition-all group overflow-hidden"
      >
        {/* Left accent stripe */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {m ? <ProviderLogo modelId={m.id} size={24} /> : (
              <span className="text-[14px] font-bold text-surface-500">?</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="text-[13px] font-bold leading-tight transition-colors text-surface-50"
            >
              {m ? m.name : 'Nepasirinkta'}
            </p>
            {m && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded text-brand-400 bg-brand-500/5 border border-brand-500/10">
                  {Math.round(m.context_length / 1000)}k ctx
                </span>
                <span className="text-surface-700">·</span>
                <span className="text-[10px] font-mono text-surface-400">
                  <span className="text-surface-600">IN:</span> ${m.pricing_prompt.toFixed(2)}/1M
                </span>
                <span className="text-surface-700">·</span>
                <span className="text-[10px] font-mono text-surface-400">
                  <span className="text-surface-600">OUT:</span> ${m.pricing_completion.toFixed(2)}/1M
                </span>
              </div>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
