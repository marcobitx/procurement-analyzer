// frontend/src/components/HistoryView.tsx
// Analysis history — analytics dashboard with KPI cards and detailed project table
// Shows aggregate metrics at top, filterable/sortable table of all past analyses below
// Related: api.ts (listAnalyses, deleteAnalysis), App.tsx

import { useEffect, useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  FileText,
  ChevronRight,
  Inbox,
  Building2,
  Calendar,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';
import { listAnalyses, deleteAnalysis, type AnalysisSummary } from '../lib/api';
import CustomSelect from './CustomSelect';
import ScrollText from './ScrollText';

interface Props {
  onSelect: (id: string) => void;
  onNew: () => void;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  QUEUED: { label: 'Eilėje', cls: 'badge-neutral' },
  PENDING: { label: 'Eilėje', cls: 'badge-neutral' },
  PARSING: { label: 'Parsavimas', cls: 'badge-brand' },
  EXTRACTING: { label: 'Ištraukimas', cls: 'badge-brand' },
  AGGREGATING: { label: 'Agregavimas', cls: 'badge-brand' },
  EVALUATING: { label: 'Vertinimas', cls: 'badge-brand' },
  COMPLETED: { label: 'Baigta', cls: 'badge-success' },
  FAILED: { label: 'Klaida', cls: 'badge-error' },
  CANCELED: { label: 'Atšaukta', cls: 'badge-neutral' },
};

type SortField = 'created_at' | 'project_title' | 'estimated_value' | 'status';
type SortDir = 'asc' | 'desc';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('lt-LT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

const CURRENCY_NAME_TO_CODE: Record<string, string> = {
  euro: 'EUR',
  euras: 'EUR',
  eur: 'EUR',
  usd: 'USD',
  doleris: 'USD',
  gbp: 'GBP',
  svaras: 'GBP',
};

function normalizeCurrency(raw: string): string {
  const code = CURRENCY_NAME_TO_CODE[raw.toLowerCase().trim()];
  if (code) return code;
  if (raw.length === 3 && raw === raw.toUpperCase()) return raw;
  return 'EUR';
}

function formatValue(amount: number | null, currency: string): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('lt-LT', {
    style: 'currency',
    currency: normalizeCurrency(currency),
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '—';
  // Try ISO date parse
  const d = new Date(deadline);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('lt-LT', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }
  // Return raw text (e.g. "2025-03-15 14:00")
  return deadline.length > 20 ? deadline.slice(0, 20) + '…' : deadline;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ką tik';
  if (min < 60) return `prieš ${min} min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `prieš ${h} val.`;
  const d = Math.floor(h / 24);
  if (d < 30) return `prieš ${d} d.`;
  return formatDate(iso);
}

export default function HistoryView({ onSelect, onNew }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setAnalyses(await listAnalyses());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Computed analytics ───────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = analyses.filter((a) => a.status === 'COMPLETED');
    const totalValue = analyses.reduce((sum, a) => sum + (a.estimated_value || 0), 0);
    const avgScore =
      completed.length > 0
        ? completed.reduce((sum, a) => sum + (a.completeness_score || 0), 0) / completed.length
        : 0;
    const totalFiles = analyses.reduce((sum, a) => sum + a.file_count, 0);

    return {
      total: analyses.length,
      completed: completed.length,
      totalValue,
      avgScore,
      totalFiles,
      inProgress: analyses.filter((a) =>
        ['PARSING', 'EXTRACTING', 'AGGREGATING', 'EVALUATING', 'PENDING', 'QUEUED'].includes(a.status)
      ).length,
      failed: analyses.filter((a) => a.status === 'FAILED').length,
    };
  }, [analyses]);

  // ── Filtered & sorted list ──────────────────────────────────────────
  const filteredAnalyses = useMemo(() => {
    let list = [...analyses];

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          (a.project_title || '').toLowerCase().includes(q) ||
          (a.organization_name || '').toLowerCase().includes(q) ||
          (a.procurement_type || '').toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'project_title':
          cmp = (a.project_title || '').localeCompare(b.project_title || '', 'lt');
          break;
        case 'estimated_value':
          cmp = (a.estimated_value || 0) - (b.estimated_value || 0);
          break;
        case 'status': {
          const order: Record<string, number> = {
            COMPLETED: 0, EVALUATING: 1, AGGREGATING: 2, EXTRACTING: 3,
            PARSING: 4, PENDING: 5, QUEUED: 6, FAILED: 7, CANCELED: 8,
          };
          cmp = (order[a.status] ?? 9) - (order[b.status] ?? 9);
          break;
        }
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [analyses, search, sortField, sortDir, statusFilter]);

  // Reset to page 0 when filters change
  useEffect(() => { setCurrentPage(0); }, [search, statusFilter, sortField, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredAnalyses.length / pageSize));
  const paginatedAnalyses = useMemo(() => {
    const start = currentPage * pageSize;
    return filteredAnalyses.slice(start, start + pageSize);
  }, [filteredAnalyses, currentPage, pageSize]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Tikrai ištrinti šią analizę?')) return;
    setDeleting(id);
    setDeleteError(null);
    try {
      await deleteAnalysis(id);
      setAnalyses((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setDeleteError(err.message || 'Nepavyko ištrinti analizės');
    } finally {
      setDeleting(null);
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────
  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedAnalyses.map((a) => a.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Tikrai ištrinti ${selectedIds.size} ${selectedIds.size === 1 ? 'analizę' : 'analizes'}?`)) return;
    setBulkDeleting(true);
    setDeleteError(null);
    try {
      await Promise.all([...selectedIds].map((id) => deleteAnalysis(id)));
      setAnalyses((prev) => prev.filter((a) => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
    } catch (err: any) {
      setDeleteError(err.message || 'Nepavyko ištrinti analizių');
    } finally {
      setBulkDeleting(false);
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'created_at' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-brand-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-brand-400" />
    );
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Analizių istorija
          </h1>
          <p className="text-[12px] text-surface-500 mt-1.5 font-bold uppercase tracking-widest">
            {loading ? '...' : `${analyses.length} analizių · ${stats.totalFiles} dokumentų`}
          </p>
        </div>
        <button onClick={onNew} className="btn-professional group">
          <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
          Nauja analizė
        </button>
      </div>

      {/* ── Loading ───────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
        </div>
      )}

      {/* ── Empty ─────────────────────────────────────────────── */}
      {!loading && analyses.length === 0 && (
        <div className="text-center py-24 animate-fade-in enterprise-card">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-brand-500/5 flex items-center justify-center border border-brand-500/10">
            <Inbox className="w-8 h-8 text-brand-400" />
          </div>
          <p className="text-xl font-bold text-white mb-2 tracking-tight">Analizių istorija tuščia</p>
          <p className="text-[14px] text-surface-500 mb-8 max-w-xs mx-auto">
            Pradėkite naują analizę įkeldami dokumentus pagrindiniame lange.
          </p>
          <button onClick={onNew} className="btn-professional">
            Pradėti naują analizę
          </button>
        </div>
      )}

      {/* ── Dashboard Content ────────────────────────────────── */}
      {!loading && analyses.length > 0 && (
        <>
          {/* ── KPI Strip ──────────────────────────────────────── */}
          <div className="relative rounded-2xl border border-surface-700/60 bg-surface-950/60 backdrop-blur-sm mb-6 overflow-hidden">
            {/* Decorative top gradient line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand-500/0 via-brand-500/40 to-brand-500/0" />

            <div className="grid grid-cols-2 lg:grid-cols-4">
              {/* Total Analyses */}
              <div className="relative px-6 py-5 group">
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-extrabold text-white tracking-tighter leading-none">{stats.total}</span>
                  {stats.inProgress > 0 && (
                    <span className="text-[11px] font-bold text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded-md">
                      +{stats.inProgress} vykdoma
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-surface-500 font-bold uppercase tracking-widest mt-1.5">Analizės</p>
                {/* Accent dot */}
                <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-brand-500/30" />
              </div>

              {/* Completed */}
              <div className="relative px-6 py-5 border-l border-surface-700/40 group">
                <div className="flex items-baseline gap-2">
                  <span className="text-[32px] font-extrabold text-white tracking-tighter leading-none">{stats.completed}</span>
                  {stats.failed > 0 && (
                    <span className="text-[11px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md">
                      {stats.failed} klaidos
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-[11px] text-surface-500 font-bold uppercase tracking-widest">Baigtos</p>
                  {stats.total > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1 rounded-full bg-surface-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/70"
                          style={{ width: `${Math.round((stats.completed / stats.total) * 100)}%`, transition: 'width 0.6s ease-out' }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-surface-600">{Math.round((stats.completed / stats.total) * 100)}%</span>
                    </div>
                  )}
                </div>
                <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-emerald-500/30" />
              </div>

              {/* Total Value */}
              <div className="relative px-6 py-5 border-l border-surface-700/40 group">
                <span className="text-[32px] font-extrabold text-white tracking-tighter leading-none">
                  {stats.totalValue > 0
                    ? stats.totalValue >= 1_000_000
                      ? `${(stats.totalValue / 1_000_000).toFixed(1)}M`
                      : stats.totalValue >= 1_000
                        ? `${(stats.totalValue / 1_000).toFixed(0)}K`
                        : formatValue(stats.totalValue, 'EUR')
                    : '—'}
                </span>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <p className="text-[11px] text-surface-500 font-bold uppercase tracking-widest">Bendra vertė</p>
                  {stats.totalValue > 0 && (
                    <span className="text-[10px] font-mono text-surface-600">EUR</span>
                  )}
                </div>
                <div className="absolute top-5 right-5 w-2 h-2 rounded-full bg-amber-500/30" />
              </div>

              {/* Avg Quality */}
              <div className="relative px-6 py-5 border-l border-surface-700/40 group">
                <div className="flex items-baseline gap-1">
                  <span className="text-[32px] font-extrabold tracking-tighter leading-none"
                    style={{ color: stats.avgScore >= 0.8 ? '#34d399' : stats.avgScore >= 0.5 ? '#fbbf24' : stats.avgScore > 0 ? '#f87171' : 'white' }}>
                    {stats.avgScore > 0 ? Math.round(stats.avgScore * 100) : '—'}
                  </span>
                  {stats.avgScore > 0 && <span className="text-[16px] font-bold text-surface-500">%</span>}
                </div>
                <p className="text-[11px] text-surface-500 font-bold uppercase tracking-widest mt-1.5">Vid. kokybė</p>
                {/* Mini quality arc */}
                {stats.avgScore > 0 && (
                  <div className="absolute top-4 right-4 w-7 h-7">
                    <svg viewBox="0 0 28 28" className="w-full h-full -rotate-90">
                      <circle cx="14" cy="14" r="11" fill="none" stroke="rgba(62,51,45,0.4)" strokeWidth="2" />
                      <circle cx="14" cy="14" r="11" fill="none"
                        stroke={stats.avgScore >= 0.8 ? '#34d399' : stats.avgScore >= 0.5 ? '#fbbf24' : '#f87171'}
                        strokeWidth="2" strokeLinecap="round"
                        strokeDasharray={`${stats.avgScore * 69.1} ${69.1 - stats.avgScore * 69.1}`}
                        style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Filters Row ──────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ieškoti pagal pavadinimą, organizaciją..."
                className="input-field w-full pl-10 py-2.5 text-[13px]"
              />
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-surface-500 flex-shrink-0" />
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'Visi statusai' },
                  { value: 'COMPLETED', label: 'Baigtos' },
                  { value: 'FAILED', label: 'Su klaidomis' },
                  { value: 'PENDING', label: 'Laukiančios' },
                ]}
                className="text-[13px] min-w-[160px]"
              />
            </div>
          </div>

          {/* ── Delete error ──────────────────────────────────────── */}
          {deleteError && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-[12px] text-red-300 animate-fade-in">
              {deleteError}
            </div>
          )}

          {/* ── Bulk Action Bar ────────────────────────────────────── */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-5 py-3 mb-4 rounded-xl bg-brand-500/8 border border-brand-500/15 animate-fade-in">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-bold text-brand-300">
                  {selectedIds.size} {selectedIds.size === 1 ? 'pasirinkta' : 'pasirinkta'}
                </span>
                <button
                  onClick={clearSelection}
                  className="text-[11px] font-medium text-surface-400 hover:text-surface-200 transition-colors"
                >
                  Atšaukti
                </button>
              </div>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold
                           text-red-400 bg-red-500/10 border border-red-500/20
                           hover:bg-red-500/20 transition-all duration-200
                           disabled:opacity-50"
              >
                {bulkDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Ištrinti
              </button>
            </div>
          )}

          {/* ── Table ──────────────────────────────────────────────── */}
          <div className="enterprise-card overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
            {/* Table header */}
            <div className="grid grid-cols-[36px_1fr_180px_120px_120px_100px_48px] gap-0 px-5 py-3 border-b border-surface-700/40
                            text-[11px] text-surface-500 font-bold uppercase tracking-widest">
              {/* Select all checkbox */}
              <div className="flex items-center justify-center">
                <button
                  onClick={toggleSelectAll}
                  className="w-4 h-4 rounded border border-surface-600 flex items-center justify-center
                             hover:border-brand-500/50 transition-colors flex-shrink-0"
                  style={{
                    backgroundColor: paginatedAnalyses.length > 0 && paginatedAnalyses.every((a) => selectedIds.has(a.id))
                      ? 'rgba(245, 158, 11, 0.7)' : 'transparent',
                    borderColor: paginatedAnalyses.length > 0 && paginatedAnalyses.every((a) => selectedIds.has(a.id))
                      ? 'rgba(245, 158, 11, 0.7)' : undefined,
                  }}
                >
                  {paginatedAnalyses.length > 0 && paginatedAnalyses.every((a) => selectedIds.has(a.id)) && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {paginatedAnalyses.some((a) => selectedIds.has(a.id)) && !paginatedAnalyses.every((a) => selectedIds.has(a.id)) && (
                    <div className="w-2 h-0.5 bg-brand-400 rounded-full" />
                  )}
                </button>
              </div>
              <button
                onClick={() => toggleSort('project_title')}
                className="flex items-center gap-1.5 text-left hover:text-surface-300 transition-colors"
              >
                Pirkimas <SortIcon field="project_title" />
              </button>
              <span className="hidden lg:flex items-center">Organizacija</span>
              <span className="hidden md:flex items-center">Terminas</span>
              <button
                onClick={() => toggleSort('estimated_value')}
                className="flex items-center gap-1.5 text-right justify-end hover:text-surface-300 transition-colors"
              >
                Vertė <SortIcon field="estimated_value" />
              </button>
              <button
                onClick={() => toggleSort('status')}
                className="flex items-center gap-1.5 justify-center hover:text-surface-300 transition-colors"
              >
                Statusas <SortIcon field="status" />
              </button>
              <span></span>
            </div>

            {/* Table rows — scrollable */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
            {filteredAnalyses.length === 0 && (
              <div className="px-5 py-12 text-center text-[13px] text-surface-500">
                Nerasta analizių pagal pasirinktus filtrus.
              </div>
            )}

            {paginatedAnalyses.map((a, i) => {
              const status = STATUS_META[a.status] || STATUS_META.QUEUED;
              const clickable = a.status === 'COMPLETED';
              const isSelected = selectedIds.has(a.id);

              return (
                <div
                  key={a.id}
                  onClick={() => clickable && onSelect(a.id)}
                  className={`grid grid-cols-[36px_1fr_180px_120px_120px_100px_48px] gap-0 px-5 py-3.5 w-full text-left
                             border-b border-surface-700/20 last:border-b-0 group
                             transition-all duration-200
                             hover:bg-surface-800/50 animate-stagger
                             ${isSelected ? 'bg-brand-500/5 border-l-2 border-l-brand-500/40' : ''}
                             ${!clickable ? 'opacity-60' : 'cursor-pointer'}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  {/* Row checkbox */}
                  <div className="flex items-center justify-center">
                    <button
                      onClick={(e) => toggleSelect(a.id, e)}
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                                  transition-all duration-150
                                  ${isSelected
                                    ? 'bg-brand-500/70 border-brand-500/70'
                                    : 'border-surface-600 hover:border-brand-500/50 opacity-40 group-hover:opacity-100'
                                  }`}
                    >
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4.5 7.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {/* Project name + meta */}
                  <div className="min-w-0 pr-4">
                    <p className="text-[13px] font-bold text-surface-100 truncate tracking-tight group-hover:text-brand-300 transition-colors">
                      {a.project_title || `Analizė #${a.id.slice(0, 8)}`}
                    </p>
                    <div className="flex items-center gap-2.5 mt-1">
                      <span className="flex items-center gap-1 text-[11px] text-surface-500">
                        <FileText className="w-3 h-3" />
                        {a.file_count} {a.file_count === 1 ? 'failas' : 'failai'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-surface-500">
                        <Clock className="w-3 h-3" />
                        {timeAgo(a.created_at)}
                      </span>
                      {a.model && (
                        <span className="font-mono text-[10px] bg-white/[0.04] px-1.5 py-0.5 rounded-full border border-surface-700/50 text-surface-500">
                          {a.model.split('/').pop()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Organization */}
                  <div className="hidden lg:flex items-center min-w-0 pr-3">
                    {a.organization_name ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-surface-400 min-w-0">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-surface-500" />
                        <ScrollText className="text-[12px] text-surface-400">{a.organization_name}</ScrollText>
                      </span>
                    ) : (
                      <span className="text-[12px] text-surface-600">—</span>
                    )}
                  </div>

                  {/* Deadline */}
                  <div className="hidden md:flex items-center min-w-0">
                    {a.submission_deadline ? (
                      <span className="flex items-center gap-1.5 text-[12px] text-surface-400">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-surface-500" />
                        {formatDeadline(a.submission_deadline)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-surface-600">—</span>
                    )}
                  </div>

                  {/* Value */}
                  <div className="flex items-center justify-end pr-3">
                    <span className={`text-[13px] font-bold tracking-tight ${
                      a.estimated_value ? 'text-amber-400' : 'text-surface-600'
                    }`}>
                      {formatValue(a.estimated_value, a.currency)}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-center">
                    <span className={`${status.cls} text-[10px] px-2 py-0.5`}>
                      {status.label}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={(e) => handleDelete(a.id, e)}
                      disabled={deleting === a.id}
                      className="p-1.5 rounded-lg text-surface-600 hover:text-red-400 hover:bg-red-500/8
                               opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-200"
                    >
                      {deleting === a.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {clickable && (
                      <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 transition-colors" />
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            {/* ── Pagination bar ──────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-700/40 flex-shrink-0">
              {/* Page size selector */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-surface-500">Rodyti</span>
                {[10, 25, 50].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-md transition-all duration-200
                      ${pageSize === size
                        ? 'bg-brand-500/15 text-brand-400 border border-brand-500/20'
                        : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/50 border border-transparent'
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              {/* Page info */}
              <span className="text-[11px] text-surface-500 font-medium">
                {filteredAnalyses.length > 0
                  ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, filteredAnalyses.length)} iš ${filteredAnalyses.length}`
                  : `0 iš ${analyses.length}`}
              </span>

              {/* Page navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-800/50
                             disabled:opacity-30 disabled:pointer-events-none transition-all duration-200"
                >
                  &larr; Ankst.
                </button>
                <span className="text-[11px] font-mono text-surface-500 px-2">
                  {currentPage + 1}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-800/50
                             disabled:opacity-30 disabled:pointer-events-none transition-all duration-200"
                >
                  Kitas &rarr;
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
