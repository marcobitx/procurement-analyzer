// frontend/src/components/ModelCarousel.tsx
// Infinite-scroll logo carousel showing supported AI model providers
// Builds trust by displaying recognizable brand logos on the upload page
// Related: UploadView.tsx, ProviderLogos.tsx

import { ProviderLogo, PROVIDER_COLORS } from './ProviderLogos';

interface Provider {
  name: string;
  key: string;      // matches ProviderLogos LOGO_MAP key
  modelId: string;  // fake model ID to feed ProviderLogo
}

const PROVIDERS: Provider[] = [
  { name: 'Anthropic', key: 'anthropic', modelId: 'anthropic/claude' },
  { name: 'OpenAI', key: 'openai', modelId: 'openai/gpt' },
  { name: 'Gemini', key: 'google', modelId: 'google/gemini' },
  { name: 'Meta AI', key: 'meta-llama', modelId: 'meta-llama/llama' },
  { name: 'Mistral', key: 'mistralai', modelId: 'mistralai/mistral' },
  { name: 'DeepSeek', key: 'deepseek', modelId: 'deepseek/deepseek' },
  { name: 'Cohere', key: 'cohere', modelId: 'cohere/command' },
  { name: 'xAI', key: 'x-ai', modelId: 'x-ai/grok' },
  { name: 'Qwen', key: 'qwen', modelId: 'qwen/qwen' },
  { name: 'Google', key: 'google', modelId: 'google/gemma' },
];

function ProviderPill({ p, suffix }: { p: Provider; suffix: string }) {
  const color = PROVIDER_COLORS[p.key] || '#8d8076';

  return (
    <div
      key={`${suffix}-${p.name}`}
      className="flex items-center gap-2 px-4 py-1.5 mx-1.5 rounded-full border bg-surface-900/20 transition-all duration-300 flex-shrink-0 cursor-default select-none hover:bg-surface-800/40"
      style={{ borderColor: `${color}25` }}
    >
      <ProviderLogo modelId={p.modelId} size={16} />
      <span
        className="text-[11px] font-semibold tracking-tight whitespace-nowrap"
        style={{ color }}
      >
        {p.name}
      </span>
    </div>
  );
}

export default function ModelCarousel() {
  return (
    <div className="mt-8 md:mt-10 animate-fade-in" style={{ animationDelay: '500ms' }}>
      <p className="text-center text-[9px] font-bold uppercase tracking-[0.25em] text-surface-600/70 mb-3">
        Palaikomi AI modeliai
      </p>

      <div className="relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-surface-950 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-surface-950 to-transparent z-10 pointer-events-none" />

        <div className="flex marquee-track hover:[animation-play-state:paused]">
          {PROVIDERS.map((p) => (
            <ProviderPill key={`a-${p.name}`} p={p} suffix="a" />
          ))}
          {PROVIDERS.map((p) => (
            <ProviderPill key={`b-${p.name}`} p={p} suffix="b" />
          ))}
        </div>
      </div>
    </div>
  );
}
