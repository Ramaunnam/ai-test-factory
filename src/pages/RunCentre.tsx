import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle2,
  CircleAlert,
  FileLock2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  DataTable,
  Disclosure,
  CodeBlock,
  SectionTitle,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { JourneyBar } from '@/components/domain/JourneyBar'
import { WorkflowFlow, type StageMark } from '@/components/domain/WorkflowFlow'
import { SourceNote } from '@/components/domain/SourceNote'
import { PROCESSES, RUNS, SCENARIOS } from '@/data'
import { store, useStore } from '@/data/appStore'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'
import { verdictOf } from '@/lib/score'
import { num } from '@/lib/format'

const TABS = [
  { label: 'Runs', path: '/run' },
  { label: 'Evidence & Reports', path: '/evidence' },
]

type StepOutcome = 'pass' | 'fail' | 'healed' | 'blocked'

interface RunStep {
  scenario: string
  stageId: string
  text: string
  system: string
  outcome: StepOutcome
  detail?: string
  technical: string
}

const DEMO_STEPS: RunStep[] = [
  { scenario: 'SC-001', stageId: 'P1-S1', text: 'Create a gate pass for VH-7741 at PL01', system: 'Yard Management', outcome: 'pass', technical: "page.goto('/yard/gate-pass/new')" },
  { scenario: 'SC-001', stageId: 'P1-S1', text: 'Weigh gross 38 420 kg and tare 13 560 kg', system: 'Yard Management', outcome: 'pass', technical: "fill('#gross','38420'); fill('#tare','13560')" },
  {
    scenario: 'SC-001',
    stageId: 'P1-S1',
    text: 'Read the net weight from the ticket',
    system: 'Yard Management',
    outcome: 'healed',
    detail: 'The field was renamed. Self-healing mapped netWeightKg to net_weight_kg with 96 % confidence and the step continued.',
    technical: 'expect(payload.net_weight_kg ?? payload.netWeightKg).toBe(24860)',
  },
  { scenario: 'SC-001', stageId: 'P1-S2', text: 'Send the ticket on IF-01 and wait for SAP', system: 'SAP S/4HANA – Steel', outcome: 'pass', technical: 'queue.publish("IF-01", payload)' },
  { scenario: 'SC-001', stageId: 'P1-S2', text: 'Check that exactly one goods receipt exists', system: 'SAP S/4HANA – Steel', outcome: 'pass', technical: "odata.get('/MSEG?$filter=xblnr eq {gatePass}')" },
  {
    scenario: 'SC-004',
    stageId: 'P1-S2',
    text: 'Compare the last 50 weighbridge tickets against SAP',
    system: 'SAP S/4HANA – Steel',
    outcome: 'fail',
    detail: 'Three trucks were booked with the wrong weight. Two are a kilogram / tonne mix-up and one used a stale tare. Raised as finding F-001.',
    technical: 'expect(abs(net_kg - menge)).toBeLessThan(20)',
  },
  {
    scenario: 'SC-003',
    stageId: 'P1-S3',
    text: 'Capture an invoice with no purchase order',
    system: 'Esker',
    outcome: 'blocked',
    detail: 'Blocked as expected. The three-way match parked the invoice with the reason “No purchase order reference”.',
    technical: "payload.purchaseOrder = null",
  },
  { scenario: 'SC-002', stageId: 'P1-S4', text: 'Post a clean supplier invoice through the three-way match', system: 'SAP S/4HANA – Steel', outcome: 'pass', technical: 'sap.run("MIRO")' },
  { scenario: 'SC-007', stageId: 'P1-S5', text: 'Check that Lasernet produced the invoice copy', system: 'Lasernet', outcome: 'pass', technical: 'await lasernet.poll(belnr)' },
  { scenario: 'SC-008', stageId: 'P1-S5', text: 'Check that only posted invoices reached Reval', system: 'Reval', outcome: 'pass', technical: 'expect(reval.payments).toContainOnly(posted)' },
]

const SPEED_MS: Record<string, number> = { '1x': 1100, '2x': 650, '4x': 320 }

export function RunCentrePage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { def } = useRole()
  const appState = useStore()
  const [params, setParams] = useSearchParams()
  const [processFilter, setProcessFilter] = useState('P1')
  const [typeFilter, setTypeFilter] = useState<'All' | 'Positive' | 'Negative' | 'Regression'>('All')
  const [speed, setSpeed] = useState<'1x' | '2x' | '4x'>('2x')
  const [cursor, setCursor] = useState(-1)
  const [running, setRunning] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const findingRaised = useRef(false)

  const filtered = SCENARIOS.filter(
    (s) => s.process === processFilter && (typeFilter === 'All' || s.type === typeFilter),
  )

  const start = () => {
    if (def.readOnly) {
      toast({
        title: 'This view is read only',
        description: `${def.id} can watch runs but not start them. Switch to Key User or QA Lead to run.`,
        tone: 'info',
      })
      return
    }
    findingRaised.current = false
    setRunId(`RUN-${1043 + appState.runs.length}`)
    setCursor(0)
    setRunning(true)
  }

  useEffect(() => {
    const demo = params.get('demo')
    if (demo) {
      setParams({}, { replace: true })
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => {
      setCursor((c) => {
        const next = c + 1
        if (next >= DEMO_STEPS.length) {
          setRunning(false)
          return DEMO_STEPS.length
        }
        return next
      })
    }, SPEED_MS[speed])
    return () => window.clearTimeout(id)
  }, [running, cursor, speed])

  const done = cursor >= DEMO_STEPS.length
  const visible = DEMO_STEPS.slice(0, Math.max(0, Math.min(cursor + 1, DEMO_STEPS.length)))
  const passed = visible.filter((s) => s.outcome === 'pass' || s.outcome === 'blocked').length
  const failed = visible.filter((s) => s.outcome === 'fail').length
  const healed = visible.filter((s) => s.outcome === 'healed').length
  const verdict = verdictOf(passed, failed, healed)

  // raise the finding the moment the failing step runs
  useEffect(() => {
    if (findingRaised.current) return
    const failedStep = visible.find((s) => s.outcome === 'fail')
    if (!failedStep || !runId) return
    findingRaised.current = true
    toast({
      title: 'Finding F-001 raised during the run',
      description: '3 trucks were booked with the wrong weight.',
      tone: 'danger',
      action: { label: 'Open the finding', onClick: () => navigate('/finding/F-001') },
    })
  }, [visible, runId, toast, navigate])

  // record the run when it finishes
  useEffect(() => {
    if (!done || !runId) return
    if (appState.runs.some((r) => r.id === runId)) return
    store.addRun({
      id: runId,
      when: new Date().toLocaleString('en-GB'),
      trigger: 'Key user on demand',
      scenarios: new Set(DEMO_STEPS.map((s) => s.scenario)).size,
      passed,
      failed,
      healed,
      verdict,
      duration: '2 min',
      process: 'P1',
      live: true,
    })
    toast({
      title: `Run ${runId} finished · ${verdict}`,
      description: `${passed} passed, ${failed} failed, ${healed} healed.`,
      tone: verdict === 'PASS' ? 'success' : verdict === 'FAIL' ? 'danger' : 'warning',
      action: { label: 'Open the summary', onClick: () => navigate(`/report/${runId}`) },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  const marks = useMemo(() => {
    const out: Record<string, StageMark> = {}
    PROCESSES[0].stages.forEach((s) => {
      out[s.id] = 'not in run'
    })
    visible.forEach((s, i) => {
      const isCurrent = i === visible.length - 1 && running
      if (isCurrent) {
        out[s.stageId] = 'running'
        return
      }
      const existing = out[s.stageId]
      if (s.outcome === 'fail') out[s.stageId] = 'fail'
      else if (s.outcome === 'healed' && existing !== 'fail') out[s.stageId] = 'healed'
      else if (existing === 'not in run' || existing === undefined) out[s.stageId] = 'pass'
    })
    return out
  }, [visible, running])

  const severityFilter = params.get('severity')
  const openFindings = appState.findings
    .filter((f) => f.status !== 'Closed')
    .filter((f) => !severityFilter || f.severity === severityFilter)

  return (
    <>
      <JourneyBar step={5} />
      <PageHeader
        title="Run Centre"
        subtitle="Pick scenarios, run them step by step, and watch the workflow light up as each stage is proven."
        tabs={TABS}
        actions={
          <>
            <Chip selected={speed === '1x'} onClick={() => setSpeed('1x')}>1x</Chip>
            <Chip selected={speed === '2x'} onClick={() => setSpeed('2x')}>2x</Chip>
            <Chip selected={speed === '4x'} onClick={() => setSpeed('4x')}>4x</Chip>
            <Button variant="primary" leftIcon={<Play size={15} />} loading={running} onClick={start}>
              Run the P1 demo now
            </Button>
          </>
        }
      />

      {cursor >= 0 && (
        <Card className="mb-4" tone={done ? (verdict === 'FAIL' ? 'danger' : verdict === 'PASS' ? 'success' : 'warning') : 'default'}>
          <CardHeader
            title={`${runId} · P1 Gate to Invoice`}
            subtitle={running ? `Running step ${Math.min(cursor + 1, DEMO_STEPS.length)} of ${DEMO_STEPS.length}` : done ? 'Finished' : 'Ready'}
            actions={
              done && (
                <>
                  <Button onClick={() => navigate(`/report/${runId}`)}>Open run summary</Button>
                  <Button
                    variant="primary"
                    leftIcon={<FileLock2 size={15} />}
                    onClick={() => {
                      const id = store.addEvidencePack(runId!, DEMO_STEPS.length)
                      toast({ title: `Evidence pack ${id} locked`, description: 'Hashed and ready for sign-off.', tone: 'success' })
                      navigate(`/evidence-pack/${runId}`)
                    }}
                  >
                    Audit evidence pack
                  </Button>
                </>
              )
            }
          />
          <CardBody className="space-y-4">
            <div>
              <div className="mb-2 text-label font-semibold uppercase text-subtle">Workflow being tested</div>
              <WorkflowFlow process={PROCESSES[0]} marks={marks} compact />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Passed" value={num(passed)} tone="success" />
              <StatTile label="Failed" value={num(failed)} tone={failed ? 'danger' : 'neutral'} />
              <StatTile label="Healed" value={num(healed)} tone={healed ? 'warning' : 'neutral'} />
              <StatTile label="Verdict" value={done ? verdict : running ? 'running' : '—'} tone={verdict === 'FAIL' ? 'danger' : verdict === 'PASS' ? 'success' : 'warning'} />
            </div>

            <div className="space-y-1.5">
              {DEMO_STEPS.map((s, i) => {
                const state = i < cursor ? s.outcome : i === cursor ? (running ? 'running' : s.outcome) : 'waiting'
                return (
                  <div
                    key={`${s.scenario}-${i}`}
                    className={cn(
                      'flex items-start gap-3 rounded-md border px-3 py-2 transition-colors',
                      state === 'waiting' && 'border-line bg-surface opacity-50',
                      state === 'running' && 'border-info/50 bg-info-soft/50',
                      state === 'pass' && 'border-success/40 bg-success-soft/40',
                      state === 'blocked' && 'border-success/40 bg-success-soft/30',
                      state === 'healed' && 'border-accent/50 bg-accent-soft/50',
                      state === 'fail' && 'border-danger/50 bg-danger-soft/50',
                    )}
                  >
                    <span className="mt-0.5 shrink-0">
                      {state === 'running' ? (
                        <Loader2 size={15} className="animate-spin text-info" />
                      ) : state === 'pass' ? (
                        <CheckCircle2 size={15} className="text-success" />
                      ) : state === 'blocked' ? (
                        <ShieldCheck size={15} className="text-success" />
                      ) : state === 'healed' ? (
                        <Sparkles size={15} className="text-accent" />
                      ) : state === 'fail' ? (
                        <XCircle size={15} className="text-danger" />
                      ) : (
                        <span className="block h-[15px] w-[15px] rounded-full border border-line" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, '0')}</span>
                        <button
                          type="button"
                          className="rounded-sm font-mono text-[11px] text-primary hover:underline"
                          onClick={() => navigate(`/studio?scenario=${s.scenario}`)}
                        >
                          {s.scenario}
                        </button>
                        <span className="text-sm text-text">{s.text}</span>
                      </span>
                      <span className="mt-0.5 block text-[11px] text-subtle">{s.system}</span>
                      {s.detail && state !== 'waiting' && state !== 'running' && (
                        <span
                          className={cn(
                            'mt-1 block text-xs',
                            s.outcome === 'fail' ? 'text-danger' : s.outcome === 'healed' ? 'text-accent' : 'text-success',
                          )}
                        >
                          {s.detail}
                        </span>
                      )}
                      {state !== 'waiting' && (
                        <Disclosure summary="Technical detail" className="mt-2">
                          <CodeBlock className="max-h-24">{s.technical}</CodeBlock>
                        </Disclosure>
                      )}
                    </span>
                    {s.outcome === 'fail' && state === 'fail' && (
                      <Button size="sm" variant="danger" onClick={() => navigate('/finding/F-001')}>
                        F-001
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader
          title="Choose what to run"
          subtitle="Thirty approved scenarios across six workflows, filtered by workflow and by type."
          actions={
            <div className="flex flex-wrap gap-1.5">
              {(['All', 'Positive', 'Negative', 'Regression'] as const).map((t) => (
                <Chip key={t} selected={typeFilter === t} onClick={() => setTypeFilter(t)}>
                  {t}
                </Chip>
              ))}
            </div>
          }
        />
        <CardBody className="flex flex-wrap gap-2 pb-0">
          {PROCESSES.map((p) => (
            <Chip key={p.id} selected={processFilter === p.id} onClick={() => setProcessFilter(p.id)}>
              {p.id} · {p.name}
            </Chip>
          ))}
        </CardBody>
        <DataTable
          rows={filtered}
          rowKey={(s) => s.id}
          onRowClick={(s) => navigate(`/studio?scenario=${s.id}`)}
          maxHeight={360}
          columns={[
            { key: 'id', header: 'Scenario', mono: true, width: 100 },
            { key: 'name', header: 'What it proves' },
            { key: 'type', header: 'Type', width: 120, render: (s) => <Badge tone={s.type === 'Negative' ? 'warning' : s.type === 'Regression' ? 'info' : 'success'}>{s.type}</Badge> },
            { key: 'requirement', header: 'Requirement', width: 120, mono: true },
            { key: 'steps', header: 'Steps', align: 'right', mono: true, width: 80, render: (s) => s.steps.length, value: (s) => s.steps.length },
            {
              key: 'lastResult',
              header: 'Last result',
              width: 120,
              render: (s) => (
                <Badge tone={s.lastResult === 'Pass' ? 'success' : s.lastResult === 'Fail' ? 'danger' : s.lastResult === 'Healed' ? 'warning' : 'neutral'}>
                  {s.lastResult}
                </Badge>
              ),
            },
            {
              key: 'run',
              header: '',
              sortable: false,
              width: 70,
              render: () => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    start()
                  }}
                >
                  Run
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <SectionTitle
        title="Findings"
        hint="Everything raised by a run, a live check or an access proof, with the evidence attached."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip selected={!severityFilter} onClick={() => setParams({})}>
              All
            </Chip>
            {(['Critical', 'High', 'Medium', 'Low'] as const).map((s) => (
              <Chip key={s} selected={severityFilter === s} onClick={() => setParams({ severity: s })}>
                {s}
              </Chip>
            ))}
          </div>
        }
      />
      <Card>
        <DataTable
          rows={openFindings}
          rowKey={(f) => f.id}
          onRowClick={(f) => navigate(`/finding/${f.id}`)}
          searchable
          maxHeight={420}
          rowTone={(f) => (f.severity === 'Critical' ? 'danger' : f.severity === 'High' ? 'warning' : undefined)}
          columns={[
            { key: 'id', header: 'Finding', mono: true, width: 95 },
            { key: 'title', header: 'What is wrong' },
            { key: 'system', header: 'System', width: 200 },
            { key: 'process', header: 'Workflow', width: 90, mono: true },
            {
              key: 'severity',
              header: 'Severity',
              width: 110,
              render: (f) => (
                <Badge tone={f.severity === 'Critical' ? 'danger' : f.severity === 'High' ? 'warning' : f.severity === 'Medium' ? 'info' : 'neutral'}>
                  {f.severity}
                </Badge>
              ),
            },
            { key: 'status', header: 'Status', width: 120, render: (f) => <Badge tone={f.status === 'Open' ? 'danger' : f.status === 'In progress' ? 'warning' : 'success'}>{f.status}</Badge> },
            { key: 'raised', header: 'Raised', width: 170 },
          ]}
        />
        <SourceNote
          title="Where findings come from"
          reads={[
            { label: 'Run steps', route: '/run', note: 'a failing step raises one automatically' },
            { label: 'Live checks', route: '/flow/checks', note: 'Raise finding on any failing check' },
            { label: 'Access proofs', route: '/access-sod', note: 'a forbidden action that was allowed' },
          ]}
          computes="every finding keeps its evidence, the records affected and the step or check that found it"
          feeds={[{ label: 'Confidence score', route: '/' }, { label: 'Release gate', route: '/release' }]}
          steps={[
            'A finding is only created by something that actually ran: a step, a check or a proof.',
            'It keeps the affected keys, so each one can be followed through every system.',
            'Open critical findings cap the confidence score at 79.',
            'The release gate cannot reach GO while one is open.',
          ]}
        />
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Evidence                                                                   */
/* -------------------------------------------------------------------------- */

export function EvidencePage() {
  const navigate = useNavigate()
  const appState = useStore()
  const allRuns = [...appState.runs, ...RUNS]

  return (
    <>
      <PageHeader
        title="Evidence & Reports"
        subtitle="Every run can be locked into a hashed bundle: the steps, the data, the screenshots and the sign-off."
        tabs={TABS}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Evidence packs" value={num(appState.evidencePacks.length)} />
        <StatTile label="Runs recorded" value={num(allRuns.length)} />
        <StatTile label="Signed off" value={num(appState.evidencePacks.filter((p) => p.locked).length)} tone="success" />
        <StatTile label="Open findings" value={num(appState.findings.filter((f) => f.status !== 'Closed').length)} tone="warning" onClick={() => navigate('/run')} />
      </div>

      <Card className="mb-4">
        <CardHeader title="Locked evidence packs" subtitle="Each pack carries a hash so it can be shown to an auditor unchanged." />
        <DataTable
          rows={appState.evidencePacks}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`/evidence-pack/${p.runId}`)}
          columns={[
            { key: 'id', header: 'Pack', mono: true, width: 110 },
            { key: 'runId', header: 'Run', mono: true, width: 110 },
            { key: 'created', header: 'Created', width: 190 },
            { key: 'items', header: 'Items', align: 'right', mono: true, width: 80 },
            { key: 'hash', header: 'Hash', mono: true, width: 190 },
            { key: 'signedBy', header: 'Signed off by', width: 140 },
            { key: 'locked', header: 'State', width: 110, render: (p) => <Badge tone={p.locked ? 'success' : 'warning'}>{p.locked ? 'Locked' : 'Open'}</Badge>, value: (p) => (p.locked ? 1 : 0) },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="All runs" subtitle="Every run kept, with its verdict and how long it took." />
        <DataTable
          rows={allRuns}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/report/${r.id}`)}
          searchable
          columns={[
            { key: 'id', header: 'Run', mono: true, width: 110 },
            { key: 'when', header: 'When', width: 180 },
            { key: 'trigger', header: 'Trigger' },
            { key: 'scenarios', header: 'Scenarios', align: 'right', mono: true, width: 100 },
            { key: 'passed', header: 'Passed', align: 'right', mono: true, width: 90 },
            { key: 'failed', header: 'Failed', align: 'right', mono: true, width: 90 },
            { key: 'healed', header: 'Healed', align: 'right', mono: true, width: 90 },
            { key: 'duration', header: 'Duration', width: 100 },
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

      <Card className="mt-4">
        <CardBody className="flex items-start gap-3">
          <CircleAlert size={18} className="mt-0.5 shrink-0 text-info" />
          <p className="text-sm text-muted">
            An evidence pack is immutable. If a scenario is re-run, a new pack is created and the old one stays
            exactly as it was, which is what an auditor needs.
          </p>
        </CardBody>
      </Card>
    </>
  )
}
