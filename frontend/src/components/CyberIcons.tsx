// frontend/src/components/CyberIcons.tsx
// Unique, custom-shaped SVG icons for the Cyber-Holographic UI
// Replaces generic Lucide icons for key hero/status areas

import React from 'react';

export const CyberCoreIcon = ({ className = 'w-12 h-12' }: { className?: string }) => (
    <div className={`relative flex items-center justify-center ${className}`}>
        {/* Orbital Rings */}
        <div className="absolute inset-0 border border-brand-500/20 rounded-full animate-[spin_10s_linear_infinite]" />
        <div className="absolute inset-2 border border-accent-500/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
        {/* Inner Monolith Crystal */}
        <div className="w-1/2 h-1/2 bg-gradient-holo clip-path-hex rotate-45 animate-pulse shadow-glow-brand"
            style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
    </div>
);

export const CyberDocIcon = ({ className = 'w-6 h-6' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2H14L20 8V22H4V2Z" className="stroke-surface-500" strokeWidth="1.5" />
        <path d="M14 2V8H20" className="stroke-surface-500" strokeWidth="1.5" />
        <rect x="7" y="12" width="10" height="1.5" className="fill-brand-400" />
        <rect x="7" y="15" width="6" height="1.5" className="fill-accent-400" />
        <circle cx="17" cy="18" r="1.5" className="fill-prism-500 animate-pulse" />
    </svg>
);

export const CyberHistoryIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
        <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M21 12C21 16.9706 16.9706 21 12 21" stroke="url(#prism-grad)" strokeWidth="2" strokeLinecap="round" />
        <defs>
            <linearGradient id="prism-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
        </defs>
    </svg>
);

export const CyberSettingsIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" className="opacity-20" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 8V6M12 18V16M16 12H18M6 12H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);
