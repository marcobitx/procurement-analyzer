// frontend/src/components/SettingsView.tsx
// Settings page — API key config, model selection, system info
// Full-width layout with logical section hierarchy
// Related: api.ts (getSettings, updateSettings, getModels)

import { useEffect, useState } from 'react';
import {
  Save, Key, Cpu, Loader2, CheckCircle2, Eye, EyeOff,
  Shield, Zap, Server, HardDrive, FileText, Users, Clock,
  Info, ExternalLink, ChevronRight,
} from 'lucide-react';
import { getSettings, updateSettings, getModels, type Settings, type ModelInfo } from '../lib/api';
import CustomSelect from './CustomSelect';

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

  const hasChanges = apiKey || (selectedModel && selectedModel !== settings?.default_model);

  const selectedModelInfo = models.find((m) => m.id === selectedModel);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl animate-fade-in-up">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight">Nustatymai</h1>
        <p className="text-[12px] text-surface-500 mt-1 font-bold uppercase tracking-widest">
          Sistemos konfigūracija ir API prieiga
        </p>
      </div>

      {/* ── Section 1: Connection ─────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full bg-brand-500" />
          <h2 className="text-[13px] font-bold text-surface-400 uppercase tracking-widest">
            Ryšys ir autentifikacija
          </h2>
        </div>

        <div className="enterprise-card p-0 overflow-hidden">
          {/* API Key Row */}
          <div className="p-5 flex flex-col lg:flex-row lg:items-start gap-5">
            <div className="flex items-start gap-3 lg:w-72 flex-shrink-0">
              <Key className="w-4.5 h-4.5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <h3 className="text-[14px] font-bold text-surface-100 tracking-tight">
                  OpenRouter API raktas
                </h3>
                <p className="text-[11px] text-surface-500 mt-0.5 font-medium">
                  Reikalingas LLM užklausoms vykdyti
                </p>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-3">
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

              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${settings?.api_key_set ? 'bg-emerald-400' : 'bg-surface-600'}`} />
                <span className="text-[11px] font-medium text-surface-500">
                  {settings?.api_key_set
                    ? <>Būsena: <span className="text-emerald-400">aktyvus</span> — <span className="font-mono text-surface-400">{settings.api_key_preview}</span></>
                    : <>Būsena: <span className="text-surface-400">nenustatytas</span></>}
                </span>
              </div>
            </div>
          </div>

          {/* Security note */}
          {!settings?.api_key_set && (
            <div className="border-t border-surface-700/30 px-5 py-3 flex items-center gap-2.5 text-[11px] text-brand-400/80 bg-brand-500/5">
              <Shield className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">Raktas saugomas šifruotai — naudojamas tik OpenRouter užklausoms</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: Model Configuration ────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full bg-brand-500" />
          <h2 className="text-[13px] font-bold text-surface-400 uppercase tracking-widest">
            Modelio konfigūracija
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Model Selector — 2/3 width */}
          <div className="lg:col-span-2 enterprise-card p-5">
            <div className="flex items-start gap-3 mb-4">
              <Cpu className="w-4.5 h-4.5 text-brand-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[14px] font-bold text-surface-100 tracking-tight">
                  Numatytasis modelis
                </h3>
                <p className="text-[11px] text-surface-500 mt-0.5 font-medium">
                  Naudojamas dokumentų analizei ir pokalbio atsakymams
                </p>
              </div>
            </div>

            {models.length > 0 ? (
              <CustomSelect
                value={selectedModel}
                onChange={setSelectedModel}
                options={models.map((m) => ({
                  value: m.id,
                  label: `${m.name} (${(m.context_length / 1000).toFixed(0)}k ctx)`,
                }))}
                className="text-[13px]"
              />
            ) : (
              <input
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="anthropic/claude-sonnet-4"
                className="input-field w-full text-[13px] font-mono"
              />
            )}

            {/* Currently active indicator */}
            <div className="flex items-center gap-2 mt-3">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              <span className="text-[11px] font-medium text-surface-500">
                Aktyvus: <span className="text-brand-400 font-mono">{settings?.default_model ? settings.default_model.split('/').pop() : '—'}</span>
              </span>
            </div>
          </div>

          {/* Model Info Card — 1/3 width */}
          <div className="enterprise-card p-5 flex flex-col justify-between">
            <div>
              <h4 className="text-[12px] font-bold text-surface-400 uppercase tracking-widest mb-3">
                Modelio informacija
              </h4>

              {selectedModelInfo ? (
                <div className="space-y-3">
                  <InfoRow
                    icon={Zap}
                    label="Konteksto langas"
                    value={`${(selectedModelInfo.context_length / 1000).toFixed(0)}k tokenų`}
                  />
                  <InfoRow
                    icon={FileText}
                    label="Įvesties kaina"
                    value={`$${selectedModelInfo.pricing_prompt.toFixed(2)} / 1M`}
                  />
                  <InfoRow
                    icon={ChevronRight}
                    label="Išvesties kaina"
                    value={`$${selectedModelInfo.pricing_completion.toFixed(2)} / 1M`}
                  />
                </div>
              ) : (
                <p className="text-[12px] text-surface-500">
                  Pasirinkite modelį, kad pamatytumėte informaciją
                </p>
              )}
            </div>

            <a
              href="https://openrouter.ai/models"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-brand-500 hover:text-brand-400 transition-colors"
            >
              Visi modeliai
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Section 3: System Limits ──────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-4 rounded-full bg-surface-600" />
          <h2 className="text-[13px] font-bold text-surface-500 uppercase tracking-widest">
            Sistemos parametrai
          </h2>
          <span className="text-[10px] text-surface-600 font-medium ml-1">(tik skaitymas)</span>
        </div>

        <div className="enterprise-card p-0 overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-surface-700/30">
            <StatCell
              icon={HardDrive}
              label="Maks. failo dydis"
              value="50 MB"
            />
            <StatCell
              icon={FileText}
              label="Maks. failų skaičius"
              value="20"
            />
            <StatCell
              icon={Users}
              label="Lygiagrečios analizės"
              value="5"
            />
            <StatCell
              icon={Clock}
              label="Dokumento laikas"
              value="120 s"
            />
          </div>
        </div>
      </section>

      {/* ── Save Button ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-surface-600 font-medium">
          {hasChanges ? 'Yra neišsaugotų pakeitimų' : 'Visi pakeitimai išsaugoti'}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="btn-professional"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saugoma...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Išsaugota
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Išsaugoti
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/* ── Helper Components ────────────────────────────────────────────── */

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-surface-500" />
        <span className="text-[12px] text-surface-400">{label}</span>
      </div>
      <span className="text-[12px] font-mono font-medium text-surface-200">{value}</span>
    </div>
  );
}

function StatCell({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="p-4 text-center">
      <Icon className="w-4 h-4 text-surface-500 mx-auto mb-2" />
      <p className="text-[15px] font-bold text-surface-200 mb-0.5">{value}</p>
      <p className="text-[10px] text-surface-500 font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}
