import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** A crash shows a panel with the reason, never a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('J2W caught a render error:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid h-full place-items-center p-6">
        <div className="w-full max-w-xl rounded-lg border border-danger/40 bg-surface p-6 shadow-md">
          <div className="mb-3 flex items-center gap-2.5">
            <AlertTriangle size={18} className="text-danger" />
            <h1 className="text-lg font-semibold text-text">Something on this page stopped working</h1>
          </div>
          <p className="text-sm text-muted">
            The rest of the factory is fine. This panel exists so a single broken screen never takes the whole app
            down.
          </p>
          <pre className="j2w-scroll mt-3 max-h-40 overflow-auto rounded-md border border-line bg-surface2 p-3 font-mono text-[11.5px] text-danger">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="h-[34px] rounded-md border border-transparent bg-primary px-3.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/'
                this.setState({ error: null })
              }}
              className="h-[34px] rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-text transition-colors hover:bg-surface2"
            >
              Back to the Command Centre
            </button>
          </div>
        </div>
      </div>
    )
  }
}
