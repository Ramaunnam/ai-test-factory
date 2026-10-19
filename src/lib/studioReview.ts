import { PROCESSES, RUNS, type Scenario } from '@/data'
import { JOURNEY_REQUIREMENTS, screensForRequirement, stepsCovering } from '@/data/journey'
import type { Finding, RunRecord } from '@/data/appStore'
import type { CheckResult } from '@/sim/checks'

/**
 * What the AI review reports. Every number is read from the scenario library,
 * the live checks, the findings and the runs — nothing is stored.
 */
export type Risk = 'Low' | 'Medium' | 'High'

export interface WorkflowReview {
  id: string
  name: string
  stages: number
  tested: number
  /** Stage names with no scenario against them. */
  untested: string[]
  coverage: number
  scenarios: number
  approved: number
  pending: number
  failingChecks: string[]
  openFindings: number
  risk: Risk
}

export interface ReviewGap {
  id: string
  workflow: string
  stage: string
  stageId: string
  type: Scenario['type']
  name: string
  why: string
}

export interface StudioReview {
  coverage: number
  stages: number
  tested: number
  total: number
  byType: { Positive: number; Negative: number; Regression: number }
  approved: number
  pending: number
  lastRun: RunRecord | (typeof RUNS)[number]
  workflows: WorkflowReview[]
  gaps: ReviewGap[]
  requirements: { id: string; group: string; short: string; full: string; steps: number[]; screens: { label: string; route: string }[] }[]
}

export interface ReviewInput {
  scenarios: Scenario[]
  scenarioStatus: Record<string, 'Approved' | 'Pending approval' | 'Rejected'>
  findings: Finding[]
  checks: CheckResult[]
  runs: RunRecord[]
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)

export function studioReview(input: ReviewInput): StudioReview {
  const { scenarios, scenarioStatus, findings, checks, runs } = input
  const open = findings.filter((f) => f.status !== 'Closed')
  const failing = checks.filter((c) => c.status === 'fail')

  const workflows: WorkflowReview[] = PROCESSES.map((p) => {
    const mine = scenarios.filter((s) => s.process === p.id)
    const untested = p.stages.filter((st) => !mine.some((s) => s.stageId === st.id)).map((st) => st.name)
    const tested = p.stages.length - untested.length
    const failingChecks = failing.filter((c) => c.process === p.id).map((c) => c.id)
    const openFindings = open.filter((f) => f.process === p.id).length
    const coverage = pct(tested, p.stages.length)
    const risk: Risk =
      failingChecks.length && untested.length ? 'High' : failingChecks.length || untested.length ? 'Medium' : 'Low'
    return {
      id: p.id,
      name: p.name,
      stages: p.stages.length,
      tested,
      untested,
      coverage,
      scenarios: mine.length,
      approved: mine.filter((s) => (scenarioStatus[s.id] ?? 'Approved') === 'Approved').length,
      pending: mine.filter((s) => scenarioStatus[s.id] === 'Pending approval').length,
      failingChecks,
      openFindings,
      risk,
    }
  })

  const stages = workflows.reduce((n, w) => n + w.stages, 0)
  const tested = workflows.reduce((n, w) => n + w.tested, 0)

  /* What the review would add: a normal path for every stage with no test, and
     a re-test for every rule the live data is currently breaking. */
  const gaps: ReviewGap[] = []
  PROCESSES.forEach((p) => {
    p.stages.forEach((st) => {
      if (scenarios.some((s) => s.stageId === st.id)) return
      gaps.push({
        id: `GAP-${st.id}`,
        workflow: `${p.id} ${p.name}`,
        stage: st.name,
        stageId: st.id,
        type: 'Positive',
        name: `${st.name} works end to end`,
        why: 'No scenario proves this stage today.',
      })
    })
  })
  failing.forEach((c) => {
    const p = PROCESSES.find((x) => x.id === c.process)
    gaps.push({
      id: `GAP-${c.id}`,
      workflow: p ? `${p.id} ${p.name}` : c.process,
      stage: c.stage,
      stageId: p?.stages.find((s) => s.name === c.stage)?.id ?? '',
      type: 'Regression',
      name: `Re-test ${c.id}: ${c.title.toLowerCase()}`,
      why: `${c.rows.length} records disagree right now.`,
    })
  })

  return {
    coverage: pct(tested, stages),
    stages,
    tested,
    total: scenarios.length,
    byType: {
      Positive: scenarios.filter((s) => s.type === 'Positive').length,
      Negative: scenarios.filter((s) => s.type === 'Negative').length,
      Regression: scenarios.filter((s) => s.type === 'Regression').length,
    },
    approved: scenarios.filter((s) => (scenarioStatus[s.id] ?? 'Approved') === 'Approved').length,
    pending: scenarios.filter((s) => scenarioStatus[s.id] === 'Pending approval').length,
    lastRun: runs[0] ?? RUNS[0],
    workflows,
    gaps: gaps.slice(0, 10),
    requirements: JOURNEY_REQUIREMENTS.map((r) => ({
      id: r.id,
      group: r.group,
      short: r.short,
      full: r.full,
      steps: stepsCovering(r.id),
      screens: screensForRequirement(r.id),
    })),
  }
}

/** The scenarios the review recommends, ready to be written. */
export function scenariosFromGaps(gaps: ReviewGap[]): Scenario[] {
  return gaps.map((g, i) => {
    const process = PROCESSES.find((p) => `${p.id} ${p.name}` === g.workflow) ?? PROCESSES[0]
    const stage = process.stages.find((s) => s.id === g.stageId) ?? process.stages[0]
    return {
      id: `SC-9${String(i + 1).padStart(2, '0')}`,
      name: g.name,
      process: process.id,
      stageId: stage.id,
      type: g.type,
      requirement: g.type === 'Regression' ? 'CORE-04' : 'CORE-02',
      systems: [stage.system],
      lastResult: 'Not run',
      steps: [
        { n: 1, text: `Set up the test data this stage needs`, technical: 'testData.create(stage)', system: stage.system },
        { n: 2, text: g.name, technical: `run('${stage.id}')`, system: stage.system },
        { n: 3, text: `Check the rule: ${stage.rule}`, technical: 'expect(rule).toHold()', system: stage.system },
      ],
    }
  })
}

export const REVIEW_LINES = [
  'Reading every scenario in the library and the stage each one proves…',
  'Reading the live checks and the records that disagree right now…',
  'Reading the open findings and the last run…',
  'Working out coverage per workflow, then the stages nobody tests…',
  'Matching all of it against the ten requirements…',
  'Review finished. The gaps and what to add are below.',
]
