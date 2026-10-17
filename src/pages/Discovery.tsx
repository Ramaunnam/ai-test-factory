import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, MonitorPlay, Radar, RotateCcw, ScrollText, Sparkles } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CodeBlock,
  DataTable,
  LiveLog,
  SectionTitle,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { JourneyBar } from '@/components/domain/JourneyBar'
import { WorkflowFlow } from '@/components/domain/WorkflowFlow'
import { SourceNote } from '@/components/domain/SourceNote'
import { DISCOVERY_SESSIONS, PROCESSES, type DiscoverySession } from '@/data'
import { engine } from '@/sim/engine'
import { useSimVersion } from '@/sim/useSim'
import { useThemeTokens } from '@/lib/useThemeTokens'
import { fmtSim, num } from '@/lib/format'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'

/* -------------------------------------------------------------------------- */
/* The three inputs                                                           */
/* -------------------------------------------------------------------------- */

const STEP_TEMPLATES: Record<string, string[]> = {
  'DS-01': [
    'Open Yard Management',
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
    'Open Scrap Yard Operations',
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
    'Open the mill execution system',
    'Select the finished heat',
    'Check the coil count and weight',
    'Confirm the heat',
    'Check that the ERP received the confirmation',
    'Open the mill certificate',
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
    system: 'Yard Management',
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
    system: 'Scrap Yard Operations',
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

const LINES = [
  'Reading 6 recorded key-user sessions (123 steps in total)…',
  'Reading the plant log from Yard Management, SAP, Esker and the laboratory…',
  'Reading 4 standard operating procedures…',
  'Grouping steps into activities by screen and action…',
  'Ordering activities by the timestamps in the log…',
  'Found the happy path: gate pass → weighbridge → goods receipt → capture → match → post…',
  'Found a rework loop: parked invoice → ask the yard → re-weigh → re-post (14 % of cases)…',
  'Found a second loop: chemistry incomplete → re-sample (9 % of cases)…',
  'Mapped 5 stages, 3 systems and 2 rework loops. Ready to write scenarios.',
]

/* -------------------------------------------------------------------------- */

export function DiscoveryPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const drawer = useDrawer()
  const version = useSimVersion()
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')

  /** The raw log is the plant's own event stream, so this page is never stale. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logLines = useMemo(() => [...engine.events].reverse().slice(0, 40), [version])

  /** Activities, counted against the live tables they were discovered from. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activities = useMemo(() => {
    const db = engine.db
    const parked = db.RBKP.filter((r) => r.status === 'Parked').length
    const noMo = db.chemistry.filter((c) => c.mo_pct === null).length
    return [
      { activity: 'Weigh a vehicle', occurrences: db.weighbridge_ticket.length, seconds: 210, systems: 'Yard Management', evidence: 'DS-01', rework: false, route: '/flow/data?system=yard&table=weighbridge_ticket' },
      { activity: 'Book the goods receipt', occurrences: db.MSEG.length, seconds: 4, systems: 'SAP S/4HANA – Steel', evidence: 'DS-01, log', rework: false, route: '/flow/data?system=sap-steel&table=MSEG' },
      { activity: 'Capture the supplier invoice', occurrences: db.captured_invoice.length, seconds: 320, systems: 'Esker', evidence: 'DS-02', rework: false, route: '/flow/data?system=esker&table=captured_invoice' },
      { activity: 'Run the three-way match', occurrences: db.RBKP.length, seconds: 6, systems: 'SAP S/4HANA – Steel', evidence: 'DS-03, log', rework: false, route: '/flow/data?system=sap-steel&table=RBKP' },
      { activity: 'Handle a parked invoice', occurrences: parked, seconds: 1680, systems: 'SAP, Yard Management', evidence: 'DS-03', rework: true, route: '/flow/checks' },
      { activity: 'Sort a receipt into batches', occurrences: db.scrap_batch.length, seconds: 540, systems: 'Scrap Yard Operations', evidence: 'DS-04', rework: false, route: '/flow/data?system=scrap&table=scrap_batch' },
      { activity: 'Release a laboratory sample', occurrences: db.lab_result.length, seconds: 420, systems: 'Laboratory app', evidence: 'DS-05', rework: false, route: '/flow/data?system=lab&table=lab_result' },
      { activity: 'Re-sample after an incomplete result', occurrences: noMo, seconds: 900, systems: 'Laboratory, Scrap Yard', evidence: 'DS-05, log', rework: true, route: '/flow/checks' },
      { activity: 'Confirm a heat', occurrences: db.AFRU.length, seconds: 90, systems: 'Mill, SAP', evidence: 'DS-06', rework: false, route: '/flow/data?system=sap-steel&table=AFRU' },
    ]
  }, [version])

  const reworkCost = activities
    .filter((a) => a.rework)
    .reduce((s, a) => s + (a.occurrences * a.seconds) / 3600, 0)

  /** What the written procedure promises, against what the systems actually did. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gaps = useMemo(() => {
    const db = engine.db
    const byGatePass = new Map(db.MSEG.map((m) => [m.xblnr, m]))
    const wrongWeight = db.weighbridge_ticket.filter((t) => {
      const m = byGatePass.get(t.gate_pass)
      return m && Math.abs(m.menge - t.net_kg) > 20
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
    setPhase('running')
    window.setTimeout(() => setPhase('done'), LINES.length * 420 + 200)
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
        actions={
          <Button variant="ai" leftIcon={<Radar size={15} />} loading={phase === 'running'} onClick={runDiscovery}>
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
            onOutput={() => navigate('/ontology?process=P1')}
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
            { label: 'Process Ontology', route: '/ontology' },
            { label: 'Test Studio', route: '/studio' },
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
          label="Rework loops found"
          value={phase === 'done' ? '2' : '—'}
          tone={phase === 'done' ? 'warning' : 'neutral'}
          hint={phase === 'done' ? `about ${reworkCost.toFixed(1)} hours a day` : 'run discovery to find them'}
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
            <LiveLog lines={LINES} running={phase === 'running'} height={200} />
          </CardBody>
        </Card>
      )}

      {phase === 'done' && (
        <>
          <SectionTitle title="What discovery found" hint="Four minutes of reading, against three weeks of workshops." />
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Stages mapped" value="5" hint="P1 Gate to Invoice" />
            <StatTile label="Activities recognised" value={num(activities.length)} hint="named from clicks and log" />
            <StatTile label="Rework loops" value="2" tone="warning" hint={`about ${reworkCost.toFixed(1)} hours a day`} />
            <StatTile
              label="Gaps against the procedure"
              value={num(gapsOpen)}
              tone={gapsOpen ? 'danger' : 'success'}
              hint={`of ${gaps.length} rules checked`}
            />
            <StatTile
              label="Scenarios it can write"
              value="12"
              tone="ai"
              hint="positive, negative and regression"
              onClick={() => navigate('/studio')}
            />
          </div>

          <SectionTitle
            title="The process it found"
            hint="P1 Gate to Invoice as the plant actually runs it, not as the manual describes it."
            actions={
              <Button
                variant="primary"
                leftIcon={<Sparkles size={15} />}
                onClick={() => {
                  toast({ title: 'Opening Test Studio with this process selected', tone: 'info' })
                  navigate('/studio')
                }}
              >
                Generate scenarios
              </Button>
            }
          />
          <Card className="mb-4">
            <CardBody className="space-y-4 pt-5">
              <WorkflowFlow process={PROCESSES[0]} onStageClick={(id) => navigate(`/ontology?process=P1&stage=${id}`)} />
              <div className="grid gap-2 md:grid-cols-5">
                {PROCESSES[0].stages.map((s, i) => {
                  const session =
                    DISCOVERY_SESSIONS.find((d) => d.stageIds.includes(s.id)) ??
                    DISCOVERY_SESSIONS[Math.min(i, DISCOVERY_SESSIONS.length - 1)]
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => openSession(session)}
                      className="rounded-md border border-line bg-surface2/50 px-2.5 py-2 text-left transition-colors hover:bg-surface2"
                    >
                      <span className="block text-[11px] font-medium text-text">{s.name}</span>
                      <span className="block text-[11px] text-subtle">
                        found in {session.id} · {12 + i * 9} log lines
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardBody>
            <SourceNote
              reads={[{ label: '6 recordings' }, { label: 'Plant event log', route: '/flow' }]}
              computes="activities ordered into five stages, each traced back to the evidence it came from"
              feeds={[
                { label: 'Process Ontology', route: '/ontology?process=P1' },
                { label: 'Test Studio', route: '/studio' },
              ]}
            />
          </Card>

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

          <Card className="mb-4">
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
              feeds={[{ label: 'Rework cost', route: '/discovery' }]}
            />
          </Card>

          <Card>
            <CardHeader
              title="Rework loops"
              subtitle={`The two loops that appear in no procedure. They cost roughly ${reworkCost.toFixed(1)} hours a day across both plants.`}
              icon={<RotateCcw size={16} className="text-accent" />}
            />
            <CardBody>
              <ReworkDiagram />
            </CardBody>
          </Card>
        </>
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
          5 stages · 3 systems · 2 loops
        </text>
      </g>
    </svg>
  )
}

function ReworkDiagram() {
  const t = useThemeTokens()
  const loops = [
    { from: 'Invoice posting', to: 'Gate and weighbridge', label: 'parked invoice → re-weigh → re-post', pct: 14, y: 60 },
    { from: 'Chemistry check', to: 'Sortation', label: 'chemistry incomplete → re-sample', pct: 9, y: 150 },
  ]
  return (
    <svg viewBox="0 0 900 215" width="100%" height={215} className="min-w-[640px]">
      {loops.map((l, i) => (
        <g key={l.label}>
          <path
            d={`M 760 ${l.y} C 600 ${l.y + 58}, 260 ${l.y + 58}, 120 ${l.y}`}
            fill="none"
            stroke={i === 0 ? t.danger : t.accent}
            strokeWidth={1.8}
            strokeDasharray="6 5"
          />
          <rect x={300} y={l.y + 22} width={300} height={28} rx={14} fill={t.surface} stroke={t.line} />
          <text x={316} y={l.y + 40} fontSize={11} fill={t.muted}>
            {l.label}
          </text>
          <text x={612} y={l.y + 40} fontSize={11} fontFamily="JetBrains Mono, monospace" fill={i === 0 ? t.danger : t.accent}>
            {l.pct} % of cases
          </text>
          <rect x={50} y={l.y - 16} width={140} height={32} rx={8} fill={t['surface-2']} stroke={t.line} />
          <text x={64} y={l.y + 4} fontSize={11} fill={t.text}>
            {l.to.length > 17 ? `${l.to.slice(0, 16)}…` : l.to}
          </text>
          <rect x={700} y={l.y - 16} width={150} height={32} rx={8} fill={t['surface-2']} stroke={t.line} />
          <text x={714} y={l.y + 4} fontSize={11} fill={t.text}>
            {l.from}
          </text>
        </g>
      ))}
      <text x={20} y={16} fontSize={10.5} fill={t.subtle}>
        A loop means the work went backwards. Neither of these appears in any written procedure.
      </text>
    </svg>
  )
}
