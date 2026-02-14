// frontend/src/lib/useFocusTrap.ts
// Lightweight focus trap hook for modal overlays (ModelPanel, ChatPanel)
// Keeps keyboard focus within the container when open
// Related: ModelPanel.tsx, ChatPanel.tsx

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    // Focus first focusable element on mount
    const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE);
    firstFocusable?.focus();

    return () => container.removeEventListener('keydown', handleKeyDown);
  }, []);

  return ref;
}
