// frontend/src/components/FileTypeLogos.tsx
// Recognizable file-type brand SVG logos for the upload drop zones
// Mirrors the ProviderLogos.tsx pattern — one SVG component per file type
// Related: UploadView.tsx, UploadPanel.tsx

import React from 'react';

const SIZE = 20;

/** PDF — Adobe-style red document mark */
function PdfLogo({ size = SIZE }: { size?: number }) {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
      <rect x="3" y="1" width="26" height="30" rx="3" fill="#E5252A" />
      <path d="M7 1h15l7 7v19a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V5a4 4 0 0 1 4-4Z" fill="#F44336" />
      <path d="M22 1l7 7h-5a2 2 0 0 1-2-2V1Z" fill="#D32F2F" />
      <text x="16" y="23" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="Arial, sans-serif" fill="white" letterSpacing="0.5">PDF</text>
    </svg>
  );
}

/** DOCX — Microsoft Word blue W mark */
function DocxLogo({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#2B579A" />
      <path d="M8 10h2.5l2.5 8.5L15.5 10H18l2.5 8.5L23 10h2.5L21.5 24h-2l-3-9.5L13.5 24h-2L8 10Z" fill="white" />
    </svg>
  );
}

/** XLSX — Microsoft Excel green X mark */
function XlsxLogo({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#217346" />
      <path d="M10 9l5.5 7L10 23h3.5l3.5-5 3.5 5H24l-5.5-7L24 9h-3.5L17 14l-3.5-5H10Z" fill="white" />
    </svg>
  );
}

/** PPTX — Microsoft PowerPoint orange P mark */
function PptxLogo({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#D24726" />
      <path d="M12 8h6a5.5 5.5 0 0 1 0 11h-3v5h-3V8Zm3 3v5h3a2.5 2.5 0 0 0 0-5h-3Z" fill="white" />
    </svg>
  );
}

/** PNG — Image/photo icon (landscape with sun) */
function PngLogo({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="4" width="28" height="24" rx="4" fill="#8E24AA" />
      <circle cx="11" cy="13" r="3" fill="#CE93D8" />
      <path d="M6 26l6-8 4 5 4-6 6 9H6Z" fill="#AB47BC" />
      <path d="M16 17l4-6 6 9H16l4-3Z" fill="#CE93D8" opacity="0.7" />
    </svg>
  );
}

/** JPG — Camera/photo icon */
function JpgLogo({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="4" width="28" height="24" rx="4" fill="#00897B" />
      <circle cx="11" cy="13" r="3" fill="#80CBC4" />
      <path d="M6 26l6-8 4 5 4-6 6 9H6Z" fill="#26A69A" />
      <path d="M16 17l4-6 6 9H16l4-3Z" fill="#80CBC4" opacity="0.7" />
    </svg>
  );
}

/** ZIP — Archive folder with zipper */
function ZipLogo({ size = SIZE }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="2" y="2" width="28" height="28" rx="4" fill="#78909C" />
      <rect x="13" y="2" width="3" height="3" fill="#546E7A" />
      <rect x="16" y="5" width="3" height="3" fill="#546E7A" />
      <rect x="13" y="8" width="3" height="3" fill="#546E7A" />
      <rect x="16" y="11" width="3" height="3" fill="#546E7A" />
      <rect x="13" y="14" width="3" height="3" fill="#546E7A" />
      <rect x="12" y="18" width="8" height="10" rx="2" fill="#546E7A" />
      <rect x="14" y="20" width="4" height="4" rx="1" fill="#B0BEC5" />
      <rect x="15" y="22" width="2" height="1" rx="0.5" fill="#546E7A" />
    </svg>
  );
}

/** File type metadata — logo component, brand color, label */
export const FILE_TYPE_INFO: Record<string, { logo: React.FC<{ size?: number }>; color: string; label: string }> = {
  pdf:  { logo: PdfLogo,  color: '#F44336', label: 'PDF' },
  docx: { logo: DocxLogo, color: '#2B579A', label: 'DOCX' },
  xlsx: { logo: XlsxLogo, color: '#217346', label: 'XLSX' },
  pptx: { logo: PptxLogo, color: '#D24726', label: 'PPTX' },
  png:  { logo: PngLogo,  color: '#8E24AA', label: 'PNG' },
  jpg:  { logo: JpgLogo,  color: '#00897B', label: 'JPG' },
  zip:  { logo: ZipLogo,  color: '#78909C', label: 'ZIP' },
};

const FILE_TYPES = ['pdf', 'docx', 'xlsx', 'pptx', 'png', 'jpg', 'zip'] as const;

/** Compact horizontal strip of file type logos with labels — for drop zones */
export function FileTypeStrip({ iconSize = 18, showLabels = true }: { iconSize?: number; showLabels?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {FILE_TYPES.map((ext) => {
        const { logo: Logo, color, label } = FILE_TYPE_INFO[ext];
        return (
          <div
            key={ext}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-200"
            style={{
              backgroundColor: `${color}08`,
              border: `1px solid ${color}18`,
            }}
          >
            <Logo size={iconSize} />
            {showLabels && (
              <span
                className="text-[10px] font-bold tracking-wide"
                style={{ color: `${color}cc` }}
              >
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Smaller inline strip — for sidebar panel drop zones */
export function FileTypeStripCompact({ iconSize = 14 }: { iconSize?: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {FILE_TYPES.map((ext) => {
        const { logo: Logo, color } = FILE_TYPE_INFO[ext];
        return (
          <div
            key={ext}
            className="inline-flex items-center justify-center rounded transition-all duration-200"
            style={{
              width: iconSize + 6,
              height: iconSize + 6,
              backgroundColor: `${color}10`,
              border: `1px solid ${color}15`,
            }}
            title={ext.toUpperCase()}
          >
            <Logo size={iconSize} />
          </div>
        );
      })}
    </div>
  );
}

/** Single file type logo — for use in file lists */
export function FileTypeLogo({ extension, size = 16 }: { extension: string; size?: number }) {
  const ext = extension.toLowerCase().replace('.', '');
  const info = FILE_TYPE_INFO[ext];
  if (!info) {
    return (
      <div
        className="flex items-center justify-center rounded flex-shrink-0 bg-surface-700/30 border border-surface-600/30"
        style={{ width: size, height: size }}
      >
        <span className="text-surface-400 font-bold" style={{ fontSize: size * 0.4 }}>?</span>
      </div>
    );
  }
  const Logo = info.logo;
  return (
    <div className="flex-shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <Logo size={size} />
    </div>
  );
}
