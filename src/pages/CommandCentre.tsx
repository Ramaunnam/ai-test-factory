import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Play, Printer, Rocket, Square, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  DataTable,
  EmptyState,
  Input,
  LiveLog,
  Progress,
  SectionTitle,
  StatTile,
  Switch,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { JourneyBar } from '@/components/domain/JourneyBar'
import { MultiLineChart } from '@/components/charts'
import { WorkflowFlow, type StageMark } from '@/components/domain/WorkflowFlow'
import { SourceNote } from '@/components/domain/SourceNote'
import { CHANGES, INTERFACES, PROCESSES, RUNS, SYSTEMS } from '@/data'
import { useStore, type Finding } from '@/data/appStore'
import { useChecks } from '@/sim/useSim'
import { confidence } from '@/lib/score'
import { useConfidenceInput } from '@/lib/useConfidenceInput'
import { num } from '@/lib/format'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'

export { HealthPage } from './Health'

const TABS = [
  { label: 'Health', path: '/' },
  { label: 'Release & Close', path: '/release' },
  { label: 'Month-End Load', path: '/load' },
  { label: 'Impact Simulator', path: '/simulator' },
]

/* -------------------------------------------------------------------------- */
/* Release & Close                                                            */
/* -------------------------------------------------------------------------- */

interface Criterion {
  id: string
  title: string
  detail: string
  met: boolean
  route: string
}

const MILESTONES: { day: number; label: string; detail: string }[] = [
  { day: 22, label: 'Cut-off', detail: 'Posting period closes. Nothing new may enter the month.' },
  { day: 23, label: 'Interface drain', detail: 'Every queue must reach zero. This is the step that fails at 5x today.' },
  { day: 25, label: 'Reconciliation', detail: 'Stock, ledger and the yards are compared and the differences explained.' },
  { day: 27, label: 'Close run', detail: 'The close is executed and the log reviewed.' },
  { day: 29, label: 'Reporting', detail: 'The pack is published and signed off.' },
]

export function ReleasePage() {
  const navigate = useNavigate()
  const store = useStore()
  const checks = useChecks()
  const input = useConfidenceInput()
  const conf = confidence(input)
  const [day, setDay] = useState<number | null>(null)

  const criticals = store.findings.filter((f) => f.severity === 'Critical' && f.status === 'Open')
  const lastRun = RUNS[0]
  const signedPack = store.evidencePacks.find((p) => p.runId === lastRun.id)
  const backlogClear = !store.findings.some((f) => f.id === 'F-008' && f.status !== 'Closed')

  const financeChecks = checks.filter((c) => c.id === 'C10' || c.id === 'C11')

  const criteria: Criterion[] = [
    {
      id: 'EC-1',
      title: 'No critical finding is open',
      detail: criticals.length ? `${criticals.length} open: ${criticals.map((f) => f.id).join(', ')}` : 'Nothing critical is open.',
      met: criticals.length === 0,
      route: criticals.length ? `/finding/${criticals[0].id}` : '/run',
    },
    {
      id: 'EC-2',
      title: `All ${checks.length} live checks agree`,
      detail: `${checks.filter((c) => c.status === 'pass').length} of ${checks.length} pass against live plant data.`,
      met: checks.every((c) => c.status === 'pass'),
      route: '/flow/checks',
    },
    {
      id: 'EC-3',
      title: 'The regression pack is green',
      detail: `${lastRun.id} ended ${lastRun.verdict} with ${lastRun.failed} failures and ${lastRun.healed} healed steps.`,
      met: lastRun.failed === 0,
      route: `/report/${lastRun.id}`,
    },
    {
      id: 'EC-4',
      title: 'Evidence is locked and signed',
      detail: signedPack ? `${signedPack.id} signed by ${signedPack.signedBy}, hash ${signedPack.hash}.` : 'No pack exists for the latest run.',
      met: !!signedPack,
      route: '/evidence',
    },
    {
      id: 'EC-5',
      title: 'Interface backlog reaches zero at month-end volume',
      detail: backlogClear ? 'The 5x profile drains cleanly.' : 'At 5x, invoice capture runs over capacity and two invoices are still in flight at the cut-off.',
      met: backlogClear,
      route: '/load',
    },
    {
      id: 'EC-6',
      title: 'Every payment was screened and priced correctly',
      detail: financeChecks.every((c) => c.status === 'pass')
        ? 'Every vendor was screened against the list of the day, and every foreign-currency invoice used that day’s rate.'
        : `${financeChecks.filter((c) => c.status !== 'pass').map((c) => c.id).join(' and ')} disagree with the live finance data.`,
      met: financeChecks.every((c) => c.status === 'pass'),
      route: '/flow/checks',
    },
  ]

  const unmet = criteria.filter((c) => !c.met)
  const decision = unmet.length === 0 ? 'GO' : unmet.length <= 2 ? 'CONDITIONAL' : 'NO-GO'
  const tone = decision === 'GO' ? 'success' : decision === 'NO-GO' ? 'danger' : 'warning'

  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const freezeFrom = 22
  const milestone = (d: number) => MILESTONES.find((m) => m.day === d)
  const selected = day ? milestone(day) : undefined

  return (
    <>
      <JourneyBar step={8} />
      <PageHeader
        title="Release & Close"
        subtitle="One gate decision for release R-2026.10, the criteria behind it, and what is safe to change before the month-end close."
        tabs={TABS}
        actions={
          <Button variant="primary" leftIcon={<Rocket size={15} />} onClick={() => navigate('/release-report/R-2026.10')}>
            Open the release report
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card tone={tone}>
          <CardBody className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Badge tone={tone}>Gate decision</Badge>
            <div
              className={cn(
                'font-mono text-4xl font-semibold',
                decision === 'GO' ? 'text-success' : decision === 'NO-GO' ? 'text-danger' : 'text-accent',
              )}
            >
              {decision}
            </div>
            <p className="text-sm text-muted">
              {criteria.length - unmet.length} of {criteria.length} exit criteria met · confidence {conf.score}
            </p>
            <p className="mt-1 text-xs text-muted">
              {decision === 'GO'
                ? 'Everything required for this release is in place.'
                : `This becomes GO when ${unmet.map((c) => c.id).join(' and ')} are met.`}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Exit criteria"
            subtitle="Five conditions, each computed from live data. The gate is GO only when all five are met."
            actions={<Badge tone={unmet.length ? 'danger' : 'success'}>{unmet.length} outstanding</Badge>}
          />
          <CardBody className="space-y-2">
            {criteria.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(c.route)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md',
                  c.met ? 'border-success/40 bg-success-soft/40' : 'border-danger/40 bg-danger-soft/40',
                )}
              >
                {c.met ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
                ) : (
                  <CircleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-subtle">{c.id}</span>
                    <span className="text-sm font-medium text-text">{c.title}</span>
                  </span>
                  <span className="block text-xs text-muted">{c.detail}</span>
                </span>
                <ArrowRight size={14} className="mt-1 shrink-0 text-subtle" />
              </button>
            ))}
          </CardBody>
          <SourceNote
            title="How the gate decision is reached"
            reads={[
              { label: 'Open findings', route: '/run' },
              { label: 'Live checks (9)', route: '/flow/checks' },
              { label: `Regression run ${RUNS[0].id}`, route: `/report/${RUNS[0].id}` },
              { label: 'Evidence packs', route: '/evidence' },
              { label: 'Month-end load result', route: '/load' },
            ]}
            computes="every exit criterion is evaluated live; the gate is GO only when all of them are met"
            feeds={[{ label: 'Release report', route: '/release-report/R-2026.10' }]}
            steps={[
              'Each criterion is a question with a yes or no answer, computed from live data rather than typed in.',
              'A failed criterion names what is wrong and links to the screen that proves it.',
              'Nothing here is a manual override: closing the finding is what changes the gate.',
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Close calendar"
            subtitle="October 2026. The freeze runs from the 22nd; the five marked days are the close milestones."
            icon={<CalendarDays size={16} />}
          />
          <CardBody>
            <div className="grid grid-cols-7 gap-1.5">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <div key={i} className="text-center text-label font-semibold uppercase text-subtle">
                  {d}
                </div>
              ))}
              {days.map((d) => {
                const frozen = d >= freezeFrom
                const today = d === 14
                const m = milestone(d)
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!m}
                    onClick={() => setDay(day === d ? null : d)}
                    title={m ? `${d} Oct · ${m.label}` : frozen ? 'Inside the freeze window' : 'Open for changes'}
                    className={cn(
                      'rounded-md border px-1 py-2 text-center font-mono text-xs transition-colors',
                      frozen ? 'border-accent/40 bg-accent-soft/60 text-accent' : 'border-line bg-surface text-muted',
                      m && 'cursor-pointer border-primary/50 bg-primary-soft font-semibold text-primary hover:brightness-105',
                      today && 'ring-2 ring-primary',
                      day === d && 'ring-2 ring-focusring',
                    )}
                  >
                    {d}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm ring-2 ring-primary" /> today
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-primary/50 bg-primary-soft" /> close milestone
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm border border-accent/40 bg-accent-soft" /> freeze window
              </span>
            </div>

            <div className="mt-3 space-y-1.5">
              {MILESTONES.map((m) => (
                <button
                  key={m.day}
                  type="button"
                  onClick={() => setDay(day === m.day ? null : m.day)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors',
                    selected?.day === m.day ? 'border-primary/50 bg-primary-soft' : 'border-line hover:bg-surface2',
                  )}
                >
                  <span className="shrink-0 font-mono text-subtle">{m.day} Oct</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-text">{m.label}</span>
                    {selected?.day === m.day && <span className="block text-muted">{m.detail}</span>}
                  </span>
                  {m.day === 23 && !backlogClear && <Badge tone="danger">at risk</Badge>}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader title="Safe to change before the close" subtitle="Based on what each change touches and what is still failing." />
            <CardBody className="space-y-2">
              {CHANGES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/regression?change=${c.id}`)}
                  className="flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md"
                >
                  <Badge tone={c.safeBeforeClose ? 'success' : 'danger'}>{c.safeBeforeClose ? 'Safe' : 'Hold'}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[11px] text-subtle">{c.id}</span>
                    <span className="block truncate text-sm text-text">{c.title}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">risk {c.risk}</span>
                </button>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sign-off" subtitle="Who has to agree before the gate can be passed." />
            <CardBody className="space-y-2">
              {[
                { role: 'QA Lead', what: 'Regression pack and evidence', done: !!signedPack },
                { role: 'Key User', what: 'Business acceptance of the open findings', done: criticals.length === 0 },
                { role: 'Plant Head', what: 'Operational impact before the close', done: false },
                { role: 'Auditor', what: 'Evidence completeness', done: !!signedPack },
              ].map((s) => (
                <div key={s.role} className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                  {s.done ? (
                    <CheckCircle2 size={15} className="shrink-0 text-success" />
                  ) : (
                    <span className="h-[15px] w-[15px] shrink-0 rounded-full border border-line-strong" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-text">{s.role}</span>
                    <span className="block text-xs text-muted">{s.what}</span>
                  </span>
                  <Badge tone={s.done ? 'success' : 'neutral'}>{s.done ? 'Signed' : 'Waiting'}</Badge>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Month-End Load                                                             */
/* -------------------------------------------------------------------------- */

type Profile = 'normal' | 'peak' | '2x' | '5x' | 'custom'

const PROFILE_LABEL: Record<Profile, string> = {
  normal: 'Normal day',
  peak: 'Month-end peak',
  '2x': '2x',
  '5x': '5x',
  custom: 'Custom',
}

const PROFILE_USERS: Record<Profile, number> = { normal: 40, peak: 150, '2x': 80, '5x': 200, custom: 120 }

/** Forty virtual users is one times a normal day. */
const USERS_PER_X = 40
const P95_TARGET_MS = 2000
const ERROR_TARGET_PCT = 1
const BACKLOG_CLEAR_MIN = 15
const RUN_POINTS = 40
const RUN_TICK_MS = 500

/** Modelled capacity per interface: headroom is the volume at which it saturates. */
const LOAD_BASE: Record<string, { perMin: number; p95: number; headroom: number }> = {
  'IF-01': { perMin: 10, p95: 180, headroom: 6 },
  'IF-02': { perMin: 6, p95: 150, headroom: 7 },
  'IF-03': { perMin: 9, p95: 210, headroom: 5 },
  'IF-04': { perMin: 2, p95: 320, headroom: 4 },
  'IF-06': { perMin: 8, p95: 260, headroom: 3 },
  'IF-09': { perMin: 7, p95: 190, headroom: 4.5 },
  'IF-10': { perMin: 2, p95: 170, headroom: 8 },
  'IF-11': { perMin: 1, p95: 240, headroom: 6 },
  'IF-14': { perMin: 9, p95: 150, headroom: 6 },
}

/** What it means for the plant when this interface is the one that gives way. */
const BOTTLENECK_IMPACT: Record<string, string> = {
  'IF-01': 'Trucks wait at the gate because the goods receipt is not booked while they are still on the weighbridge.',
  'IF-02': 'Recycling loads sit in the yard with nothing recorded against them.',
  'IF-03': 'Stock in D365 lags the yard, so the month-end stock value is wrong on the day it is read.',
  'IF-04': 'Production confirmations arrive late, so the shift report understates output.',
  'IF-06': 'Supplier invoices queue behind the close, and the last ones miss the cut-off.',
  'IF-09': 'Invoice copies are late, so the document archive is incomplete at the close.',
  'IF-10': 'Mill certificates are late, which holds up dispatch.',
  'IF-11': 'The payment run misses its slot and suppliers are paid a day late.',
  'IF-14': 'Batches wait for their chemistry before they can be certified and charged.',
}

interface LoadRow {
  id: string
  name: string
  perMin: number
  tps: number
  avg: number
  p95: number
  errors: number
  backlog: number
  saturation: number
  status: 'OK' | 'Watch' | 'Breaks'
}

function loadProfile(factor: number): LoadRow[] {
  return Object.entries(LOAD_BASE).map(([id, b]) => {
    const saturation = factor / b.headroom
    const p95 = Math.round(b.p95 * (1 + Math.pow(saturation, 2) * 1.8))
    const backlog = saturation > 0.7 ? Math.round((saturation - 0.7) * b.perMin * 40) : 0
    const errors = saturation > 0.9 ? Math.round((saturation - 0.9) * b.perMin * 6 * 10) / 10 : 0
    const perMin = Math.round(b.perMin * factor * 10) / 10
    return {
      id,
      name: INTERFACES.find((i) => i.id === id)?.name ?? id,
      perMin,
      tps: Math.round((perMin / 60) * 100) / 100,
      avg: Math.round(p95 * 0.45),
      p95,
      errors,
      backlog,
      saturation,
      status: saturation >= 1 ? 'Breaks' : saturation >= 0.7 ? 'Watch' : 'OK',
    }
  })
}

/** A month-end day hour by hour, as a share of that day's peak. Illustrative. */
const MONTH_END_HOURS = [
  0.18, 0.12, 0.1, 0.1, 0.14, 0.32, 0.55, 0.72, 0.84, 0.9, 0.96, 0.88, 0.7, 0.78, 0.92, 1, 0.95, 0.82, 0.64, 0.5,
  0.42, 0.36, 0.3, 0.22,
]

interface LoadResult {
  id: string
  when: string
  profile: string
  users: number
  p95: number
  errorPct: number
  backlog: number
  lost: number
  verdict: 'Holds' | 'Watch' | 'Breaks'
}

/** Three earlier load tests, kept so a new run has something to compare with. */
const SEEDED_RESULTS: LoadResult[] = [
  { id: 'LT-0312', when: '12 Oct 2026 21:10', profile: 'Month-end peak', users: 150, p95: 1480, errorPct: 0.4, backlog: 180, lost: 0, verdict: 'Watch' },
  { id: 'LT-0311', when: '11 Oct 2026 20:40', profile: '2x', users: 80, p95: 640, errorPct: 0, backlog: 0, lost: 0, verdict: 'Holds' },
  { id: 'LT-0310', when: '10 Oct 2026 22:05', profile: '5x', users: 200, p95: 2360, errorPct: 2.1, backlog: 720, lost: 2, verdict: 'Breaks' },
]

export function LoadPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [profile, setProfile] = useState<Profile>('peak')
  const [customUsers, setCustomUsers] = useState(120)
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState(0)
  const [done, setDone] = useState(false)
  const [history, setHistory] = useState<LoadResult[]>(SEEDED_RESULTS)

  const users = profile === 'custom' ? Math.min(500, Math.max(10, customUsers)) : PROFILE_USERS[profile]
  const factor = Math.round((users / USERS_PER_X) * 100) / 100

  const rows = useMemo(() => loadProfile(factor), [factor])
  const worst = [...rows].sort((a, b) => b.saturation - a.saturation)[0]
  const breaking = rows.filter((r) => r.status === 'Breaks')

  const totalPerMin = Math.round(rows.reduce((s, r) => s + r.perMin, 0))
  const maxP95 = Math.max(...rows.map((r) => r.p95))
  const avgMs = Math.round(rows.reduce((s, r) => s + r.avg, 0) / rows.length)
  const errorsPerMin = Math.round(rows.reduce((s, r) => s + r.errors, 0) * 10) / 10
  const errorPct = totalPerMin ? Math.round((errorsPerMin / totalPerMin) * 1000) / 10 : 0
  const totalBacklog = rows.reduce((s, r) => s + r.backlog, 0)
  const lost = factor >= 5 ? 2 : 0
  const minutesToClear = totalBacklog === 0 ? 0 : Math.ceil(totalBacklog / Math.max(1, totalPerMin * 0.12))

  const verdict: LoadResult['verdict'] =
    maxP95 > P95_TARGET_MS || errorPct > ERROR_TARGET_PCT || lost > 0
      ? 'Breaks'
      : totalBacklog > 0 || breaking.length > 0
        ? 'Watch'
        : 'Holds'

  const targets = [
    { label: `Slowest 5 % under ${P95_TARGET_MS / 1000} s`, met: maxP95 <= P95_TARGET_MS, actual: `${num(maxP95)} ms` },
    { label: `Errors under ${ERROR_TARGET_PCT} %`, met: errorPct <= ERROR_TARGET_PCT, actual: `${errorPct} %` },
    { label: 'No documents lost', met: lost === 0, actual: lost ? `${lost} invoices still in flight` : 'none lost' },
    {
      label: `Backlog cleared within ${BACKLOG_CLEAR_MIN} min`,
      met: minutesToClear <= BACKLOG_CLEAR_MIN,
      actual: totalBacklog ? `${num(totalBacklog)} waiting, about ${minutesToClear} min` : 'nothing waiting',
    },
  ]

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((t) => t + 1), RUN_TICK_MS)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running || tick < RUN_POINTS) return
    setRunning(false)
    setDone(true)
    const result: LoadResult = {
      id: `LT-${String(313 + history.length - SEEDED_RESULTS.length)}`,
      when: new Date().toLocaleString('en-GB'),
      profile: profile === 'custom' ? `Custom · ${users} users` : PROFILE_LABEL[profile],
      users,
      p95: maxP95,
      errorPct,
      backlog: totalBacklog,
      lost,
      verdict,
    }
    setHistory((h) => [result, ...h].slice(0, 6))
    toast({
      title: `Load test finished · ${verdict}`,
      description:
        verdict === 'Holds'
          ? 'Every interface stayed inside its capacity.'
          : `${worst.id} ${worst.name} gives way first.`,
      tone: verdict === 'Holds' ? 'success' : verdict === 'Watch' ? 'warning' : 'danger',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, tick])

  const series = useMemo(
    () =>
      Array.from({ length: Math.min(tick, RUN_POINTS) }, (_, i) => {
        const ramp = Math.min(1, (i + 1) / 8)
        const wave = 1 + Math.sin(i / 4) * 0.08
        return {
          minute: `${i}`,
          tpm: Math.round(totalPerMin * ramp * wave),
          p95: Math.round(maxP95 * (0.75 + 0.25 * ramp) * wave),
          avg: Math.round(avgMs * (0.8 + 0.2 * ramp) * wave),
          errorPct: Math.round(errorPct * ramp * wave * 10) / 10,
        }
      }),
    [tick, totalPerMin, maxP95, avgMs, errorPct],
  )

  const start = () => {
    setTick(0)
    setDone(false)
    setRunning(true)
  }

  const liveUsers = running ? Math.round(users * Math.min(1, (tick + 1) / 8)) : done ? users : 0
  const last = series[series.length - 1]

  return (
    <>
      <PageHeader
        title="Month-End Load"
        subtitle="Push the month-end volume through every interface and find out which one bends first."
        tabs={TABS}
        actions={
          <>
            <Button leftIcon={<Printer size={15} />} onClick={() => window.print()} disabled={!done}>
              Print the report
            </Button>
            {running ? (
              <Button variant="danger" leftIcon={<Square size={14} />} onClick={() => setRunning(false)}>
                Stop
              </Button>
            ) : (
              <Button variant="primary" leftIcon={<Play size={15} />} onClick={start}>
                Run load test
              </Button>
            )}
          </>
        }
      />

      {/* ------------------------------------------------------- scenario */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <span className="text-label font-semibold uppercase text-subtle">Scenario</span>
          {(['normal', 'peak', '2x', '5x', 'custom'] as Profile[]).map((p) => (
            <Chip
              key={p}
              selected={profile === p}
              onClick={() => {
                setProfile(p)
                setTick(0)
                setDone(false)
                setRunning(false)
              }}
            >
              {PROFILE_LABEL[p]}
            </Chip>
          ))}
          {profile === 'custom' && (
            <span className="flex items-center gap-2">
              <Input
                type="number"
                min={10}
                max={500}
                value={customUsers}
                onChange={(e) => {
                  setCustomUsers(Number(e.target.value))
                  setTick(0)
                  setDone(false)
                }}
                className="w-24"
              />
              <span className="text-xs text-muted">virtual users (10–500)</span>
            </span>
          )}
          <span className="ml-auto text-xs text-muted">
            {running
              ? `running · second ${Math.min(Math.round((tick * RUN_TICK_MS) / 1000), 20)} of 20`
              : done
                ? 'run finished'
                : `${users} virtual users · ${factor}x a normal day`}
          </span>
        </CardBody>
      </Card>

      {/* ------------------------------------------------------------ KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Virtual users" value={num(liveUsers)} hint={`${factor}x a normal day`} />
        <StatTile
          label="Transactions per minute"
          value={last ? num(last.tpm) : '—'}
          tone="info"
          hint={`target ${num(totalPerMin)} at this volume`}
        />
        <StatTile label="Average response" value={last ? `${num(last.avg)} ms` : '—'} hint="across all interfaces" />
        <StatTile
          label="Slowest 5 %"
          value={last ? `${num(last.p95)} ms` : '—'}
          tone={maxP95 > P95_TARGET_MS ? 'danger' : maxP95 > P95_TARGET_MS * 0.6 ? 'warning' : 'neutral'}
          hint={`target under ${P95_TARGET_MS / 1000} s`}
        />
        <StatTile
          label="Error rate"
          value={last ? `${last.errorPct} %` : '—'}
          tone={errorPct > ERROR_TARGET_PCT ? 'danger' : errorPct > 0 ? 'warning' : 'success'}
          hint={`target under ${ERROR_TARGET_PCT} %`}
        />
        <StatTile
          label="Interfaces that break"
          value={`${breaking.length} of ${rows.length}`}
          tone={breaking.length ? 'danger' : 'success'}
          hint={breaking.length ? breaking.map((r) => r.id).join(', ') : 'all inside capacity'}
        />
      </div>

      {!running && !done ? (
        <Card className="mb-4">
          <EmptyState
            icon={<Zap size={28} />}
            title="No load test has run yet"
            description={`Pick a scenario and run it. The ${users} virtual users ramp up over the first few seconds and the run takes about 20 seconds.`}
            action={
              <Button variant="primary" leftIcon={<Play size={15} />} onClick={start}>
                Run load test
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {/* --------------------------------------------------- bottleneck */}
          <Card className="mb-4" tone={verdict === 'Holds' ? 'success' : verdict === 'Watch' ? 'warning' : 'danger'}>
            <CardBody className="flex flex-wrap items-center gap-4">
              <Zap size={20} className={verdict === 'Holds' ? 'text-success' : verdict === 'Watch' ? 'text-accent' : 'text-danger'} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text">
                  {verdict === 'Holds'
                    ? `Every interface holds at ${users} virtual users`
                    : `${worst.id} ${worst.name} gives way first`}
                </div>
                <p className="text-xs text-muted">
                  {verdict === 'Holds'
                    ? `The busiest is ${worst.id} at ${Math.round(worst.saturation * 100)} % of its capacity.`
                    : `${BOTTLENECK_IMPACT[worst.id] ?? 'It cannot keep up with the volume.'} It starts to struggle at about ${
                        Math.round((1 / worst.saturation) * factor * 10) / 10
                      }x a normal day.`}
                </p>
              </div>
              <Button onClick={() => navigate(`/interfaces?interface=${worst.id}`)}>Open {worst.id}</Button>
            </CardBody>
          </Card>

          {/* ------------------------------------------------------- charts */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Response time" subtitle="Average and slowest 5 %, against the two second target." />
              <CardBody>
                <MultiLineChart
                  data={series}
                  reference={{ y: P95_TARGET_MS, label: 'target 2 s', tone: 'danger' }}
                  series={[
                    { key: 'p95', label: 'Slowest 5 % (ms)', tone: 'accent' },
                    { key: 'avg', label: 'Average (ms)', tone: 'primary' },
                  ]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Transactions per minute" subtitle="Everything moving across the live interfaces." />
              <CardBody>
                <MultiLineChart data={series} series={[{ key: 'tpm', label: 'Transactions per minute', tone: 'primary' }]} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Error rate" subtitle="Rejected or retried, against the one per cent target." />
              <CardBody>
                <MultiLineChart
                  data={series}
                  reference={{ y: ERROR_TARGET_PCT, label: 'target 1 %', tone: 'danger' }}
                  series={[{ key: 'errorPct', label: 'Errors (%)', tone: 'danger' }]}
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Backlog per interface"
                subtitle={totalBacklog ? `${num(totalBacklog)} messages waiting in total` : 'Nothing is waiting'}
              />
              <CardBody className="space-y-2">
                {totalBacklog === 0 && <p className="text-sm text-success">Every interface drained as fast as it was fed.</p>}
                {rows
                  .filter((r) => r.backlog > 0)
                  .sort((a, b) => b.backlog - a.backlog)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/interfaces?interface=${r.id}`)}
                      className="flex w-full items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-surface2"
                    >
                      <span className="w-16 shrink-0 font-mono text-xs text-text">{r.id}</span>
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface2">
                        <span
                          className="block h-full rounded-full bg-danger"
                          style={{ width: `${Math.min(100, (r.backlog / Math.max(1, totalBacklog)) * 100 * 2)}%` }}
                        />
                      </span>
                      <span className="w-16 shrink-0 text-right font-mono text-xs text-text">{num(r.backlog)}</span>
                    </button>
                  ))}
              </CardBody>
            </Card>
          </div>

          {/* -------------------------------------------------- per system */}
          <Card className="mb-4">
            <CardHeader
              title="Interface by interface"
              subtitle={`At ${users} virtual users, sorted by how much of its capacity each one is using.`}
            />
            <DataTable
              rows={[...rows].sort((a, b) => b.saturation - a.saturation)}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/interfaces?interface=${r.id}`)}
              rowTone={(r) => (r.status === 'Breaks' ? 'danger' : r.status === 'Watch' ? 'warning' : undefined)}
              columns={[
                { key: 'id', header: 'Interface', mono: true, width: 100 },
                { key: 'name', header: 'What it carries' },
                { key: 'tps', header: 'Peak TPS', align: 'right', mono: true, width: 100 },
                {
                  key: 'p95',
                  header: 'p95 ms',
                  align: 'right',
                  mono: true,
                  width: 100,
                  render: (r) => <span className={r.p95 > P95_TARGET_MS ? 'text-danger' : ''}>{num(r.p95)}</span>,
                },
                {
                  key: 'errors',
                  header: 'Errors %',
                  align: 'right',
                  mono: true,
                  width: 100,
                  render: (r) => (r.perMin ? Math.round((r.errors / r.perMin) * 1000) / 10 : 0),
                  value: (r) => (r.perMin ? r.errors / r.perMin : 0),
                },
                { key: 'backlog', header: 'Backlog', align: 'right', mono: true, width: 100 },
                {
                  key: 'saturation',
                  header: 'Capacity used',
                  width: 170,
                  render: (r) => (
                    <span className="flex items-center gap-2">
                      <Progress
                        value={Math.min(100, r.saturation * 100)}
                        tone={r.saturation >= 1 ? 'danger' : r.saturation >= 0.7 ? 'warning' : 'success'}
                        className="w-20"
                      />
                      <span className="font-mono text-xs text-muted">{Math.round(r.saturation * 100)} %</span>
                    </span>
                  ),
                },
                {
                  key: 'status',
                  header: 'Status',
                  width: 110,
                  render: (r) => (
                    <Badge tone={r.status === 'Breaks' ? 'danger' : r.status === 'Watch' ? 'warning' : 'success'}>
                      {r.status}
                    </Badge>
                  ),
                },
              ]}
            />
            <SourceNote
              title="How the load model works"
              reads={[
                { label: 'Nineteen interfaces', route: '/landscape' },
                { label: 'Observed message rates', route: '/interfaces' },
              ]}
              computes="Modelled from interface capacity: each interface has a measured rate and a capacity, and the scenario multiplies the rate"
              feeds={[{ label: 'Release exit criteria', route: '/release' }, { label: 'Finding F-008', route: '/finding/F-008' }]}
              steps={[
                'Each live interface carries a measured rate per minute and a modelled capacity.',
                'The scenario sets the number of virtual users; forty users is one times a normal day.',
                'Response time, errors and backlog follow from how far past its comfortable point each interface is pushed.',
                'The first interface to pass 100 % of capacity is the one reported as the bottleneck.',
              ]}
            />
          </Card>

          {/* ------------------------------------------------ result vs targets */}
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card tone={verdict === 'Holds' ? 'success' : verdict === 'Watch' ? 'warning' : 'danger'}>
              <CardHeader
                title="Result against the targets"
                subtitle="The four things a month-end run has to do."
                actions={
                  <Badge tone={verdict === 'Holds' ? 'success' : verdict === 'Watch' ? 'warning' : 'danger'}>
                    {verdict}
                  </Badge>
                }
              />
              <CardBody className="space-y-2">
                {targets.map((t) => (
                  <div key={t.label} className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                    {t.met ? (
                      <CheckCircle2 size={15} className="shrink-0 text-success" />
                    ) : (
                      <CircleAlert size={15} className="shrink-0 text-danger" />
                    )}
                    <span className="min-w-0 flex-1 text-sm text-text">{t.label}</span>
                    <span className={cn('shrink-0 font-mono text-xs', t.met ? 'text-muted' : 'text-danger')}>
                      {t.actual}
                    </span>
                  </div>
                ))}
                {lost > 0 && (
                  <Button size="sm" onClick={() => navigate('/finding/F-008')}>
                    Open F-008
                  </Button>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Last load tests"
                subtitle="Kept so a new run can be compared with the last one."
                actions={<Badge tone="neutral">Modelled</Badge>}
              />
              <DataTable
                rows={history.slice(0, 3)}
                rowKey={(r) => r.id}
                dense
                rowTone={(r) => (r.verdict === 'Breaks' ? 'danger' : r.verdict === 'Watch' ? 'warning' : undefined)}
                columns={[
                  { key: 'id', header: 'Test', mono: true, width: 90 },
                  { key: 'when', header: 'When', width: 160 },
                  { key: 'profile', header: 'Scenario' },
                  { key: 'users', header: 'Users', align: 'right', mono: true, width: 80 },
                  { key: 'p95', header: 'p95 ms', align: 'right', mono: true, width: 90 },
                  {
                    key: 'verdict',
                    header: 'Verdict',
                    width: 110,
                    render: (r) => (
                      <Badge tone={r.verdict === 'Breaks' ? 'danger' : r.verdict === 'Watch' ? 'warning' : 'success'}>
                        {r.verdict}
                      </Badge>
                    ),
                  },
                ]}
              />
            </Card>
          </div>
        </>
      )}

      {/* ------------------------------------------------------- heat strip */}
      <Card>
        <CardHeader
          title="A month-end day, hour by hour"
          subtitle="Where the volume sits on the last working day of the month. Illustrative."
        />
        <CardBody>
          <div className="flex items-end gap-1">
            {MONTH_END_HOURS.map((v, h) => (
              <span
                key={h}
                title={`${String(h).padStart(2, '0')}:00 · ${Math.round(v * 100)} % of the day's peak`}
                className="flex-1"
              >
                <span
                  className={cn(
                    'block rounded-sm',
                    v >= 0.9 ? 'bg-danger' : v >= 0.7 ? 'bg-accent' : v >= 0.4 ? 'bg-info' : 'bg-surface3',
                  )}
                  style={{ height: `${Math.max(6, v * 56)}px` }}
                />
                {h % 3 === 0 && <span className="mt-1 block text-center font-mono text-[9px] text-subtle">{h}</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            The peak sits between 14:00 and 17:00, when the yard, the invoices and the close all run together. That is
            the window a load test has to survive.
          </p>
        </CardBody>
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Impact Simulator                                                           */
/* -------------------------------------------------------------------------- */

export function SimulatorPage() {
  const navigate = useNavigate()
  const { def } = useRole()
  const input = useConfidenceInput()
  const current = confidence(input)
  const [selected, setSelected] = useState<string[]>(
    CHANGES.filter((c) => c.release === 'R-2026.10').map((c) => c.id),
  )
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [wholeRelease, setWholeRelease] = useState(true)

  const changes = CHANGES.filter((c) => selected.includes(c.id))
  const unsafe = changes.filter((c) => !c.safeBeforeClose)

  /** If these changes shipped, each unsafe one adds a finding of its own weight. */
  const projected = useMemo(() => {
    const synthetic: Finding[] = unsafe.map((c) => ({
      id: `SIM-${c.id}`,
      title: `Projected: ${c.whatCouldGoWrong}`,
      severity: c.risk >= 70 ? 'Critical' : 'High',
      status: 'Open',
      process: c.stages[0]?.split('-')[0] ?? 'P1',
      stage: c.stages[0] ?? '',
      system: c.system,
      raised: 'projected',
      raisedBy: 'Change Impact agent',
      detail: c.whatCouldGoWrong,
      evidence: [],
      affectedKeys: [],
    }))
    return confidence({ ...input, findings: [...input.findings, ...synthetic] })
  }, [input, unsafe])

  const delta = projected.score - current.score

  const logLines = [
    'Reading the change feed and the transport list…',
    'Mapping each change onto the workflow ontology…',
    `Walking ${changes.length} changes through 6 workflows and 14 interfaces…`,
    'Comparing against the last baseline run RUN-1041…',
    'Scoring the effect on the confidence score and the close…',
    `Verdict ready: ${unsafe.length} of ${changes.length} changes are not safe before the close.`,
  ]

  const marks = useMemo(() => {
    const out: Record<string, StageMark> = {}
    changes.forEach((c) => c.stages.forEach((s) => { out[s] = 'change' }))
    PROCESSES.forEach((p) => {
      let seen = false
      p.stages.forEach((s) => {
        if (out[s.id] === 'change') {
          seen = true
          return
        }
        if (seen && !out[s.id]) out[s.id] = 'downstream'
      })
    })
    return out
  }, [changes])

  const affected = new Set(changes.flatMap((c) => c.affectedSystems))
  const downstream = new Set(changes.flatMap((c) => c.downstreamSystems).filter((s) => !affected.has(s)))

  const stageNames = (c: (typeof CHANGES)[number]) =>
    c.stages
      .map((id) => PROCESSES.flatMap((p) => p.stages).find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ')

  return (
    <>
      <PageHeader
        title="Impact Simulator"
        subtitle={`A plain-language answer to one question: if we ship this, what breaks in the plant? You are viewing as ${def.id}.`}
        tabs={TABS}
        actions={
          <Button
            variant="primary"
            leftIcon={<Zap size={15} />}
            loading={phase === 'running'}
            onClick={() => {
              setPhase('running')
              window.setTimeout(() => setPhase('done'), logLines.length * 420 + 200)
            }}
          >
            Simulate impact
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="space-y-3">
          <Switch
            checked={wholeRelease}
            onChange={(v) => {
              setWholeRelease(v)
              setSelected(v ? CHANGES.filter((c) => c.release === 'R-2026.10').map((c) => c.id) : [])
              setPhase('idle')
            }}
            label="Simulate the whole release R-2026.10"
            description="Or pick individual changes below."
            size="sm"
          />
          <div className="flex flex-wrap gap-2">
            {CHANGES.map((c) => (
              <Chip
                key={c.id}
                selected={selected.includes(c.id)}
                onClick={() => {
                  setWholeRelease(false)
                  setPhase('idle')
                  setSelected((s) => (s.includes(c.id) ? s.filter((x) => x !== c.id) : [...s, c.id]))
                }}
              >
                {c.id} · {c.system}
              </Chip>
            ))}
          </div>
        </CardBody>
      </Card>

      {phase === 'idle' && (
        <Card>
          <CardHeader
            title={`Ready to simulate ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`}
            subtitle="This is what would be walked through the workflows."
          />
          <CardBody className="space-y-2">
            {changes.length === 0 && <p className="text-sm text-muted">Pick at least one change above.</p>}
            {changes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                <span className="font-mono text-[11px] text-subtle">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-text">{c.title}</span>
                <span className="shrink-0 text-xs text-muted">{c.system}</span>
                <Badge tone={c.risk >= 70 ? 'danger' : c.risk >= 40 ? 'warning' : 'success'}>risk {c.risk}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {phase === 'running' && (
        <Card className="mb-4">
          <CardHeader title="Working it out" subtitle="Three steps: map the change, walk the workflows, score the risk." />
          <CardBody>
            <LiveLog lines={logLines} running height={150} />
          </CardBody>
        </Card>
      )}

      {phase === 'done' && (
        <>
          <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card tone={unsafe.length ? 'danger' : 'success'}>
              <CardBody className="flex h-full flex-wrap items-center gap-4">
                <Zap size={22} className={unsafe.length ? 'text-danger' : 'text-success'} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-text">
                    {unsafe.length} of {changes.length} changes are not safe before the close
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {unsafe.length
                      ? `Hold ${unsafe.map((c) => c.id).join(' and ')} until after the close on 29 October, or close the findings they depend on first. The rest can go in now.`
                      : 'Everything selected can go in before the close.'}
                  </p>
                </div>
                <Button onClick={() => navigate('/release')}>Open the gate decision</Button>
              </CardBody>
            </Card>

            <Card tone={delta < 0 ? 'danger' : 'success'}>
              <CardHeader title="Effect on confidence" subtitle="Same maths as the Command Centre gauge." />
              <CardBody className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <div className="font-mono text-3xl font-semibold text-text">{current.score}</div>
                  <div className="text-[11px] text-subtle">today</div>
                </div>
                <ArrowRight size={18} className="text-subtle" />
                <div className="text-center">
                  <div className={cn('font-mono text-3xl font-semibold', delta < 0 ? 'text-danger' : 'text-success')}>
                    {projected.score}
                  </div>
                  <div className="text-[11px] text-subtle">if shipped</div>
                </div>
                <div
                  className={cn(
                    'rounded-full px-2 py-0.5 font-mono text-sm font-semibold',
                    delta < 0 ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success',
                  )}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </div>
              </CardBody>
              <SourceNote
                reads={[
                  { label: 'Change feed', route: '/regression' },
                  { label: 'Confidence score today', route: '/' },
                ]}
                computes="each unsafe change is added as a projected finding, then the same score is recalculated"
                feeds={[{ label: 'Release gate', route: '/release' }]}
                steps={[
                  'A change marked not safe would raise a finding of its own risk weight if it shipped.',
                  'Those projected findings are added to the real ones.',
                  'The confidence score is recalculated with exactly the same formula.',
                  'The difference between the two numbers is the cost of shipping now.',
                ]}
              />
            </Card>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Changes simulated" value={num(changes.length)} />
            <StatTile label="Systems changed" value={num(affected.size)} tone="danger" />
            <StatTile label="Systems downstream" value={num(downstream.size)} tone="warning" />
            <StatTile
              label="Workflows touched"
              value={num(new Set(changes.flatMap((c) => c.stages.map((s) => s.split('-')[0]))).size)}
              tone="info"
            />
          </div>

          <SectionTitle title="Which systems feel it" hint="Red is changed directly. Amber feels it downstream." />
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {SYSTEMS.map((s) => {
              const tone = affected.has(s.id) ? 'danger' : downstream.has(s.id) ? 'warning' : 'neutral'
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => navigate(`/landscape?system=${s.id}`)}
                  className={cn(
                    'rounded-lg border bg-surface px-3 py-2.5 text-left transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md',
                    tone === 'danger' ? 'border-danger/50 bg-danger-soft/40' : tone === 'warning' ? 'border-accent/50 bg-accent-soft/40' : 'border-line',
                  )}
                >
                  <div className="truncate text-sm font-medium text-text">{s.short}</div>
                  <div className="truncate text-xs text-muted">
                    {tone === 'danger' ? 'changed' : tone === 'warning' ? 'feels it downstream' : 'not touched'}
                  </div>
                </button>
              )
            })}
          </div>

          <SectionTitle title="Where it lands in the workflows" />
          <div className="mb-4 grid gap-3">
            {PROCESSES.filter((p) => p.stages.some((s) => marks[s.id])).map((p) => (
              <Card key={p.id}>
                <CardHeader title={`${p.id} · ${p.name}`} />
                <CardBody className="pt-4">
                  <WorkflowFlow process={p} marks={marks} onStageClick={(id) => navigate(`/ontology?process=${p.id}&stage=${id}`)} />
                </CardBody>
              </Card>
            ))}
          </div>

          <SectionTitle title="What it means for the plant" hint="One card per change: what stops, and what to do about it." />
          <div className="grid gap-3 lg:grid-cols-2">
            {changes.map((c) => (
              <Card key={c.id} tone={c.safeBeforeClose ? 'default' : 'danger'}>
                <CardBody className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={c.safeBeforeClose ? 'success' : 'danger'}>{c.safeBeforeClose ? 'Safe' : 'Hold'}</Badge>
                    <span className="font-mono text-[11px] text-subtle">{c.id}</span>
                    <span className="ml-auto font-mono text-xs text-muted">risk {c.risk}</span>
                  </div>
                  <div className="text-sm font-medium text-text">{c.title}</div>
                  <p className="text-sm text-muted">{c.business.replace('For the business: ', '')}</p>

                  <div className="rounded-md border border-line bg-surface2/60 px-3 py-2 text-xs">
                    <div className="text-label font-semibold uppercase text-subtle">What stops</div>
                    <div className="text-text">{stageNames(c) || 'No stage is blocked.'}</div>
                  </div>

                  <div
                    className={cn(
                      'rounded-md border px-3 py-2 text-xs',
                      c.safeBeforeClose ? 'border-success/40 bg-success-soft/40' : 'border-accent/40 bg-accent-soft/40',
                    )}
                  >
                    <div className="text-label font-semibold uppercase text-subtle">Recommendation</div>
                    <div className="text-text">
                      {c.safeBeforeClose
                        ? 'Ship before the freeze starts on 22 October. Re-run the regression pack afterwards.'
                        : 'Hold until after the close on 29 October. ' + c.whatWeDo}
                    </div>
                  </div>

                  <Button size="sm" variant="link" onClick={() => navigate(`/regression?change=${c.id}`)}>
                    See the full impact
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  )
}
