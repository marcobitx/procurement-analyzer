// frontend/src/components/panels/panelHelpers.ts
// Shared constants and utility functions for right panel sub-components
// Extracted from RightPanel.tsx to avoid duplication across panel files
// Related: UploadPanel.tsx, AnalyzingPanel.tsx, ResultsPanel.tsx

import { FileText, Table2, Archive, Image } from 'lucide-react';

export const ACCEPTED = '.pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.zip';
export const MAX_SIZE_MB = 50;

export const FILE_ICONS: Record<string, { icon: any; color: string }> = {
  pdf: { icon: FileText, color: 'text-red-400' },
  docx: { icon: FileText, color: 'text-brand-400' },
  xlsx: { icon: Table2, color: 'text-emerald-400' },
  pptx: { icon: FileText, color: 'text-accent-400' },
  zip: { icon: Archive, color: 'text-brand-300' },
  png: { icon: Image, color: 'text-accent-300' },
  jpg: { icon: Image, color: 'text-accent-300' },
  jpeg: { icon: Image, color: 'text-accent-300' },
};

export function getFileInfo(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || { icon: FileText, color: 'text-surface-400' };
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}
