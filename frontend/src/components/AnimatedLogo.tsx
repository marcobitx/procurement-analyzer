// frontend/src/components/AnimatedLogo.tsx
// "foxDoc" — Nerdy Tech Fox with Glasses 🦊🤓
// A playful fox with round glasses that periodically push up!
// The "adjusting glasses" gesture = classic nerd move
// Eyes wink + glasses lift = tons of personality
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
    const id = 'dk';

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
                viewBox="0 0 48 48"
                width={size}
                height={size}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="foxDoc"
                role="img"
            >
                <defs>
                    <linearGradient id={`${id}-fur`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fcd34d" />
                        <stop offset="45%" stopColor="#f59e0b" />
                        <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                    <linearGradient id={`${id}-dark`} x1="50%" y1="0%" x2="50%" y2="100%">
                        <stop offset="0%" stopColor="#d97706" />
                        <stop offset="100%" stopColor="#92400e" />
                    </linearGradient>
                    <radialGradient id={`${id}-eye`} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="50%" stopColor="#67e8f9" />
                        <stop offset="100%" stopColor="#06b6d4" />
                    </radialGradient>
                    <linearGradient id={`${id}-lens`} x1="30%" y1="0%" x2="70%" y2="100%">
                        <stop offset="0%" stopColor="#ecfeff" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.1" />
                    </linearGradient>
                    <filter id={`${id}-glow`} x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="1.3" result="b" />
                        <feFlood floodColor="#22d3ee" floodOpacity="0.55" result="c" />
                        <feComposite in="c" in2="b" operator="in" result="g" />
                        <feMerge>
                            <feMergeNode in="g" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id={`${id}-warm`} x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2" result="b" />
                        <feFlood floodColor="#f59e0b" floodOpacity="0.2" result="c" />
                        <feComposite in="c" in2="b" operator="in" result="g" />
                        <feMerge>
                            <feMergeNode in="g" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* ══════════════════════════════════════════════════════
            NERDY TECH FOX 🦊🤓  with glasses!
            ══════════════════════════════════════════════════════ */}

                {/* ── Ambient ─────────────────────────────────────────── */}
                <circle cx="24" cy="28" r="15" fill="#f59e0b" opacity="0.06"
                    filter={`url(#${id}-warm)`} className={animate ? 'dk-ambient' : ''} />

                {/* ── LEFT EAR ────────────────────────────────────────── */}
                <path d="M8 6 L16 22 L3 23 Z"
                    fill={`url(#${id}-fur)`} stroke="#b45309" strokeWidth="0.4" strokeLinejoin="round"
                    opacity={animate ? '0' : '1'}>
                    {animate && <animate attributeName="opacity" values="0;1" dur="0.2s" begin="0.05s" fill="freeze" />}
                </path>
                <path d="M9 10 L15 21 L5 22 Z" fill={`url(#${id}-dark)`} opacity="0.35" />

                {/* ── RIGHT EAR ───────────────────────────────────────── */}
                <path d="M40 6 L32 22 L45 23 Z"
                    fill={`url(#${id}-fur)`} stroke="#b45309" strokeWidth="0.4" strokeLinejoin="round"
                    opacity={animate ? '0' : '1'}>
                    {animate && <animate attributeName="opacity" values="0;1" dur="0.2s" begin="0.05s" fill="freeze" />}
                </path>
                <path d="M39 10 L33 21 L43 22 Z" fill={`url(#${id}-dark)`} opacity="0.35" />

                {/* ── HEAD ─────────────────────────────────────────────── */}
                <path
                    d="M3 23 L16 22 L24 18 L32 22 L45 23 L41 35 L33 41 L24 44 L15 41 L7 35 Z"
                    fill={`url(#${id}-fur)`} stroke="#b45309" strokeWidth="0.5" strokeLinejoin="round"
                    opacity={animate ? '0' : '1'}>
                    {animate && (
                        <animate attributeName="opacity" values="0;1" dur="0.3s" fill="freeze"
                            calcMode="spline" keySplines="0.16 1 0.3 1" />
                    )}
                </path>

                {/* Forehead */}
                <path d="M16 22 L24 18 L32 22 L28 26 L20 26 Z" fill="white" opacity="0.1" />
                {/* White muzzle */}
                <path d="M12 31 L24 27 L36 31 L32 39 L24 42 L16 39 Z" fill="#fef3c7" opacity="0.45" />
                {/* Cheek accents */}
                <path d="M3 23 L12 31 L7 35 Z" fill="#b45309" opacity="0.12" />
                <path d="M45 23 L36 31 L41 35 Z" fill="#b45309" opacity="0.12" />

                {/* ══════════════════════════════════════════════════════
            EYES — glowing cyan tech (behind glasses)
            ══════════════════════════════════════════════════════ */}

                {/* Left eye glow */}
                <circle cx="17" cy="28" r="3.5"
                    fill={`url(#${id}-eye)`} filter={`url(#${id}-glow)`}
                    opacity={animate ? '0' : '1'}
                    className={animate ? 'dk-wink-glow' : ''}>
                    {animate && <animate attributeName="opacity" values="0;1" dur="0.25s" begin="0.3s" fill="freeze" />}
                </circle>
                {/* Left pupil + highlights — hidden during wink */}
                <g className={animate ? 'dk-wink-open' : ''}>
                    <ellipse cx="17" cy="28" rx="0.9" ry="2.5" fill="#0e7490" opacity="0.85" />
                    <circle cx="15.8" cy="26.8" r="0.8" fill="white" opacity="0.9" />
                </g>
                {/* Left wink arc */}
                <path d="M13.5 28.5 Q17 25.5 20.5 28.5"
                    stroke="#78350f" strokeWidth="1.6" strokeLinecap="round" fill="none"
                    className={animate ? 'dk-wink-shut' : ''} opacity="0" />

                {/* Right eye glow */}
                <circle cx="31" cy="28" r="3.5"
                    fill={`url(#${id}-eye)`} filter={`url(#${id}-glow)`}
                    opacity={animate ? '0' : '1'} className={animate ? 'dk-eye-pulse' : ''}>
                    {animate && <animate attributeName="opacity" values="0;1" dur="0.25s" begin="0.3s" fill="freeze" />}
                </circle>
                {/* Right pupil */}
                <ellipse cx="31" cy="28" rx="0.9" ry="2.5" fill="#0e7490" opacity="0.85" />
                <circle cx="29.8" cy="26.8" r="0.8" fill="white" opacity="0.9" />

                {/* ══════════════════════════════════════════════════════
            GLASSES 🤓 — round, nerdy, with bridge!
            The whole group lifts up periodically ("adjusting glasses")
            ══════════════════════════════════════════════════════ */}

                <g className={animate ? 'dk-glasses' : ''}
                    style={{ transformOrigin: '24px 28px' }}
                    opacity={animate ? '0' : '1'}>
                    {animate && <animate attributeName="opacity" values="0;1" dur="0.25s" begin="0.35s" fill="freeze" />}

                    {/* Left lens */}
                    <circle cx="17" cy="28" r="5.5"
                        fill={`url(#${id}-lens)`}
                        stroke="#334155" strokeWidth="1.3"
                    />

                    {/* Right lens */}
                    <circle cx="31" cy="28" r="5.5"
                        fill={`url(#${id}-lens)`}
                        stroke="#334155" strokeWidth="1.3"
                    />

                    {/* Bridge */}
                    <path d="M22.5 27 Q24 25.5 25.5 27"
                        stroke="#334155" strokeWidth="1.2" strokeLinecap="round" fill="none" />

                    {/* Left arm — goes to ear */}
                    <line x1="11.5" y1="27" x2="7" y2="25"
                        stroke="#334155" strokeWidth="1" strokeLinecap="round" />

                    {/* Right arm */}
                    <line x1="36.5" y1="27" x2="41" y2="25"
                        stroke="#334155" strokeWidth="1" strokeLinecap="round" />

                    {/* Lens glare — left */}
                    <circle cx="14.5" cy="26" r="1.2" fill="white" opacity="0.4" />
                    {/* Lens glare — right */}
                    <circle cx="28.5" cy="26" r="1.2" fill="white" opacity="0.4" />
                </g>

                {/* ══════════════════════════════════════════════════════
            NOSE
            ══════════════════════════════════════════════════════ */}
                <path d="M22.5 34 Q24 32.5 25.5 34 Q24 35 22.5 34 Z"
                    fill="#78350f" opacity={animate ? '0' : '0.9'}>
                    {animate && <animate attributeName="opacity" values="0;0.9" dur="0.15s" begin="0.4s" fill="freeze" />}
                </path>

                {/* ── Smile ────────────────────────────────────────────── */}
                <path d="M18 37 Q21 40.5 24 40.5 Q27 40.5 30 37"
                    stroke="#78350f" strokeWidth="1.1" strokeLinecap="round" fill="none"
                    opacity={animate ? '0' : '0.65'}>
                    {animate && <animate attributeName="opacity" values="0;0.65" dur="0.2s" begin="0.45s" fill="freeze" />}
                </path>

                {/* Tongue */}
                <ellipse cx="24" cy="40" rx="2" ry="1.2"
                    fill="#f87171" opacity={animate ? '0' : '0.5'}>
                    {animate && <animate attributeName="opacity" values="0;0.5" dur="0.2s" begin="0.5s" fill="freeze" />}
                </ellipse>

                {/* ══════════════════════════════════════════════════════
            CIRCUIT TRACES
            ══════════════════════════════════════════════════════ */}

                <g opacity={animate ? '0' : '0.18'} className={animate ? 'dk-circuit' : ''}>
                    {animate && <animate attributeName="opacity" values="0;0.18" dur="0.3s" begin="0.55s" fill="freeze" />}
                    <line x1="24" y1="19.5" x2="24" y2="23" stroke="#22d3ee" strokeWidth="0.5" strokeLinecap="round" />
                    <circle cx="24" cy="23" r="0.5" fill="#22d3ee" />
                    <line x1="7" y1="29" x2="10" y2="29" stroke="#22d3ee" strokeWidth="0.4" strokeLinecap="round" />
                    <circle cx="7" cy="29" r="0.4" fill="#22d3ee" />
                    <line x1="41" y1="29" x2="38" y2="29" stroke="#22d3ee" strokeWidth="0.4" strokeLinecap="round" />
                    <circle cx="41" cy="29" r="0.4" fill="#22d3ee" />
                </g>

                {/* ══════════════════════════════════════════════════════
            FLOATING PARTICLES
            ══════════════════════════════════════════════════════ */}

                {animate && (
                    <g>
                        <rect x="1" y="11" width="2.5" height="3" rx="0.4" fill="#fbbf24" opacity="0">
                            <animate attributeName="opacity" values="0;0.5;0" dur="3.2s" repeatCount="indefinite" begin="1s" />
                            <animateTransform attributeName="transform" type="translate" values="0,0;-1,-2;0,0" dur="3.2s" repeatCount="indefinite" begin="1s" />
                        </rect>
                        <rect x="44" y="9" width="2.5" height="3" rx="0.4" fill="#fde68a" opacity="0">
                            <animate attributeName="opacity" values="0;0.4;0" dur="2.8s" repeatCount="indefinite" begin="1.6s" />
                            <animateTransform attributeName="transform" type="translate" values="0,0;1,-2;0,0" dur="2.8s" repeatCount="indefinite" begin="1.6s" />
                        </rect>
                        <path d="M2 35 L3 33 L4 35 L3 37 Z" fill="#22d3ee" opacity="0">
                            <animate attributeName="opacity" values="0;0.3;0" dur="2.5s" repeatCount="indefinite" begin="2s" />
                        </path>
                        <circle cx="46" cy="35" r="0.6" fill="#22d3ee" opacity="0">
                            <animate attributeName="opacity" values="0;0.25;0" dur="3s" repeatCount="indefinite" begin="1.4s" />
                        </circle>
                    </g>
                )}
            </svg>
        </div>
    );
}

/** Static compact mark */
export function LogoMark({ size = 24, className }: { size?: number; className?: string }) {
    return <AnimatedLogo size={size} animate={false} className={className} />;
}
