import { Fragment, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Info,
  Pause,
  Play,
  TrendingDown,
  Truck,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  Gauge,
  Progress,
  SectionTitle,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { FindingsBar, TrendChart } from '@/components/charts'
import { HealthLegend } from '@/components/domain/WorkflowFlow'
import { SourceNote } from '@/components/domain/SourceNote'
import { FREEZE_TARGET_DAYS, PROCESSES, RUNS, SCENARIOS, TREND_30_DAYS, freezeDays, type StageHealth } from '@/data'
import { JOURNEY_REQUIREMENTS, screensForRequirement, stepsCovering } from '@/data/journey'
import { useStore } from '@/data/appStore'
import { ALL_PROJECTS, PROJECTS, projectOfSystem, projectOfSystems, useProjectFilter } from '@/data/projects'
import { useChecks, useSim } from '@/sim/useSim'
import { confidence } from '@/lib/score'
import { useConfidenceInput, scoreIf } from '@/lib/useConfidenceInput'
import { interfaceStats } from '@/lib/interfaceStats'
import { interfaceTraffic, plantPulse, systemActivity } from '@/lib/live'
import { fmtSim, num, plural } from '@/lib/format'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'

const TABS = [
  { label: 'Health', path: '/' },
  { label: 'Release & Close', path: '/release' },
  { label: 'Month-End Load', path: '/load' },
  { label: 'Impact Simulator', path: '/simulator' },
]

const HEALTH_PILL: Record<StageHealth, string> = {
  working: 'border-success/40 bg-success-soft/50',
  watch: 'border-accent/40 bg-accent-soft/50',
  issue: 'border-danger/45 bg-danger-soft/50',
  'not tested': 'border-line bg-surface2/60',
}

const HEALTH_WORD: Record<StageHealth, string> = {
  working: 'Working',
  watch: 'Watch',
  issue: 'Issue',
  'not tested': 'Not tested',
}

const HEALTH_TONE: Record<StageHealth, 'success' | 'warning' | 'danger' | 'neutral'> = {
  working: 'success',
  watch: 'warning',
  issue: 'danger',
  'not tested': 'neutral',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "18 Oct 2026 02:00" becomes "Tonight 02:00"; anything without a clock stays blank. */
function shortWhen(s: { nextRun: string; nextInMinutes: number }) {
  const time = s.nextRun.match(/\b(\d{2}:\d{2})$/)?.[1]
  if (!time) return ''
  if (s.nextInMinutes <= 24 * 60 && Number(time.slice(0, 2)) < 5) return `Tonight ${time}`
  return time
}

export function HealthPage() {
  const navigate = useNavigate()
  const drawer = useDrawer()
  const toast = useToast()
  const store = useStore()
  const checks = useChecks()
  const { engine } = useSim()
  const input = useConfidenceInput()
  const conf = confidence(input)

  const ifStats = useMemo(() => interfaceStats(), [checks])
  const pulse = useMemo(() => plantPulse(60), [checks])
  const systems = useMemo(() => systemActivity(60).filter((s) => s.live), [checks])
  const traffic = useMemo(() => interfaceTraffic(60), [checks])

  const openFindings = store.findings.filter((f) => f.status !== 'Closed')
  const criticals = openFindings.filter((f) => f.severity === 'Critical')
  const failingChecks = checks.filter((c) => c.status === 'fail')
  const busiestSystem = Math.max(1, ...systems.map((s) => s.recent))

  const bySeverity = (['Critical', 'High', 'Medium', 'Low'] as const).map((s) => ({
    name: s,
    value: openFindings.filter((f) => f.severity === s).length,
    tone:
      s === 'Critical' ? ('danger' as const)
      : s === 'High' ? ('accent' as const)
      : s === 'Medium' ? ('info' as const)
      : ('subtle' as const),
  }))

  const trend = useMemo(() => {
    const end = new Date(2026, 9, 14)
    return TREND_30_DAYS.map((p, i) => {
      const d = new Date(end.getTime() - (TREND_30_DAYS.length - 1 - i) * 86400000)
      return {
        day: `${d.getDate()} ${MONTHS[d.getMonth()]}`,
        score: i === TREND_30_DAYS.length - 1 ? conf.score : p.score,
      }
    })
  }, [conf.score])

  const actions = useMemo(() => {
    const list: { title: string; detail: string; gain: number; route: string; cta: string }[] = []

    criticals.forEach((f) => {
      list.push({
        title: `Close ${f.id}`,
        detail: f.title,
        gain: scoreIf(input, { findings: store.findings.filter((x) => x.id !== f.id) }) - conf.score,
        route: `/finding/${f.id}`,
        cta: 'Open the finding card',
      })
    })

    if (failingChecks.length) {
      list.push({
        title: `Fix the cause behind ${failingChecks.length} live ${failingChecks.length === 1 ? 'check' : 'checks'}`,
        detail: `${failingChecks.map((c) => c.id).join(', ')} disagree across systems right now.`,
        gain: scoreIf(input, { checks: checks.map((c) => ({ ...c, status: 'pass' as const, rows: [] })) }) - conf.score,
        route: '/flow/checks',
        cta: 'Open live checks',
      })
    }

    if (ifStats.matched < ifStats.measured) {
      list.push({
        title: `Clean up ${ifStats.measured - ifStats.matched} interfaces`,
        detail: `${ifStats.rows.filter((r) => !r.clean).map((r) => r.id).join(', ')} carry damaged, lost or doubled messages.`,
        gain: scoreIf(input, { messagesMatched: ifStats.messagesTotal }) - conf.score,
        route: '/interfaces',
        cta: 'Open interface testing',
      })
    }

    if (RUNS[0].failed > 0) {
      list.push({
        title: `Get the ${RUNS[0].failed} failing scenarios green`,
        detail: `${RUNS[0].id} ended ${RUNS[0].verdict} with ${RUNS[0].failed} failures.`,
        gain: scoreIf(input, { scenariosPassed: RUNS[0].scenarios }) - conf.score,
        route: '/run',
        cta: 'Open the Run Centre',
      })
    }

    return list.sort((a, b) => b.gain - a.gain).slice(0, 4)
  }, [input, conf.score, criticals, failingChecks, checks, ifStats, store.findings])

  const projectFilter = useProjectFilter()
  const nextRuns = [...store.schedules]
    .filter((s) => s.on && (s.project === ALL_PROJECTS || projectFilter.matches(s.project)))
    .sort((a, b) => a.nextInMinutes - b.nextInMinutes)
    .slice(0, 3)

  return (
    <>
      <PageHeader
        title="Command Centre"
        subtitle="How much you can trust the application landscape today, where every number comes from, and what to do next."
        tabs={TABS}
        actions={
          <>
            <Button
              leftIcon={engine.running ? <Pause size={15} /> : <Play size={15} />}
              onClick={() => engine.toggle()}
            >
              {engine.running ? 'Pause the plant' : 'Run the plant'}
            </Button>
            <Button variant="primary" leftIcon={<Play size={15} />} onClick={() => navigate('/run?demo=1')}>
              Run the P1 demo
            </Button>
          </>
        }
      />

      {/* ---------------------------------------------------------------- */}
      {/* the projects running at the same time                              */}
      {/* ---------------------------------------------------------------- */}
      <Card>
        <CardHeader
          title="Projects"
          subtitle="Three change projects are running at once. Pick one in the header and the whole factory follows it."
          actions={
            <Badge tone={projectFilter.project ? 'info' : 'neutral'}>
              {projectFilter.project ? projectFilter.project.name : 'All projects'}
            </Badge>
          }
        />
        <CardBody className="divide-y divide-line py-0">
          {PROJECTS.map((p) => {
            const scenarios = SCENARIOS.filter((s) => projectOfSystems(s.systems) === p.id).length
            const open = store.findings.filter((f) => f.status !== 'Closed' && projectOfSystem(f.system) === p.id)
            const criticalsHere = open.filter((f) => f.severity === 'Critical').length
            const schedules = store.schedules.filter((s) => s.project === p.id && s.on).length
            const selected = projectFilter.projectId === p.id
            return (
              <div
                key={p.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-2',
                  selected && 'bg-primary-soft/40',
                )}
              >
                <span className="text-sm font-medium text-text">{p.name}</span>
                <Badge tone={criticalsHere ? 'danger' : open.length ? 'warning' : 'success'}>
                  {criticalsHere ? `${criticalsHere} critical` : open.length ? `${open.length} open` : 'clean'}
                </Badge>
                <span className="font-mono text-[11px] text-subtle">{num(scenarios)} scenarios</span>
                <span className="font-mono text-[11px] text-subtle">{plural(schedules, 'schedule on', 'schedules on')}</span>
                <span className="font-mono text-[11px] text-subtle">{p.release}</span>
                <button
                  type="button"
                  onClick={() => {
                    projectFilter.setProject(p.id)
                    toast({ title: `Showing project: ${p.name}`, tone: 'info' })
                    navigate(`/run?project=${p.id}`)
                  }}
                  className="ml-auto rounded-sm text-xs font-medium text-primary transition-colors hover:underline"
                  title={`Show ${p.name} in the Run Centre`}
                >
                  View →
                </button>
              </div>
            )
          })}
        </CardBody>
      </Card>

      <p className="mb-4 mt-1.5 px-1 text-xs text-muted">
        Next runs:{' '}
        {nextRuns.length === 0
          ? 'nothing is scheduled'
          : nextRuns.map((s, i) => (
              <Fragment key={s.id}>
                {i > 0 && ' · '}
                {s.name}
                {shortWhen(s) && <span className="text-subtle"> {shortWhen(s)}</span>}
              </Fragment>
            ))}{' '}
        —{' '}
        <button
          type="button"
          onClick={() => navigate('/run/schedules')}
          className="rounded-sm font-medium text-primary transition-colors hover:underline"
        >
          see Schedules →
        </button>
      </p>

      {/* ---------------------------------------------------------------- */}
      {/* the plant, live                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mb-4">
        <CardHeader
          title="The plant, right now"
          subtitle="Everything below is produced by the simulated plant as you watch. Nothing here is a fixed number."
          icon={<Activity size={16} className={engine.running ? 'text-success' : 'text-subtle'} />}
          actions={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <span className={cn('h-2 w-2 rounded-full', engine.running ? 'animate-pulseDot bg-success' : 'bg-subtle')} />
                {engine.running ? `running at ${engine.speed}x` : 'paused'}
              </span>
              <Button size="sm" leftIcon={<Truck size={14} />} onClick={() => engine.addTruck()}>
                Send a truck
              </Button>
              <Button size="sm" onClick={() => navigate('/flow')}>
                Watch the flow
              </Button>
            </div>
          }
        />
        <CardBody className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Plant clock" value={fmtSim(pulse.now).slice(-5)} hint={fmtSim(pulse.now).slice(0, 6)} />
          <StatTile
            label="Vehicles in the last hour"
            value={num(pulse.vehiclesLastHour)}
            hint={`${num(pulse.vehicles)} since the shift started`}
            onClick={() => navigate('/flow/data?system=yard&table=gate_pass')}
          />
          <StatTile
            label="Records created in the last hour"
            value={num(pulse.recordsLastHour)}
            hint={`${num(pulse.records)} held across ${systems.length} systems`}
            onClick={() => navigate('/flow/data')}
          />
          <StatTile
            label="Messages delivered"
            value={num(pulse.delivered)}
            tone="success"
            hint="in the last simulated hour"
            onClick={() => navigate('/interfaces')}
          />
          <StatTile
            label="In flight right now"
            value={num(pulse.inFlight)}
            tone="info"
            hint="moving between systems"
            onClick={() => navigate('/flow')}
          />
          <StatTile
            label="Damaged, lost or doubled"
            value={num(pulse.damaged)}
            tone={pulse.damaged ? 'danger' : 'success'}
            hint="in the last simulated hour"
            onClick={() => navigate('/flow/checks')}
          />
        </CardBody>
        <SourceNote
          title="How the live numbers are produced"
          reads={[
            { table: 'gate_pass', note: 'every vehicle that passed a gate' },
            { table: 'MSEG', note: 'goods receipts booked in SAP' },
            { label: 'engine.messages', note: 'every message on the live interfaces' },
          ]}
          computes="counts rows created in the last 60 simulated minutes"
          feeds={[{ label: 'Confidence score', route: '/' }, { label: 'Live Data Flow', route: '/flow' }]}
          steps={[
            'The simulation runs an event queue on a seeded random generator, so every replay is identical.',
            'A truck, a recycling load or a mill heat creates records in the system that owns them.',
            'Anything that crosses a system boundary becomes a message with a payload and a travel time.',
            'These tiles count what that produced in the last simulated hour.',
          ]}
        />
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* score + what to do                                                 */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-4 grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="Confidence score" subtitle="Four inputs, weighted. Capped while a critical finding is open." />
          <CardBody className="flex flex-col items-center gap-4">
            <Gauge value={conf.score} caption={conf.capped ? `Would be ${conf.raw}, capped at 79 while a critical finding is open` : 'Out of 100'} />
            <div className="w-full space-y-2.5">
              {conf.parts.map((p) => (
                <div key={p.label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs text-muted">{p.label}</span>
                    <span className="shrink-0 font-mono text-[11px] text-subtle">
                      {Math.round(p.value)} × {Math.round(p.weight * 100)} %
                    </span>
                  </div>
                  <Progress
                    value={p.value}
                    tone={p.value >= 80 ? 'success' : p.value >= 60 ? 'warning' : 'danger'}
                    className="mt-1"
                  />
                  <div className="mt-0.5 text-[11px] text-subtle">{p.note}</div>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              fullWidth
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
                              {Math.round(p.value)} × {Math.round(p.weight * 100)} % ={' '}
                              {Math.round(p.value * p.weight)}
                            </span>
                          </div>
                          <Progress value={p.value} tone={p.value >= 80 ? 'success' : p.value >= 60 ? 'warning' : 'danger'} className="mt-1.5" />
                          <p className="mt-1 text-xs text-muted">{p.note}</p>
                        </div>
                      ))}
                      <div className="rounded-md border border-line bg-surface2 p-3 text-xs text-muted">
                        The weighted total is {Math.round(conf.parts.reduce((s, p) => s + p.weight * p.value, 0))}.
                        {conf.capped
                          ? ' Because at least one critical finding is open, the score is capped at 79 until it is closed. The cap exists so a landscape with a known critical defect can never look healthy.'
                          : ' No cap applies today.'}
                      </div>
                    </div>
                  ),
                })
              }
            >
              Show the full calculation
            </Button>
          </CardBody>
          <SourceNote
            title="What the confidence score is made of"
            reads={[
              { label: 'Live checks (9)', route: '/flow/checks' },
              { label: `Last run ${RUNS[0].id}`, route: `/report/${RUNS[0].id}` },
              { label: 'Interface agreement', route: '/interfaces' },
              { label: 'Open findings', route: '/run' },
            ]}
            computes="35 % checks · 30 % scenarios · 20 % interfaces · 15 % findings"
            feeds={[{ label: 'Release gate decision', route: '/release' }, { label: 'Impact Simulator', route: '/simulator' }]}
            steps={[
              'Each input is scored out of 100 from live data, never from a stored number.',
              'The four scores are weighted and added.',
              'If any critical finding is open, the result is capped at 79.',
              'The release gate reads the same number, so the two screens can never disagree.',
            ]}
          />
        </Card>

        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Live checks passing"
              value={`${checks.length - failingChecks.length} of ${checks.length}`}
              tone={failingChecks.length ? 'danger' : 'success'}
              hint={`${num(checks.reduce((s, c) => s + c.compared, 0))} records compared`}
              onClick={() => navigate('/flow/checks')}
            />
            <StatTile
              label="Open findings"
              value={num(openFindings.length)}
              tone={criticals.length ? 'danger' : 'warning'}
              hint={`${criticals.length} critical`}
              onClick={() => navigate('/run?severity=Critical')}
            />
            <StatTile
              label="Scenarios"
              value={num(SCENARIOS.length)}
              hint={`${SCENARIOS.filter((s) => s.lastResult === 'Fail').length} failed last run`}
              onClick={() => navigate('/studio')}
            />
            <StatTile
              label="Interfaces agreeing"
              value={`${ifStats.matched} of ${ifStats.measured}`}
              tone={ifStats.matched === ifStats.measured ? 'success' : 'warning'}
              hint={`${ifStats.messagePct} % of messages arrived intact`}
              onClick={() => navigate('/interfaces')}
            />
          </div>

          <Card>
            <CardHeader
              title="What to do next"
              subtitle="Ranked by the points each one would add to the score, using the same maths as the gauge."
              actions={<Badge tone="neutral">{actions.length} actions</Badge>}
            />
            <CardBody className="space-y-2">
              {actions.length === 0 && <p className="text-sm text-success">Nothing is holding the score back today.</p>}
              {actions.map((a, i) => (
                <button
                  key={a.title}
                  type="button"
                  onClick={() => navigate(a.route)}
                  className="flex w-full items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-[transform,box-shadow,border-color] duration-[120ms] hover:-translate-y-px hover:border-line-strong hover:shadow-md"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface2 font-mono text-xs text-muted">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{a.title}</span>
                    <span className="block truncate text-xs text-muted">{a.detail}</span>
                    <span className="mt-0.5 block text-[11px] text-primary">{a.cta}</span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold',
                      a.gain > 0 ? 'bg-success-soft text-success' : 'bg-surface2 text-subtle',
                    )}
                    title="Points the confidence score would gain"
                  >
                    {a.gain > 0 ? `+${a.gain}` : '±0'}
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-subtle" />
                </button>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* where the data is flowing                                          */}
      {/* ---------------------------------------------------------------- */}
      <SectionTitle
        title="Where the data is flowing"
        hint="Which system is producing records, and which interface is carrying them, over the last simulated hour."
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Records produced in the last hour"
            subtitle={`${systems.length} systems, measured over the last simulated hour.`}
            actions={<Badge tone="neutral">{num(pulse.recordsLastHour)} rows</Badge>}
          />
          <CardBody className="space-y-2">
            {systems.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/flow/data?system=${s.id}`)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface2"
              >
                <span className="w-28 shrink-0 truncate text-xs text-text">{s.short}</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface2">
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{ width: `${Math.max(3, (s.recent / busiestSystem) * 100)}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-xs text-text">{num(s.recent)}</span>
                <span className="w-16 shrink-0 text-right font-mono text-[11px] text-subtle">{num(s.total)} held</span>
              </button>
            ))}
          </CardBody>
          <SourceNote
            reads={[{ table: 'gate_pass' }, { table: 'MSEG' }, { table: 'scrap_batch' }]}
            computes="groups every table by the system that owns it, then counts rows written in the last hour"
            feeds={[{ label: 'System Data', route: '/flow/data' }]}
          />
        </Card>

        <Card>
          <CardHeader
            title="Busiest interfaces in the last hour"
            subtitle="Message volume on the live interfaces in the last hour."
            actions={<Badge tone="neutral">{num(traffic.reduce((s, i) => s + i.count, 0))} messages</Badge>}
          />
          <CardBody className="space-y-1.5">
            {traffic.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => navigate(`/interfaces?interface=${i.id}`)}
                className="flex w-full items-center gap-2.5 rounded-md border border-line px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface2"
              >
                <span className="shrink-0 font-mono font-semibold text-text">{i.id}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{i.name}</span>
                <span className="hidden shrink-0 font-mono text-[11px] text-subtle sm:block">
                  {i.from} → {i.to}
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-text">{num(i.count)}</span>
                {i.damaged > 0 ? (
                  <Badge tone="danger">{i.damaged} bad</Badge>
                ) : (
                  <Badge tone="success">clean</Badge>
                )}
              </button>
            ))}
          </CardBody>
          <SourceNote
            reads={[{ label: 'engine.messages', route: '/flow' }]}
            computes="counts messages sent in the last hour per interface, and how many were damaged, lost or doubled"
            feeds={[{ label: 'Interface Testing', route: '/interfaces' }, { label: 'Confidence score', route: '/' }]}
          />
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* trend + readiness                                                  */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Confidence over the last 30 days"
            subtitle="Each point is that day's nightly regression plus the live checks. Today's point is the gauge above."
          />
          <CardBody>
            <TrendChart data={trend} />
          </CardBody>
          <SourceNote
            reads={[{ label: '30 nightly runs', route: '/evidence' }, { label: 'Live checks', route: '/flow/checks' }]}
            computes="one confidence score per day; today's point is recomputed live"
            feeds={[{ label: 'Release report', route: '/release-report/R-2026.10' }]}
          />
        </Card>

        <Card>
          <CardHeader
            title="Month-end readiness"
            subtitle={`Freeze takes ${freezeDays()} days today. The target is ${FREEZE_TARGET_DAYS}.`}
            actions={<Button size="sm" onClick={() => navigate('/release')}>Release & Close</Button>}
          />
          <CardBody className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="font-mono text-2xl font-semibold text-text">{freezeDays()} days</div>
                <div className="text-xs text-muted">current freeze window</div>
              </div>
              <TrendingDown size={18} className="mb-2 text-subtle" />
              <div className="text-right">
                <div className="font-mono text-2xl font-semibold text-success">{FREEZE_TARGET_DAYS} days</div>
                <div className="text-xs text-muted">target by R-2026.11</div>
              </div>
            </div>
            <Progress value={42} tone="warning" />
            <button
              type="button"
              onClick={() => navigate('/load')}
              className="flex w-full items-start gap-2 rounded-md border border-accent/40 bg-accent-soft/50 px-3 py-2 text-left transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-md"
            >
              <CircleAlert size={14} className="mt-0.5 shrink-0 text-accent" />
              <span className="text-xs text-muted">
                <span className="font-medium text-text">One thing blocks the shorter freeze:</span> at the 5x month-end
                profile the invoice capture interface runs over capacity and two invoices are still in flight at the
                cut-off. Measure it on Month-End Load.
              </span>
            </button>
          </CardBody>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* workflow health                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Card className="mb-4">
        <CardHeader
          title="Workflow health"
          subtitle="Each business process at a glance. Open one for the detail."
          actions={<HealthLegend />}
        />
        <CardBody className="space-y-1.5">
          {PROCESSES.map((p) => {
            const findings = openFindings.filter((f) => f.process === p.id)
            const worst: StageHealth = p.stages.some((s) => s.health === 'issue')
              ? 'issue'
              : p.stages.some((s) => s.health === 'watch')
                ? 'watch'
                : p.stages.some((s) => s.health === 'working')
                  ? 'working'
                  : 'not tested'
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line px-3 py-2.5 transition-colors hover:bg-surface2"
              >
                <div className="min-w-[220px] flex-1">
                  <div className="text-sm font-medium text-text">
                    {p.id} · {p.name}
                  </div>
                  <div className="truncate text-xs text-muted">{p.summary}</div>
                </div>

                <div className="flex shrink-0 items-center gap-1" aria-label={`${p.stages.length} stages`}>
                  {p.stages.map((stage) => (
                    <span
                      key={stage.id}
                      title={`${stage.name} — ${HEALTH_WORD[stage.health]}`}
                      className={cn('h-2.5 w-7 rounded-full border', HEALTH_PILL[stage.health])}
                    />
                  ))}
                </div>

                <Badge tone={HEALTH_TONE[worst]}>{HEALTH_WORD[worst]}</Badge>

                <span className="w-[110px] shrink-0 text-xs text-muted">
                  {findings.length} open {findings.length === 1 ? 'finding' : 'findings'}
                </span>

                <Button size="sm" variant="link" onClick={() => navigate(`/ontology?process=${p.id}`)}>
                  See details →
                </Button>
              </div>
            )
          })}
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      {/* findings + requirements                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Open findings" subtitle="Everything raised by a run, a live check or an access proof." />
          <CardBody className="space-y-3">
            <FindingsBar data={bySeverity} onSelect={(name) => navigate(`/run?severity=${name}`)} height={150} />
            <div className="space-y-1.5">
              {openFindings.slice(0, 5).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => navigate(`/finding/${f.id}`)}
                  className="flex w-full items-center gap-2.5 rounded-md border border-line px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface2"
                >
                  <span className="shrink-0 font-mono text-subtle">{f.id}</span>
                  <span className="min-w-0 flex-1 truncate text-text">{f.title}</span>
                  <span className="hidden shrink-0 text-[11px] text-subtle lg:block">{f.system}</span>
                  <Badge tone={f.severity === 'Critical' ? 'danger' : f.severity === 'High' ? 'warning' : 'info'}>
                    {f.severity}
                  </Badge>
                </button>
              ))}
            </div>
          </CardBody>
          <SourceNote
            reads={[{ label: 'Run results', route: '/run' }, { label: 'Live checks', route: '/flow/checks' }, { label: 'Access proofs', route: '/access-sod' }]}
            computes="every finding raised by an agent or a run, grouped by severity"
            feeds={[{ label: 'Confidence score', route: '/' }, { label: 'Release gate', route: '/release' }]}
          />
        </Card>

        <Card>
          <CardHeader title="Requirements proven" subtitle="Each tile opens the screen that proves it." />
          <CardBody className="grid gap-2 sm:grid-cols-2">
            {JOURNEY_REQUIREMENTS.map((r) => {
              const steps = stepsCovering(r.id)
              const screens = screensForRequirement(r.id)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(screens[0]?.route ?? '/journey')}
                  className="flex items-start gap-2 rounded-md border border-line bg-surface px-3 py-2 text-left transition-[transform,box-shadow] duration-[120ms] hover:-translate-y-px hover:shadow-md"
                >
                  {steps.length ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                  ) : (
                    <CircleAlert size={15} className="mt-0.5 shrink-0 text-accent" />
                  )}
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] text-subtle">{r.id}</span>
                    <span className="block truncate text-xs text-text">{r.short}</span>
                    <span className="block truncate text-[11px] text-subtle">
                      {steps.length} {steps.length === 1 ? 'step' : 'steps'} · proven on{' '}
                      {screens[0]?.label ?? 'the Testing Journey'}
                    </span>
                  </span>
                </button>
              )
            })}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Last runs" subtitle="Nightly regressions and on-demand runs, newest first." />
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
                <Badge tone={r.verdict === 'PASS' ? 'success' : r.verdict === 'FAIL' ? 'danger' : 'warning'}>
                  {r.verdict}
                </Badge>
              ),
            },
          ]}
        />
        <SourceNote
          reads={[{ label: 'Run history', route: '/evidence' }]}
          computes="the last six nightly and on-demand runs, newest first"
          feeds={[{ label: 'Confidence score', route: '/' }, { label: 'Evidence packs', route: '/evidence' }]}
        />
      </Card>
    </>
  )
}
