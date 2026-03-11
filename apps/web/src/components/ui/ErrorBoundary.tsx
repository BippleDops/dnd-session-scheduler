'use client';
import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="parchment p-10 text-center max-w-lg mx-auto mt-10">
          <h2 className="font-[var(--font-heading)] text-xl text-[var(--blood-red)] mb-3">
            ⚠️ Something Went Wrong
          </h2>
          <p className="text-[var(--ink-faded)] mb-4">
            The magic fizzled. An unexpected error occurred.
          </p>
          <p className="text-xs text-[var(--ink-faded)] mb-4 font-mono bg-[rgba(0,0,0,0.05)] p-2 rounded break-all">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="wood-btn wood-btn-primary"
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
