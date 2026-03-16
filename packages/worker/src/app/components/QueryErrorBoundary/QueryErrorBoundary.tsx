import { Component } from 'react'
import type { ReactNode } from 'react'

type QueryErrorBoundaryProps = {
  children: ReactNode
}

type QueryErrorBoundaryState = {
  error: Error | null
}

export default class QueryErrorBoundary extends Component<QueryErrorBoundaryProps, QueryErrorBoundaryState> {
  constructor(props: QueryErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
        <div className="text-sm text-[#e74c3c]">Something went wrong</div>
        <div className="max-w-md text-xs text-[#888]">{this.state.error.message}</div>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-2 cursor-pointer rounded border-none bg-[#333] px-4 py-1.5 text-sm text-white hover:bg-[#444]"
        >
          Retry
        </button>
      </div>
    )
  }
}
