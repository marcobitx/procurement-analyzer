// frontend/src/components/FilesPanel.tsx
// Slide panel for viewing/managing uploaded files with side-by-side preview
// Preview opens as a large viewer to the LEFT of the file list panel
// Related: UploadPanel.tsx, store.ts, FileTypeLogos.tsx

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, FolderOpen, Trash2, Plus, Eye, EyeOff, FileText, HardDrive, Maximize2, Minimize2 } from 'lucide-react';
import { appStore, useStore } from '../lib/store';
import { useFocusTrap } from '../lib/useFocusTrap';
import { FileTypeLogo, FILE_TYPE_INFO } from './FileTypeLogos';
import ScrollText from './ScrollText';
import { clsx } from 'clsx';

const ACCEPTED = '.pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.zip';
const MAX_SIZE_MB = 50;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function getFormatSummary(files: File[]): { ext: string; count: number; color: string }[] {
  const map = new Map<string, number>();
  for (const f of files) {
    const ext = getExtension(f.name);
    map.set(ext, (map.get(ext) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ext, count]) => ({
      ext,
      count,
      color: FILE_TYPE_INFO[ext]?.color || '#78909C',
    }));
}

export default function FilesPanel() {
  const state = useStore(appStore);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>();

  const hasPreview = previewFile !== null && previewUrl !== null;

  useEffect(() => {
    if (state.filesPanelOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
        closePreview();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state.filesPanelOpen]);

  const handleClose = useCallback(() => {
    appStore.setState({ filesPanelOpen: false });
  }, []);

  const closePreview = useCallback(() => {
    setPreviewFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!state.filesPanelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (previewFile) {
          closePreview();
        } else {
          handleClose();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.filesPanelOpen, handleClose, previewFile, closePreview]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => f.size <= MAX_SIZE_MB * 1024 * 1024);
    const currentFiles = appStore.getState().files;
    const names = new Set(currentFiles.map((f) => f.name));
    const uniqueNew = valid.filter((f) => !names.has(f.name));
    if (uniqueNew.length) {
      appStore.setState({ files: [...currentFiles, ...uniqueNew] });
    }
  }, []);

  const removeFile = useCallback((name: string) => {
    appStore.setState({ files: appStore.getState().files.filter((f) => f.name !== name) });
    if (previewFile?.name === name) {
      closePreview();
    }
  }, [previewFile, closePreview]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const openPreview = useCallback((file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewFile(file);
    setPreviewUrl(url);
  }, [previewUrl]);

  if (!visible) return null;

  const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  const formats = getFormatSummary(state.files);
  const previewExt = previewFile ? getExtension(previewFile.name) : '';

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

      {/* ── Container: Preview (left) + File List (right) ── */}
      <div
        ref={trapRef}
        className={clsx(
          "relative flex gap-2 my-2 mr-2",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          animating
            ? "translate-x-0 opacity-100"
            : "translate-x-[105%] opacity-0"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Failų peržiūra"
      >
        {/* ── LEFT: Preview Viewer ── */}
        {hasPreview && (
          <div
            className={clsx(
              "flex flex-col rounded-[10px] overflow-hidden shadow-2xl",
              "bg-surface-950 border border-surface-700/60",
              "w-[580px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "animate-fade-in"
            )}
          >
            {/* Preview header */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-surface-700/50 bg-surface-950/80 backdrop-blur-md flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileTypeLogo extension={previewExt} size={18} />
                <ScrollText className="text-[13px] font-semibold text-surface-200">{previewFile!.name}</ScrollText>
                <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">{formatSize(previewFile!.size)}</span>
              </div>
              <button
                onClick={closePreview}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0 ml-3"
                title="Uždaryti peržiūrą"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview content — fills all available space */}
            <div className="flex-1 overflow-auto bg-surface-900/30 p-3">
              {['png', 'jpg', 'jpeg'].includes(previewExt) ? (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <img
                    src={previewUrl!}
                    alt={previewFile!.name}
                    className="max-w-full max-h-full rounded-lg border border-surface-700/40 object-contain"
                  />
                </div>
              ) : previewExt === 'pdf' ? (
                <iframe
                  src={previewUrl!}
                  title={previewFile!.name}
                  className="w-full h-full min-h-[500px] rounded-lg border border-surface-700/40 bg-white"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
                  <EyeOff className="w-10 h-10 text-surface-600" />
                  <p className="text-[13px] text-surface-500 font-medium">Peržiūra nepalaikoma šiam formatui</p>
                  <p className="text-[11px] text-surface-600">{previewExt.toUpperCase()} failas</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── RIGHT: File List Panel ── */}
        <div
          className={clsx(
            "w-[440px] flex flex-col shadow-2xl",
            "bg-surface-950 border border-surface-700/60",
            "rounded-[10px] overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-5 border-b border-surface-700/50 bg-surface-950/80 backdrop-blur-md flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <FolderOpen className="w-4 h-4 text-brand-400" />
              <h2 className="text-[14px] font-bold text-white uppercase tracking-wider">Failai</h2>
              {state.files.length > 0 && (
                <span className="text-[11px] font-mono text-surface-500 ml-1">
                  ({state.files.length})
                </span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats bar */}
          {state.files.length > 0 && (
            <div className="px-5 py-3 border-b border-surface-700/40 bg-surface-900/30 flex-shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-surface-500" />
                    <span className="text-[11px] font-bold text-surface-300">
                      {state.files.length} {state.files.length === 1 ? 'failas' : state.files.length < 10 ? 'failai' : 'failų'}
                    </span>
                  </div>
                  <div className="w-px h-3 bg-surface-700/50" />
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-surface-500" />
                    <span className="text-[11px] font-mono text-surface-400">{formatSize(totalSize)}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    appStore.setState({ files: [] });
                    closePreview();
                  }}
                  className="text-[10px] font-bold text-surface-600 hover:text-red-400 transition-colors uppercase tracking-wider"
                >
                  Išvalyti
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {formats.map(({ ext, count, color }) => (
                  <div
                    key={ext}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${color}12`,
                      border: `1px solid ${color}25`,
                      color: `${color}cc`,
                    }}
                  >
                    <span>{ext}</span>
                    <span style={{ color: `${color}80` }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {state.files.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 gap-4 px-8">
                <div className="w-16 h-16 rounded-2xl bg-surface-800/60 border border-surface-700/50 flex items-center justify-center">
                  <FolderOpen className="w-7 h-7 text-surface-600" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-surface-400 mb-1">Nėra failų</p>
                  <p className="text-[11px] text-surface-600">Nutempkite failus arba paspauskite mygtuką žemiau</p>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-1">
                {state.files.map((f) => {
                  const ext = getExtension(f.name);
                  const isPreviewable = ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
                  const isActive = previewFile?.name === f.name;

                  return (
                    <div
                      key={f.name}
                      className={clsx(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-brand-500/5 border-brand-500/20"
                          : "bg-surface-900/40 border-surface-700/40 hover:border-surface-600/60 hover:bg-surface-800/40"
                      )}
                      onClick={() => isPreviewable && openPreview(f)}
                    >
                      <FileTypeLogo extension={ext} size={20} />

                      <div className="flex-1 min-w-0">
                        <ScrollText className="text-[12px] font-semibold text-surface-200">{f.name}</ScrollText>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-surface-500">{formatSize(f.size)}</span>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 rounded"
                            style={{
                              backgroundColor: `${FILE_TYPE_INFO[ext]?.color || '#78909C'}15`,
                              color: `${FILE_TYPE_INFO[ext]?.color || '#78909C'}aa`,
                            }}
                          >
                            {ext}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isPreviewable && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openPreview(f); }}
                            className={clsx(
                              "p-1.5 rounded-lg transition-all",
                              isActive
                                ? "bg-brand-500/10 text-brand-400"
                                : "opacity-0 group-hover:opacity-100 hover:bg-brand-500/10 text-surface-500 hover:text-brand-400"
                            )}
                            title="Peržiūrėti"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-all"
                          title="Pašalinti"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add files */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className="border-t border-surface-700/50 bg-surface-900/40 flex-shrink-0"
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              multiple
              onChange={(e) => e.target.files && addFiles(e.target.files)}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              className={clsx(
                "w-full flex items-center justify-center gap-2 px-5 py-3.5 text-[12px] font-semibold transition-all duration-200",
                dragOver
                  ? "text-brand-400 bg-brand-500/5"
                  : "text-surface-400 hover:text-surface-200 hover:bg-white/[0.03]"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              {dragOver ? 'Paleiskite failus čia' : 'Pridėti failų'}
            </button>
          </div>

          {/* Footer */}
          <div className="px-5 py-2.5 border-t border-surface-700/40 bg-surface-950/50 flex-shrink-0">
            <p className="text-[10px] text-surface-500 leading-relaxed italic">
              Maks. {MAX_SIZE_MB}MB per failą · PDF, DOCX, XLSX, PPTX, PNG, JPG, ZIP
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
