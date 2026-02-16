// frontend/src/components/ResultsView.tsx
// Analysis report display — unified card with numbered sections matching PDF export
// All 17 PDF sections are displayed with full detail
// Related: api.ts, ResultsPanel.tsx, App.tsx

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
  AlertTriangle,
  CheckCircle2,
  Info,
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

  const qaScore = qa?.completeness_score != null
    ? (qa.completeness_score <= 1 ? Math.round(qa.completeness_score * 100) : Math.round(qa.completeness_score))
    : 0;
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

  // ── Helper: format estimated value ────────────────────────────────

  const formatValue = (ev: any) => {
    if (!ev?.amount) return null;
    const amt = ev.amount.toLocaleString('lt-LT');
    const cur = ev.currency || 'EUR';
    let suffix = '';
    if (ev.vat_included === true) suffix = ' (su PVM)';
    else if (ev.vat_included === false) suffix = ' (be PVM)';
    let result = `${amt} ${cur}${suffix}`;
    if (ev.vat_amount != null) result += `, PVM: ${ev.vat_amount.toLocaleString('lt-LT')} ${cur}`;
    return result;
  };

  // ── Helper: format org address ────────────────────────────────────

  const formatOrgAddress = (org: any) => {
    return [org.address, org.city, org.country].filter(Boolean).join(', ') || null;
  };

  const formatOrgContacts = (org: any) => {
    const parts: string[] = [];
    if (org.contact_person) parts.push(org.contact_person);
    if (org.phone) parts.push(`Tel: ${org.phone}`);
    if (org.email) parts.push(`El. paštas: ${org.email}`);
    if (org.website) parts.push(`Svetainė: ${org.website}`);
    return parts.length ? parts.join('; ') : null;
  };

  // ── Build numbered sections matching PDF export ────────────────────

  type SectionDef = { title: string; render: () => React.ReactNode };
  const sections: SectionDef[] = [];
  const sRefs: SourceRef[] = r.source_references || [];

  // 1. Projekto santrauka
  if (r.project_summary) {
    sections.push({
      title: 'Projekto santrauka',
      render: () => (
        <>
          <p className="text-[13px] text-surface-300 leading-relaxed whitespace-pre-line">{r.project_summary}</p>
          {r.nuts_codes?.length > 0 && (
            <InfoRow label="NUTS kodai" value={r.nuts_codes.join('; ')} />
          )}
          {r.procurement_law && (
            <InfoRow label="Teisės aktas" value={r.procurement_law} />
          )}
        </>
      ),
    });
  }

  // 2. Perkančioji organizacija
  const org = r.procuring_organization;
  if (org) {
    sections.push({
      title: 'Perkančioji organizacija',
      render: () => (
        <>
          <InfoRow label="Pavadinimas" value={org.name} />
          <InfoRow label="Kodas" value={org.code} />
          <InfoRow label="Tipas" value={org.organization_type} />
          <InfoRow label="Adresas" value={formatOrgAddress(org)} />
          <InfoRow label="Kontaktai" value={formatOrgContacts(org)} />
        </>
      ),
    });
  }

  // 3. Pirkimo būdas
  if (r.procurement_type) {
    sections.push({
      title: 'Pirkimo būdas',
      render: () => (
        <p className="text-[13px] text-surface-300 leading-relaxed">{r.procurement_type}</p>
      ),
    });
  }

  // 4. Finansinės sąlygos
  const ft = r.financial_terms;
  if (ft) {
    const hasFinancialData = ft.payment_terms || ft.advance_payment || ft.guarantee_requirements ||
      ft.guarantee_amount || ft.price_adjustment || ft.insurance_requirements || ft.penalty_clauses?.length > 0;
    if (hasFinancialData) {
      sections.push({
        title: 'Finansinės sąlygos',
        render: () => (
          <>
            <InfoRow label="Mokėjimo sąlygos" value={ft.payment_terms} />
            <InfoRow label="Avansinis mokėjimas" value={ft.advance_payment} />
            <InfoRow label="Garantijos reikalavimai" value={ft.guarantee_requirements} />
            <InfoRow label="Garantijos dydis" value={ft.guarantee_amount} />
            <InfoRow label="Kainos keitimo sąlygos" value={ft.price_adjustment} />
            <InfoRow label="Draudimo reikalavimai" value={ft.insurance_requirements} />
            {ft.penalty_clauses?.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] font-bold text-surface-400 uppercase tracking-wider mb-2">Baudos ir netesybos:</p>
                <ul className="space-y-1.5">
                  {ft.penalty_clauses.map((p: string, i: number) => (
                    <li key={i} className="flex gap-2.5 text-[13px] text-surface-300 leading-relaxed">
                      <span className="text-red-400/70 mt-0.5 flex-shrink-0">&bull;</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ),
      });
    }
  }

  // 5. Terminai
  const dl = r.deadlines;
  if (dl) {
    sections.push({
      title: 'Terminai',
      render: () => (
        <>
          <InfoRow label="Pasiūlymų pateikimas" value={dl.submission_deadline} />
          <InfoRow label="Klausimų pateikimas" value={dl.questions_deadline} />
          <InfoRow label="Sutarties trukmė" value={dl.contract_duration} />
          <InfoRow label="Darbų atlikimas" value={dl.execution_deadline} />
          <InfoRow label="Pasiūlymo galiojimas" value={dl.offer_validity} />
          <InfoRow label="Sutarties pradžia" value={dl.contract_start} />
          <InfoRow label="Pratęsimo galimybės" value={dl.extension_options} />
        </>
      ),
    });
  }

  // 6. Techninė specifikacija
  if (r.technical_specifications?.length > 0) {
    sections.push({
      title: 'Techninė specifikacija',
      render: () => (
        <ul className="space-y-2">
          {r.technical_specifications.map((ts: any, i: number) => {
            const tag = ts.mandatory !== false ? 'PRIVALOMA' : 'PAGEIDAUJAMA';
            const tagColor = ts.mandatory !== false ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10';
            return (
              <li key={i} className="text-[13px] text-surface-300 leading-relaxed">
                <div className="flex gap-2.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tagColor} flex-shrink-0 mt-0.5`}>
                    {tag}
                  </span>
                  <span>{ts.description}</span>
                </div>
                {ts.details && (
                  <p className="ml-[72px] mt-1 text-[12px] text-surface-400 italic">↳ {ts.details}</p>
                )}
              </li>
            );
          })}
        </ul>
      ),
    });
  } else if (r.key_requirements?.length > 0 && !r.technical_specifications?.length) {
    // Fallback: show key_requirements as tech spec if no dedicated tech specs
    sections.push({
      title: 'Techninė specifikacija',
      render: () => (
        <ul className="space-y-2">
          {r.key_requirements.map((req: string, i: number) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-surface-300 leading-relaxed">
              <span className="text-accent-400 mt-0.5 flex-shrink-0">&#9656;</span>
              <span>{req}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  // 7. Kiti pagrindiniai reikalavimai (only if both tech specs AND key_requirements exist)
  if (r.technical_specifications?.length > 0 && r.key_requirements?.length > 0) {
    sections.push({
      title: 'Kiti pagrindiniai reikalavimai',
      render: () => (
        <ul className="space-y-2">
          {r.key_requirements.map((req: string, i: number) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-surface-300 leading-relaxed">
              <span className="text-accent-400 mt-0.5 flex-shrink-0">&#9656;</span>
              <span>{req}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  // 8. Kvalifikacijos reikalavimai (all 7 categories matching PDF)
  const qr = r.qualification_requirements;
  if (qr) {
    const qualGroups: [string, string][] = [
      ['financial', 'Finansiniai'],
      ['technical', 'Techniniai'],
      ['experience', 'Patirties'],
      ['personnel', 'Personalo'],
      ['exclusion_grounds', 'Pašalinimo pagrindai'],
      ['required_documents', 'Reikalaujami dokumentai'],
      ['other', 'Kiti'],
    ];
    const nonEmptyGroups = qualGroups.filter(([key]) => qr[key]?.length > 0);
    if (nonEmptyGroups.length > 0) {
      sections.push({
        title: 'Kvalifikacijos reikalavimai',
        render: () => (
          <>
            {nonEmptyGroups.map(([key, label]) => (
              <div key={key} className="mb-4 last:mb-0">
                <p className="text-[11px] font-bold text-accent-400/80 uppercase tracking-wider mb-2 italic">
                  {label}:
                </p>
                {qr[key].map((item: string, i: number) => (
                  <p key={i} className="text-[13px] text-surface-300 ml-3 mb-1.5 leading-relaxed">
                    &bull; {item}
                  </p>
                ))}
              </div>
            ))}
          </>
        ),
      });
    }
  }

  // 9. Vertinimo kriterijai (as table with description, matching PDF)
  if (r.evaluation_criteria?.length > 0) {
    sections.push({
      title: 'Vertinimo kriterijai',
      render: () => (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-700/40">
                <th className="text-left py-2.5 pr-4 text-[11px] font-bold text-surface-400 uppercase tracking-wider">Kriterijus</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-bold text-surface-400 uppercase tracking-wider w-24">Svoris (%)</th>
                <th className="text-left py-2.5 pl-4 text-[11px] font-bold text-surface-400 uppercase tracking-wider">Aprašymas</th>
              </tr>
            </thead>
            <tbody>
              {r.evaluation_criteria.map((c: any, i: number) => (
                <tr key={i} className="border-b border-surface-700/20 last:border-0">
                  <td className="py-2.5 pr-4 text-surface-200 font-medium">{c.criterion || c.name}</td>
                  <td className="py-2.5 px-3 text-center">
                    {(c.weight_percent != null || c.weight != null) ? (
                      <span className="text-accent-400 font-mono font-semibold">
                        {c.weight_percent ?? c.weight}
                      </span>
                    ) : (
                      <span className="text-surface-600">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pl-4 text-surface-400">{c.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    });
  }

  // 10. Pasiūlymo pateikimas
  const sr = r.submission_requirements;
  if (sr) {
    const hasSubmissionData = sr.submission_method || sr.submission_language?.length > 0 ||
      sr.required_format || sr.envelope_system || sr.variants_allowed != null ||
      sr.joint_bidding || sr.subcontracting;
    if (hasSubmissionData) {
      sections.push({
        title: 'Pasiūlymo pateikimas',
        render: () => (
          <>
            <InfoRow label="Pateikimo būdas" value={sr.submission_method} />
            <InfoRow label="Kalbos" value={sr.submission_language?.length > 0 ? sr.submission_language.join(', ') : null} />
            <InfoRow label="Formatas" value={sr.required_format} />
            <InfoRow label="Vokelių sistema" value={sr.envelope_system} />
            {sr.variants_allowed != null && (
              <InfoRow label="Alternatyvūs pasiūlymai" value={sr.variants_allowed ? 'Leidžiami' : 'Neleidžiami'} />
            )}
            <InfoRow label="Jungtiniai pasiūlymai" value={sr.joint_bidding} />
            <InfoRow label="Subrangos sąlygos" value={sr.subcontracting} />
          </>
        ),
      });
    }
  }

  // 11. Rizikos tiekėjui (with severity colors, matching PDF)
  if (r.risk_factors?.length > 0) {
    sections.push({
      title: 'Rizikos tiekėjui',
      render: () => (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-700/40">
                <th className="text-left py-2.5 pr-4 text-[11px] font-bold text-surface-400 uppercase tracking-wider">Rizika</th>
                <th className="text-center py-2.5 px-3 text-[11px] font-bold text-surface-400 uppercase tracking-wider w-24">Lygis</th>
                <th className="text-left py-2.5 pl-4 text-[11px] font-bold text-surface-400 uppercase tracking-wider">Rekomendacija</th>
              </tr>
            </thead>
            <tbody>
              {r.risk_factors.map((rf: any, i: number) => {
                const severity = (rf.severity || 'medium').toLowerCase();
                const severityStyles: Record<string, string> = {
                  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
                  high: 'bg-red-500/15 text-red-400 border-red-500/20',
                  critical: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/20',
                };
                return (
                  <tr key={i} className="border-b border-surface-700/20 last:border-0">
                    <td className="py-2.5 pr-4 text-surface-200">{rf.risk}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${severityStyles[severity] || severityStyles.medium}`}>
                        {rf.severity?.toUpperCase() || 'MEDIUM'}
                      </span>
                    </td>
                    <td className="py-2.5 pl-4 text-surface-400">{rf.recommendation || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ),
    });
  }

  // 12. Lotai
  if (r.lot_structure?.length > 0) {
    sections.push({
      title: `Lotai (${r.lot_structure.length})`,
      render: () => (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-surface-700/40">
                <th className="text-left py-2.5 pr-4 text-[11px] font-bold text-surface-400 uppercase tracking-wider w-16">Nr.</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-bold text-surface-400 uppercase tracking-wider">Aprašymas</th>
                <th className="text-right py-2.5 pl-4 text-[11px] font-bold text-surface-400 uppercase tracking-wider w-32">Vertė (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {r.lot_structure.map((lot: any, i: number) => (
                <tr key={i} className="border-b border-surface-700/20 last:border-0">
                  <td className="py-2.5 pr-4 text-surface-300 text-center">{lot.lot_number}</td>
                  <td className="py-2.5 px-3 text-surface-200">{lot.description}</td>
                  <td className="py-2.5 pl-4 text-right font-mono text-accent-400">
                    {lot.estimated_value != null ? lot.estimated_value.toLocaleString('lt-LT') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    });
  }

  // 13. Specialios sąlygos
  if (r.special_conditions?.length > 0) {
    sections.push({
      title: 'Specialios sąlygos',
      render: () => (
        <ul className="space-y-1.5">
          {r.special_conditions.map((c: string, i: number) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-surface-300 leading-relaxed">
              <span className="text-accent-400 mt-0.5 flex-shrink-0">&bull;</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  // 14. Apribojimai ir draudimai
  if (r.restrictions_and_prohibitions?.length > 0) {
    sections.push({
      title: 'Apribojimai ir draudimai',
      render: () => (
        <ul className="space-y-1.5">
          {r.restrictions_and_prohibitions.map((item: string, i: number) => (
            <li key={i} className="flex gap-2.5 text-[13px] text-surface-300 leading-relaxed">
              <span className="text-red-400/70 mt-0.5 flex-shrink-0">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ),
    });
  }

  // 15. Apeliavimo procedūra
  if (r.appeal_procedures) {
    sections.push({
      title: 'Apeliavimo procedūra',
      render: () => (
        <p className="text-[13px] text-surface-300 leading-relaxed whitespace-pre-line">{r.appeal_procedures}</p>
      ),
    });
  }

  // 16. Pastabos ir patikimumas
  if (r.confidence_notes?.length > 0) {
    sections.push({
      title: 'Pastabos ir patikimumas',
      render: () => (
        <div className="space-y-2">
          {r.confidence_notes.map((note: any, i: number) => {
            const severity = typeof note === 'string' ? 'info' : note.severity || 'info';
            const text = typeof note === 'string' ? note : note.text || note.note;
            const styles: Record<string, { bg: string; icon: typeof Info }> = {
              info: { bg: 'bg-blue-500/6 border-blue-500/12 text-blue-300', icon: Info },
              warning: { bg: 'bg-amber-500/6 border-amber-500/12 text-amber-300', icon: AlertTriangle },
              conflict: { bg: 'bg-red-500/6 border-red-500/12 text-red-300', icon: AlertTriangle },
            };
            const style = styles[severity] || styles.info;
            const SIcon = style.icon;
            return (
              <div key={i} className={`flex gap-3 text-[13px] px-3.5 py-2.5 rounded-xl border leading-relaxed ${style.bg}`}>
                <SIcon className="w-4 h-4 flex-shrink-0 mt-0.5 opacity-70" />
                <span>[{severity.toUpperCase()}] {text}</span>
              </div>
            );
          })}
        </div>
      ),
    });
  }

  // 17. Kokybės vertinimas (QA details — missing fields, conflicts, suggestions)
  if (qa) {
    const hasQADetails = qa.missing_fields?.length > 0 || qa.conflicts?.length > 0 || qa.suggestions?.length > 0;
    if (hasQADetails) {
      sections.push({
        title: 'Kokybės vertinimas',
        render: () => (
          <>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[13px] font-semibold text-surface-300">Užbaigtumo balas:</span>
              <span className={`text-[15px] font-bold font-mono ${qaColors.text}`}>{qaScore}%</span>
            </div>

            {qa.missing_fields?.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-2 italic">Trūkstami laukai:</p>
                {qa.missing_fields.map((mf: string, i: number) => (
                  <p key={i} className="text-[13px] text-amber-400/80 ml-3 mb-1 leading-relaxed">
                    &bull; {mf}
                  </p>
                ))}
              </div>
            )}

            {qa.conflicts?.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-2 italic">Prieštaravimai:</p>
                {qa.conflicts.map((c: string, i: number) => (
                  <p key={i} className="text-[13px] text-red-400/80 ml-3 mb-1 leading-relaxed">
                    &bull; {c}
                  </p>
                ))}
              </div>
            )}

            {qa.suggestions?.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-surface-400 uppercase tracking-wider mb-2 italic">Pasiūlymai:</p>
                {qa.suggestions.map((s: string, i: number) => (
                  <p key={i} className="text-[13px] text-surface-300 ml-3 mb-1 leading-relaxed">
                    &bull; {s}
                  </p>
                ))}
              </div>
            )}
          </>
        ),
      });
    }
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
              {r.project_title || 'Analizės ataskaita'}
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

      {/* ── Key Info Card (Pagrindinė informacija) ─────────────── */}
      <div className="enterprise-card p-6 mb-6">
        <h2 className="text-[13px] font-bold text-surface-400 uppercase tracking-widest mb-4">Pagrindinė informacija</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
          <KeyInfoRow icon={FileText} label="Projekto pavadinimas" value={r.project_title} />
          <KeyInfoRow icon={Building2} label="Perkančioji organizacija" value={r.procuring_organization?.name} />
          <KeyInfoRow icon={BadgeEuro} label="Projekto vertė" value={formatValue(r.estimated_value)} />
          <KeyInfoRow icon={CalendarClock} label="Dokumentų pateikimo terminas" value={r.deadlines?.submission_deadline} />
          <KeyInfoRow icon={Tag} label="CVP kodas" value={r.procurement_reference} />
          <KeyInfoRow icon={Hash} label="CPV kodai" value={r.cpv_codes?.length ? r.cpv_codes.join('; ') : null} />
        </div>
      </div>

      {/* ── Unified Report Card — All Numbered Sections ────────── */}
      {sections.length > 0 && (
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
      )}
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
        {open ? '\u25BE' : '\u25B8'} Šaltinis ({refs.length})
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

function InfoRow({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return (
    <div className="flex flex-col py-2">
      <div className="flex items-start gap-3">
        <span className="text-[12px] text-surface-500 min-w-[160px] flex-shrink-0 font-medium">{label}</span>
        <span className="text-[13px] text-surface-200 leading-relaxed">{String(value)}</span>
      </div>
    </div>
  );
}
