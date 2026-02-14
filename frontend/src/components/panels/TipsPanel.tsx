// frontend/src/components/panels/TipsPanel.tsx
// Context tips for views without document-specific content (history, settings)
// Shows helpful Lithuanian tips relevant to the current view
// Related: RightPanel.tsx

import { Lightbulb, BookMarked } from 'lucide-react';
import type { AppView } from '../../lib/store';

export default function TipsPanel({ view }: { view: AppView }) {
  const tips = view === 'history'
    ? [
      'Pasirinkite užbaigtą analizę norėdami peržiūrėti ataskaitą',
      'Galite ištrinti nebereikalingas analizes',
      'Kiekviena analizė saugoma su pilna ataskaita ir dokumentais',
    ]
    : [
      'Nustatykite OpenRouter API raktą prieš pradedant',
      'Rekomenduojamas modelis: Claude Sonnet 4',
      'API raktas saugomas tik jūsų serveryje',
    ];

  return (
    <>
      <div className="px-6 h-16 flex items-center border-b border-surface-700/50 bg-surface-950/20 backdrop-blur-md">
        <BookMarked className="w-3.5 h-3.5 text-brand-400" />
        <h3 className="text-[13px] font-bold text-surface-400 tracking-wider uppercase ml-2">Patarimai</h3>
      </div>

      <div className="flex-1 p-4 space-y-3 animate-fade-in">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-surface-800/20 border border-surface-700/50 animate-stagger"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <Lightbulb className="w-3.5 h-3.5 text-brand-400 mt-0.5 flex-shrink-0" />
            <span className="text-[12px] text-surface-400 leading-relaxed font-medium">{tip}</span>
          </div>
        ))}
      </div>
    </>
  );
}
