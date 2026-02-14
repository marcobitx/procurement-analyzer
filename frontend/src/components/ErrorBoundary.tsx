// frontend/src/components/ErrorBoundary.tsx
// React error boundary — catches render errors and shows Lithuanian recovery UI
// Prevents entire app crash when a single view throws during render
// Related: App.tsx

import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 mb-5">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Įvyko klaida</h2>
          <p className="text-[13px] text-surface-400 max-w-sm mb-6">
            Nepavyko atvaizduoti šio rodinio. Bandykite iš naujo arba grįžkite į pradinį puslapį.
          </p>
          {this.state.error && (
            <pre className="text-[11px] text-red-300/70 font-mono bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 max-w-md mb-6 overflow-auto max-h-24">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            className="btn-professional flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Bandyti dar kartą
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
