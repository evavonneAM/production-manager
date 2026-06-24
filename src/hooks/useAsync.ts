import { useEffect, useState } from 'react'

type State<T> = { data?: T; loading: boolean; error?: string }

/**
 * Minimal data-loading hook: runs `run` on mount and whenever `deps` change,
 * tracking loading/error/data. Ignores results from stale runs on unmount.
 */
export function useAsync<T>(run: () => Promise<T>, deps: unknown[]): State<T> {
  const [state, setState] = useState<State<T>>({ loading: true })

  useEffect(() => {
    let active = true
    setState({ loading: true })
    run()
      .then((data) => active && setState({ data, loading: false }))
      .catch((e) =>
        active && setState({ loading: false, error: e instanceof Error ? e.message : String(e) }),
      )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
