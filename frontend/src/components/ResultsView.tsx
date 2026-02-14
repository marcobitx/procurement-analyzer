// frontend/src/components/ResultsView.tsx
// Analysis report display — unified card with numbered sections and dividers
// Right sidebar content (source docs, QA missing) moved to RightPanel.tsx
// Related: api.ts, RightPanel.tsx, App.tsx

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  ShieldCheck,
  Loader2,
  Clock,
  Coins,
  BookOpen,
  Hash,
  Building2,
  CalendarClock,
  BadgeEuro,
  Tag,
} from 'lucide-react';
import { getAnalysis, exportAnalysis, type Analysis } from '../lib/api';
import { appStore } from '../lib/store';

interface Props {
  analysisId: string;
  onBack: () => void;
}

export default function ResultsView({ analysisId, onBack }: Props) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    // Use cached analysis if ID matches
    const cached = appStore.getState().cachedAnalysis;
    if (cached && cached.id === analysisId) {
      setAnalysis(cached.data);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await getAnalysis(analysisId);
        setAnalysis(data);
        appStore.setState({ cachedAnalysis: { id: analysisId, data } });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [analysisId]);

  const handleExport = async (format: 'pdf' | 'docx') => {
    setExporting(format);
    setExportError(null);
    try {
      const blob = await exportAnalysis(analysisId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ataskaita.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setExportError(e.message || 'Nepavyko eksportuoti ataskaitos');
    } finally {
      setExporting(null);
    }
  };

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
        <button onClick={onBack} className="btn-secondary-professional">Grįžti</button>
      </div>
    );
  }

  const r = analysis.report;
  const qa = analysis.qa;
  const metrics = analysis.metrics;

  const qaScore = qa?.completeness_score ?? 0;
  const qaLevel = qaScore >= 80 ? 'success' : qaScore >= 50 ? 'warning' : 'error';
  const qaColors = {
    success: { text: 'text-emerald-500', bg: 'bg-emerald-500/5', ring: 'ring-emerald-500/10', bar: 'bg-emerald-500' },
    warning: { text: 'text-brand-500', bg: 'bg-brand-500/5', ring: 'ring-brand-500/10', bar: 'bg-brand-500' },
    error: { text: 'text-red-500', bg: 'bg-red-500/5', ring: 'ring-red-500/10', bar: 'bg-red-500' },
  }[qaLevel];

  // ── Metric cards data ─────────────────────────────────────────────

  const metricCards = [
    { icon: BookOpen, label: 'Puslapiai', value: metrics?.total_pages || '—', color: 'text-brand-400' },
    { icon: Hash, label: 'Tokenai', value: metrics?.total_tokens ? `${(metrics.total_tokens / 1000).toFixed(1)}k` : '—', color: 'text-brand-400' },
    { icon: Clock, label: 'Laikas', value: metrics?.elapsed_seconds ? `${metrics.elapsed_seconds.toFixed(0)}s` : '—', color: 'text-brand-400' },
    { icon: Coins, label: 'Kaina', value: metrics?.total_cost ? `$${metrics.total_cost.toFixed(3)}` : '—', color: 'text-brand-400' },
  ];

  // ── Build numbered sections (only those with data) ────────────────

  type SectionDef = { title: string; render: () => React.ReactNode };
  const sections: SectionDef[] = [];

  const sRefs: SourceRef[] = r.source_references || [];

  // 1. Projekto santrauka (always has data if report exists)
  sections.push({
    title: 'Projekto santrauka',
    render: () => (
      <>
        <InfoRow label="Pavadinimas" value={r.project_name} sourceRefs={sRefs} fieldKey="project_name" />
        <InfoRow label="Pirkimo tipas" value={r.procurement_type} sourceRefs={sRefs} fieldKey="procurement_type" />
        <InfoRow label="Pirkimo būdas" value={r.procurement_method} sourceRefs={sRefs} fieldKey="procurement_method" />
        {r.procuring_organization && (
          <>
            <InfoRow label="Organizacija" value={r.procuring_organization.name} sourceRefs={sRefs} fieldKey="procuring_organization" />
            <InfoRow label="Kodas" value={r.procuring_organization.code} sourceRefs={sRefs} fieldKey="organization.code" />
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
            sourceRefs={sRefs}
            fieldKey="estimated_value"
          />
        )}
        {r.contract_duration && <InfoRow label="Trukmė" value={r.contract_duration} sourceRefs={sRefs} fieldKey="contract_duration" />}
      </>
    ),
  });

  // 2. Terminai
  if (r.deadlines) {
    sections.push({
      title: 'Terminai',
      render: () => (
        <>
          <InfoRow label="Pasiūlymų pateikimas" value={r.deadlines.submission_deadline} sourceRefs={sRefs} fieldKey="submission_deadline" />
          <InfoRow label="Klausimų pateikimas" value={r.deadlines.questions_deadline} sourceRefs={sRefs} fieldKey="questions_deadline" />
          <InfoRow label="Vokų atplėšimas" value={r.deadlines.opening_date} sourceRefs={sRefs} fieldKey="opening_date" />
          <InfoRow label="Galiojimo laikotarpis" value={r.deadlines.validity_period} sourceRefs={sRefs} fieldKey="validity_period" />
        </>
      ),
    });
  }

  // 3. Pagrindiniai reikalavimai
  if (r.key_requirements?.length > 0) {
    const reqRefs = findRefs(sRefs, 'key_requirements');
    sections.push({
      title: 'Pagrindiniai reikalavimai',
      render: () => (
        <>
          <ul className="space-y-2">
            {r.key_requirements.map((req: string, i: number) => (
              <li key={i} className="flex gap-2.5 text-[13px] text-surface-300 leading-relaxed">
                <span className="text-accent-400 mt-0.5 flex-shrink-0">&#9656;</span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
          {reqRefs.length > 0 && <SourceRefBadge refs={reqRefs} />}
        </>
      ),
    });
  }

  // 4. Kvalifikacijos reikalavimai
  if (r.qualification_requirements) {
    const cats = (['financial', 'technical', 'professional'] as const).filter(
      (cat) => r.qualification_requirements[cat]?.length > 0,
    );
    if (cats.length > 0) {
      const qualRefs = findRefs(sRefs, 'qualification');
      sections.push({
        title: 'Kvalifikacijos reikalavimai',
        render: () => (
          <>
            {cats.map((cat) => {
              const items = r.qualification_requirements[cat];
              const labels = { financial: 'Finansiniai', technical: 'Techniniai', professional: 'Profesiniai' };
              return (
                <div key={cat} className="mb-4 last:mb-0">
                  <p className="text-[11px] font-bold text-accent-400/80 uppercase tracking-wider mb-2">
                    {labels[cat]}
                  </p>
                  {items.map((q: string, i: number) => (
                    <p key={i} className="text-[13px] text-surface-300 ml-3 mb-1 leading-relaxed">
                      &bull; {q}
                    </p>
                  ))}
                </div>
              );
            })}
            {qualRefs.length > 0 && <SourceRefBadge refs={qualRefs} />}
          </>
        ),
      });
    }
  }

  // 5. Vertinimo kriterijai
  if (r.evaluation_criteria?.length > 0) {
    const evalRefs = findRefs(sRefs, 'evaluation_criteria');
    sections.push({
      title: 'Vertinimo kriterijai',
      render: () => (
        <>
          <div className="space-y-2">
            {r.evaluation_criteria.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-surface-700/30 last:border-0">
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
          {evalRefs.length > 0 && <SourceRefBadge refs={evalRefs} />}
        </>
      ),
    });
  }

  // 6. Dalys
  if (r.lots?.length > 0) {
    sections.push({
      title: `Dalys (${r.lots.length})`,
      render: () => (
        <>
          {r.lots.map((lot: any, i: number) => (
            <div key={i} className="py-3 border-b border-surface-700/30 last:border-0">
              <p className="text-[13px] font-semibold text-surface-200">
                {lot.number ? `Dalis ${lot.number}: ` : ''}{lot.title || lot.name || 'Be pavadinimo'}
              </p>
              {lot.description && <p className="text-[12px] text-surface-400 mt-1 leading-relaxed">{lot.description}</p>}
              {lot.estimated_value && <p className="text-[12px] font-mono text-accent-400 mt-1">&euro;{lot.estimated_value.toLocaleString()}</p>}
            </div>
          ))}
        </>
      ),
    });
  }

  // 7. Specialiosios sąlygos
  if (r.special_conditions?.length > 0) {
    sections.push({
      title: 'Specialiosios sąlygos',
      render: () => (
        <ul className="space-y-1.5">
          {r.special_conditions.map((c: string, i: number) => (
            <li key={i} className="text-[13px] text-surface-300 leading-relaxed">&bull; {c}</li>
          ))}
        </ul>
      ),
    });
  }

  // 8. Pastabos
  if (r.confidence_notes?.length > 0) {
    sections.push({
      title: 'Pastabos',
      render: () => (
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
      ),
    });
  }

  return (
    <div className="animate-fade-in-up">
      {/* ── Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-surface-400 hover:text-white hover:bg-white/[0.05] border border-surface-700/40 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {r.project_title || r.project_name || 'Analizės ataskaita'}
            </h1>
            <p className="text-[11px] text-surface-500 mt-1 font-bold uppercase tracking-widest">
              {analysis.file_count} dokumentai · {r.procurement_type || 'Viešasis pirkimas'}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {(['pdf', 'docx'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={exporting === fmt}
                className="btn-secondary-professional"
              >
                {exporting === fmt ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
          {exportError && (
            <p className="text-[12px] text-red-400 animate-fade-in">{exportError}</p>
          )}
        </div>
      </div>

      {/* ── QA Score ──────────────────────────────────────────── */}
      {qa && (
        <div className={`enterprise-card p-5 mb-5 flex items-center gap-5 ${qaColors.bg} border-brand-500/10`}>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {metricCards.map((m) => {
            const MIcon = m.icon;
            return (
              <div key={m.label} className="enterprise-card px-5 py-4 flex items-center gap-4">
                <MIcon className="w-5 h-5 text-brand-400 flex-shrink-0" />
                <div>
                  <p className="text-[16px] font-bold text-surface-100 tracking-tight">{m.value}</p>
                  <p className="text-[10px] text-surface-500 font-bold uppercase tracking-wider">{m.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Key Info Card ─────────────────────────────────────── */}
      <div className="enterprise-card p-6 mb-6">
        <h2 className="text-[13px] font-bold text-surface-400 uppercase tracking-widest mb-4">Pagrindinė informacija</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          <KeyInfoRow icon={FileText} label="Projekto pavadinimas" value={r.project_title || r.project_name} />
          <KeyInfoRow icon={Building2} label="Perkančioji organizacija" value={r.procuring_organization?.name} />
          <KeyInfoRow icon={BadgeEuro} label="Projekto vertė" value={
            r.estimated_value?.amount
              ? `€${r.estimated_value.amount.toLocaleString('lt-LT')} ${r.estimated_value.vat_included ? '(su PVM)' : r.estimated_value.vat_included === false ? '(be PVM)' : ''}`
              : null
          } />
          <KeyInfoRow icon={CalendarClock} label="Dokumentų pateikimo terminas" value={r.deadlines?.submission_deadline} />
          <KeyInfoRow icon={Tag} label="CVP kodas" value={r.procurement_reference} />
          <KeyInfoRow icon={Hash} label="CPV kodai" value={r.cpv_codes?.length ? r.cpv_codes.join('; ') : null} />
        </div>
      </div>

      {/* ── Unified Report Card — Numbered Sections ────────────── */}
      <div className="enterprise-card overflow-hidden">
        {sections.map((section, idx) => (
          <div key={idx}>
            <div className="px-6 py-5">
              <h2 className="text-[15px] font-bold text-surface-50 tracking-tight mb-4">
                <span className="text-brand-400 mr-2">{idx + 1}.</span>
                {section.title}
              </h2>
              {section.render()}
            </div>
            {idx < sections.length - 1 && <hr className="divider" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

interface SourceRef {
  field: string;
  quote: string;
  page?: number | null;
  section?: string | null;
  filename?: string | null;
}

function SourceRefBadge({ refs }: { refs: SourceRef[] }) {
  const [open, setOpen] = useState(false);
  if (!refs.length) return null;
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-brand-400 hover:text-brand-300 transition-colors"
      >
        {open ? '\u25BE' : '\u25B8'} \u0160altinis ({refs.length})
      </button>
      {open && refs.map((ref, i) => (
        <blockquote key={i} className="mt-1 pl-3 border-l-2 border-brand-500/30 text-[11px] italic text-surface-400">
          &ldquo;{ref.quote}&rdquo;
          {ref.page && <span className="not-italic text-surface-500 ml-2">&mdash; psl. {ref.page}</span>}
          {ref.filename && <span className="not-italic text-surface-600 ml-1">({ref.filename})</span>}
        </blockquote>
      ))}
    </div>
  );
}

function findRefs(sourceRefs: SourceRef[] | undefined, fieldPattern: string): SourceRef[] {
  if (!sourceRefs?.length) return [];
  return sourceRefs.filter((ref) => ref.field?.toLowerCase().includes(fieldPattern.toLowerCase()));
}

function KeyInfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="w-4.5 h-4.5 text-brand-400 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] text-surface-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-[14px] text-surface-100 font-semibold mt-0.5 break-words">
          {value || <span className="text-surface-600 font-normal italic">Nenurodyta</span>}
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value, sourceRefs, fieldKey }: { label: string; value: any; sourceRefs?: SourceRef[]; fieldKey?: string }) {
  if (!value) return null;
  const refs = fieldKey ? findRefs(sourceRefs, fieldKey) : [];
  return (
    <div className="flex flex-col py-2">
      <div className="flex items-start gap-3">
        <span className="text-[12px] text-surface-500 min-w-[110px] flex-shrink-0 font-medium">{label}</span>
        <span className="text-[13px] text-surface-200">{String(value)}</span>
      </div>
      {refs.length > 0 && <div className="ml-[122px]"><SourceRefBadge refs={refs} /></div>}
    </div>
  );
}
