import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Catches render crashes so the app shows a recovery UI instead of a blank white page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-app-darker text-app-text p-6 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-app-muted max-w-md">
            The app hit an unexpected error. Reload to continue.
          </p>
          <pre className="text-xs text-red-300/90 max-w-lg overflow-auto whitespace-pre-wrap text-left bg-black/40 rounded-lg p-3">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="px-4 py-2 rounded-md bg-app-accent hover:bg-app-accent-hover text-white text-sm font-medium"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
