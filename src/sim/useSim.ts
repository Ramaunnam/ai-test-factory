import { useMemo, useSyncExternalStore } from 'react'
import { engine } from './engine'
import { runAllChecks, type CheckResult } from './checks'

/** Subscribe to the engine. The version number is the snapshot. */
export function useSimVersion(): number {
  return useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion)
}

export function useSim() {
  const version = useSimVersion()
  return { engine, version }
}

/** Live checks, recomputed whenever the plant moves (or frozen when paused). */
export function useChecks(live = true): CheckResult[] {
  const version = useSimVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => runAllChecks(), [live ? version : 0])
}
