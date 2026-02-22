// frontend/src/components/AnimatedLogo.tsx
// Premium "A" lettermark logo — warm, friendly, tech-inspired
// Inspired by Airbnb (rounded warmth), Linear (clean strokes), Stripe (precision)
// The letter "A" uses smooth Bézier curves for a soft, approachable feel
// Pure SVG + CSS — zero dependencies

import { clsx } from 'clsx';

interface AnimatedLogoProps {
    size?: number;
    animate?: boolean;
    className?: string;
}

export default function AnimatedLogo({
    size = 32,
    animate = true,
    className,
}: AnimatedLogoProps) {
    // Unique ID prefix to avoid SVG filter collisions
    const id = 'al';

    return (
        <div
            className={clsx('al-root', className)}
            style={{
                width: size,
                height: size,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <svg
                viewBox="0 0 64 64"
                width={size}
                height={size}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Analizė Pro"
                role="img"
            >
                <defs>
                    {/* ── Warm gradient for the A stroke ────────────────── */}
                    <linearGradient id={`${id}-stroke`} x1="0%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%" stopColor="#fcd34d" />
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>

                    {/* ── Soft glow filter ──────────────────────────────── */}
                    <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2" result="b" />
                        <feFlood floodColor="#f59e0b" floodOpacity="0.35" result="c" />
                        <feComposite in="c" in2="b" operator="in" result="g" />
                        <feMerge>
                            <feMergeNode in="g" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* ── Bright point glow ─────────────────────────────── */}
                    <filter id={`${id}-pt`} x="-200%" y="-200%" width="500%" height="500%">
                        <feGaussianBlur stdDeviation="1.5" result="b" />
                        <feFlood floodColor="#fbbf24" floodOpacity="0.7" result="c" />
                        <feComposite in="c" in2="b" operator="in" result="g" />
                        <feMerge>
                            <feMergeNode in="g" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>

                    {/* ── Traveling light mask ──────────────────────────── */}
                    <linearGradient id={`${id}-sweep`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="white" stopOpacity="0">
                            {animate && (
                                <animate attributeName="offset" values="-0.3;1.3" dur="3s" repeatCount="indefinite" />
                            )}
                        </stop>
                        <stop offset="15%" stopColor="white" stopOpacity="1">
                            {animate && (
                                <animate attributeName="offset" values="-0.15;1.45" dur="3s" repeatCount="indefinite" />
                            )}
                        </stop>
                        <stop offset="30%" stopColor="white" stopOpacity="0">
                            {animate && (
                                <animate attributeName="offset" values="0;1.6" dur="3s" repeatCount="indefinite" />
                            )}
                        </stop>
                    </linearGradient>

                    <mask id={`${id}-sweep-mask`}>
                        <rect x="0" y="0" width="64" height="64" fill={`url(#${id}-sweep)`} />
                    </mask>
                </defs>

                {/* ══════════════════════════════════════════════════════
            THE LETTER "A" — Soft, rounded Bézier curves
            
            Structure:
            - Rounded apex with quadratic curve (warm, friendly)
            - Smooth legs with gentle curves at the base
            - Rounded crossbar
            ══════════════════════════════════════════════════════ */}

                {/* ── Shadow "A" — very subtle depth layer ────────────── */}
                <path
                    d="M14 54 Q14 50 16 47 L28 18 Q32 10 36 18 L48 47 Q50 50 50 54 M22 39 Q23 37 25 37 L39 37 Q41 37 42 39"
                    stroke="#f59e0b"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.06"
                    filter={`url(#${id}-glow)`}
                />

                {/* ── Left leg — smooth curve from base to rounded apex ─ */}
                <path
                    d="M14 54 Q14 50 16 47 L28 18 Q32 10 36 18"
                    stroke={`url(#${id}-stroke)`}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#${id}-glow)`}
                    strokeDasharray={animate ? '60' : 'none'}
                    strokeDashoffset={animate ? '60' : '0'}
                >
                    {animate && (
                        <animate
                            attributeName="stroke-dashoffset"
                            from="60" to="0"
                            dur="0.8s" fill="freeze"
                            calcMode="spline"
                            keySplines="0.25 0.1 0.25 1"
                        />
                    )}
                </path>

                {/* ── Right leg — smooth from apex to base ────────────── */}
                <path
                    d="M36 18 L48 47 Q50 50 50 54"
                    stroke={`url(#${id}-stroke)`}
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#${id}-glow)`}
                    strokeDasharray={animate ? '50' : 'none'}
                    strokeDashoffset={animate ? '50' : '0'}
                >
                    {animate && (
                        <animate
                            attributeName="stroke-dashoffset"
                            from="50" to="0"
                            dur="0.7s" begin="0.2s" fill="freeze"
                            calcMode="spline"
                            keySplines="0.25 0.1 0.25 1"
                        />
                    )}
                </path>

                {/* ── Crossbar — softly curved ─────────────────────── */}
                <path
                    d="M22 39 Q23 37 25 37 L39 37 Q41 37 42 39"
                    stroke={`url(#${id}-stroke)`}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#${id}-glow)`}
                    strokeDasharray={animate ? '28' : 'none'}
                    strokeDashoffset={animate ? '28' : '0'}
                >
                    {animate && (
                        <animate
                            attributeName="stroke-dashoffset"
                            from="28" to="0"
                            dur="0.5s" begin="0.6s" fill="freeze"
                            calcMode="spline"
                            keySplines="0.25 0.1 0.25 1"
                        />
                    )}
                </path>

                {/* ── Light sweep overlay — shimmer traveling across ──── */}
                {animate && (
                    <g mask={`url(#${id}-sweep-mask)`}>
                        <path
                            d="M14 54 Q14 50 16 47 L28 18 Q32 10 36 18 L48 47 Q50 50 50 54 M22 39 Q23 37 25 37 L39 37 Q41 37 42 39"
                            stroke="#fff"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.35"
                        />
                    </g>
                )}

                {/* ── Vertex accents — soft dots at endpoints ─────────── */}
                {/* Top apex — centered at the curve peak */}
                <circle cx="32" cy="11" r="2" fill="#fbbf24" filter={`url(#${id}-pt)`}
                    opacity={animate ? '0' : '0.7'}>
                    {animate && (
                        <animate attributeName="opacity" values="0;0.7" dur="0.4s" begin="0.9s" fill="freeze" />
                    )}
                </circle>

                {/* Bottom-left — at curve end */}
                <circle cx="14" cy="54" r="1.5" fill="#f59e0b" filter={`url(#${id}-pt)`}
                    opacity={animate ? '0' : '0.5'}>
                    {animate && (
                        <animate attributeName="opacity" values="0;0.5" dur="0.3s" begin="1.0s" fill="freeze" />
                    )}
                </circle>

                {/* Bottom-right — at curve end */}
                <circle cx="50" cy="54" r="1.5" fill="#f59e0b" filter={`url(#${id}-pt)`}
                    opacity={animate ? '0' : '0.5'}>
                    {animate && (
                        <animate attributeName="opacity" values="0;0.5" dur="0.3s" begin="1.1s" fill="freeze" />
                    )}
                </circle>

                {/* ── Continuous light pulse traveling the A edges ────── */}
                {animate && (
                    <>
                        <circle r="1.3" fill="#fbbf24" filter={`url(#${id}-pt)`}>
                            <animateMotion
                                dur="4s"
                                repeatCount="indefinite"
                                begin="1.5s"
                                path="M14,54 Q14,50 16,47 L28,18 Q32,10 36,18 L48,47 Q50,50 50,54"
                            />
                            <animate
                                attributeName="opacity"
                                values="0;0.8;0.8;0.8;0"
                                dur="4s"
                                repeatCount="indefinite"
                                begin="1.5s"
                            />
                        </circle>
                    </>
                )}
            </svg>

            {/* ── Ambient background glow ───────────────────────────── */}
            {animate && (
                <div
                    className="al-ambient"
                    style={{
                        position: 'absolute',
                        inset: '-35%',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 60%)',
                        pointerEvents: 'none',
                        zIndex: -1,
                    }}
                />
            )}
        </div>
    );
}

/** Static compact mark for collapsed sidebar / favicon */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
    return <AnimatedLogo size={size} animate={false} className={className} />;
}
