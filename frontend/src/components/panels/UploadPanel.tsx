// frontend/src/components/panels/UploadPanel.tsx
// File drop zone + compact file summary + submit button for the upload view
// Shows only file count and total size; full list opens in FilesPanel slide-over
// Related: FilesPanel.tsx, panelHelpers.ts, store.ts, api.ts

import { useState, useRef, useCallback } from 'react';
import { Upload, Cpu, Loader2, FolderOpen, ChevronRight, FileText, HardDrive } from 'lucide-react';
import { appStore, useStore, startAnalysisStream } from '../../lib/store';
import { createAnalysis } from '../../lib/api';
import { ACCEPTED, MAX_SIZE_MB, formatSize } from './panelHelpers';
import { FileTypeStripCompact, FILE_TYPE_INFO } from '../FileTypeLogos';

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function getFormatChips(files: File[]): { ext: string; count: number; color: string }[] {
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

export default function UploadPanel() {
  const state = useStore(appStore);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter((f) => {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`${f.name} per didelis (maks. ${MAX_SIZE_MB}MB)`);
        return false;
      }
      return true;
    });
    const currentFiles = appStore.getState().files;
    const names = new Set(currentFiles.map((f) => f.name));
    const uniqueNew = valid.filter((f) => !names.has(f.name));
    if (uniqueNew.length) {
      appStore.setState({ files: [...currentFiles, ...uniqueNew] });
      setError(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles],
  );

  const handleSubmit = async () => {
    const files = appStore.getState().files;
    if (!files.length || appStore.getState().uploading) return;
    appStore.setState({ uploading: true });
    setError(null);
    try {
      const selectedModelId = appStore.getState().selectedModel?.id;
      const result = await createAnalysis(files, selectedModelId);
      startAnalysisStream(result.id);
      appStore.setState({
        view: 'analyzing',
        currentAnalysisId: result.id,
        uploading: false,
        error: null,
        reviewMode: false,
        analysisSnapshot: null,
      });
    } catch (e: any) {
      setError(e.message || 'Nepavyko įkelti failų');
      appStore.setState({ uploading: false });
    }
  };

  const openFilesPanel = () => {
    appStore.setState({ filesPanelOpen: true });
  };

  const totalSize = state.files.reduce((s, f) => s + f.size, 0);
  const formats = getFormatChips(state.files);

  return (
    <>
      {/* Header */}
      <div className="px-5 h-12 flex items-center border-b border-surface-700/50">
        <FolderOpen className="w-3.5 h-3.5 text-brand-400" />
        <h3 className="text-[11px] font-bold text-surface-400 tracking-widest uppercase ml-2">Dokumentai</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed cursor-pointer p-6 text-center transition-all duration-200 ${dragOver
            ? 'border-brand-500/50 bg-brand-500/5'
            : 'border-surface-700/50 hover:border-surface-600/70 hover:bg-white/[0.03]'
            }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            onChange={(e) => e.target.files && addFiles(e.target.files)}
            className="hidden"
          />
          <Upload className={`w-6 h-6 mx-auto mb-3 transition-all duration-300 ${dragOver ? 'text-brand-400 scale-110' : 'text-surface-500'}`} />
          <p className="text-[12px] text-surface-400 font-medium mb-2.5">
            {dragOver ? 'Paleiskite čia' : 'Nutempkite arba paspauskite'}
          </p>
          <FileTypeStripCompact iconSize={14} />
          <p className="text-[10px] text-surface-600 mt-2">
            Maks. {MAX_SIZE_MB}MB
          </p>
        </div>

        {/* Compact file summary — click to open FilesPanel */}
        {state.files.length > 0 && (
          <button
            onClick={openFilesPanel}
            className="w-full group animate-fade-in"
          >
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-surface-900/50 border border-surface-700/50 hover:border-brand-500/20 hover:bg-surface-800/50 transition-all duration-200">
              {/* Left — icon */}
              <div className="w-9 h-9 rounded-lg bg-brand-500/8 border border-brand-500/15 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-4 h-4 text-brand-400" />
              </div>

              {/* Center — stats */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-bold text-surface-200">
                    {state.files.length} {state.files.length === 1 ? 'failas' : state.files.length < 10 ? 'failai' : 'failų'}
                  </span>
                  <span className="text-[10px] text-surface-600">|</span>
                  <span className="text-[10px] font-mono text-surface-400">{formatSize(totalSize)}</span>
                </div>

                {/* Format chips */}
                <div className="flex items-center gap-1 flex-wrap">
                  {formats.map(({ ext, count, color }) => (
                    <span
                      key={ext}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[8px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${color}12`,
                        color: `${color}aa`,
                      }}
                    >
                      {ext}
                      {count > 1 && <span style={{ color: `${color}70` }}>{count}</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right — chevron */}
              <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-brand-400 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </div>
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-red-500/8 border border-red-500/15 text-[12px] text-red-300 animate-fade-in">
            {error}
          </div>
        )}
      </div>

      {/* Submit */}
      {state.files.length > 0 && (
        <div className="p-4 border-t border-surface-700/50 animate-fade-in">
          <button
            onClick={handleSubmit}
            disabled={state.uploading}
            className="btn-professional w-full"
          >
            {state.uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Įkeliama...</span>
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4" />
                <span>Vykdyti analizę</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
