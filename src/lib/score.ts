import type { CheckResult } from '@/sim/checks'
import type { Finding } from '@/data/appStore'

export type Band = 'good' | 'watch' | 'bad'

export function band(score: number): Band {
  if (score >= 80) return 'good'
  if (score >= 60) return 'watch'
  return 'bad'
}

export interface ConfidenceInput {
  checks: CheckResult[]
  findings: Finding[]
  scenariosPassed: number
  scenariosTotal: number
  /** Messages that arrived intact, and how many were sent. */
  messagesMatched: number
  messagesTotal: number
}

export interface ConfidenceBreakdown {
  score: number
  raw: number
  capped: boolean
  parts: { label: string; weight: number; value: number; note: string }[]
}

const WEIGHTS = { data: 0.35, scenarios: 0.3, interfaces: 0.2, findings: 0.15 }

/**
 * Deterministic, and measured at the level the business cares about: how many
 * records agree, not how many checks happen to be green. One failing check over
 * 500 clean records is a problem worth seeing, not a reason to call the whole
 * landscape untrustworthy.
 */
export function confidence(input: ConfidenceInput): ConfidenceBreakdown {
  const compared = input.checks.reduce((s, c) => s + c.compared, 0)
  const disagree = input.checks.reduce((s, c) => s + c.rows.length, 0)
  const agree = Math.max(0, compared - disagree)
  const dataScore = compared ? (agree / compared) * 100 : 100
  const checksPassing = input.checks.filter((c) => c.status === 'pass').length

  const scenarioScore = input.scenariosTotal ? (input.scenariosPassed / input.scenariosTotal) * 100 : 100

  const interfaceScore = input.messagesTotal ? (input.messagesMatched / input.messagesTotal) * 100 : 100

  const open = input.findings.filter((f) => f.status !== 'Closed')
  const criticals = open.filter((f) => f.severity === 'Critical').length
  const highs = open.filter((f) => f.severity === 'High').length
  const mediums = open.filter((f) => f.severity === 'Medium').length
  const lows = open.length - criticals - highs - mediums
  const findingScore = Math.max(10, 100 - criticals * 15 - highs * 6 - mediums * 2 - lows * 1)

  const parts = [
    {
      label: 'Data agreement across systems',
      weight: WEIGHTS.data,
      value: dataScore,
      note: `${agree.toLocaleString('en-GB')} of ${compared.toLocaleString('en-GB')} records compared agree · ${checksPassing} of ${input.checks.length} checks fully green`,
    },
    {
      label: 'Scenario results',
      weight: WEIGHTS.scenarios,
      value: scenarioScore,
      note: `${input.scenariosPassed} of ${input.scenariosTotal} scenarios passed in the last run`,
    },
    {
      label: 'Interface messages intact',
      weight: WEIGHTS.interfaces,
      value: interfaceScore,
      note: `${input.messagesMatched.toLocaleString('en-GB')} of ${input.messagesTotal.toLocaleString('en-GB')} messages arrived undamaged`,
    },
    {
      label: 'Open findings',
      weight: WEIGHTS.findings,
      value: findingScore,
      note: `${open.length} open: ${criticals} critical, ${highs} high, ${mediums + lows} other`,
    },
  ]

  const raw = parts.reduce((sum, p) => sum + p.weight * p.value, 0)
  const capped = criticals > 0 && raw > 79
  return { score: Math.round(capped ? 79 : raw), raw: Math.round(raw), capped, parts }
}

export function verdictOf(passed: number, failed: number, healed: number): 'PASS' | 'CONDITIONAL' | 'FAIL' {
  if (failed > 2) return 'FAIL'
  if (failed > 0 || healed > 0) return 'CONDITIONAL'
  return passed > 0 ? 'PASS' : 'CONDITIONAL'
}

export function gateDecision(score: number, blockers: number): 'GO' | 'CONDITIONAL' | 'NO-GO' {
  if (blockers > 1 || score < 55) return 'NO-GO'
  if (blockers > 0 || score < 80) return 'CONDITIONAL'
  return 'GO'
}
