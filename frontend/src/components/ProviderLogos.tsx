// frontend/src/components/ProviderLogos.tsx
// Inline SVG logos for LLM providers, extracted from model ID prefix
// Provides recognizable brand marks for the model selector panel
// Related: ModelPanel.tsx

import React from 'react';

const SIZE = 18;

/** Extract provider prefix from model ID like "anthropic/claude-sonnet-4" → "anthropic" */
export function getProvider(modelId: string): string {
    return modelId.split('/')[0]?.toLowerCase() || '';
}

/** Provider brand colors — used for logos, card accents, fallback badges */
export const PROVIDER_COLORS: Record<string, string> = {
    anthropic: '#D4A574',
    openai: '#10A37F',
    google: '#4285F4',
    'meta-llama': '#0668E1',
    mistralai: '#F7D046',
    deepseek: '#4D6BFE',
    'x-ai': '#FFFFFF',
    cohere: '#D18EE2',
    qwen: '#6E56CF',
    microsoft: '#00A4EF',
    nvidia: '#76B900',
    perplexity: '#20808D',
    'amazon': '#FF9900',
    ai21: '#9B59B6',
    databricks: '#FF3621',
    together: '#E44D26',
    'moonshotai': '#6366F1',
    'z-ai': '#3B82F6',
};

/** Anthropic — Stylized A mark */
function AnthropicLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M13.827 3L21 21h-4.252l-1.456-3.74H9.068L12.2 10.474 9.597 3h4.23Z" fill="#D4A574" />
            <path d="M8.37 3 3 21h4.2l1.064-2.85h5.525L11.636 12 8.37 3Z" fill="#D4A574" opacity="0.7" />
        </svg>
    );
}

/** OpenAI — Hexagonal flower mark */
function OpenAILogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073ZM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494ZM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646ZM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872v.024Zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667Zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66v.018ZM8.322 12.814l-2.017-1.168a.075.075 0 0 1-.038-.057V6.013a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.4a.795.795 0 0 0-.393.681l-.004 6.734h.015Zm1.096-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5-.005-2.999Z" fill="#10A37F" />
        </svg>
    );
}

/** Google — Four-color G */
function GoogleLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
            <path d="M5.84 14.09A6.69 6.69 0 0 1 5.5 12c0-.72.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
        </svg>
    );
}

/** Meta — Infinity loop */
function MetaLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M6.915 4.03c-1.968 0-3.26 1.17-4.14 2.46C1.795 8.01 1.4 10.08 1.4 12c0 2.05.488 3.58 1.29 4.57C3.53 17.59 4.6 18 5.72 18c1.63 0 2.65-.72 3.63-1.94l1.08-1.36c.43-.54.86-1.1 1.3-1.7.48.65.96 1.26 1.42 1.82l.92 1.12C15.1 17.23 16.18 18 17.88 18c1.13 0 2.17-.39 2.98-1.36.82-.99 1.34-2.53 1.34-4.64 0-1.91-.42-3.97-1.4-5.52-.88-1.3-2.2-2.45-4.15-2.45-1.63 0-2.78.82-3.78 1.9l-.67.77-.31.38-.32-.4-.67-.78C10.74 4.82 9.56 4.03 7.93 4.03h-1.015Zm0 1.83h.58c.97 0 1.7.46 2.57 1.49l.86 1.04-1.58 2.04c-.86 1.12-1.55 1.74-2.57 1.74-.67 0-1.17-.22-1.55-.65-.4-.45-.72-1.24-.72-2.46 0-1.48.3-2.86.95-3.74.36-.5.84-.46 1.44-.46Zm9.25 0c.6 0 1.08-.04 1.44.46.66.88.95 2.26.95 3.74 0 1.59-.37 2.4-.83 2.84-.36.35-.81.26-1.48.26-1.03 0-1.67-.63-2.55-1.78l-.87-1.12 1.61-2.05c.9-1.17 1.54-1.51 1.73-1.35Z" fill="#0668E1" />
        </svg>
    );
}

/** Mistral — Orange/black M squares pattern */
function MistralLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="4" height="4" fill="#F7D046" />
            <rect x="18" y="3" width="4" height="4" fill="#F7D046" />
            <rect x="2" y="9" width="4" height="4" fill="#F7D046" />
            <rect x="6" y="9" width="4" height="4" fill="#F2A73B" />
            <rect x="14" y="9" width="4" height="4" fill="#F2A73B" />
            <rect x="18" y="9" width="4" height="4" fill="#F7D046" />
            <rect x="2" y="15" width="4" height="4" fill="#F7D046" />
            <rect x="10" y="15" width="4" height="4" fill="#EE792F" />
            <rect x="18" y="15" width="4" height="4" fill="#F7D046" />
        </svg>
    );
}

/** DeepSeek — Stylized D mark */
function DeepSeekLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" fill="#4D6BFE" opacity="0.15" />
            <path d="M8 5h4a7 7 0 0 1 0 14H8V5Z" fill="#4D6BFE" />
            <path d="M10 8h2a4 4 0 0 1 0 8h-2V8Z" fill="#1a1a2e" />
        </svg>
    );
}

/** xAI — Stylized x mark */
function XAILogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M4 4l7.2 8.5L4 21h1.8l6.1-7.2L18 21h2l-7.5-9L19.8 4H18l-5.7 6.6L6.2 4H4Z" fill="#FFFFFF" />
        </svg>
    );
}

/** Cohere — Stylized C mark */
function CohereLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 3a6 6 0 0 1 4.24 10.24L12 12V6Z" fill="#D18EE2" />
        </svg>
    );
}

/** Qwen / Alibaba — Stylized Q */
function QwenLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="11" r="8" stroke="#6E56CF" strokeWidth="2.5" fill="none" />
            <path d="M14 15l4 5" stroke="#6E56CF" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    );
}

/** Microsoft — Four-pane window */
function MicrosoftLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="8.5" height="8.5" fill="#F25022" />
            <rect x="12.5" y="3" width="8.5" height="8.5" fill="#7FBA00" />
            <rect x="3" y="12.5" width="8.5" height="8.5" fill="#00A4EF" />
            <rect x="12.5" y="12.5" width="8.5" height="8.5" fill="#FFB900" />
        </svg>
    );
}

/** NVIDIA — Eye/swoosh mark */
function NvidiaLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M8.948 8.798V6.852c.2-.015.4-.023.6-.023 4.366-.09 7.17 3.6 7.17 3.6s-3.47 4.35-6.77 4.35c-.37 0-.7-.06-1-.16V9.83c1.87.22 2.24.96 3.37 2.57l2.5-2.13S12.68 7.74 9.55 7.74c-.2 0-.4.02-.6.058ZM8.948 4V6.062c.2-.018.4-.03.6-.037C14.47 5.78 18.3 10.43 18.3 10.43s-4.58 5.35-8.35 5.35c-.36 0-.69-.04-1-.11v1.88c.27.035.55.058.83.058 3.65 0 6.28-1.85 8.84-4.08.43.35 2.2 1.19 2.56 1.56-2.47 2.03-8.23 4.38-11.33 4.38-.3 0-.59-.015-.87-.04V21h12.5V4H8.948ZM8.948 14.62v-4.79C6.378 9.46 4.1 12.1 4.1 12.1s1.67 2.53 4.848 2.77V14.62Z" fill="#76B900" />
        </svg>
    );
}

/** Amazon — Smile arrow */
function AmazonLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M13.958 10.09c0 1.232.029 2.256-.591 3.351-.502.891-1.301 1.438-2.186 1.438-1.214 0-1.922-.924-1.922-2.292 0-2.692 2.415-3.182 4.7-3.182v.685Zm3.186 7.705a.66.66 0 0 1-.753.073c-1.06-.879-1.247-1.287-1.826-2.125-1.748 1.782-2.983 2.315-5.248 2.315C6.828 18.058 5 16.536 5 13.85c0-2.088 1.131-3.51 2.745-4.207 1.397-.615 3.348-.725 4.839-.895v-.334c0-.613.048-1.337-.313-1.867-.314-.47-.916-.664-1.45-.664-1.066 0-1.899.61-2.12 1.528a.473.473 0 0 1-.397.407L5.78 7.53c-.15-.033-.316-.153-.273-.38C6.168 3.862 9.01 3 11.557 3c1.301 0 3.003.347 4.03 1.33C16.82 5.418 16.63 7.02 16.63 8.453v3.837c0 1.152.478 1.658.928 2.282.157.222.192.487-.01.652-.505.42-1.402 1.205-1.894 1.644l-.51-.073Z" fill="#FF9900" />
            <path d="M20.176 17.892c-1.845 1.36-4.524 2.088-6.827 2.088-3.23 0-6.14-1.194-8.34-3.18-.172-.156-.019-.368.19-.248 2.375 1.382 5.313 2.213 8.347 2.213 2.048 0 4.296-.424 6.366-1.303.312-.133.574.206.264.43Z" fill="#FF9900" />
        </svg>
    );
}

/** Perplexity — Stylized lens/search mark */
function PerplexityLogo({ size = SIZE }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5Z" stroke="#20808D" strokeWidth="1.5" fill="none" />
            <path d="M12 2v20M4 7l8 5 8-5M4 17l8-5 8 5" stroke="#20808D" strokeWidth="1.5" />
        </svg>
    );
}

const LOGO_MAP: Record<string, React.FC<{ size?: number }>> = {
    anthropic: AnthropicLogo,
    openai: OpenAILogo,
    google: GoogleLogo,
    'meta-llama': MetaLogo,
    mistralai: MistralLogo,
    deepseek: DeepSeekLogo,
    'x-ai': XAILogo,
    cohere: CohereLogo,
    qwen: QwenLogo,
    microsoft: MicrosoftLogo,
    nvidia: NvidiaLogo,
    amazon: AmazonLogo,
    perplexity: PerplexityLogo,
};

/** Fallback: colored circle with provider initial */
function FallbackLogo({ provider, size = SIZE }: { provider: string; size?: number }) {
    const color = PROVIDER_COLORS[provider] || '#8d8076';
    const initial = provider.charAt(0).toUpperCase();
    return (
        <div
            className="flex items-center justify-center rounded-md flex-shrink-0"
            style={{
                width: size,
                height: size,
                backgroundColor: `${color}20`,
                border: `1px solid ${color}30`,
            }}
        >
            <span
                className="font-bold leading-none"
                style={{ fontSize: size * 0.5, color }}
            >
                {initial}
            </span>
        </div>
    );
}

/** Main export: renders provider logo from model ID */
export function ProviderLogo({ modelId, size = SIZE }: { modelId: string; size?: number }) {
    const provider = getProvider(modelId);
    const LogoComponent = LOGO_MAP[provider];

    if (LogoComponent) {
        return (
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
                <LogoComponent size={size} />
            </div>
        );
    }

    return <FallbackLogo provider={provider} size={size} />;
}
