import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * Contains a crash to one screen. The live presentation (which runs in its
 * own window) and the rest of the app keep working.
 */
export class ErrorBoundary extends Component<{ label: string; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}]`, error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle size={32} className="text-warn" />
        <div className="text-sm font-semibold">The {this.props.label} screen hit a problem</div>
        <div className="max-w-md text-[12px] text-muted">
          Your data is safe and the audience output is unaffected. You can retry, or switch to another screen and carry on with the service.
        </div>
        <pre className="max-w-lg overflow-auto rounded bg-panel-2 p-2 text-left text-[11px] text-dim">{this.state.error.message}</pre>
        <button type="button" className="rounded-md bg-accent px-3 py-1.5 text-[13px] text-white" onClick={() => this.setState({ error: null })}>
          Retry
        </button>
      </div>
    )
  }
}
