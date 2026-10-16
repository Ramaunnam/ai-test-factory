import { useMemo } from 'react'
import { RUNS } from '@/data'
import { useStore } from '@/data/appStore'
import { useChecks } from '@/sim/useSim'
import { confidence, type ConfidenceInput } from '@/lib/score'
import { interfaceStats } from '@/lib/interfaceStats'

/** One set of inputs shared by every Command Centre tab, so they cannot disagree. */
export function useConfidenceInput(): ConfidenceInput {
  const checks = useChecks()
  const store = useStore()
  const last = RUNS[0]
  const ifStats = useMemo(() => interfaceStats(), [checks])
  return {
    checks,
    findings: store.findings,
    scenariosPassed: last.passed,
    scenariosTotal: last.scenarios,
    messagesMatched: ifStats.messagesMatched,
    messagesTotal: ifStats.messagesTotal,
  }
}

/** "What would the score be if this one thing were fixed?" — same maths, patched inputs. */
export function scoreIf(base: ConfidenceInput, patch: Partial<ConfidenceInput>): number {
  return confidence({ ...base, ...patch }).score
}
