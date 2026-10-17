import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Play, Rocket, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  DataTable,
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
      title: 'All nine live checks agree',
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
            computes="five criteria evaluated live; the gate is GO only when all five are met"
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

type Profile = 'normal' | '2x' | '5x'
const PROFILE_FACTOR: Record<Profile, number> = { normal: 1, '2x': 2, '5x': 5 }

/** Per-interface capacity model. headroom is the multiplier at which it saturates. */
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

interface LoadRow {
  id: string
  name: string
  perMin: number
  p95: number
  errors: number
  backlog: number
  saturation: number
  status: 'Comfortable' | 'At the limit' | 'Over capacity'
}

function loadProfile(factor: number): LoadRow[] {
  return Object.entries(LOAD_BASE).map(([id, b]) => {
    const saturation = factor / b.headroom
    const p95 = Math.round(b.p95 * (1 + Math.pow(saturation, 2) * 1.8))
    const backlog = saturation > 0.7 ? Math.round((saturation - 0.7) * b.perMin * 40) : 0
    const errors = saturation > 0.9 ? Math.round((saturation - 0.9) * b.perMin * 6) : 0
    return {
      id,
      name: INTERFACES.find((i) => i.id === id)?.name ?? id,
      perMin: Math.round(b.perMin * factor * 10) / 10,
      p95,
      errors,
      backlog,
      saturation,
      status: saturation >= 1 ? 'Over capacity' : saturation >= 0.7 ? 'At the limit' : 'Comfortable',
    }
  })
}

export function LoadPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile>('normal')
  const [running, setRunning] = useState(false)
  const [tick, setTick] = useState(0)
  const [history, setHistory] = useState<Partial<Record<Profile, { p95: number; backlog: number; lost: number }>>>({})
  const toast = useToast()

  const factor = PROFILE_FACTOR[profile]
  const rows = useMemo(() => loadProfile(factor), [factor])
  const worst = [...rows].sort((a, b) => b.saturation - a.saturation)[0]
  const over = rows.filter((r) => r.status === 'Over capacity')
  const totalPerMin = rows.reduce((s, r) => s + r.perMin, 0)
  const maxP95 = Math.max(...rows.map((r) => r.p95))
  const totalBacklog = rows.reduce((s, r) => s + r.backlog, 0)
  const lost = factor >= 5 ? 2 : 0
  const done = !running && tick >= 40

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((t) => t + 1), 220)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (!running || tick < 40) return
    setRunning(false)
    setHistory((h) => ({ ...h, [profile]: { p95: maxP95, backlog: totalBacklog, lost } }))
    toast({
      title: `Load run at ${profile === 'normal' ? 'a normal day' : profile} finished`,
      description: over.length
        ? `${over.length} ${over.length === 1 ? 'interface is' : 'interfaces are'} over capacity. ${worst.id} bends first.`
        : 'Every interface stayed inside its capacity.',
      tone: over.length ? 'danger' : 'success',
    })
  }, [running, tick, profile, maxP95, totalBacklog, lost, over.length, worst.id, toast])

  const series = useMemo(
    () =>
      Array.from({ length: Math.min(tick, 40) }, (_, i) => {
        const wave = 1 + Math.sin(i / 5) * 0.12
        return {
          minute: `${i}`,
          throughput: Math.round(totalPerMin * wave),
          p95: Math.round(maxP95 * (0.85 + Math.sin(i / 3) * 0.1)),
          errors: rows.reduce((s, r) => s + r.errors, 0),
          backlog: Math.round(totalBacklog * Math.min(1, i / 25)),
        }
      }),
    [tick, totalPerMin, maxP95, totalBacklog, rows],
  )

  return (
    <>
      <PageHeader
        title="Month-End Load"
        subtitle="Push the month-end volume through the fourteen interfaces and find out which one bends first."
        tabs={TABS}
        actions={
          <Button
            variant="primary"
            leftIcon={<Play size={15} />}
            loading={running}
            onClick={() => {
              setTick(0)
              setRunning(true)
            }}
          >
            {running ? 'Running' : 'Run the load profile'}
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <span className="text-label font-semibold uppercase text-subtle">Profile</span>
          {(['normal', '2x', '5x'] as Profile[]).map((p) => (
            <Chip key={p} selected={profile === p} onClick={() => { setProfile(p); setTick(0); setRunning(false) }}>
              {p === 'normal' ? 'Normal day' : `${p} month-end`}
            </Chip>
          ))}
          <span className="ml-auto text-xs text-muted">
            {running ? `minute ${Math.min(tick, 40)} of 40` : done ? 'run finished' : 'not started'}
          </span>
        </CardBody>
      </Card>

      {(running || done) && (
        <Card className="mb-4" tone={over.length ? 'danger' : 'success'}>
          <CardBody className="flex flex-wrap items-center gap-4">
            <Zap size={20} className={over.length ? 'text-danger' : 'text-success'} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-text">
                {over.length
                  ? `${worst.id} ${worst.name} bends first`
                  : `Every interface stayed inside its capacity at ${profile === 'normal' ? 'a normal day' : profile}`}
              </div>
              <p className="text-xs text-muted">
                {over.length
                  ? `It saturates at ${Math.round((1 / worst.saturation) * PROFILE_FACTOR[profile] * 10) / 10}x volume. At ${profile} it runs at ${Math.round(worst.saturation * 100)} % of capacity, p95 ${num(worst.p95)} ms, ${num(worst.backlog)} messages waiting.`
                  : `The slowest is ${worst.id} at ${Math.round(worst.saturation * 100)} % of its capacity.`}
              </p>
            </div>
            {over.length > 0 && (
              <Button onClick={() => navigate(`/interfaces?interface=${worst.id}`)}>Open {worst.id}</Button>
            )}
          </CardBody>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Throughput" value={`${num(totalPerMin)}/min`} tone="info" hint="across nine live interfaces" />
        <StatTile label="Worst p95" value={`${num(maxP95)} ms`} tone={maxP95 > 800 ? 'danger' : maxP95 > 500 ? 'warning' : 'neutral'} hint="target is 800 ms" />
        <StatTile label="Backlog at the cut-off" value={num(totalBacklog)} tone={totalBacklog ? 'danger' : 'success'} hint="target is zero" />
        <StatTile label="Interfaces over capacity" value={`${over.length} of ${rows.length}`} tone={over.length ? 'danger' : 'success'} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Throughput and backlog" subtitle="Backlog is what has not drained yet. It must be zero at the cut-off." />
          <CardBody>
            <MultiLineChart
              data={series}
              reference={{ y: 0, label: 'backlog target', tone: 'success' }}
              series={[
                { key: 'throughput', label: 'Throughput', tone: 'primary' },
                { key: 'backlog', label: 'Backlog', tone: 'danger' },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Response time and errors" subtitle="p95 in milliseconds against errors per minute." />
          <CardBody>
            <MultiLineChart
              data={series}
              reference={{ y: 800, label: 'p95 target 800 ms', tone: 'danger' }}
              series={[
                { key: 'p95', label: 'p95 ms', tone: 'accent' },
                { key: 'errors', label: 'Errors', tone: 'danger' },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Interface by interface"
          subtitle={`At ${profile === 'normal' ? 'a normal day' : `${profile} month-end volume`}, sorted by how much of its capacity each one is using.`}
        />
        <DataTable
          rows={[...rows].sort((a, b) => b.saturation - a.saturation)}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/interfaces?interface=${r.id}`)}
          rowTone={(r) => (r.status === 'Over capacity' ? 'danger' : r.status === 'At the limit' ? 'warning' : undefined)}
          columns={[
            { key: 'id', header: 'Interface', mono: true, width: 100 },
            { key: 'name', header: 'What it carries' },
            { key: 'perMin', header: 'Per minute', align: 'right', mono: true, width: 110 },
            { key: 'p95', header: 'p95 ms', align: 'right', mono: true, width: 100, render: (r) => <span className={r.p95 > 800 ? 'text-danger' : ''}>{num(r.p95)}</span> },
            { key: 'errors', header: 'Errors/min', align: 'right', mono: true, width: 110 },
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
              width: 140,
              render: (r) => (
                <Badge tone={r.status === 'Over capacity' ? 'danger' : r.status === 'At the limit' ? 'warning' : 'success'}>
                  {r.status}
                </Badge>
              ),
            },
          ]}
        />
        <SourceNote
          title="How the load model works"
          reads={[
            { label: 'Fourteen interfaces', route: '/landscape' },
            { label: 'Observed message rates', route: '/interfaces' },
          ]}
          computes="each interface has a measured rate and a capacity; the profile multiplies the rate and the model reports where it saturates"
          feeds={[{ label: 'Release exit criteria', route: '/release' }, { label: 'Finding F-008', route: '/finding/F-008' }]}
          steps={[
            'Each live interface carries a baseline rate per minute and the volume at which it saturates.',
            'The profile multiplies the rate: a normal day, twice, or five times month-end volume.',
            'p95, errors and backlog are derived from how far past its comfortable point each interface is pushed.',
            'The first interface to pass 100 % of capacity is the one reported as bending first.',
          ]}
        />
      </Card>

      {done && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card tone={lost ? 'danger' : 'success'}>
            <CardHeader title="Integrity after the run" subtitle="Every message that went in must come out exactly once." />
            <CardBody className="space-y-2 text-sm">
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Sent" value={num(Math.round(totalPerMin * 40))} />
                <StatTile label="Received" value={num(Math.round(totalPerMin * 40) - lost)} tone={lost ? 'warning' : 'success'} />
                <StatTile label="Lost or stuck" value={num(lost)} tone={lost ? 'danger' : 'success'} />
              </div>
              {lost ? (
                <p className="text-danger">
                  Two invoices were still in flight on {worst.id} when the posting period closed, so they would post into
                  the next period. This is finding F-008, and it is the reason the freeze cannot drop from 10 days to 3.
                </p>
              ) : (
                <p className="text-success">Nothing was lost, duplicated or left in flight.</p>
              )}
              {lost > 0 && (
                <Button size="sm" onClick={() => navigate('/finding/F-008')}>
                  Open F-008
                </Button>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Profiles measured so far" subtitle="Run each profile to compare them side by side." />
            <CardBody>
              <DataTable
                rows={(['normal', '2x', '5x'] as Profile[]).map((p) => ({
                  profile: p === 'normal' ? 'Normal day' : `${p} month-end`,
                  key: p,
                  ...(history[p] ?? { p95: 0, backlog: 0, lost: 0 }),
                  measured: !!history[p],
                }))}
                rowKey={(r) => r.key}
                dense
                rowTone={(r) => (r.measured && (r.lost > 0 || r.backlog > 0) ? 'danger' : undefined)}
                columns={[
                  { key: 'profile', header: 'Profile' },
                  { key: 'p95', header: 'Worst p95', align: 'right', mono: true, render: (r) => (r.measured ? `${num(r.p95)} ms` : '—') },
                  { key: 'backlog', header: 'Backlog', align: 'right', mono: true, render: (r) => (r.measured ? num(r.backlog) : '—') },
                  { key: 'lost', header: 'Lost', align: 'right', mono: true, render: (r) => (r.measured ? num(r.lost) : '—') },
                  {
                    key: 'measured',
                    header: 'Verdict',
                    width: 130,
                    render: (r) =>
                      !r.measured ? (
                        <Badge tone="neutral">not measured</Badge>
                      ) : r.lost || r.backlog ? (
                        <Badge tone="danger">fails</Badge>
                      ) : (
                        <Badge tone="success">holds</Badge>
                      ),
                    value: (r) => (r.measured ? 1 : 0),
                  },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      )}
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
