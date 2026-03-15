import React, { Component, ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  module?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const api = (window as Record<string, unknown>).bytefix as
      | { logError?: (data: Record<string, unknown>) => void }
      | undefined
    if (api?.logError) {
      api.logError({
        module: this.props.module || 'unknown',
        message: error.message,
        stack: error.stack || '',
        componentStack: errorInfo.componentStack || '',
        timestamp: Date.now()
      })
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="p-6 bg-red-900/20 border border-red-500/50 rounded-lg m-4">
          <h3 className="text-red-400 text-lg font-semibold mb-2">
            Module Error{this.props.module ? `: ${this.props.module}` : ''}
          </h3>
          <p className="text-gray-300 text-sm mb-4">{this.state.error?.message}</p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
          >
            Retry Module
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function withErrorBoundary<P extends Record<string, unknown>>(
  WrappedComponent: React.ComponentType<P>,
  moduleName: string
): React.FC<P> {
  const WithErrorBoundaryWrapper: React.FC<P> = (props: P) => (
    <ErrorBoundary module={moduleName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  )
  WithErrorBoundaryWrapper.displayName = `withErrorBoundary(${moduleName})`
  return WithErrorBoundaryWrapper
}
