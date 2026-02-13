// frontend/src/components/SettingsView.tsx
// Settings page — API key config and model selection
// Clean form layout with card-based sections
// Related: api.ts (getSettings, updateSettings, getModels)

import { useEffect, useState } from 'react';
import { Save, Key, Cpu, Loader2, CheckCircle2, Eye, EyeOff, Shield } from 'lucide-react';
import { getSettings, updateSettings, getModels, type Settings, type ModelInfo } from '../lib/api';

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, m] = await Promise.all([getSettings(), getModels()]);
        setSettings(s);
        setModels(m);
        setSelectedModel(s.default_model);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const update: any = {};
      if (selectedModel && selectedModel !== settings?.default_model) update.default_model = selectedModel;
      if (apiKey) update.openrouter_api_key = apiKey;
      if (Object.keys(update).length) {
        const result = await updateSettings(update);
        setSettings(result);
        setApiKey('');
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto animate-fade-in-up">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white tracking-tight">Nustatymai</h1>
        <p className="text-[12px] text-surface-500 mt-1.5 font-bold uppercase tracking-widest">Konfigūruokite API prieigą ir modelį</p>
      </div>

      <div className="space-y-5">
        {/* ── API Key ─────────────────────────────────────────── */}
        <div className="enterprise-card p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center flex-shrink-0 border border-white/[0.04]">
              <Key className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-surface-100 tracking-tight">
                OpenRouter API raktas
              </h3>
              <p className="text-[12px] text-surface-500 mt-0.5 font-medium">
                {settings?.api_key_set
                  ? <>Aktyvus: <span className="font-mono text-brand-400/80">{settings.api_key_preview}</span></>
                  : 'Nenustatytas — reikalingas sistemos veikimui'}
              </p>
            </div>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="input-field w-full pr-11 font-mono text-[13px]"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-surface-500 hover:text-surface-300 transition-colors"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {!settings?.api_key_set && (
            <div className="mt-5 flex items-start gap-2.5 text-[12px] text-brand-400/80 bg-brand-500/5 p-3 rounded-xl border border-brand-500/10">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span className="font-medium">Jūsų API raktas yra saugus — jis naudojamas tik užklausoms į OpenRouter ir niekada neišsaugomas viešai</span>
            </div>
          )}
        </div>

        {/* ── Model Selection ────────────────────────────────── */}
        <div className="enterprise-card p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center flex-shrink-0 border border-white/[0.04]">
              <Cpu className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-surface-100 tracking-tight">
                Numatytasis modelis
              </h3>
              <p className="text-[11px] text-surface-500 mt-1 uppercase font-bold tracking-widest leading-none">
                Aktyvus: <span className="text-brand-500 font-mono inline-block">{settings?.default_model ? settings.default_model.split('/').pop() : '—'}</span>
              </p>
            </div>
          </div>

          {models.length > 0 ? (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="input-field w-full text-[13px] cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({(m.context_length / 1000).toFixed(0)}k ctx)
                </option>
              ))}
            </select>
          ) : (
            <input
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              placeholder="anthropic/claude-sonnet-4"
              className="input-field w-full text-[13px] font-mono"
            />
          )}
        </div>

        {/* ── Save Button ────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={saving || (!apiKey && selectedModel === settings?.default_model)}
          className="btn-professional w-full py-4 text-[15px]"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saugoma...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Išsaugota sėkmingai
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Išsaugoti konfigūraciją
            </>
          )}
        </button>
      </div>
    </div>
  );
}
