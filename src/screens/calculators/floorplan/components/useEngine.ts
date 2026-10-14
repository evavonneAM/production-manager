import { useSyncExternalStore } from 'react'
import type { Engine } from '../engine/engine'

/** Re-renders the calling component whenever the engine's state changes. */
export function useEngine(e: Engine) {
  useSyncExternalStore(e.subscribe, e.getVersion)
}
