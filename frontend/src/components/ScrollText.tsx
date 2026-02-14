// frontend/src/components/ScrollText.tsx
// Text that fades out on the right when overflowing, and smoothly scrolls on hover
// Reusable across any truncated text field — replaces CSS truncate with a smarter UX
// Related: HistoryView.tsx (OrgNameCell), ModelPanel.tsx, FilesPanel.tsx

import { useEffect, useState, useRef } from 'react';

interface ScrollTextProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function ScrollText({ children, className = '', style }: ScrollTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      setOverflow(Math.max(0, el.scrollWidth - el.clientWidth));
    }
  }, [children]);

  const hasOverflow = overflow > 0;
  const scrollDuration = `${Math.max(0.6, overflow / 80)}s`;

  return (
    <span
      ref={containerRef}
      className={`block overflow-hidden whitespace-nowrap cursor-default ${className}`}
      style={{
        ...style,
        maskImage: hasOverflow && !hovered
          ? 'linear-gradient(to right, black calc(100% - 24px), transparent)'
          : undefined,
        WebkitMaskImage: hasOverflow && !hovered
          ? 'linear-gradient(to right, black calc(100% - 24px), transparent)'
          : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className="inline-block"
        style={{
          transform: hovered && hasOverflow ? `translateX(-${overflow + 6}px)` : 'translateX(0)',
          transitionProperty: 'transform',
          transitionDuration: scrollDuration,
          transitionTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
      >
        {children}
      </span>
    </span>
  );
}
