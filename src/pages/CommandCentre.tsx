import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CheckCircle2, CircleAlert, Gauge as GaugeIcon, Info, Play, Rocket, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  DataTable,
  Gauge,
  LiveLog,
  Progress,
  SectionTitle,
  StatTile,
  Switch,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { FindingsBar, MultiLineChart, TrendChart } from '@/components/charts'
import { HealthLegend, WorkflowFlow, type StageMark } from '@/components/domain/WorkflowFlow'
import { CHANGES, PROCESSES, REQUIREMENTS, RUNS, SCENARIOS, SYSTEMS, TREND_30_DAYS } from '@/data'
import { useStore } from '@/data/appStore'
import { useChecks } from '@/sim/useSim'
import { confidence, gateDecision } from '@/lib/score'
import { num } from '@/lib/format'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'

const TABS = [
  { label: 'Health', path: '/' },
  { label: 'Release & Close', path: '/release' },
  { label: 'Month-End Load', path: '/load' },
  { label: 'Impact Simulator', path: '/simulator' },
]

function useConfidence() {
  const checks = useChecks()
  const store = useStore()
  const last = RUNS[0]
  return useMemo(
    () =>
      confidence({
        checks,
        findings: store.findings,
        scenariosPassed: last.passed,
        scenariosTotal: last.scenarios,
        interfacesMatched: 11,
        interfacesTotal: 14,
      }),
    [checks, store.findings, last],
  )
}

/* -------------------------------------------------------------------------- */
/* Health                                                                     */
/* -------------------------------------------------------------------------- */

export function HealthPage() {
  const navigate = useNavigate()
  const drawer = useDrawer()
  const store = useStore()
  const checks = useChecks()
  const conf = useConfidence()

  const openFindings = store.findings.filter((f) => f.status !== 'Closed')
  const bySeverity = (['Critical', 'High', 'Medium', 'Low'] as const).map((s) => ({
    name: s,
    value: openFindings.filter((f) => f.severity === s).length,
    tone: s === 'Critical' ? ('danger' as const) : s === 'High' ? ('accent' as const) : s === 'Medium' ? ('info' as const) : ('subtle' as const),
  }))

  return (
    <>
      <PageHeader
        title="Command Centre"
        subtitle="One number for how much you can trust the application landscape today, and the evidence behind it."
        tabs={TABS}
        actions={
          <Button variant="primary" leftIcon={<Play size={15} />} onClick={() => navigate('/run?demo=1')}>
            Run the P1 demo
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader title="Confidence score" subtitle="Weighted, and capped while a critical finding is open." />
          <CardBody className="flex flex-col items-center gap-3">
            <Gauge value={conf.score} caption={conf.capped ? 'Capped at 79 while a critical finding is open' : 'Out of 100'} />
            <Button
              size="sm"
              leftIcon={<Info size={14} />}
              onClick={() =>
                drawer.open({
                  title: 'How the confidence score is calculated',
                  subtitle: 'Deterministic. The same inputs always give the same number.',
                  width: 'md',
                  content: (
                    <div className="space-y-4">
                      {conf.parts.map((p) => (
                        <div key={p.label}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-text">{p.label}</span>
                            <span className="font-mono text-xs text-muted">
                              {Math.round(p.value)} × {Math.round(p.weight * 100)} %
                            </span>
                          </div>
                          <Progress value={p.value} tone={p.value >= 80 ? 'success' : p.value >= 60 ? 'warning' : 'danger'} className="mt-1.5" />
                          <p className="mt-1 text-xs text-muted">{p.note}</p>
                        </div>
                      ))}
                      <div className="rounded-md border border-line bg-surface2 p-3 text-xs text-muted">
                        The weighted total is {Math.round(conf.parts.reduce((s, p) => s + p.weight * p.value, 0))}.
                        {conf.capped
                          ? ' Because at least one critical finding is open, the score is capped at 79 until it is closed.'
                          : ' No cap applies today.'}
                      </div>
                    </div>
                  ),
                })
              }
            >
              How is this calculated
            </Button>
          </CardBody>
        </Card>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Live checks passing"
              value={`${checks.filter((c) => c.status === 'pass').length} of ${checks.length}`}
              tone={checks.every((c) => c.status === 'pass') ? 'success' : 'danger'}
              hint="against live plant data"
              onClick={() => navigate('/flow/checks')}
            />
            <StatTile
              label="Open findings"
              value={num(openFindings.length)}
              tone={openFindings.some((f) => f.severity === 'Critical') ? 'danger' : 'warning'}
              hint={`${openFindings.filter((f) => f.severity === 'Critical').length} critical`}
              onClick={() => navigate('/run')}
            />
            <StatTile label="Scenarios" value={num(SCENARIOS.length)} hint="approved and ready to run" onClick={() => navigate('/studio')} />
            <StatTile label="Interfaces matched" value="11 of 14" tone="warning" hint="field by field" onClick={() => navigate('/interfaces')} />
          </div>

          <Card>
            <CardHeader
              title="Month-end readiness"
              subtitle="Freeze takes 10 days today. The target is 3."
              actions={<Button size="sm" onClick={() => navigate('/release')}>Open Release & Close</Button>}
            />
            <CardBody className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="font-mono text-2xl font-semibold text-text">10 days</div>
                  <div className="text-xs text-muted">current freeze window</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xl font-semibold text-success">3 days</div>
                  <div className="text-xs text-muted">target by R-2026.11</div>
                </div>
              </div>
              <Progress value={42} tone="warning" />
              <p className="text-xs text-muted">
                Shortening the freeze depends on the interface backlog reaching zero at the cut-off, which fails today at
                the 5x load profile.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader title="Confidence over the last 30 days" subtitle="Each point is the nightly regression plus the live checks." />
        <CardBody>
          <TrendChart data={TREND_30_DAYS} />
        </CardBody>
      </Card>

      <SectionTitle
        title="Workflow health, stage by stage"
        hint="Click any stage to open it in the process ontology."
        actions={<HealthLegend />}
      />
      <div className="mb-4 grid gap-3">
        {PROCESSES.map((p) => (
          <Card key={p.id}>
            <CardHeader
              title={`${p.id} · ${p.name}`}
              subtitle={p.summary}
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigate(`/ontology?process=${p.id}`)}>
                  Open workflow
                </Button>
              }
            />
            <CardBody className="pt-4">
              <WorkflowFlow process={p} onStageClick={(id) => navigate(`/ontology?process=${p.id}&stage=${id}`)} />
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Open findings by severity" subtitle="Click a bar to see those findings." />
          <CardBody>
            <FindingsBar data={bySeverity} onSelect={() => navigate('/run')} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Requirements proven" subtitle="Each tile opens the screen that proves it." />
          <CardBody className="grid grid-cols-2 gap-2">
            {REQUIREMENTS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(r.provenBy[0].route)}
                className="flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2 text-left transition-[transform,box-shadow] duration-[120ms] hover:-translate-y-px hover:shadow-md"
              >
                {r.status === 'Proven' ? (
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                ) : (
                  <CircleAlert size={15} className="mt-0.5 shrink-0 text-accent" />
                )}
                <span className="min-w-0">
                  <span className="block font-mono text-[11px] text-subtle">{r.id}</span>
                  <span className="block truncate text-xs text-text">{r.title}</span>
                </span>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Last runs" subtitle="Click a run to open its summary." />
        <DataTable
          rows={[...store.runs, ...RUNS]}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/report/${r.id}`)}
          columns={[
            { key: 'id', header: 'Run', mono: true, width: 110 },
            { key: 'when', header: 'When', width: 160 },
            { key: 'trigger', header: 'Trigger' },
            { key: 'scenarios', header: 'Scenarios', align: 'right', mono: true, width: 100 },
            { key: 'passed', header: 'Passed', align: 'right', mono: true, width: 90 },
            { key: 'failed', header: 'Failed', align: 'right', mono: true, width: 90 },
            {
              key: 'verdict',
              header: 'Verdict',
              width: 130,
              render: (r) => (
                <Badge tone={r.verdict === 'PASS' ? 'success' : r.verdict === 'FAIL' ? 'danger' : 'warning'}>{r.verdict}</Badge>
              ),
            },
          ]}
        />
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Release & Close                                                            */
/* -------------------------------------------------------------------------- */

export function ReleasePage() {
  const navigate = useNavigate()
  const conf = useConfidence()
  const store = useStore()
  const blockers = store.findings.filter((f) => f.severity === 'Critical' && f.status === 'Open')
  const decision = gateDecision(conf.score, blockers.length)

  const days = Array.from({ length: 31 }, (_, i) => i + 1)
  const freezeFrom = 22

  return (
    <>
      <PageHeader
        title="Release & Close"
        subtitle="One gate decision for release R-2026.10, and what is safe to change before the month-end close."
        tabs={TABS}
        actions={
          <Button variant="primary" leftIcon={<Rocket size={15} />} onClick={() => navigate('/release-report/R-2026.10')}>
            Open the release report
          </Button>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card tone={decision === 'GO' ? 'success' : decision === 'NO-GO' ? 'danger' : 'warning'}>
          <CardBody className="flex flex-col items-center gap-3 text-center">
            <Badge tone={decision === 'GO' ? 'success' : decision === 'NO-GO' ? 'danger' : 'warning'}>Gate decision</Badge>
            <div
              className={cn(
                'font-mono text-3xl font-semibold',
                decision === 'GO' ? 'text-success' : decision === 'NO-GO' ? 'text-danger' : 'text-accent',
              )}
            >
              {decision}
            </div>
            <p className="text-sm text-muted">
              Confidence {conf.score} of 100 with {blockers.length} critical {blockers.length === 1 ? 'blocker' : 'blockers'} open.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Blockers" subtitle="Each one must be closed or accepted before the release can go." />
          <CardBody className="space-y-2">
            {blockers.length === 0 && <p className="text-sm text-success">Nothing is blocking the release.</p>}
            {blockers.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => navigate(`/finding/${b.id}`)}
                className="flex w-full items-start gap-3 rounded-md border border-danger/40 bg-danger-soft/50 px-3 py-2 text-left transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md"
              >
                <CircleAlert size={16} className="mt-0.5 shrink-0 text-danger" />
                <span className="min-w-0">
                  <span className="block font-mono text-[11px] text-subtle">{b.id}</span>
                  <span className="block text-sm text-text">{b.title}</span>
                  <span className="block text-xs text-muted">{b.system}</span>
                </span>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Freeze calendar" subtitle="October 2026. The freeze runs from the 22nd to the end of the month." icon={<CalendarDays size={16} />} />
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
                return (
                  <div
                    key={d}
                    className={cn(
                      'rounded-md border px-1 py-2 text-center font-mono text-xs',
                      frozen ? 'border-accent/40 bg-accent-soft/60 text-accent' : 'border-line bg-surface text-muted',
                      today && 'ring-2 ring-primary',
                    )}
                    title={frozen ? 'Inside the freeze window' : 'Open for changes'}
                  >
                    {d}
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              Today is the 14th. Eight days remain before the freeze, which is why two changes below are marked as not
              safe.
            </p>
          </CardBody>
        </Card>

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
                <Badge tone={c.safeBeforeClose ? 'success' : 'danger'}>{c.safeBeforeClose ? 'Safe' : 'Not safe'}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] text-subtle">{c.id}</span>
                  <span className="block truncate text-sm text-text">{c.title}</span>
                </span>
                <span className="shrink-0 font-mono text-xs text-muted">risk {c.risk}</span>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Month-End Load                                                             */
/* -------------------------------------------------------------------------- */

type Profile = 'normal' | '2x' | '5x'

const PROFILE_FACTOR: Record<Profile, number> = { normal: 1, '2x': 2, '5x': 5 }

export function LoadPage() {
  const [profile, setProfile] = useState<Profile>('normal')
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [tick, setTick] = useState(0)
  const toast = useToast()

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((t) => t + 1), 220)
    return () => window.clearInterval(id)
  }, [running])

  useEffect(() => {
    if (running && tick >= 40) {
      setRunning(false)
      setDone(true)
      toast({
        title: `Load run at ${profile} finished`,
        description: profile === '5x' ? 'Two invoices were still in flight at the cut-off.' : 'No records were lost.',
        tone: profile === '5x' ? 'danger' : 'success',
      })
    }
  }, [running, tick, profile, toast])

  const factor = PROFILE_FACTOR[profile]
  const data = useMemo(
    () =>
      Array.from({ length: Math.min(tick, 40) }, (_, i) => {
        const load = 1 + Math.sin(i / 5) * 0.15
        return {
          minute: `${i}`,
          throughput: Math.round(120 * factor * load),
          p95: Math.round(180 + factor * factor * 26 + Math.sin(i / 3) * 18),
          errors: Math.max(0, Math.round((factor - 1) * 1.6 + Math.sin(i / 4) * 1.2)),
          backlog: Math.max(0, Math.round((factor - 1) * 14 + Math.sin(i / 6) * 8 * factor)),
        }
      }),
    [tick, factor],
  )

  const last = data[data.length - 1]

  return (
    <>
      <PageHeader
        title="Month-End Load"
        subtitle="Push the month-end volume through the interfaces and watch where it bends."
        tabs={TABS}
        actions={
          <Button
            variant="primary"
            leftIcon={<Play size={15} />}
            loading={running}
            onClick={() => {
              setTick(0)
              setDone(false)
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
            <Chip key={p} selected={profile === p} onClick={() => { setProfile(p); setDone(false); setTick(0) }}>
              {p === 'normal' ? 'Normal day' : `${p} month-end`}
            </Chip>
          ))}
          <span className="ml-auto text-xs text-muted">
            {running ? `minute ${Math.min(tick, 40)} of 40` : done ? 'run finished' : 'not started'}
          </span>
        </CardBody>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Throughput" value={last ? `${num(last.throughput)}/min` : '—'} tone="info" hint="messages across all interfaces" />
        <StatTile label="p95 response" value={last ? `${num(last.p95)} ms` : '—'} tone={last && last.p95 > 800 ? 'danger' : 'neutral'} hint="slowest 5 % of calls" />
        <StatTile label="Error rate" value={last ? `${last.errors}/min` : '—'} tone={last && last.errors > 3 ? 'danger' : 'success'} hint="rejected or retried" />
        <StatTile label="Backlog" value={last ? num(last.backlog) : '—'} tone={last && last.backlog > 30 ? 'danger' : 'neutral'} hint="messages waiting" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Throughput and backlog" subtitle="Backlog is what has not drained yet." />
          <CardBody>
            <MultiLineChart
              data={data}
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
              data={data}
              series={[
                { key: 'p95', label: 'p95 ms', tone: 'accent' },
                { key: 'errors', label: 'Errors', tone: 'danger' },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {done && (
        <Card className="mt-4" tone={profile === '5x' ? 'danger' : 'success'}>
          <CardHeader title="Integrity check after the run" subtitle="Every message that went in must come out exactly once." />
          <CardBody className="space-y-2 text-sm">
            {profile === '5x' ? (
              <>
                <p className="text-danger">
                  Two invoices were still in flight when the posting period closed. They would post into the next period.
                </p>
                <p className="text-muted">
                  This is finding F-008. It is the reason the freeze window cannot drop from 10 days to 3 yet.
                </p>
              </>
            ) : (
              <p className="text-success">
                All {num(Math.round(120 * factor * 40))} messages were accounted for. Nothing was lost, duplicated or left
                in flight.
              </p>
            )}
          </CardBody>
        </Card>
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
  const [selected, setSelected] = useState<string[]>(['CH-204', 'CH-205', 'CH-206'])
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [wholeRelease, setWholeRelease] = useState(true)

  const changes = CHANGES.filter((c) => selected.includes(c.id))
  const unsafe = changes.filter((c) => !c.safeBeforeClose)

  const logLines = [
    'Reading the change feed and the transport list…',
    'Mapping each change onto the workflow ontology…',
    `Walking ${changes.length} changes through 6 workflows and 14 interfaces…`,
    'Comparing against the last baseline run RUN-1041…',
    'Scoring the risk for the month-end close…',
    `Verdict ready: ${unsafe.length} of ${changes.length} changes are not safe before the close.`,
  ]

  const marks = useMemo(() => {
    const out: Record<string, StageMark> = {}
    changes.forEach((c) => {
      c.stages.forEach((s) => {
        out[s] = 'change'
      })
    })
    PROCESSES.forEach((p) => {
      let seenChange = false
      p.stages.forEach((s) => {
        if (out[s.id] === 'change') {
          seenChange = true
          return
        }
        if (seenChange && !out[s.id]) out[s.id] = 'downstream'
      })
    })
    return out
  }, [changes])

  const affected = new Set(changes.flatMap((c) => c.affectedSystems))
  const downstream = new Set(changes.flatMap((c) => c.downstreamSystems).filter((s) => !affected.has(s)))

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
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={wholeRelease}
              onChange={(v) => {
                setWholeRelease(v)
                setSelected(v ? CHANGES.filter((c) => c.release === 'R-2026.10').map((c) => c.id) : [])
                setPhase('idle')
              }}
              label="Simulate the whole release R-2026.10"
              size="sm"
            />
          </div>
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
          <Card tone={unsafe.length ? 'danger' : 'success'} className="mb-4">
            <CardBody className="flex flex-wrap items-center gap-4">
              <GaugeIcon size={24} className={unsafe.length ? 'text-danger' : 'text-success'} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text">
                  {unsafe.length} of {changes.length} changes are not safe before the close
                </div>
                <p className="text-xs text-muted">
                  {unsafe.length
                    ? `Hold ${unsafe.map((c) => c.id).join(' and ')} until after the close, or close the critical findings they depend on first.`
                    : 'Everything selected can go in before the close.'}
                </p>
              </div>
              <Button onClick={() => navigate('/release')}>Open the gate decision</Button>
            </CardBody>
          </Card>

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

          <SectionTitle title="What it means for the plant" hint="One sentence per change, in plain language." />
          <div className="grid gap-3 lg:grid-cols-2">
            {changes.map((c) => (
              <Card key={c.id} tone={c.safeBeforeClose ? 'default' : 'danger'}>
                <CardBody>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={c.safeBeforeClose ? 'success' : 'danger'}>{c.safeBeforeClose ? 'Safe' : 'Not safe'}</Badge>
                    <span className="font-mono text-[11px] text-subtle">{c.id}</span>
                  </div>
                  <div className="text-sm font-medium text-text">{c.title}</div>
                  <p className="mt-1 text-sm text-muted">{c.business.replace('For the business: ', '')}</p>
                  <Button size="sm" variant="link" className="mt-2" onClick={() => navigate(`/regression?change=${c.id}`)}>
                    See the full impact
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}

      {phase === 'idle' && (
        <Card>
          <CardBody className="py-10 text-center">
            <Zap size={26} className="mx-auto mb-3 text-subtle" />
            <p className="text-sm font-medium text-text">Pick a release or individual changes, then simulate</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted">
              The simulator walks each change through the workflow ontology and tells you, in plain language, what the
              plant would feel.
            </p>
          </CardBody>
        </Card>
      )}
    </>
  )
}
