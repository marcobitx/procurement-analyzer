// frontend/src/components/ResultsView.tsx
// Analysis report display — structured sections with collapsible panels
// Right sidebar content (source docs, QA missing) moved to RightPanel.tsx
// Related: api.ts, RightPanel.tsx, App.tsx

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Building2,
  Calendar,
  FileText,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Layers,
  Clock,
  Coins,
  BookOpen,
  Hash,
  TrendingUp,
  Info,
} from 'lucide-react';
import { getAnalysis, exportAnalysis, type Analysis } from '../lib/api';

interface Props {
  analysisId: string;
  onBack: () => void;
}

export default function ResultsView({ analysisId, onBack }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(['summary', 'requirements', 'qualification', 'evaluation']),
  );

  useEffect(() => {
    (async () => {
      try {
        setAnalysis(await getAnalysis(analysisId));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [analysisId]);

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(format);
    try {
      const blob = await exportAnalysis(analysisId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ataskaita.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(null);
    }
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  // ── Loading / Empty states ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        <span className="text-[13px] text-surface-500">Kraunama ataskaita...</span>
      </div>
    );
  }

  if (!analysis?.report) {
    return (
      <div className="text-center py-20">
        <FileText className="w-10 h-10 mx-auto mb-4 text-surface-600" />
        <p className="text-surface-400 text-[15px] mb-4">Ataskaita nerasta</p>
        <button onClick={onBack} className="btn-secondary">Grįžti</button>
      </div>
    );
  }

  const r = analysis.report;
  const qa = analysis.qa;
  const metrics = analysis.metrics;

  const qaScore = qa?.completeness_score ?? 0;
  const qaLevel = qaScore >= 80 ? 'success' : qaScore >= 50 ? 'warning' : 'error';
  const qaColors = {
    success: { text: 'text-emerald-400', bg: 'bg-emerald-500/8', ring: 'ring-emerald-500/15', bar: 'bg-emerald-500' },
    warning: { text: 'text-amber-400', bg: 'bg-amber-500/8', ring: 'ring-amber-500/15', bar: 'bg-amber-500' },
    error: { text: 'text-red-400', bg: 'bg-red-500/8', ring: 'ring-red-500/15', bar: 'bg-red-500' },
  }[qaLevel];

  // ── Metric cards data ─────────────────────────────────────────────

  const metricCards = [
    { icon: BookOpen, label: 'Puslapiai', value: metrics?.total_pages || '—', color: 'text-blue-400' },
    { icon: Hash, label: 'Tokenai', value: metrics?.total_tokens ? `${(metrics.total_tokens / 1000).toFixed(1)}k` : '—', color: 'text-brand-400' },
    { icon: Clock, label: 'Laikas', value: metrics?.elapsed_seconds ? `${metrics.elapsed_seconds.toFixed(0)}s` : '—', color: 'text-cyan-400' },
    { icon: Coins, label: 'Kaina', value: metrics?.total_cost ? `$${metrics.total_cost.toFixed(3)}` : '—', color: 'text-accent-400' },
  ];

  return (
    <div className="animate-fade-in-up">
      {/* ── Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-surface-500 hover:text-surface-200 hover:bg-surface-700/40 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-surface-50 tracking-tighter">
              {r.project_name || 'Analizės ataskaita'}
            </h1>
            <p className="text-[12px] text-surface-500 mt-0.5">
              {analysis.file_count} dokumentai · {r.procurement_type || 'Viešasis pirkimas'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(['pdf', 'docx'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => handleExport(fmt)}
              disabled={exporting === fmt}
              className="btn-secondary flex items-center gap-2 text-[13px]"
            >
              {exporting === fmt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── QA Score ──────────────────────────────────────────── */}
      {qa && (
        <div className={`glass-card p-5 mb-5 flex items-center gap-5 ${qaColors.bg} ring-1 ${qaColors.ring}`}>
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                className="text-surface-700/30" />
              <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3"
                className={qaColors.text}
                strokeDasharray={`${qaScore} ${100 - qaScore}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease-out' }} />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-[13px] font-bold ${qaColors.text}`}>
              {qaScore}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-surface-100">Kokybės balas</p>
            <p className="text-[12px] text-surface-400 mt-0.5 truncate">
              {qa.summary || 'Automatinis QA vertinimas pagal pilnumą ir tikslumą'}
            </p>
          </div>
          <ShieldCheck className={`w-5 h-5 ${qaColors.text} flex-shrink-0`} />
        </div>
      )}

      {/* ── Metrics ───────────────────────────────────────────── */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {metricCards.map((m) => {
            const MIcon = m.icon;
            return (
              <div key={m.label} className="glass-card px-4 py-3.5 flex items-center gap-3">
                <MIcon className={`w-4 h-4 ${m.color} flex-shrink-0`} />
                <div>
                  <p className="text-[15px] font-bold text-surface-100 tracking-tight">{m.value}</p>
                  <p className="text-[10px] text-surface-500 font-semibold uppercase tracking-wider">{m.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Report Sections (full width, no sidebar) ──────────── */}
      <div className="space-y-4">
        {/* Summary */}
        <Section title="Projekto santrauka" icon={FileText} sectionKey="summary" expanded={expanded.has('summary')} onToggle={toggle}>
          <InfoRow label="Pavadinimas" value={r.project_name} />
          <InfoRow label="Pirkimo tipas" value={r.procurement_type} />
          <InfoRow label="Pirkimo būdas" value={r.procurement_method} />
          {r.procuring_organization && (
            <>
              <InfoRow label="Organizacija" value={r.procuring_organization.name} />
              <InfoRow label="Kodas" value={r.procuring_organization.code} />
            </>
          )}
          {r.estimated_value && (
            <InfoRow
              label="Vertė"
              value={
                r.estimated_value.amount
                  ? `€${r.estimated_value.amount.toLocaleString()} ${r.estimated_value.with_vat ? '(su PVM)' : '(be PVM)'}`
                  : null
              }
            />
          )}
          {r.contract_duration && <InfoRow label="Trukmė" value={r.contract_duration} />}
        </Section>

        {/* Deadlines */}
        {r.deadlines && (
          <Section title="Terminai" icon={Calendar} sectionKey="deadlines" expanded={expanded.has('deadlines')} onToggle={toggle}>
            <InfoRow label="Pasiūlymų pateikimas" value={r.deadlines.submission_deadline} />
            <InfoRow label="Klausimų pateikimas" value={r.deadlines.questions_deadline} />
            <InfoRow label="Vokų atplėšimas" value={r.deadlines.opening_date} />
            <InfoRow label="Galiojimo laikotarpis" value={r.deadlines.validity_period} />
          </Section>
        )}

        {/* Key requirements */}
        {r.key_requirements?.length > 0 && (
          <Section title="Pagrindiniai reikalavimai" icon={FileText} sectionKey="requirements" expanded={expanded.has('requirements')} onToggle={toggle}>
            <ul className="space-y-2">
              {r.key_requirements.map((req: string, i: number) => (
                <li key={i} className="flex gap-2.5 text-[13px] text-surface-300 leading-relaxed">
                  <span className="text-accent-400 mt-0.5 flex-shrink-0">▸</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Qualification requirements */}
        {r.qualification_requirements && (
          <Section title="Kvalifikacijos reikalavimai" icon={ShieldCheck} sectionKey="qualification" expanded={expanded.has('qualification')} onToggle={toggle}>
            {(['financial', 'technical', 'professional'] as const).map((cat) => {
              const items = r.qualification_requirements[cat];
              if (!items?.length) return null;
              const labels = { financial: 'Finansiniai', technical: 'Techniniai', professional: 'Profesiniai' };
              return (
                <div key={cat} className="mb-4 last:mb-0">
                  <p className="text-[11px] font-bold text-accent-400/80 uppercase tracking-wider mb-2">
                    {labels[cat]}
                  </p>
                  {items.map((q: string, i: number) => (
                    <p key={i} className="text-[13px] text-surface-300 ml-3 mb-1 leading-relaxed">
                      • {q}
                    </p>
                  ))}
                </div>
              );
            })}
          </Section>
        )}

        {/* Evaluation criteria */}
        {r.evaluation_criteria?.length > 0 && (
          <Section title="Vertinimo kriterijai" icon={TrendingUp} sectionKey="evaluation" expanded={expanded.has('evaluation')} onToggle={toggle}>
            <div className="space-y-2">
              {r.evaluation_criteria.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <span className="text-[13px] text-surface-300">{c.name || c.criterion}</span>
                  <div className="flex items-center gap-2">
                    {c.weight != null && (
                      <>
                        <div className="w-20 h-1.5 rounded-full bg-surface-700/40 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-600"
                            style={{ width: `${Math.min(c.weight, 100)}%`, transition: 'width 1s ease-out' }}
                          />
                        </div>
                        <span className="text-[12px] font-mono font-semibold text-accent-400 w-10 text-right">
                          {c.weight}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Lots */}
        {r.lots?.length > 0 && (
          <Section title={`Dalys (${r.lots.length})`} icon={Layers} sectionKey="lots" expanded={expanded.has('lots')} onToggle={toggle}>
            {r.lots.map((lot: any, i: number) => (
              <div key={i} className="py-3 border-b border-white/[0.03] last:border-0">
                <p className="text-[13px] font-semibold text-surface-200">
                  {lot.number ? `Dalis ${lot.number}: ` : ''}{lot.title || lot.name || 'Be pavadinimo'}
                </p>
                {lot.description && <p className="text-[12px] text-surface-400 mt-1 leading-relaxed">{lot.description}</p>}
                {lot.estimated_value && <p className="text-[12px] font-mono text-accent-400 mt-1">€{lot.estimated_value.toLocaleString()}</p>}
              </div>
            ))}
          </Section>
        )}

        {/* Special conditions */}
        {r.special_conditions?.length > 0 && (
          <Section title="Specialiosios sąlygos" icon={Info} sectionKey="conditions" expanded={expanded.has('conditions')} onToggle={toggle}>
            <ul className="space-y-1.5">
              {r.special_conditions.map((c: string, i: number) => (
                <li key={i} className="text-[13px] text-surface-300 leading-relaxed">• {c}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Confidence notes */}
        {r.confidence_notes?.length > 0 && (
          <Section title="Pastabos" icon={AlertTriangle} sectionKey="notes" expanded={expanded.has('notes')} onToggle={toggle}>
            <div className="space-y-2">
              {r.confidence_notes.map((note: any, i: number) => {
                const severity = typeof note === 'string' ? 'info' : note.severity || 'info';
                const text = typeof note === 'string' ? note : note.text || note.note;
                const styles: Record<string, string> = {
                  info: 'bg-blue-500/6 border-blue-500/12 text-blue-300',
                  warning: 'bg-amber-500/6 border-amber-500/12 text-amber-300',
                  conflict: 'bg-red-500/6 border-red-500/12 text-red-300',
                };
                return (
                  <div key={i} className={`text-[13px] px-3.5 py-2.5 rounded-xl border leading-relaxed ${styles[severity] || styles.info}`}>
                    {text}
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Section({
  title, icon: Icon, sectionKey, expanded, onToggle, children,
}: {
  title: string; icon: any; sectionKey: string;
  expanded: boolean; onToggle: (key: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => onToggle(sectionKey)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors"
      >
        <Icon className="w-4 h-4 text-accent-400" />
        <span className="text-[14px] font-bold text-surface-200 flex-1 text-left tracking-tight">
          {title}
        </span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-surface-600" />
          : <ChevronDown className="w-4 h-4 text-surface-600" />}
      </button>
      {expanded && (
        <div className="px-5 pb-5 pt-1 border-t border-white/[0.03]">
          {children}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-[12px] text-surface-500 min-w-[110px] flex-shrink-0 font-medium">{label}</span>
      <span className="text-[13px] text-surface-200">{String(value)}</span>
    </div>
  );
}
