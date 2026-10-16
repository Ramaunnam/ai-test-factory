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
  interfacesMatched: number
  interfacesTotal: number
}

export interface ConfidenceBreakdown {
  score: number
  capped: boolean
  parts: { label: string; weight: number; value: number; note: string }[]
}

/**
 * Deterministic. Never random. Capped at 79 while a critical finding is open,
 * which is why the gauge can sit at 79 with green inputs.
 */
export function confidence(input: ConfidenceInput): ConfidenceBreakdown {
  const checksPassing = input.checks.filter((c) => c.status === 'pass').length
  const checkScore = input.checks.length ? (checksPassing / input.checks.length) * 100 : 0
  const scenarioScore = input.scenariosTotal ? (input.scenariosPassed / input.scenariosTotal) * 100 : 0
  const interfaceScore = input.interfacesTotal
    ? (input.interfacesMatched / input.interfacesTotal) * 100
    : 0
  const open = input.findings.filter((f) => f.status === 'Open')
  const criticals = open.filter((f) => f.severity === 'Critical').length
  const highs = open.filter((f) => f.severity === 'High').length
  const findingScore = Math.max(0, 100 - criticals * 25 - highs * 10 - (open.length - criticals - highs) * 3)

  const parts = [
    {
      label: 'Live data checks',
      weight: 0.35,
      value: checkScore,
      note: `${checksPassing} of ${input.checks.length} checks agree across systems`,
    },
    {
      label: 'Scenario results',
      weight: 0.3,
      value: scenarioScore,
      note: `${input.scenariosPassed} of ${input.scenariosTotal} scenarios passed in the last run`,
    },
    {
      label: 'Interface matching',
      weight: 0.2,
      value: interfaceScore,
      note: `${input.interfacesMatched} of ${input.interfacesTotal} interfaces match field by field`,
    },
    {
      label: 'Open findings',
      weight: 0.15,
      value: findingScore,
      note: `${open.length} open (${criticals} critical, ${highs} high)`,
    },
  ]

  const raw = parts.reduce((sum, p) => sum + p.weight * p.value, 0)
  const capped = criticals > 0 && raw > 79
  return { score: Math.round(capped ? 79 : raw), capped, parts }
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
