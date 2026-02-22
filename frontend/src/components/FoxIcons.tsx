// frontend/src/components/FoxIcons.tsx
// Custom fox-themed SVG icons for sidebar navigation 🦊
// Each icon is a React component matching Lucide's interface
// Designed for 18-24px, warm amber + brand colors
// Related: IconSidebar.tsx

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

/* ── FoxScan — fox snout sniffing / searching 🔍🦊 ─────────── */
/* A fox nose in profile with a small magnifying glass — "sniffing out" documents */
export function FoxScan(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            {/* Fox snout — pointy nose going right */}
            <path d="M3 8 L3 5 L7 3" />
            <path d="M3 8 L3 11 L7 13" />
            <path d="M3 5 L10 7 L10 9 L3 11" />
            {/* Nose dot */}
            <circle cx="4" cy="8" r="1" fill="currentColor" stroke="none" />
            {/* Magnifying glass — the "search" */}
            <circle cx="16.5" cy="11.5" r="4.5" />
            <line x1="19.8" y1="14.8" x2="22" y2="17" strokeWidth="2.2" />
            {/* Sniff lines */}
            <path d="M10 6 L13 5" opacity="0.4" strokeDasharray="1 1.5" />
            <path d="M10 10 L13 11" opacity="0.4" strokeDasharray="1 1.5" />
        </svg>
    );
}

/* ── FoxPaw — paw print = "tracks" / history 🐾 ────────────── */
/* A fox paw print — three toes + pad. "Tracks = history" */
export function FoxPaw(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
            {/* Main pad — big heart shape at bottom */}
            <path d="M8.5 15 Q7 17 8 19 Q9 21 12 21 Q15 21 16 19 Q17 17 15.5 15 Q14 13.5 12 13.5 Q10 13.5 8.5 15Z" />
            {/* Toe beans — three */}
            <ellipse cx="8" cy="10" rx="2" ry="2.5" transform="rotate(-15, 8, 10)" />
            <ellipse cx="12" cy="8.5" rx="1.8" ry="2.5" />
            <ellipse cx="16" cy="10" rx="2" ry="2.5" transform="rotate(15, 16, 10)" />
        </svg>
    );
}

/* ── FoxNote — fox ears peeking over a notepad 📝🦊 ─────────── */
/* A sticky note with two fox ears poking up — playful! */
export function FoxNote(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            {/* Fox ears peeking over the note! */}
            <path d="M6 9 L8 4 L10.5 8" fill="currentColor" opacity="0.3" stroke="currentColor" />
            <path d="M13.5 8 L16 4 L18 9" fill="currentColor" opacity="0.3" stroke="currentColor" />
            {/* Note body */}
            <rect x="4" y="9" width="16" height="13" rx="2" />
            {/* Corner fold */}
            <path d="M15 22 L15 18 Q15 17 16 17 L20 17" fill="currentColor" opacity="0.1" stroke="currentColor" strokeWidth="1.2" />
            {/* Text lines */}
            <line x1="7.5" y1="13.5" x2="12" y2="13.5" opacity="0.5" />
            <line x1="7.5" y1="16.5" x2="14" y2="16.5" opacity="0.5" />
            <line x1="7.5" y1="19.5" x2="11" y2="19.5" opacity="0.5" />
        </svg>
    );
}

/* ── FoxGear — fox tail curled as settings ⚙️🦊 ─────────────── */
/* A fox tail curling into a gear/cog shape */
export function FoxGear(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            {/* Fluffy tail tip — curves up left */}
            <path d="M4 6 Q2 10 5 12 Q8 14 8 11" fill="currentColor" opacity="0.2" />
            <path d="M4 6 Q2 10 5 12 Q8 14 8 11" />
            {/* Main gear circle */}
            <circle cx="15" cy="14" r="3" />
            {/* Center dot */}
            <circle cx="15" cy="14" r="1" fill="currentColor" stroke="none" />
            {/* Gear teeth */}
            <line x1="15" y1="9" x2="15" y2="10.5" />
            <line x1="15" y1="17.5" x2="15" y2="19" />
            <line x1="10" y1="14" x2="11.5" y2="14" />
            <line x1="18.5" y1="14" x2="20" y2="14" />
            <line x1="11.5" y1="10.5" x2="12.5" y2="11.5" />
            <line x1="17.5" y1="16.5" x2="18.5" y2="17.5" />
            <line x1="11.5" y1="17.5" x2="12.5" y2="16.5" />
            <line x1="17.5" y1="11.5" x2="18.5" y2="10.5" />
            {/* Tail connecting to gear */}
            <path d="M8 11 Q10 10 11.5 12" strokeDasharray="2 1.5" opacity="0.4" />
        </svg>
    );
}

/* ── FoxHelp — fox face outline with "?" 🦊❓ ───────────────── */
/* Simplified fox face with a question mark */
export function FoxHelp(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            {/* Left ear */}
            <path d="M6 10 L8 4 L10.5 9" />
            {/* Right ear */}
            <path d="M13.5 9 L16 4 L18 10" />
            {/* Face outline */}
            <path d="M4 10 Q4 18 12 21 Q20 18 20 10" />
            {/* Question mark */}
            <path d="M10 13 Q10 10 12 10 Q14 10 14 12 Q14 13.5 12 14 L12 15" />
            <circle cx="12" cy="17.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
    );
}

/* ── FoxBrain — AI / intelligence 🧠🦊 ─────────────────────── */
/* Fox head with a tech/circuit node in the forehead area */
export function FoxBrain(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M6 10 L8 4 L10.5 9" />
            <path d="M13.5 9 L16 4 L18 10" />
            <path d="M4 10 Q4 18 12 21 Q20 18 20 10" />
            {/* Brain/AI node */}
            <circle cx="12" cy="11" r="2.5" />
            <circle cx="12" cy="11" r="1" fill="currentColor" stroke="none" />
            <path d="M12 8.5 V7" />
            <path d="M14.5 11 H16" />
            <path d="M9.5 11 H8" />
        </svg>
    );
}

/* ── FoxGuard — security / shield 🛡️🦊 ──────────────────────── */
/* A shield with fox ears poking up from the top */
export function FoxGuard(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            {/* Fox ears behind shield */}
            <path d="M8 6 L10 3 L12 6" fill="currentColor" opacity="0.2" />
            <path d="M12 6 L14 3 L16 6" fill="currentColor" opacity="0.2" />
            {/* Shield body */}
            <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" />
            {/* V shape inside */}
            <path d="M9 10 L12 13 L15 10" />
        </svg>
    );
}

/* ── FoxScroll — document / log 📜🦊 ────────────────────────── */
/* A scroll with fox ears at the top of the paper */
export function FoxScroll(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
            {/* Ears peeking */}
            <path d="M8 8 L10 3 L12 7" fill="currentColor" opacity="0.2" />
            <path d="M12 7 L14 3 L16 8" fill="currentColor" opacity="0.2" />
            {/* Scroll body */}
            <path d="M18 19V5C18 3.34315 16.6569 2 15 2H9C7.34315 2 6 3.34315 6 5V19C6 20.6569 7.34315 22 9 22H15C16.6569 22 18 20.6569 18 19Z" />
            <path d="M6 18H18" />
            {/* Text lines */}
            <line x1="9" y1="12" x2="15" y2="12" opacity="0.5" />
            <line x1="9" y1="15" x2="13" y2="15" opacity="0.5" />
        </svg>
    );
}
