import React from 'react';
import { getFriendlyErrorMessage } from '../lib/firestoreError';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const msg = getFriendlyErrorMessage(this.state.error);
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Ocorreu um erro inesperado
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 break-words leading-relaxed">
              {msg}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
