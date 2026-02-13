import React, { useEffect, useState } from 'react';
import { X, Cpu, Check, Info, AlertCircle, Loader2 } from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import { getModels, type ModelInfo } from '../lib/api';
import { clsx } from 'clsx';

export default function ModelPanel() {
    const state = useStore(appStore);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (state.modelPanelOpen) {
            loadModels();
        }
    }, [state.modelPanelOpen]);

    async function loadModels() {
        setLoading(true);
        setError(null);
        try {
            const data = await getModels();
            setModels(data);
            // Auto-select if none selected
            if (!state.selectedModel && data.length > 0) {
                appStore.setState({ selectedModel: data[0] });
            }
        } catch (err: any) {
            setError(err.message || 'Nepavyko užkrauti modelių');
        } finally {
            setLoading(false);
        }
    }

    if (!state.modelPanelOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={() => appStore.setState({ modelPanelOpen: false })}
            />

            {/* Panel */}
            <div className="relative w-full max-w-md h-full bg-surface-950 border-l border-white/[0.08] shadow-2xl flex flex-col animate-slide-in-right">
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-white/[0.04] bg-surface-950/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <Cpu className="w-5 h-4 text-brand-400" />
                        <h2 className="text-[15px] font-bold text-white uppercase tracking-wider">Pasirinkite modelį</h2>
                    </div>
                    <button
                        onClick={() => appStore.setState({ modelPanelOpen: false })}
                        className="p-2 rounded-xl hover:bg-white/[0.05] text-surface-400 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                            <p className="text-sm text-surface-500">Kraunami OpenRouter modeliai...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-3 text-center">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                            <p className="text-sm text-red-300 font-medium">{error}</p>
                            <button
                                onClick={loadModels}
                                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold uppercase hover:bg-red-500/30 transition-all"
                            >
                                Bandyti vėl
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {models.map((model) => {
                                const isSelected = state.selectedModel?.id === model.id;
                                return (
                                    <button
                                        key={model.id}
                                        onClick={() => {
                                            appStore.setState({ selectedModel: model, modelPanelOpen: false });
                                        }}
                                        className={clsx(
                                            "group relative flex items-center gap-4 px-4 py-2.5 rounded-xl border transition-all duration-200 text-left",
                                            isSelected
                                                ? "bg-brand-500/10 border-brand-500/30"
                                                : "bg-surface-900/40 border-white/[0.04] hover:border-white/[0.1] hover:bg-surface-800/60"
                                        )}
                                    >
                                        {/* Name - flex-1 for max space */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className={clsx(
                                                "text-[13px] font-bold truncate transition-colors",
                                                isSelected ? "text-brand-400" : "text-white"
                                            )}>
                                                {model.name}
                                            </h3>
                                        </div>

                                        {/* Stats Group - Horizontal line */}
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            {/* Context */}
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] uppercase tracking-tighter text-surface-500 font-bold">Ctx</span>
                                                <span className="text-[10px] font-mono text-surface-300">{Math.round(model.context_length / 1000)}k</span>
                                            </div>

                                            {/* Pricing In */}
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] uppercase tracking-tighter text-surface-500 font-bold leading-none mb-0.5">In / 1M</span>
                                                <span className="text-[10px] font-mono text-surface-300">${model.pricing_prompt.toFixed(2)}</span>
                                            </div>

                                            {/* Pricing Out */}
                                            <div className="flex flex-col items-end">
                                                <span className="text-[8px] uppercase tracking-tighter text-surface-500 font-bold leading-none mb-0.5">Out / 1M</span>
                                                <span className="text-[10px] font-mono text-surface-300">${model.pricing_completion.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {/* Selection mark */}
                                        {isSelected && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shadow-glow-brand" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/[0.04] bg-surface-950/30">
                    <p className="text-[11px] text-surface-500 leading-relaxed italic">
                        Modelių sąrašas paimtas tiesiogiai iš OpenRouter. Kainos nurodytos už 1 mln. žetonų.
                    </p>
                </div>
            </div>
        </div>
    );
}
