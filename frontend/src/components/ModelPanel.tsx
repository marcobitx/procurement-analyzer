// frontend/src/components/ModelPanel.tsx
// Slide panel for selecting LLM models with search and custom model addition
// All models (API + custom) can be removed; persisted via localStorage
// Related: api.ts, store.ts

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X, Cpu, AlertCircle, Loader2, Search, Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import { getModels, searchAllModels, type ModelInfo } from '../lib/api';
import { useFocusTrap } from '../lib/useFocusTrap';
import { ProviderLogo, getProvider, PROVIDER_COLORS } from './ProviderLogos';
import ScrollText from './ScrollText';
import { clsx } from 'clsx';

const CUSTOM_MODELS_KEY = 'procurement-analyzer:custom-models';
const HIDDEN_MODELS_KEY = 'procurement-analyzer:hidden-models';

function loadCustomModels(): ModelInfo[] {
    try {
        const raw = localStorage.getItem(CUSTOM_MODELS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveCustomModels(models: ModelInfo[]) {
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(models));
}

function loadHiddenIds(): Set<string> {
    try {
        const raw = localStorage.getItem(HIDDEN_MODELS_KEY);
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
        return new Set();
    }
}

function saveHiddenIds(ids: Set<string>) {
    localStorage.setItem(HIDDEN_MODELS_KEY, JSON.stringify([...ids]));
}

export default function ModelPanel() {
    const state = useStore(appStore);
    const [apiModels, setApiModels] = useState<ModelInfo[]>([]);
    const [customModels, setCustomModels] = useState<ModelInfo[]>(() => loadCustomModels());
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => loadHiddenIds());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [visible, setVisible] = useState(false);
    const [animating, setAnimating] = useState(false);
    const trapRef = useFocusTrap<HTMLDivElement>();

    // Search state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ModelInfo[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

    // Visible models = (API - hidden) + (custom - hidden)
    const visibleApiModels = apiModels.filter(m => !hiddenIds.has(m.id));
    const visibleCustomModels = customModels.filter(c => !hiddenIds.has(c.id) && !apiModels.some(a => a.id === c.id));
    const allVisibleModels = [...visibleApiModels, ...visibleCustomModels];
    const customIdSet = new Set(customModels.map(m => m.id));

    // Animate open
    useEffect(() => {
        if (state.modelPanelOpen) {
            setVisible(true);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setAnimating(true));
            });
            loadModels();
        } else if (visible) {
            setAnimating(false);
            const timer = setTimeout(() => {
                setVisible(false);
                setSearchOpen(false);
                setSearchQuery('');
                setSearchResults([]);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [state.modelPanelOpen]);

    async function loadModels() {
        const cached = appStore.getState().cachedModels;
        if (cached && cached.length > 0) {
            setApiModels(cached);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const data = await getModels();
            setApiModels(data);
            appStore.setState({ cachedModels: data });
            if (!state.selectedModel && data.length > 0) {
                appStore.setState({ selectedModel: data[0] });
            }
        } catch (err: any) {
            setError(err.message || 'Nepavyko užkrauti modelių');
        } finally {
            setLoading(false);
        }
    }

    const handleClose = useCallback(() => {
        appStore.setState({ modelPanelOpen: false });
    }, []);

    // Debounced search
    const handleSearch = useCallback((q: string) => {
        setSearchQuery(q);
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

        if (q.trim().length < 2) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                setSearchError(null);
                const results = await searchAllModels(q.trim());
                setSearchResults(results);
            } catch (err: any) {
                setSearchError(err.message || 'Paieška nepavyko');
            } finally {
                setSearching(false);
            }
        }, 400);
    }, []);

    useEffect(() => {
        if (searchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchOpen]);

    useEffect(() => {
        if (!state.modelPanelOpen) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') handleClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [state.modelPanelOpen, handleClose]);

    if (!visible) return null;

    const selectModel = (model: ModelInfo) => {
        appStore.setState({ selectedModel: model });
    };

    const addAndSelectModel = (model: ModelInfo) => {
        // If it was hidden, unhide it
        if (hiddenIds.has(model.id)) {
            const next = new Set(hiddenIds);
            next.delete(model.id);
            setHiddenIds(next);
            saveHiddenIds(next);
        }
        // Add to custom if not an API model
        if (!apiModels.some(m => m.id === model.id) && !customModels.some(m => m.id === model.id)) {
            const updated = [...customModels, model];
            setCustomModels(updated);
            saveCustomModels(updated);
        }
        appStore.setState({ selectedModel: model });
    };

    const removeModel = (e: React.MouseEvent, modelId: string) => {
        e.stopPropagation();

        const isCustom = customIdSet.has(modelId) && !apiModels.some(a => a.id === modelId);

        if (isCustom) {
            // Custom model: delete from localStorage entirely
            const updated = customModels.filter(m => m.id !== modelId);
            setCustomModels(updated);
            saveCustomModels(updated);
        } else {
            // API model: hide it
            const next = new Set(hiddenIds);
            next.add(modelId);
            setHiddenIds(next);
            saveHiddenIds(next);
        }

        // If removed model was selected, fallback
        if (state.selectedModel?.id === modelId) {
            const remaining = allVisibleModels.filter(m => m.id !== modelId);
            appStore.setState({ selectedModel: remaining[0] || null });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className={clsx(
                    "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
                    animating ? "opacity-100" : "opacity-0"
                )}
                onClick={handleClose}
            />

            {/* Panel */}
            <div
                ref={trapRef}
                className={clsx(
                    "relative w-full max-w-lg flex flex-col shadow-2xl",
                    "bg-surface-950 border border-surface-700/60",
                    "my-2 mr-2 rounded-[10px] overflow-hidden",
                    "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    animating
                        ? "translate-x-0 opacity-100"
                        : "translate-x-[105%] opacity-0"
                )}
                role="dialog"
                aria-modal="true"
                aria-label="Modelio pasirinkimas"
            >
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-5 border-b border-surface-700/50 bg-surface-950/80 backdrop-blur-md flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <Cpu className="w-4 h-4 text-brand-400" />
                        <h2 className="text-[14px] font-bold text-white uppercase tracking-wider">Modeliai</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                            <p className="text-sm text-surface-500">Kraunami modeliai...</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-[10px] bg-red-500/10 border border-red-500/20 flex flex-col items-center gap-3 text-center">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                            <p className="text-sm text-red-300 font-medium">{error}</p>
                            <button
                                onClick={loadModels}
                                className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-[12px] font-semibold hover:bg-red-500/30 transition-all"
                            >
                                Bandyti vėl
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* All visible models */}
                            {visibleApiModels.length > 0 && (
                                <div className="grid gap-2">
                                    {visibleApiModels.map((model) => (
                                        <ModelCard
                                            key={model.id}
                                            model={model}
                                            isSelected={state.selectedModel?.id === model.id}
                                            onSelect={selectModel}
                                            onRemove={removeModel}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Custom models section */}
                            {visibleCustomModels.length > 0 && (
                                <>
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="h-px flex-1 bg-surface-700/40" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-surface-500">Pridėti</span>
                                        <div className="h-px flex-1 bg-surface-700/40" />
                                    </div>
                                    <div className="grid gap-2">
                                        {visibleCustomModels.map((model) => (
                                            <ModelCard
                                                key={model.id}
                                                model={model}
                                                isSelected={state.selectedModel?.id === model.id}
                                                onSelect={selectModel}
                                                onRemove={removeModel}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                            {visibleApiModels.length === 0 && visibleCustomModels.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                    <p className="text-sm text-surface-500">Nėra modelių sąraše</p>
                                    <p className="text-[11px] text-surface-600">Pridėkite modelį per paiešką žemiau</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Search / Add Model Section */}
                <div className="border-t border-surface-700/50 bg-surface-900/40 flex-shrink-0">
                    <button
                        onClick={() => setSearchOpen(!searchOpen)}
                        className="w-full flex items-center justify-between px-5 py-3 text-[12px] font-semibold text-surface-400 hover:text-surface-200 transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" />
                            Pridėti modelį iš OpenRouter
                        </span>
                        {searchOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>

                    <div
                        className={clsx(
                            "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                            searchOpen ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0"
                        )}
                    >
                        <div className="px-4 pb-4 space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    placeholder="Ieškoti modelio (pvz. claude, gpt, gemini)..."
                                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-950 border border-surface-700/50 text-[13px] text-surface-100 placeholder-surface-500 focus:outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/10 transition-all"
                                />
                                {searching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-brand-400" />
                                )}
                            </div>

                            {searchError && (
                                <p className="text-[11px] text-red-400 px-1">{searchError}</p>
                            )}

                            {searchResults.length > 0 && (
                                <div className="max-h-[220px] overflow-y-auto space-y-1.5 scrollbar-thin">
                                    {searchResults.map((model) => {
                                        const alreadyVisible = allVisibleModels.some(m => m.id === model.id);
                                        return (
                                            <button
                                                key={model.id}
                                                onClick={() => addAndSelectModel(model)}
                                                className={clsx(
                                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all duration-150",
                                                    alreadyVisible
                                                        ? "bg-brand-500/5 border-brand-500/20 opacity-60"
                                                        : "bg-surface-900/50 border-surface-700/40 hover:border-surface-600/60 hover:bg-surface-800/60"
                                                )}
                                            >
                                                <ProviderLogo modelId={model.id} size={16} />
                                                <div className="flex-1 min-w-0">
                                                    <ScrollText className="text-[12px] font-semibold text-white">{model.name}</ScrollText>
                                                    <ScrollText className="text-[10px] text-surface-500 font-mono">{model.id}</ScrollText>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 text-[9px] text-surface-500">
                                                    <span>{Math.round(model.context_length / 1000)}k</span>
                                                    <span>${model.pricing_prompt.toFixed(2)}</span>
                                                </div>
                                                {alreadyVisible ? (
                                                    <span className="text-[9px] text-brand-400 font-bold flex-shrink-0">SĄRAŠE</span>
                                                ) : (
                                                    <Plus className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && !searchError && (
                                <p className="text-[11px] text-surface-500 text-center py-3">
                                    Modelių nerasta pagal „{searchQuery}"
                                </p>
                            )}

                            {searchQuery.length < 2 && (
                                <p className="text-[11px] text-surface-500 text-center py-2 italic">
                                    Įveskite bent 2 simbolius, kad ieškotumėte
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-surface-700/40 bg-surface-950/50 flex-shrink-0">
                    <p className="text-[10px] text-surface-500 leading-relaxed italic">
                        Modeliai iš OpenRouter. Kainos nurodytos už 1 mln. žetonų.
                    </p>
                </div>
            </div>
        </div>
    );
}

function ModelCard({ model, isSelected, onSelect, onRemove }: {
    model: ModelInfo;
    isSelected: boolean;
    onSelect: (m: ModelInfo) => void;
    onRemove: (e: React.MouseEvent, id: string) => void;
}) {
    const provider = getProvider(model.id);
    const brandColor = PROVIDER_COLORS[provider] || '#8d8076';

    return (
        <button
            onClick={() => onSelect(model)}
            className={clsx(
                "group relative flex items-center gap-3 pr-3.5 pl-4 py-2.5 rounded-[10px] border transition-all duration-200 text-left overflow-hidden",
                isSelected
                    ? "bg-surface-800/60 border-brand-500/40"
                    : "bg-surface-900/40 border-surface-700/50 hover:border-surface-600/70 hover:bg-surface-800/60"
            )}
        >
            {/* Left accent bar */}
            <div
                className={clsx(
                    "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[10px] transition-all duration-200",
                    isSelected ? "opacity-100" : "opacity-0"
                )}
                style={{ backgroundColor: brandColor }}
            />

            {/* Provider logo */}
            <ProviderLogo modelId={model.id} size={20} />

            {/* Name */}
            <div className="flex-1 min-w-0">
                <ScrollText className="text-[13px] font-bold text-white">
                    {model.name}
                </ScrollText>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex flex-col items-end">
                    <span className="text-[8px] uppercase tracking-tighter text-surface-500 font-bold">Ctx</span>
                    <span className="text-[10px] font-mono text-surface-300">{Math.round(model.context_length / 1000)}k</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[8px] uppercase tracking-tighter text-surface-500 font-bold leading-none mb-0.5">In / 1M</span>
                    <span className="text-[10px] font-mono text-surface-300">${model.pricing_prompt.toFixed(2)}</span>
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-[8px] uppercase tracking-tighter text-surface-500 font-bold leading-none mb-0.5">Out / 1M</span>
                    <span className="text-[10px] font-mono text-surface-300">${model.pricing_completion.toFixed(2)}</span>
                </div>
            </div>

            {/* Delete */}
            <div className="flex items-center flex-shrink-0">
                <div
                    onClick={(e) => onRemove(e, model.id)}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-surface-500 hover:text-red-400 transition-all cursor-pointer"
                    title="Pašalinti modelį"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </div>
            </div>
        </button>
    );
}
