import { useState, useCallback } from 'react'

interface LoadingState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface UseLoadingStateReturn<T> extends LoadingState<T> {
  execute: (...args: unknown[]) => Promise<T | null>
  reset: () => void
}

export function useLoadingState<T>(
  asyncFn: (...args: unknown[]) => Promise<T>
): UseLoadingStateReturn<T> {
  const [state, setState] = useState<LoadingState<T>>({
    data: null,
    loading: false,
    error: null
  })

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setState({ data: null, loading: true, error: null })
      try {
        const result = await asyncFn(...args)
        setState({ data: result, loading: false, error: null })
        return result
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setState({ data: null, loading: false, error: message })
        return null
      }
    },
    [asyncFn]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return { ...state, execute, reset }
}
