// frontend/src/components/FilesPanel.tsx
// Slide panel for viewing/managing uploaded files with side-by-side preview
// Preview opens as a large viewer to the LEFT of the file list panel
// Related: UploadPanel.tsx, store.ts, FileTypeLogos.tsx

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, FolderOpen, Trash2, Plus, Eye, EyeOff, FileText, HardDrive, Maximize2, Minimize2, BookOpen, Unplug } from 'lucide-react';
import { appStore, useStore, type ParsedDocInfo } from '../lib/store';
import { getDocumentContent } from '../lib/api';
import { useFocusTrap } from '../lib/useFocusTrap';
import { FileTypeLogo, FILE_TYPE_INFO } from './FileTypeLogos';
import ScrollText from './ScrollText';
import Tooltip from './Tooltip';
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

function getFormatSummary(items: { name: string }[]): { ext: string; count: number; color: string }[] {
  const map = new Map<string, number>();
  for (const f of items) {
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

function formatSizeKb(kb: number) {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function FilesPanel() {
  const state = useStore(appStore);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [docPreview, setDocPreview] = useState<{ filename: string; content: string; pages: number; docType: string } | null>(null);
  const [docPreviewLoading, setDocPreviewLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>();

  const hasPreview = (previewFile !== null && previewUrl !== null) || docPreview !== null;

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
    setDocPreview(null);
    setDocPreviewLoading(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  useEffect(() => {
    if (!state.filesPanelOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (previewFile || docPreview) {
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
    setDocPreview(null);
  }, [previewUrl]);

  const openDocPreview = useCallback(async (filename: string) => {
    const analysisId = appStore.getState().currentAnalysisId;
    if (!analysisId) return;
    if (docPreview?.filename === filename) return;
    setDocPreviewLoading(true);
    setPreviewFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    try {
      const data = await getDocumentContent(analysisId, filename);
      setDocPreview({ filename: data.filename, content: data.content, pages: data.page_count, docType: data.doc_type });
    } catch {
      setDocPreview({ filename, content: 'Nepavyko įkelti dokumento turinio.', pages: 0, docType: '' });
    } finally {
      setDocPreviewLoading(false);
    }
  }, [docPreview?.filename, previewUrl]);

  if (!visible) return null;

  // Analysis mode: show extracted/parsed docs instead of original uploads (e.g. ZIP → individual files)
  const isAnalysisMode = state.parsedDocs.length > 0 && state.view !== 'upload';
  const displayItems = isAnalysisMode
    ? state.parsedDocs.map((d) => ({ name: d.filename, size: d.size_kb * 1024, ext: d.format, pages: d.pages, sizeKb: d.size_kb }))
    : state.files.map((f) => ({ name: f.name, size: f.size, ext: getExtension(f.name), pages: 0, sizeKb: 0 }));
  const totalSize = isAnalysisMode
    ? state.parsedDocs.reduce((s, d) => s + d.size_kb, 0) * 1024
    : state.files.reduce((s, f) => s + f.size, 0);
  const totalPages = isAnalysisMode
    ? state.parsedDocs.reduce((s, d) => s + d.pages, 0)
    : 0;
  const formats = getFormatSummary(displayItems);
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
        {(hasPreview || docPreviewLoading) && (
          <div
            className={clsx(
              "flex flex-col rounded-[10px] overflow-hidden shadow-2xl",
              "bg-surface-950 border border-surface-700/60",
              "w-[820px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "animate-fade-in"
            )}
          >
            {/* Preview header */}
            <div className="h-12 flex items-center justify-between px-4 border-b border-surface-700/50 bg-surface-950/80 backdrop-blur-md flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {docPreview ? (
                  <>
                    <FileTypeLogo extension={docPreview.docType || getExtension(docPreview.filename)} size={18} />
                    <ScrollText className="text-[13px] font-semibold text-surface-200">{docPreview.filename}</ScrollText>
                    {docPreview.pages > 0 && (
                      <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">{docPreview.pages} psl.</span>
                    )}
                  </>
                ) : previewFile ? (
                  <>
                    <FileTypeLogo extension={previewExt} size={18} />
                    <ScrollText className="text-[13px] font-semibold text-surface-200">{previewFile.name}</ScrollText>
                    <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">{formatSize(previewFile.size)}</span>
                  </>
                ) : docPreviewLoading ? (
                  <span className="text-[13px] text-surface-400">Kraunama...</span>
                ) : null}
              </div>
              <Tooltip content="Uždaryti peržiūrą" side="bottom">
                <button
                  onClick={closePreview}
                  className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0 ml-3"
                >
                  <X className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>

            {/* Preview content — fills all available space */}
            <div className="flex-1 overflow-auto bg-surface-800/40 p-3">
              {docPreviewLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-3">
                  <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-[13px] text-surface-500">Kraunamas turinys...</p>
                </div>
              ) : docPreview ? (
                <div className="h-full min-h-[400px] rounded-lg border border-surface-700/40 bg-surface-900/60 p-5 overflow-auto">
                  <pre className="text-[13px] text-surface-300 leading-relaxed whitespace-pre-wrap font-[inherit] break-words">
                    {docPreview.content || 'Turinys neprieinamas.'}
                  </pre>
                </div>
              ) : ['png', 'jpg', 'jpeg'].includes(previewExt) ? (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <img
                    src={previewUrl!}
                    alt={previewFile!.name}
                    className="max-w-full max-h-full rounded-lg border border-surface-700/40 object-contain"
                  />
                </div>
              ) : previewExt === 'pdf' ? (
                <iframe
                  src={`${previewUrl!}#navpanes=0&scrollbar=1&view=FitH`}
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
              {displayItems.length > 0 && (
                <span className="text-[11px] font-mono text-surface-500 ml-1">
                  ({displayItems.length})
                </span>
              )}
            </div>
            <Tooltip content="Uždaryti failų sąrašą" side="bottom">
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-surface-400 hover:text-surface-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>

          {/* Stats bar */}
          {displayItems.length > 0 && (
            <div className="px-5 py-3 border-b border-surface-700/40 bg-surface-800/40 flex-shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-surface-500" />
                    <span className="text-[11px] font-bold text-surface-300">
                      {displayItems.length} {displayItems.length === 1 ? 'failas' : displayItems.length < 10 ? 'failai' : 'failų'}
                    </span>
                  </div>
                  <div className="w-px h-3 bg-surface-700/50" />
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-surface-500" />
                    <span className="text-[11px] font-mono text-surface-400">{formatSize(totalSize)}</span>
                  </div>
                  {totalPages > 0 && (
                    <>
                      <div className="w-px h-3 bg-surface-700/50" />
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-surface-500" />
                        <span className="text-[11px] font-mono text-surface-400">{totalPages} psl.</span>
                      </div>
                    </>
                  )}
                </div>
                {!isAnalysisMode && (
                  <Tooltip content="Pašalinti visus failus" side="top">
                    <button
                      onClick={() => {
                        appStore.setState({ files: [] });
                        closePreview();
                      }}
                      className="text-[10px] font-bold text-surface-600 hover:text-red-400 transition-colors uppercase tracking-wider"
                    >
                      Išvalyti
                    </button>
                  </Tooltip>
                )}
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
            {displayItems.length === 0 ? (
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
                {displayItems.map((item) => {
                  const ext = item.ext;
                  const isUploadFile = !isAnalysisMode;
                  const originalFile = isUploadFile ? state.files.find((f) => f.name === item.name) : null;
                  const isPreviewable = isUploadFile ? ['pdf', 'png', 'jpg', 'jpeg'].includes(ext) : true;
                  const isActive = isAnalysisMode
                    ? docPreview?.filename === item.name
                    : previewFile?.name === item.name;

                  return (
                    <div
                      key={item.name}
                      className={clsx(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-brand-500/5 border-brand-500/20"
                          : "bg-surface-800/50 border-surface-600/30 hover:border-surface-500/50 hover:bg-surface-700/50"
                      )}
                      onClick={() => {
                        if (isAnalysisMode) {
                          openDocPreview(item.name);
                        } else if (originalFile && ['pdf', 'png', 'jpg', 'jpeg'].includes(ext)) {
                          openPreview(originalFile);
                        }
                      }}
                    >
                      <FileTypeLogo extension={ext} size={20} />

                      <div className="flex-1 min-w-0">
                        <ScrollText className="text-[12px] font-semibold text-surface-200">{item.name}</ScrollText>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-surface-500">{formatSize(item.size)}</span>
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0 rounded"
                            style={{
                              backgroundColor: `${FILE_TYPE_INFO[ext]?.color || '#78909C'}15`,
                              color: `${FILE_TYPE_INFO[ext]?.color || '#78909C'}aa`,
                            }}
                          >
                            {ext}
                          </span>
                          {item.pages > 0 && (
                            <span className="text-[10px] font-mono text-surface-600">{item.pages} psl.</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isAnalysisMode ? (
                          <Tooltip content="Peržiūrėti turinį" side="top">
                            <button
                              onClick={(e) => { e.stopPropagation(); openDocPreview(item.name); }}
                              className={clsx(
                                "p-1.5 rounded-lg transition-all",
                                isActive
                                  ? "bg-brand-500/10 text-brand-400"
                                  : "opacity-0 group-hover:opacity-100 hover:bg-brand-500/10 text-surface-500 hover:text-brand-400"
                              )}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        ) : (
                          <>
                            {['pdf', 'png', 'jpg', 'jpeg'].includes(ext) && (
                              <Tooltip content="Peržiūrėti" side="top">
                                <button
                                  onClick={(e) => { e.stopPropagation(); originalFile && openPreview(originalFile); }}
                                  className={clsx(
                                    "p-1.5 rounded-lg transition-all",
                                    isActive
                                      ? "bg-brand-500/10 text-brand-400"
                                      : "opacity-0 group-hover:opacity-100 hover:bg-brand-500/10 text-surface-500 hover:text-brand-400"
                                  )}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip content="Pašalinti" side="top">
                              <button
                                onClick={(e) => { e.stopPropagation(); removeFile(item.name); }}
                                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-surface-500 hover:text-red-400 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add files — only in upload mode */}
          {!isAnalysisMode && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className="border-t border-surface-700/50 bg-surface-800/50 flex-shrink-0"
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
          )}

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
