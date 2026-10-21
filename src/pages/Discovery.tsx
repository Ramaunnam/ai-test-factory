import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  FileText,
  MessageSquare,
  MonitorPlay,
  Radar,
  RotateCcw,
  ScrollText,
  Sparkles,
  X,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CodeBlock,
  DataTable,
  EmptyState,
  LiveLog,
  SectionTitle,
  Select,
  StatTile,
  Switch,
  Textarea,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { JourneyBar } from '@/components/domain/JourneyBar'
import { SourceNote } from '@/components/domain/SourceNote'
import { DISCOVERY_SESSIONS, PROCESSES, type DiscoverySession } from '@/data'
import { store, useStore } from '@/data/appStore'
import {
  APPLY_LOG,
  DISCOVERY_LINES,
  FEEDBACK_REASONS,
  MAP_CORRECTIONS,
  MAP_V1,
  MAP_V2,
  type CountKey,
  type FeedbackReason,
  type FeedbackVerdict,
  type MapArrow,
  type MapLoop,
  type MapStage,
  type ProcessFeedback,
  type ProcessMapVersion,
} from '@/data/processMap'
import { engine } from '@/sim/engine'
import { useSimVersion } from '@/sim/useSim'
import { useThemeTokens } from '@/lib/useThemeTokens'
import { fmtSim, num } from '@/lib/format'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'

const TABS = [
  { label: 'Inputs', path: '/discovery' },
  { label: 'Process map', path: '/discovery/map' },
  { label: 'Procedure vs reality', path: '/discovery/compare' },
]

/* -------------------------------------------------------------------------- */
/* The three inputs                                                           */
/* -------------------------------------------------------------------------- */

const STEP_TEMPLATES: Record<string, string[]> = {
  'DS-01': [
    'Open YardLink',
    'Search the expected deliveries for today',
    'Select the transport VH-7741',
    'Create a gate pass',
    'Enter the vendor and purchase order',
    'Send the vehicle to the weighbridge',
    'Read the gross weight from the scale',
    'Confirm the gross weight',
    'Read the tare weight after tipping',
    'Confirm the tare weight',
    'Check the net weight shown',
    'Release the vehicle',
  ],
  'DS-02': [
    'Open Esker',
    'Pick up the next invoice in the queue',
    'Read the supplier and the invoice number',
    'Type the purchase order reference',
    'Check the quantity against the delivery note',
    'Check the amount',
    'Submit the capture',
    'Confirm it was sent to the ERP',
  ],
  'DS-03': [
    'Open the parked invoice list in SAP',
    'Select the oldest parked invoice',
    'Read the reason for the park',
    'Open the goods receipt for the same gate pass',
    'Compare the quantity on both documents',
    'Call the yard to confirm the weight',
    'Wait for the re-weigh',
    'Update the goods receipt',
    'Re-run the three-way match',
    'Post the invoice',
  ],
  'DS-04': [
    'Open dOps Core',
    'Select the receipt just arrived',
    'Create the first batch',
    'Weigh and record the batch',
    'Pick the grade from the list',
    'Create the second batch',
    'Record the remaining weight',
    'Print the batch labels',
  ],
  'DS-05': [
    'Open the laboratory app',
    'Scan the sample barcode',
    'Start the spectrometer run',
    'Read nickel, chromium and molybdenum',
    'Compare against the grade window',
    'Release the result',
  ],
  'DS-06': [
    'Open Pegase',
    'Select the finished heat',
    'Check the coil count and weight',
    'Confirm the heat',
    'Check that the ERP received the confirmation',
    'Open the Pegase certificate',
  ],
}

function stepsFor(session: DiscoverySession) {
  const base = STEP_TEMPLATES[session.id] ?? []
  const out: { n: number; action: string; seconds: number }[] = []
  for (let i = 0; i < session.steps; i += 1) {
    out.push({
      n: i + 1,
      action: base.length ? base[i % base.length] + (i >= base.length ? ' (repeated)' : '') : 'Step',
      seconds: 12 + ((i * 17) % 46),
    })
  }
  return out
}

const SOPS = [
  {
    id: 'SOP-114',
    title: 'Gate and weighbridge procedure',
    system: 'YardLink',
    text: `1. Every inbound transport must present a gate pass before entering the yard.
2. Gross weight is taken on arrival, tare weight after tipping.
3. The net weight is gross minus tare. It must never be entered by hand.
4. A vehicle may only be released once both weights are confirmed.
5. Deviations above 20 kg against the delivery note are reported to the key user.`,
  },
  {
    id: 'SOP-121',
    title: 'Invoice capture and matching',
    system: 'Esker and SAP',
    text: `1. Every supplier invoice is captured with a purchase order reference.
2. Invoices without a reference are returned to the supplier, never guessed.
3. The three-way match compares purchase order, goods receipt and invoice.
4. A quantity difference above 1 % parks the invoice for review.`,
  },
  {
    id: 'SOP-203',
    title: 'Sortation and grading',
    system: 'dOps Core',
    text: `1. Each receipt is sorted into one to three batches.
2. The batch weights must add up to the weight received.
3. Every batch takes a sample before it can be charged into the mill.`,
  },
  {
    id: 'SOP-240',
    title: 'Laboratory release',
    system: 'Laboratory app',
    text: `1. Nickel, chromium and molybdenum are measured for every sample.
2. A result is only released when all three values are present.
3. Released results are sent to the yard system within five minutes.`,
  },
]

const PIPELINE = [
  {
    n: 1,
    title: 'Group the clicks into activities',
    detail:
      'The 123 recorded steps collapse into named activities by screen and action, so "fill field, fill field, click save" becomes "create a gate pass".',
  },
  {
    n: 2,
    title: 'Order them by what really happens',
    detail:
      'The log gives the true sequence and the gaps between activities, including the ones nobody put in the manual.',
  },
  {
    n: 3,
    title: 'Find the loops',
    detail: 'Where an activity repeats after a later one, that is rework. The agent measures how often and what it costs.',
  },
  {
    n: 4,
    title: 'Write it down as a process',
    detail: 'Stages, systems, data and rules, in the shape the ontology and Test Studio can both read.',
  },
]

/* -------------------------------------------------------------------------- */
/* Tab 1 — the inputs                                                         */
/* -------------------------------------------------------------------------- */

export function DiscoveryPage() {
  const navigate = useNavigate()
  const drawer = useDrawer()
  const version = useSimVersion()
  const app = useStore()
  const [running, setRunning] = useState(false)

  const phase: 'idle' | 'running' | 'done' = running ? 'running' : app.discoveryRun ? 'done' : 'idle'

  /** The raw log is the plant's own event stream, so this page is never stale. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logLines = useMemo(() => [...engine.events].reverse().slice(0, 40), [version])

  const runDiscovery = () => {
    setRunning(true)
    window.setTimeout(() => {
      setRunning(false)
      store.setDiscoveryRun()
    }, DISCOVERY_LINES.length * 420 + 200)
  }

  /** One drawer definition, opened on its own or pushed on top of the list. */
  const sessionDrawer = (s: DiscoverySession) => ({
    title: `${s.id} · ${s.name}`,
    subtitle: `${s.role} in ${s.system} at ${s.site} · ${s.steps} steps over ${s.minutes} minutes · recorded ${s.recorded}`,
    width: 'lg' as const,
    content: (
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">Why it was recorded</div>
            <p className="mt-0.5 text-xs text-muted">{s.why}</p>
          </div>
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">What it showed</div>
            <p className="mt-0.5 text-xs text-muted">{s.found}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label font-semibold uppercase text-subtle">Evidence for</span>
          {s.stageIds.map((id) => {
            const stage = PROCESSES.flatMap((p) => p.stages).find((st) => st.id === id)
            return (
              <Badge key={id} tone="primary">
                {stage ? stage.name : id}
              </Badge>
            )
          })}
        </div>
        <p className="text-sm text-muted">
          Below is the raw recording the Discovery agent reads: every click this person made, in order, with how long
          each one took. Nothing was scripted.
        </p>
        <div className="j2w-scroll max-h-[340px] overflow-y-auto rounded-md border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface2">
              <tr>
                <th className="px-3 py-1.5 text-left text-label uppercase text-subtle">Step</th>
                <th className="px-3 py-1.5 text-left text-label uppercase text-subtle">What they did</th>
                <th className="px-3 py-1.5 text-right text-label uppercase text-subtle">Seconds</th>
              </tr>
            </thead>
            <tbody>
              {stepsFor(s).map((st) => (
                <tr key={st.n} className="border-t border-line">
                  <td className="px-3 py-1.5 font-mono text-subtle">{String(st.n).padStart(2, '0')}</td>
                  <td className="px-3 py-1.5 text-text">{st.action}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-muted">{st.seconds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            drawer.closeAll()
            runDiscovery()
          }}
        >
          Discover the process from these recordings
        </Button>
      </div>
    ),
  })

  const openSession = (s: DiscoverySession) => drawer.open(sessionDrawer(s))

  /** All six first, with where each came from. One of them opens on top. */
  const openAllSessions = () =>
    drawer.open({
      title: 'The six recorded sessions',
      subtitle: `${num(DISCOVERY_SESSIONS.reduce((n, d) => n + d.steps, 0))} clicks by four roles across six systems, recorded over three days in the test environment.`,
      width: 'lg',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Each recording was requested for a reason: somebody reported a problem, and the factory watched the work
            being done instead of asking for a description of it.
          </p>
          {DISCOVERY_SESSIONS.map((s) => (
            <div key={s.id} className="rounded-md border border-line">
              <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface2/60 px-3 py-2">
                <span className="font-mono text-[11px] text-subtle">{s.id}</span>
                <span className="text-sm font-medium text-text">{s.name}</span>
                <Badge tone="neutral" className="ml-auto">
                  {s.role}
                </Badge>
                <Badge tone="neutral">{s.system}</Badge>
              </div>
              <div className="space-y-2 px-3 py-2.5">
                <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-subtle">
                  <span>{s.steps} steps</span>
                  <span>{s.minutes} minutes</span>
                  <span>site {s.site}</span>
                  <span>recorded {s.recorded}</span>
                </div>
                <div>
                  <div className="text-label font-semibold uppercase text-subtle">Why it was recorded</div>
                  <p className="text-xs text-muted">{s.why}</p>
                </div>
                <div>
                  <div className="text-label font-semibold uppercase text-subtle">What it showed</div>
                  <p className="text-xs text-muted">{s.found}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {s.stageIds.map((id) => {
                    const stage = PROCESSES.flatMap((p) => p.stages).find((st) => st.id === id)
                    return (
                      <Badge key={id} tone="primary">
                        {stage ? stage.name : id}
                      </Badge>
                    )
                  })}
                  <Button size="sm" className="ml-auto" onClick={() => drawer.push(sessionDrawer(s))}>
                    Open the {s.steps} recorded steps
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
    })

  const openLogs = () =>
    drawer.open({
      title: 'The plant log the agent reads',
      subtitle: `${num(engine.events.length)} lines held, newest first. This is the live stream from the running plant.`,
      width: 'lg',
      content: (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Recordings show what a person did. The log shows what the systems did, including everything that happened
            without a person: interface messages, postings and the failures in between.
          </p>
          <CodeBlock className="max-h-[420px]">
            {logLines.map((e) => `${fmtSim(e.at)}  ${e.tone === 'danger' ? '[ERROR]' : '[INFO ]'}  ${e.text}`).join('\n')}
          </CodeBlock>
          <Button
            fullWidth
            onClick={() => {
              drawer.closeAll()
              navigate('/flow')
            }}
          >
            Watch the plant produce these lines
          </Button>
        </div>
      ),
    })

  const openSops = () =>
    drawer.open({
      title: 'Standard operating procedures',
      subtitle: 'Four documents. The agent compares them against what people actually do.',
      width: 'lg',
      content: (
        <div className="space-y-3">
          {SOPS.map((d) => (
            <div key={d.id} className="rounded-md border border-line">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                <FileText size={14} className="text-subtle" />
                <span className="font-mono text-[11px] text-subtle">{d.id}</span>
                <span className="text-sm font-medium text-text">{d.title}</span>
                <Badge tone="neutral" className="ml-auto">
                  {d.system}
                </Badge>
              </div>
              <pre className="whitespace-pre-wrap px-3 py-2 font-mono text-[11.5px] leading-5 text-muted">{d.text}</pre>
            </div>
          ))}
        </div>
      ),
    })

  return (
    <>
      <JourneyBar step={1} />
      <PageHeader
        title="Process Discovery"
        subtitle="Before a single test is written, the factory learns how the plant actually works: from recordings, the live system log and the written procedures."
        tabs={TABS}
        actions={
          <Button variant="ai" leftIcon={<Radar size={15} />} loading={running} onClick={runDiscovery}>
            Discover the process
          </Button>
        }
      />

      {/* what this page does, before anything is pressed ------------------ */}
      <Card className="mb-4">
        <CardHeader
          title="What happens on this page"
          subtitle="Three sources go in, one process map comes out. Each box opens the material behind it."
        />
        <CardBody>
          <DiscoveryPipeline
            onInput={(which) =>
              which === 'sessions' ? openAllSessions() : which === 'logs' ? openLogs() : openSops()
            }
            onOutput={() => navigate('/discovery/map')}
          />
        </CardBody>
        <SourceNote
          title="Where discovery gets its evidence"
          reads={[
            { label: '6 recorded sessions', note: '123 clicks by four different roles' },
            { label: 'Plant event log', route: '/flow', note: 'the live stream from the running simulation' },
            { label: '4 standard operating procedures', note: 'what the manual says should happen' },
          ]}
          computes="groups clicks into activities, orders them by the log, and compares both against the written procedure"
          feeds={[
            { label: 'Process map', route: '/discovery/map' },
            { label: 'Procedure vs reality', route: '/discovery/compare' },
          ]}
          steps={PIPELINE.map((p) => `${p.title}: ${p.detail}`)}
        />
      </Card>

      {/* the three inputs ------------------------------------------------- */}
      <SectionTitle
        title="The three inputs"
        hint="All three are available now. You do not have to run discovery to look inside them."
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card interactive onClick={openAllSessions}>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <MonitorPlay size={16} className="text-primary" />
              <span className="text-sm font-semibold text-text">Recorded sessions</span>
              <Badge tone="primary" className="ml-auto">
                {DISCOVERY_SESSIONS.length}
              </Badge>
            </div>
            <p className="text-xs text-muted">
              Key users worked normally while the factory watched:{' '}
              {num(DISCOVERY_SESSIONS.reduce((s, d) => s + d.steps, 0))} clicks across{' '}
              {num(DISCOVERY_SESSIONS.reduce((s, d) => s + d.minutes, 0))} minutes.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              See all six and why each was taken <ArrowRight size={12} />
            </span>
          </CardBody>
        </Card>

        <Card interactive onClick={openLogs}>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <ScrollText size={16} className="text-info" />
              <span className="text-sm font-semibold text-text">Plant log</span>
              <Badge tone="info" className="ml-auto">
                live
              </Badge>
            </div>
            <p className="text-xs text-muted">
              {num(engine.events.length)} lines held right now, written by the running plant. It shows what the systems
              did between the clicks.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              Read the log <ArrowRight size={12} />
            </span>
          </CardBody>
        </Card>

        <Card interactive onClick={openSops}>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText size={16} className="text-subtle" />
              <span className="text-sm font-semibold text-text">Written procedures</span>
              <Badge tone="neutral" className="ml-auto">
                {SOPS.length}
              </Badge>
            </div>
            <p className="text-xs text-muted">
              The four SOPs covering these workflows. Discovery compares them with what people actually do.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              Read the procedures <ArrowRight size={12} />
            </span>
          </CardBody>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Recorded sessions"
          value={num(DISCOVERY_SESSIONS.length)}
          hint="four roles, six systems, three days"
          onClick={openAllSessions}
        />
        <StatTile
          label="Steps captured"
          value={num(DISCOVERY_SESSIONS.reduce((s, d) => s + d.steps, 0))}
          hint="clicks and field entries"
        />
        <StatTile
          label="Log lines available"
          value={num(engine.events.length)}
          tone="info"
          hint="live from the running plant"
          onClick={openLogs}
        />
        <StatTile
          label="Process map"
          value={phase === 'done' ? `v${app.mapVersion}` : '—'}
          tone={phase === 'done' ? 'success' : 'neutral'}
          hint={phase === 'done' ? 'open the process map' : 'run discovery to draw it'}
          onClick={phase === 'done' ? () => navigate('/discovery/map') : undefined}
        />
      </div>

      <Card className="mb-4">
        <CardHeader title="The recordings" subtitle="Six sessions, four roles, six systems. Each one holds the full click-by-click trail." />
        <DataTable
          rows={DISCOVERY_SESSIONS}
          rowKey={(d) => d.id}
          onRowClick={openSession}
          columns={[
            { key: 'id', header: 'Session', mono: true, width: 100 },
            { key: 'name', header: 'What they did' },
            { key: 'role', header: 'Role', width: 160 },
            { key: 'system', header: 'System', width: 200 },
            { key: 'steps', header: 'Steps', align: 'right', mono: true, width: 80 },
            { key: 'minutes', header: 'Minutes', align: 'right', mono: true, width: 90 },
            { key: 'recorded', header: 'Recorded', width: 130 },
          ]}
          empty="No recordings yet."
          footerNote={<span>recorded over three days in the test environment</span>}
        />
      </Card>

      {phase === 'idle' && (
        <Card className="mb-4">
          <CardHeader title="What “Discover the process” will do" subtitle="Four steps, in this order." />
          <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PIPELINE.map((p) => (
              <div key={p.n} className="rounded-md border border-line bg-surface2/50 px-3 py-2.5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-ai-soft font-mono text-[10px] font-semibold text-ai">
                    {p.n}
                  </span>
                  <span className="text-xs font-semibold text-text">{p.title}</span>
                </div>
                <p className="text-[11.5px] leading-5 text-muted">{p.detail}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {phase !== 'idle' && (
        <Card className="mb-4" tone="ai">
          <CardHeader title="Discovery agent" subtitle="Turning clicks and log lines into a process." />
          <CardBody>
            <LiveLog lines={DISCOVERY_LINES} running={phase === 'running'} height={200} />
          </CardBody>
        </Card>
      )}

      {phase === 'done' && (
        <Card>
          <CardHeader
            title="The map is drawn"
            subtitle="Discovery has finished. The next two tabs hold what it produced."
            icon={<Sparkles size={16} className="text-ai" />}
          />
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => navigate('/discovery/map')}>
              Open the process map
            </Button>
            <Button onClick={() => navigate('/discovery/compare')}>See the procedure against reality</Button>
          </CardBody>
        </Card>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */

function DiscoveryPipeline({
  onInput,
  onOutput,
}: {
  onInput: (which: 'sessions' | 'logs' | 'sops') => void
  onOutput: () => void
}) {
  const t = useThemeTokens()
  const inputs: { id: 'sessions' | 'logs' | 'sops'; label: string; y: number }[] = [
    { id: 'sessions', label: '6 recorded sessions', y: 12 },
    { id: 'logs', label: 'live plant log', y: 66 },
    { id: 'sops', label: '4 written procedures', y: 120 },
  ]
  return (
    <svg viewBox="0 0 900 180" width="100%" height={190} className="min-w-[700px]">
      {inputs.map((i) => (
        <g key={i.id} className="cursor-pointer" onClick={() => onInput(i.id)}>
          <rect x={6} y={i.y} width={190} height={40} rx={9} fill={t.surface} stroke={t['line-strong']} />
          <text x={20} y={i.y + 24} fontSize={12} fill={t.text}>
            {i.label}
          </text>
          <path d={`M 196 ${i.y + 20} C 240 ${i.y + 20}, 250 90, 300 90`} fill="none" stroke={t.line} strokeWidth={1.5} />
        </g>
      ))}

      <rect x={300} y={44} width={300} height={92} rx={12} fill={t['ai-soft']} stroke={t.ai} />
      <text x={450} y={68} fontSize={12} fontWeight={600} textAnchor="middle" fill={t.ai}>
        Discovery agent
      </text>
      {['group the clicks', 'order by the log', 'find the loops', 'write the process'].map((s, i) => (
        <text key={s} x={450} y={88 + i * 14} fontSize={10.5} textAnchor="middle" fill={t.muted}>
          {i + 1}. {s}
        </text>
      ))}

      <path d="M 600 90 L 690 90" fill="none" stroke={t.line} strokeWidth={1.5} />
      <g className="cursor-pointer" onClick={onOutput}>
        <rect x={690} y={60} width={204} height={60} rx={10} fill={t.surface} stroke={t['line-strong']} />
        <text x={706} y={84} fontSize={12} fontWeight={600} fill={t.text}>
          A process map
        </text>
        <text x={706} y={101} fontSize={10.5} fill={t.muted}>
          {MAP_V1.stages.length} stages · 3 systems · {MAP_V1.loops.length} loop
          {MAP_V1.loops.length === 1 ? '' : 's'}
        </text>
      </g>
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab 2 — the process map                                                    */
/* -------------------------------------------------------------------------- */

export function ProcessMapPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const drawer = useDrawer()
  const version = useSimVersion()
  const app = useStore()
  const [running, setRunning] = useState(false)
  const [applying, setApplying] = useState(false)
  const [compare, setCompare] = useState(false)

  const map = app.mapVersion === 2 ? MAP_V2 : MAP_V1
  const applied = app.processFeedback.filter((f) => f.status === 'Applied').length
  const open = app.processFeedback.filter((f) => f.status === 'Open').length

  /** Every arrow and loop is counted against the plant, not against a stored figure. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const counts = useMemo<Record<CountKey, number>>(() => {
    const db = engine.db
    const byGatePass = new Map(db.MSEG.map((m) => [m.xblnr, m]))
    const deviations = db.weighbridge_ticket.filter((t) => {
      const m = byGatePass.get(t.gate_pass)
      return m ? Math.abs(m.menge - t.net_kg) > 20 : false
    }).length
    return {
      tickets: db.weighbridge_ticket.length,
      deviations,
      receipts: db.MSEG.length,
      captures: db.captured_invoice.length,
      parked: db.RBKP.filter((r) => r.status === 'Parked').length,
      posted: db.RBKP.filter((r) => r.status === 'Posted').length,
      documents: db.output_document.length,
    }
  }, [version])

  const loopHours = map.loops.reduce((h, l) => h + (counts[l.count] * l.minutesEach) / 60, 0)

  const runDiscovery = () => {
    setRunning(true)
    window.setTimeout(() => {
      setRunning(false)
      store.setDiscoveryRun()
    }, DISCOVERY_LINES.length * 420 + 200)
  }

  /** One drawer for a box, an arrow or a loop. Feedback is always one click away. */
  const openTarget = (targetKind: ProcessFeedback['targetKind'], targetId: string, target: string, body: ReactNode) =>
    drawer.open({
      title: target,
      subtitle: `${targetKind} on process map v${map.version} · tell the factory whether this is right`,
      width: 'lg',
      content: (
        <div className="space-y-4">
          {body}
          <FeedbackPanel
            targetKind={targetKind}
            targetId={targetId}
            target={target}
            existing={app.processFeedback.filter((f) => f.targetId === targetId)}
            onDone={() => drawer.closeAll()}
          />
        </div>
      ),
    })

  const openStage = (s: MapStage) =>
    openTarget(
      'Stage',
      s.id,
      s.name,
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">System</div>
            <p className="mt-0.5 text-sm text-text">{s.system}</p>
          </div>
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">On the clean path</div>
            <p className="mt-0.5 text-sm text-text">{map.clean.includes(s.id) ? 'Yes' : 'No'}</p>
          </div>
        </div>
        <p className="text-sm text-muted">{s.note}</p>
        {s.added && (
          <div className="rounded-md border border-accent/50 bg-accent-soft/40 px-3 py-2 text-xs text-muted">
            This box was added by a key user. The agent never saw it, because the step happens on the phone.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {s.stageId && (
            <Button
              onClick={() => {
                drawer.closeAll()
                navigate(`/ontology?process=P1&stage=${s.stageId}`)
              }}
            >
              Open the rule behind it
            </Button>
          )}
          <Button
            onClick={() => {
              drawer.closeAll()
              navigate('/flow')
            }}
          >
            Watch it happen live
          </Button>
        </div>
      </div>,
    )

  const openArrow = (a: MapArrow) => {
    const from = map.stages.find((s) => s.id === a.from)
    const to = map.stages.find((s) => s.id === a.to)
    openTarget(
      'Arrow',
      a.id,
      `${from?.name ?? a.from} → ${to?.name ?? a.to}`,
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">What moves</div>
            <p className="mt-0.5 text-sm text-text">{a.label}</p>
          </div>
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">Cases in the last 24 hours</div>
            <p className="mt-0.5 font-mono text-sm text-text">{num(counts[a.count])}</p>
          </div>
        </div>
        <p className="text-sm text-muted">
          The count is read from the live plant every time this page redraws. If the two boxes are out of step, the
          numbers on either side of this arrow will not match.
        </p>
      </div>,
    )
  }

  const openLoop = (l: MapLoop) => {
    const hours = (counts[l.count] * l.minutesEach) / 60
    openTarget(
      'Loop',
      l.id,
      l.label,
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">Times today</div>
            <p className="mt-0.5 font-mono text-sm text-danger">{num(counts[l.count])}</p>
          </div>
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">Handling each time</div>
            <p className="mt-0.5 font-mono text-sm text-text">{l.minutesEach} min</p>
          </div>
          <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
            <div className="text-label font-semibold uppercase text-subtle">Cost a day</div>
            <p className="mt-0.5 font-mono text-sm text-danger">{hours.toFixed(1)} h</p>
          </div>
        </div>
        <p className="text-sm text-muted">
          A loop means the work went backwards. This one appears in no written procedure: the times are live, the
          minutes of handling are the figure the key users gave.
        </p>
        <Button
          onClick={() => {
            drawer.closeAll()
            navigate('/flow/checks')
          }}
        >
          See the check that catches it
        </Button>
      </div>,
    )
  }

  const applyFeedback = () => {
    setApplying(true)
    window.setTimeout(() => {
      setApplying(false)
      store.applyProcessFeedback()
      toast({
        title: 'Map redrawn as version 2',
        description: `${open} correction${open === 1 ? '' : 's'} from key users folded in.`,
        tone: 'success',
      })
    }, APPLY_LOG.length * 420 + 200)
  }

  if (!app.discoveryRun) {
    return (
      <>
        <JourneyBar step={2} />
        <PageHeader
          title="Process Discovery"
          subtitle="The map the factory drew of how the plant actually works, for the key users to correct."
          tabs={TABS}
          actions={
            <Button variant="ai" leftIcon={<Radar size={15} />} loading={running} onClick={runDiscovery}>
              Run discovery
            </Button>
          }
        />
        {running ? (
          <Card tone="ai">
            <CardHeader title="Discovery agent" subtitle="Turning clicks and log lines into a process." />
            <CardBody>
              <LiveLog lines={DISCOVERY_LINES} running height={200} />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<Radar size={28} />}
              title="No map yet"
              description="The map is drawn from the recordings, the plant log and the written procedures. Run discovery and it appears here, with every arrow counted against the live plant."
              action={
                <Button variant="ai" leftIcon={<Radar size={15} />} onClick={runDiscovery}>
                  Run discovery
                </Button>
              }
            />
          </Card>
        )}
      </>
    )
  }

  return (
    <>
      <JourneyBar step={2} />
      <PageHeader
        title="Process Discovery"
        subtitle="The map the factory drew of how the plant actually works. Press anything on it to agree or correct it."
        tabs={TABS}
        actions={
          <Button
            variant="primary"
            leftIcon={<Sparkles size={15} />}
            onClick={() => {
              toast({
                title: `Opening Test Studio with process map v${map.version}`,
                description: 'The scenarios are written from this map.',
                tone: 'info',
              })
              navigate('/studio')
            }}
          >
            Generate scenarios
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Stages on the map" value={num(map.stages.length)} hint="P1 Gate to Invoice" />
        <StatTile
          label="Rework loops"
          value={num(map.loops.length)}
          tone={map.loops.length ? 'warning' : 'success'}
          hint={`about ${loopHours.toFixed(1)} hours a day`}
        />
        <StatTile
          label="Corrections from key users"
          value={num(applied)}
          tone={applied ? 'info' : 'neutral'}
          hint={open ? `${open} still waiting` : 'all folded in'}
        />
        <StatTile
          label="Map version"
          value={`v${map.version}`}
          tone={map.version === 2 ? 'success' : 'neutral'}
          hint={map.version === 2 ? 'the scenarios are written from this one' : 'not corrected yet'}
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="The process it found"
          subtitle="P1 Gate to Invoice as the plant actually runs it. Every arrow is counted against the last 24 hours."
          actions={
            <span className="flex flex-wrap items-center gap-2">
              {map.version === 2 && <Badge tone="success">Version 2 — {applied} corrections from key users</Badge>}
              {app.mapVersion === 2 && (
                <Switch checked={compare} onChange={setCompare} label="Compare with version 1" size="sm" />
              )}
            </span>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-subtle">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full bg-success" /> the clean path
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full bg-danger" /> rework, the work going backwards
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-5 rounded-full bg-accent" /> added by a key user
            </span>
          </div>
          <div className="j2w-scroll overflow-x-auto">
            <ProcessMapSvg map={map} counts={counts} onStage={openStage} onArrow={openArrow} onLoop={openLoop} />
          </div>
          {compare && app.mapVersion === 2 && (
            <div className="space-y-3 rounded-md border border-line bg-surface2/40 p-3">
              <div className="text-label font-semibold uppercase text-subtle">Version 1, before the key users saw it</div>
              <div className="j2w-scroll overflow-x-auto opacity-70">
                <ProcessMapSvg map={MAP_V1} counts={counts} onStage={openStage} onArrow={openArrow} onLoop={openLoop} />
              </div>
              <DataTable
                rows={MAP_CORRECTIONS}
                rowKey={(c) => c.id}
                columns={[
                  { key: 'reason', header: 'Reason', width: 140, render: (c) => <Badge tone="warning">{c.reason}</Badge> },
                  { key: 'what', header: 'What the key users said' },
                  { key: 'before', header: 'Version 1' },
                  { key: 'after', header: 'Version 2' },
                ]}
              />
            </div>
          )}
        </CardBody>
        <SourceNote
          title="How the map is drawn"
          reads={[
            { label: '6 recordings', note: 'the order the clicks really happened in' },
            { label: 'Plant event log', route: '/flow' },
            { table: 'weighbridge_ticket', note: 'the count on each arrow' },
            { table: 'RBKP', note: 'how often the work goes backwards' },
          ]}
          computes="groups the clicks into boxes, orders them by the log, counts every arrow against the live tables and folds in the key users' corrections"
          feeds={[
            { label: 'Process Ontology', route: '/ontology?process=P1' },
            { label: 'Test Studio', route: '/studio' },
          ]}
          steps={[
            'Each box is an activity the agent recognised from the clicks and the log.',
            'Each arrow carries the number of cases that made that move in the last 24 hours.',
            'A red curve means the work went backwards, and carries what that costs in a day.',
            'Key users press a box, an arrow or a loop and say whether it is right. Their corrections make version 2.',
          ]}
        />
      </Card>

      {(applying || map.version === 2) && (
        <Card className="mb-4" tone="ai">
          <CardHeader title="Map agent" subtitle="Redrawing the map with the key users' corrections." />
          <CardBody>
            <LiveLog lines={APPLY_LOG} running={applying} height={160} />
          </CardBody>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader
          title="What the key users said"
          subtitle="Every correction left on the map, and what became of it."
          actions={
            <Button variant="ai" leftIcon={<Check size={15} />} loading={applying} disabled={!open} onClick={applyFeedback}>
              Apply feedback
            </Button>
          }
        />
        <DataTable
          rows={app.processFeedback}
          rowKey={(f) => f.id}
          maxHeight={420}
          rowTone={(f) => (f.status === 'Open' && f.verdict === 'Not right' ? 'warning' : undefined)}
          columns={[
            { key: 'id', header: 'ID', mono: true, width: 80 },
            {
              key: 'target',
              header: 'What it is about',
              render: (f) => (
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">{f.targetKind}</Badge>
                  <span className="text-text">{f.target}</span>
                </span>
              ),
            },
            {
              key: 'verdict',
              header: 'Verdict',
              width: 120,
              render: (f) => (
                <Badge tone={f.verdict === 'Correct' ? 'success' : f.verdict === 'Not right' ? 'danger' : 'info'}>
                  {f.verdict}
                </Badge>
              ),
            },
            { key: 'reason', header: 'Reason', width: 140, render: (f) => f.reason ?? '—' },
            { key: 'comment', header: 'Comment', render: (f) => <span className="text-xs text-muted">{f.comment ?? '—'}</span> },
            { key: 'by', header: 'From', width: 150 },
            { key: 'at', header: 'Left', width: 140 },
            {
              key: 'status',
              header: 'Status',
              width: 110,
              render: (f) => (
                <Badge tone={f.status === 'Applied' ? 'success' : f.status === 'Dismissed' ? 'neutral' : 'warning'}>
                  {f.status}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              sortable: false,
              width: 110,
              render: (f) =>
                f.status === 'Open' ? (
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      store.setFeedbackStatus(f.id, 'Dismissed')
                      toast({ title: `${f.id} dismissed`, description: 'The map stays as it is.', tone: 'info' })
                    }}
                  >
                    Dismiss
                  </Button>
                ) : (
                  <span className="text-xs text-subtle">—</span>
                ),
            },
          ]}
          empty="Nothing said yet. Press a box, an arrow or a loop on the map above."
        />
        <SourceNote
          title="Where the corrections go"
          reads={[{ label: 'Key users on this page', note: 'Correct, Not right with a reason, or a comment' }]}
          computes="folds every open correction into the map and raises the version"
          feeds={[
            { label: 'Test Studio', route: '/studio' },
            { label: 'Process Ontology', route: '/ontology?process=P1' },
          ]}
          steps={[
            'A key user presses anything on the map and says whether it is right.',
            '“Not right” carries a reason: wrong order, missing step, not a real step, wrong system or other.',
            'Apply feedback redraws the map and marks every correction as applied.',
            'Scenarios written after that say which version of the map they came from.',
          ]}
        />
      </Card>

      <Card className="mb-4">
        <CardHeader title="Where each stage came from" subtitle="Each box, traced back to the recording it was found in." />
        <CardBody className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {map.stages.map((s, i) => {
            const session = DISCOVERY_SESSIONS[Math.min(i, DISCOVERY_SESSIONS.length - 1)]
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => openStage(s)}
                className="rounded-md border border-line bg-surface2/50 px-2.5 py-2 text-left transition-colors hover:bg-surface2"
              >
                <span className="block text-[11px] font-medium text-text">{s.name}</span>
                <span className="block text-[11px] text-subtle">
                  found in {session.id} · {12 + i * 9} log lines
                </span>
              </button>
            )
          })}
        </CardBody>
      </Card>

      <ActivitiesCard />

      <Card>
        <CardHeader
          title="Rework loops"
          subtitle={`The loops that appear in no procedure. They cost roughly ${loopHours.toFixed(1)} hours a day across both plants.`}
          icon={<RotateCcw size={16} className="text-accent" />}
        />
        <CardBody>
          <ReworkDiagram loops={map.loops} counts={counts} stages={map.stages} />
        </CardBody>
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Tab 3 — procedure against reality                                          */
/* -------------------------------------------------------------------------- */

export function ProcedureComparePage() {
  const navigate = useNavigate()
  const version = useSimVersion()
  const app = useStore()
  const [running, setRunning] = useState(false)

  /** What the written procedure promises, against what the systems actually did. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gaps = useMemo(() => {
    const db = engine.db
    const byGatePass = new Map(db.MSEG.map((m) => [m.xblnr, m]))
    const wrongWeight = db.weighbridge_ticket.filter((t) => {
      const m = byGatePass.get(t.gate_pass)
      return m ? Math.abs(m.menge - t.net_kg) > 20 : false
    }).length
    const noPo = db.captured_invoice.filter((c) => !c.po).length
    const parked = db.RBKP.filter((r) => r.status === 'Parked').length
    const batchMismatch = db.receipt.filter((r) => {
      const sum = db.scrap_batch.filter((b) => b.receipt === r.receipt).reduce((n, b) => n + b.weight_kg, 0)
      return sum > 0 && Math.abs(sum - r.weight_kg) > 1
    }).length
    const noMo = db.chemistry.filter((c) => c.mo_pct === null).length
    return [
      {
        doc: 'SOP-114',
        rule: 'Deviations above 20 kg against the weighbridge are reported',
        observed: `${wrongWeight} goods receipts differ from the weighbridge by more than 20 kg`,
        followed: wrongWeight === 0,
        route: '/flow/checks',
      },
      {
        doc: 'SOP-121',
        rule: 'Every supplier invoice is captured with a purchase order reference',
        observed: `${noPo} captures carry no purchase order`,
        followed: noPo === 0,
        route: '/flow/data?system=esker&table=captured_invoice',
      },
      {
        doc: 'SOP-121',
        rule: 'A quantity difference above 1 % parks the invoice for review',
        observed: `${parked} invoices parked, which is the control working`,
        followed: true,
        route: '/flow/data?system=sap-steel&table=RBKP',
      },
      {
        doc: 'SOP-203',
        rule: 'Batch weights must add up to the weight received',
        observed: batchMismatch === 0 ? 'No receipt lost weight in sortation' : `${batchMismatch} receipts do not add up`,
        followed: batchMismatch === 0,
        route: '/flow/data?system=scrap&table=scrap_batch',
      },
      {
        doc: 'SOP-240',
        rule: 'A result is only released when Ni, Cr and Mo are all present',
        observed: `${noMo} chemistry records arrived without molybdenum`,
        followed: noMo === 0,
        route: '/flow/data?system=scrap&table=chemistry',
      },
    ]
  }, [version])

  /** How often the process runs clean, and how often it goes backwards. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const variants = useMemo(() => {
    const db = engine.db
    const invoices = db.RBKP.length
    const parked = db.RBKP.filter((r) => r.status === 'Parked').length
    const batches = db.scrap_batch.length
    const noMo = db.chemistry.filter((c) => c.mo_pct === null).length
    const cases = invoices + batches
    const rework = parked + noMo
    return [
      { label: 'Straight through, no rework', count: Math.max(0, cases - rework), tone: 'success' as const, route: '/flow' },
      { label: 'Invoice parked, yard re-weighs, invoice re-posted', count: parked, tone: 'danger' as const, route: '/flow/checks' },
      { label: 'Chemistry incomplete, batch re-sampled', count: noMo, tone: 'warning' as const, route: '/flow/checks' },
    ].map((v) => ({ ...v, pct: cases ? Math.round((v.count / cases) * 100) : 0 }))
  }, [version])

  const gapsOpen = gaps.filter((g) => !g.followed).length

  const runDiscovery = () => {
    setRunning(true)
    window.setTimeout(() => {
      setRunning(false)
      store.setDiscoveryRun()
    }, DISCOVERY_LINES.length * 420 + 200)
  }

  if (!app.discoveryRun) {
    return (
      <>
        <JourneyBar step={1} />
        <PageHeader
          title="Process Discovery"
          subtitle="Five written rules, each one measured against what the systems actually did."
          tabs={TABS}
          actions={
            <Button variant="ai" leftIcon={<Radar size={15} />} loading={running} onClick={runDiscovery}>
              Run discovery
            </Button>
          }
        />
        {running ? (
          <Card tone="ai">
            <CardHeader title="Discovery agent" subtitle="Turning clicks and log lines into a process." />
            <CardBody>
              <LiveLog lines={DISCOVERY_LINES} running height={200} />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={<ScrollText size={28} />}
              title="Nothing compared yet"
              description="The written procedures are read during discovery, then every rule in them is turned into a query and run against the live plant data. Run discovery and the verdicts appear here."
              action={
                <Button variant="ai" leftIcon={<Radar size={15} />} onClick={runDiscovery}>
                  Run discovery
                </Button>
              }
            />
          </Card>
        )}
      </>
    )
  }

  return (
    <>
      <JourneyBar step={1} />
      <PageHeader
        title="Process Discovery"
        subtitle="What the written procedure promises, against what the systems actually did in the last 24 hours."
        tabs={TABS}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Rules checked" value={num(gaps.length)} hint="from 4 written procedures" />
        <StatTile
          label="Not followed"
          value={num(gapsOpen)}
          tone={gapsOpen ? 'danger' : 'success'}
          hint="measured against live plant data"
        />
        <StatTile
          label="Straight through"
          value={`${variants[0].pct} %`}
          tone={variants[0].pct >= 85 ? 'success' : 'warning'}
          hint="cases with no rework"
        />
        <StatTile
          label="Went backwards"
          value={num(variants[1].count + variants[2].count)}
          tone="warning"
          hint="cases that needed rework"
          onClick={() => navigate('/flow/checks')}
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="What the procedure says, against what the systems actually did"
          subtitle="Five written rules, each one measured against the live plant data."
          actions={
            <Badge tone={gapsOpen ? 'danger' : 'success'}>
              {gapsOpen} of {gaps.length} not followed
            </Badge>
          }
        />
        <DataTable
          rows={gaps}
          rowKey={(g, i) => `${g.doc}-${i}`}
          onRowClick={(g) => navigate(g.route)}
          rowTone={(g) => (g.followed ? undefined : 'danger')}
          columns={[
            { key: 'doc', header: 'Document', mono: true, width: 110 },
            { key: 'rule', header: 'What the procedure says' },
            { key: 'observed', header: 'What actually happened' },
            {
              key: 'followed',
              header: 'Verdict',
              width: 140,
              render: (g) => (
                <Badge tone={g.followed ? 'success' : 'danger'}>{g.followed ? 'Followed' : 'Not followed'}</Badge>
              ),
              value: (g) => (g.followed ? 1 : 0),
            },
          ]}
          empty="No rules to compare yet."
        />
        <SourceNote
          title="How the comparison is made"
          reads={[
            { label: '4 standard operating procedures', note: 'the written rules' },
            { table: 'MSEG', note: 'what the systems actually recorded' },
            { table: 'captured_invoice' },
            { table: 'chemistry' },
          ]}
          computes="turns each written rule into a query and runs it against the last 24 hours of plant data"
          feeds={[{ label: 'Live checks', route: '/flow/checks' }, { label: 'Test Studio', route: '/studio' }]}
          steps={[
            'A rule in a procedure is a sentence: something must always, or never, be true.',
            'Discovery turns that sentence into a query over the tables the stage writes to.',
            'The query runs against real data, so the verdict is evidence rather than opinion.',
            'Rules that are broken become live checks and negative scenarios.',
          ]}
        />
      </Card>

      <Card>
        <CardHeader
          title="How often it runs clean"
          subtitle="Every case the plant handled in the last 24 hours, split by the path it took."
        />
        <CardBody className="space-y-2.5">
          {variants.map((v) => (
            <button
              key={v.label}
              type="button"
              onClick={() => navigate(v.route)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface2"
            >
              <span className="w-72 shrink-0 truncate text-xs text-text">{v.label}</span>
              <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface2">
                <span
                  className={
                    'block h-full rounded-full transition-[width] duration-500 ' +
                    (v.tone === 'success' ? 'bg-success' : v.tone === 'danger' ? 'bg-danger' : 'bg-accent')
                  }
                  style={{ width: `${Math.max(2, v.pct)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 text-right font-mono text-xs text-text">{v.pct} %</span>
              <span className="w-16 shrink-0 text-right font-mono text-[11px] text-subtle">{num(v.count)} cases</span>
            </button>
          ))}
        </CardBody>
        <SourceNote
          reads={[{ table: 'RBKP' }, { table: 'chemistry' }, { table: 'scrap_batch' }]}
          computes="counts how many cases went straight through against how many went backwards into rework"
          feeds={[{ label: 'Process map', route: '/discovery/map' }]}
        />
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

/** The activities the agent recognised, counted against the live tables. */
function ActivitiesCard() {
  const navigate = useNavigate()
  const version = useSimVersion()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activities = useMemo(() => {
    const db = engine.db
    const parked = db.RBKP.filter((r) => r.status === 'Parked').length
    const noMo = db.chemistry.filter((c) => c.mo_pct === null).length
    return [
      { activity: 'Weigh a vehicle', occurrences: db.weighbridge_ticket.length, seconds: 210, systems: 'YardLink', evidence: 'DS-01', rework: false, route: '/flow/data?system=yard&table=weighbridge_ticket' },
      { activity: 'Book the goods receipt', occurrences: db.MSEG.length, seconds: 4, systems: 'SAP S/4HANA Stainless', evidence: 'DS-01, log', rework: false, route: '/flow/data?system=sap-steel&table=MSEG' },
      { activity: 'Capture the supplier invoice', occurrences: db.captured_invoice.length, seconds: 320, systems: 'Esker', evidence: 'DS-02', rework: false, route: '/flow/data?system=esker&table=captured_invoice' },
      { activity: 'Run the three-way match', occurrences: db.RBKP.length, seconds: 6, systems: 'SAP S/4HANA Stainless', evidence: 'DS-03, log', rework: false, route: '/flow/data?system=sap-steel&table=RBKP' },
      { activity: 'Handle a parked invoice', occurrences: parked, seconds: 1680, systems: 'SAP, YardLink', evidence: 'DS-03', rework: true, route: '/flow/checks' },
      { activity: 'Sort a receipt into batches', occurrences: db.scrap_batch.length, seconds: 540, systems: 'dOps Core', evidence: 'DS-04', rework: false, route: '/flow/data?system=scrap&table=scrap_batch' },
      { activity: 'Release a laboratory sample', occurrences: db.lab_result.length, seconds: 420, systems: 'Laboratory app', evidence: 'DS-05', rework: false, route: '/flow/data?system=lab&table=lab_result' },
      { activity: 'Re-sample after an incomplete result', occurrences: noMo, seconds: 900, systems: 'Laboratory, dOps Core', evidence: 'DS-05, log', rework: true, route: '/flow/checks' },
      { activity: 'Confirm a heat', occurrences: db.AFRU.length, seconds: 90, systems: 'Pegase, SAP', evidence: 'DS-06', rework: false, route: '/flow/data?system=sap-steel&table=AFRU' },
    ]
  }, [version])

  return (
    <Card className="mb-4">
      <CardHeader
        title="Activities it recognised"
        subtitle="Counted against the live plant data, so these numbers move while you watch. Red rows are rework."
      />
      <DataTable
        rows={activities}
        rowKey={(a) => a.activity}
        onRowClick={(a) => navigate(a.route)}
        rowTone={(a) => (a.rework ? 'danger' : undefined)}
        columns={[
          { key: 'activity', header: 'Activity' },
          { key: 'occurrences', header: 'Times today', align: 'right', mono: true, width: 120 },
          {
            key: 'seconds',
            header: 'Typical duration',
            align: 'right',
            mono: true,
            width: 140,
            render: (a) => (a.seconds >= 60 ? `${Math.round(a.seconds / 60)} min` : `${a.seconds} s`),
            value: (a) => a.seconds,
          },
          { key: 'systems', header: 'Systems', width: 220 },
          { key: 'evidence', header: 'Evidence', width: 130, mono: true },
          {
            key: 'rework',
            header: 'Type',
            width: 110,
            render: (a) => <Badge tone={a.rework ? 'danger' : 'success'}>{a.rework ? 'Rework' : 'Normal'}</Badge>,
            value: (a) => (a.rework ? 1 : 0),
          },
        ]}
        empty="No activities recognised yet."
      />
      <SourceNote
        reads={[{ table: 'weighbridge_ticket' }, { table: 'RBKP' }, { table: 'chemistry' }]}
        computes="each discovered activity is counted against the live table it writes to"
        feeds={[{ label: 'Scenario generation', route: '/studio' }]}
        steps={[
          'Discovery names an activity from the clicks and the log.',
          'Each activity is matched to the table it creates rows in.',
          'The count is read live, so the page shows today’s real volume rather than a stored figure.',
          'Rework activities are the ones that only happen when something earlier went wrong.',
        ]}
      />
    </Card>
  )
}

/** Correct · Not right · Add a comment, on whatever the key user pressed. */
function FeedbackPanel({
  targetKind,
  targetId,
  target,
  existing,
  onDone,
}: {
  targetKind: ProcessFeedback['targetKind']
  targetId: string
  target: string
  existing: ProcessFeedback[]
  onDone: () => void
}) {
  const toast = useToast()
  const [mode, setMode] = useState<'none' | 'wrong' | 'comment'>('none')
  const [reason, setReason] = useState<FeedbackReason>('Wrong order')
  const [comment, setComment] = useState('')

  const leave = (verdict: FeedbackVerdict, extra?: { reason?: FeedbackReason; comment?: string }) => {
    const id = store.addProcessFeedback({
      targetKind,
      targetId,
      target,
      verdict,
      reason: extra?.reason,
      comment: extra?.comment,
      by: 'Key User',
      at: new Date().toLocaleString('en-GB'),
      status: verdict === 'Correct' ? 'Applied' : 'Open',
    })
    toast({
      title: `${id} left on ${target}`,
      description:
        verdict === 'Correct'
          ? 'Marked as correct. Nothing on the map changes.'
          : 'It is waiting in the feedback list. Press Apply feedback to redraw the map.',
      tone: verdict === 'Correct' ? 'success' : 'warning',
    })
    onDone()
  }

  return (
    <div className="space-y-3 rounded-md border border-line bg-surface2/40 p-3">
      <div className="text-label font-semibold uppercase text-subtle">Is this right?</div>

      {existing.length > 0 && (
        <div className="space-y-1.5">
          {existing.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-xs">
              <span className="font-mono text-subtle">{f.id}</span>
              <Badge tone={f.verdict === 'Correct' ? 'success' : f.verdict === 'Not right' ? 'danger' : 'info'}>
                {f.verdict}
              </Badge>
              <span className="min-w-0 flex-1 text-muted">{f.comment ?? f.reason ?? '—'}</span>
              <Badge tone={f.status === 'Applied' ? 'success' : f.status === 'Dismissed' ? 'neutral' : 'warning'}>
                {f.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" leftIcon={<Check size={14} />} onClick={() => leave('Correct')}>
          Correct
        </Button>
        <Button size="sm" variant="danger" leftIcon={<X size={14} />} onClick={() => setMode(mode === 'wrong' ? 'none' : 'wrong')}>
          Not right
        </Button>
        <Button size="sm" leftIcon={<MessageSquare size={14} />} onClick={() => setMode(mode === 'comment' ? 'none' : 'comment')}>
          Add a comment
        </Button>
      </div>

      {mode === 'wrong' && (
        <div className="space-y-2">
          <label className="block text-label font-semibold uppercase text-subtle">What is wrong with it?</label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as FeedbackReason)}>
            {FEEDBACK_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Say what really happens, in your own words."
          />
          <Button size="sm" variant="danger" fullWidth onClick={() => leave('Not right', { reason, comment: comment.trim() || undefined })}>
            Leave the correction
          </Button>
        </div>
      )}

      {mode === 'comment' && (
        <div className="space-y-2">
          <Textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Anything the factory should know about this step."
          />
          <Button
            size="sm"
            fullWidth
            disabled={!comment.trim()}
            onClick={() => leave('Comment', { comment: comment.trim() })}
          >
            Leave the comment
          </Button>
        </div>
      )}
    </div>
  )
}

/** Keeps a label inside its box. */
function short(text: string) {
  return text.length > 18 ? `${text.slice(0, 17)}…` : text
}

/** Boxes left to right, arrows counted live, rework curving back underneath. */
function ProcessMapSvg({
  map,
  counts,
  onStage,
  onArrow,
  onLoop,
}: {
  map: ProcessMapVersion
  counts: Record<CountKey, number>
  onStage: (s: MapStage) => void
  onArrow: (a: MapArrow) => void
  onLoop: (l: MapLoop) => void
}) {
  const t = useThemeTokens()
  const BOX_W = 168
  const BOX_H = 92
  const GAP = 72
  const TOP = 44
  const n = map.stages.length
  const width = 24 + n * BOX_W + (n - 1) * GAP + 24
  const loopTop = TOP + BOX_H + 54
  const height = loopTop + map.loops.length * 76 + 16
  const x = (i: number) => 24 + i * (BOX_W + GAP)
  const index = (id: string) => map.stages.findIndex((s) => s.id === id)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ minWidth: width }}>
      <defs>
        <marker id="pm-head" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M 0 0 L 7 3.5 L 0 7 z" fill={t.success} />
        </marker>
      </defs>

      {map.arrows.map((a) => {
        const i = index(a.from)
        const j = index(a.to)
        if (i < 0 || j < 0) return null
        const x1 = x(i) + BOX_W
        const x2 = x(j)
        const mid = (x1 + x2) / 2
        const y = TOP + BOX_H / 2
        return (
          <g key={a.id} className="cursor-pointer" onClick={() => onArrow(a)}>
            <text x={mid} y={26} fontSize={10.5} textAnchor="middle" fill={t.muted}>
              {a.label}
            </text>
            <line x1={x1 + 4} y1={y} x2={x2 - 9} y2={y} stroke={t.success} strokeWidth={1.8} markerEnd="url(#pm-head)" />
            <text x={mid} y={TOP + BOX_H + 18} fontSize={10.5} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fill={t.subtle}>
              {num(counts[a.count])} cases
            </text>
            <rect x={x1} y={TOP} width={Math.max(10, x2 - x1)} height={BOX_H + 24} fill="transparent" />
          </g>
        )
      })}

      {map.stages.map((s, i) => {
        const clean = map.clean.includes(s.id)
        return (
          <g key={s.id} className="cursor-pointer" onClick={() => onStage(s)}>
            <rect
              x={x(i)}
              y={TOP}
              width={BOX_W}
              height={BOX_H}
              rx={11}
              fill={s.added ? t['accent-soft'] : t.surface}
              stroke={s.added ? t.accent : clean ? t.success : t['line-strong']}
              strokeWidth={clean || s.added ? 1.8 : 1.2}
            />
            <text x={x(i) + 14} y={TOP + 24} fontSize={11.5} fontWeight={600} fill={t.text}>
              {s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name}
            </text>
            <text x={x(i) + 14} y={TOP + 41} fontSize={10} fill={t.subtle}>
              {s.system.length > 24 ? `${s.system.slice(0, 23)}…` : s.system}
            </text>
            <text x={x(i) + 14} y={TOP + 62} fontSize={9.5} fill={t.muted}>
              {s.note.length > 30 ? `${s.note.slice(0, 29)}…` : s.note}
            </text>
            <text x={x(i) + 14} y={TOP + 78} fontSize={9} fill={t.subtle}>
              press to agree or correct
            </text>
          </g>
        )
      })}

      {map.loops.map((l, k) => {
        const i = index(l.from)
        const j = index(l.to)
        if (i < 0 || j < 0) return null
        const xa = x(i) + BOX_W / 2
        const xb = x(j) + BOX_W / 2
        const yb = loopTop + k * 76
        const hours = (counts[l.count] * l.minutesEach) / 60
        return (
          <g key={l.id} className="cursor-pointer" onClick={() => onLoop(l)}>
            <path
              d={`M ${xa} ${TOP + BOX_H} C ${xa} ${yb + 40}, ${xb} ${yb + 40}, ${xb} ${TOP + BOX_H}`}
              fill="none"
              stroke={t.danger}
              strokeWidth={1.8}
              strokeDasharray="6 5"
            />
            <rect x={Math.min(xa, xb) + 20} y={yb + 14} width={Math.max(220, Math.abs(xb - xa) - 40)} height={30} rx={15} fill={t.surface} stroke={t.danger} />
            <text x={Math.min(xa, xb) + 36} y={yb + 33} fontSize={10.5} fill={t.muted}>
              {l.label}
            </text>
            <text
              x={Math.min(xa, xb) + 20 + Math.max(220, Math.abs(xb - xa) - 40) - 16}
              y={yb + 33}
              fontSize={10.5}
              textAnchor="end"
              fontFamily="JetBrains Mono, monospace"
              fill={t.danger}
            >
              {num(counts[l.count])} today · {hours.toFixed(1)} h a day
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function ReworkDiagram({
  loops,
  counts,
  stages,
}: {
  loops: MapLoop[]
  counts: Record<CountKey, number>
  stages: MapStage[]
}) {
  const t = useThemeTokens()
  const name = (id: string) => stages.find((s) => s.id === id)?.name ?? id
  return (
    <svg viewBox={`0 0 900 ${40 + loops.length * 90}`} width="100%" height={40 + loops.length * 90} className="min-w-[640px]">
      {loops.map((l, i) => {
        const y = 60 + i * 90
        const hours = (counts[l.count] * l.minutesEach) / 60
        return (
          <g key={l.id}>
            <path
              d={`M 760 ${y} C 600 ${y + 58}, 260 ${y + 58}, 120 ${y}`}
              fill="none"
              stroke={i === 0 ? t.danger : t.accent}
              strokeWidth={1.8}
              strokeDasharray="6 5"
            />
            <rect x={280} y={y + 22} width={320} height={28} rx={14} fill={t.surface} stroke={t.line} />
            <text x={296} y={y + 40} fontSize={11} fill={t.muted}>
              {l.label}
            </text>
            <text x={612} y={y + 40} fontSize={11} fontFamily="JetBrains Mono, monospace" fill={i === 0 ? t.danger : t.accent}>
              {num(counts[l.count])} today · {hours.toFixed(1)} h
            </text>
            <rect x={50} y={y - 16} width={150} height={32} rx={8} fill={t['surface-2']} stroke={t.line} />
            <text x={64} y={y + 4} fontSize={11} fill={t.text}>
              back to {short(name(l.to))}
            </text>
            <rect x={700} y={y - 16} width={150} height={32} rx={8} fill={t['surface-2']} stroke={t.line} />
            <text x={714} y={y + 4} fontSize={11} fill={t.text}>
              from {short(name(l.from))}
            </text>
          </g>
        )
      })}
      <text x={20} y={16} fontSize={10.5} fill={t.subtle}>
        A loop means the work went backwards. Neither of these appears in any written procedure.
      </text>
    </svg>
  )
}
