import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, CircleDot, Database, MonitorPlay, Play, Printer, Search, Sparkles, Square, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  CodeBlock,
  DataTable,
  Disclosure,
  EmptyState,
  LiveLog,
  SectionTitle,
  Select,
  StatTile,
  Switch,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { JourneyBar } from '@/components/domain/JourneyBar'
import { PROCESSES, SCENARIOS, type Scenario } from '@/data'
import { CONVERSION_LOG, RECORDED_ACTIONS, RECORDED_SCENARIO } from '@/data/recordings'
import { SAMPLE_PROBLEMS, SCAN_LOG, type MasterDataProblem } from '@/data/masterData'
import { projectOfSystems, useProjectFilter } from '@/data/projects'
import { engine } from '@/sim/engine'
import { useSimVersion } from '@/sim/useSim'
import { StepScreenshot } from '@/components/domain/StepScreenshot'
import { SourceNote } from '@/components/domain/SourceNote'
import { store, useStore } from '@/data/appStore'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'
import { num } from '@/lib/format'
import { REVIEW_LINES, scenariosFromGaps, studioReview } from '@/lib/studioReview'
import { useChecks } from '@/sim/useSim'
import { useMoney } from '@/lib/currency'

const TABS = [
  { label: 'Scenarios', path: '/studio' },
  { label: 'Test Data', path: '/test-data' },
  { label: 'Master Data Check', path: '/studio/master-data' },
  { label: 'Record', path: '/studio/record' },
]


export function StudioPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const drawer = useDrawer()
  const appState = useStore()
  const { def } = useRole()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string[]>(['P1'])
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [review, setReview] = useState<'idle' | 'running' | 'done'>('idle')
  const [generated, setGenerated] = useState<Scenario[]>([])
  const [rule, setRule] = useState(false)
  const checks = useChecks()

  const scenarioProject = useProjectFilter()
  const all = useMemo(
    () => [...appState.recordedScenarios, ...generated, ...SCENARIOS],
    [generated, appState.recordedScenarios],
  )
  const forProcess = all
    .filter((s) => selected.includes(s.process))
    .filter((s) => scenarioProject.matches(projectOfSystems(s.systems)))

  /** The whole library, for a review that is about all of it. */
  const reviewed = useMemo(
    () =>
      studioReview({
        scenarios: all,
        scenarioStatus: appState.scenarioStatus,
        findings: appState.findings,
        checks,
        runs: appState.runs,
      }),
    [all, appState.scenarioStatus, appState.findings, appState.runs, checks],
  )

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  /** Scenarios the writer adds for the workflows that are selected. */
  const writeForSelected = () =>
    scenariosFromGaps(reviewed.gaps.filter((g) => selected.some((id) => g.workflow.startsWith(id)))).slice(0, 6)

  const lines = [
    `Reading the ontology for ${selected.join(', ') || 'no workflow'} and the stages in it…`,
    'Reading the live checks that are currently failing…',
    'Reading change CH-204 and the payload that caused it…',
    'Writing positive paths first, then the negatives that must be blocked…',
    'Adding a regression check against the baseline run RUN-1041…',
    'Three scenarios written. They are waiting for your approval.',
  ]

  const openScenario = (sc: Scenario) => {
    const status = appState.scenarioStatus[sc.id] ?? 'Pending approval'
    drawer.open({
      title: `${sc.id} · ${sc.name}`,
      subtitle: `${sc.type} · ${sc.process} · proves ${sc.requirement}`,
      width: 'lg',
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={sc.type === 'Negative' ? 'warning' : sc.type === 'Regression' ? 'info' : 'success'}>{sc.type}</Badge>
            <Badge tone={status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'warning'}>{status}</Badge>
            {sc.systems.map((s) => (
              <Badge key={s} tone="neutral">
                {s}
              </Badge>
            ))}
          </div>

          <div>
            <div className="mb-2 text-label font-semibold uppercase text-subtle">Steps</div>
            <ol className="space-y-2">
              {sc.steps.map((st) => (
                <li key={st.n} className="rounded-md border border-line bg-surface2/60 px-3 py-2">
                  <div className="flex gap-2">
                    <span className="font-mono text-xs text-subtle">{String(st.n).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text">{st.text}</div>
                      <div className="mt-0.5 text-[11px] text-subtle">{st.system}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <Disclosure summary="Technical detail">
            <CodeBlock>{sc.steps.map((s) => `${String(s.n).padStart(2, '0')}  ${s.technical}`).join('\n')}</CodeBlock>
          </Disclosure>

          <div className="flex gap-2">
            <Button
              variant="primary"
              fullWidth
              leftIcon={<Check size={15} />}
              onClick={() => {
                if (def.readOnly) {
                  toast({ title: 'This view is read only', description: 'Switch to Key User to approve scenarios.', tone: 'info' })
                  return
                }
                store.setScenarioStatus(sc.id, 'Approved')
                toast({ title: `${sc.id} approved`, tone: 'success' })
                drawer.closeAll()
              }}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              fullWidth
              leftIcon={<X size={15} />}
              onClick={() => {
                if (def.readOnly) {
                  toast({ title: 'This view is read only', description: 'Switch to Key User to reject scenarios.', tone: 'info' })
                  return
                }
                store.setScenarioStatus(sc.id, 'Rejected')
                toast({ title: `${sc.id} rejected`, tone: 'warning' })
                drawer.closeAll()
              }}
            >
              Reject
            </Button>
            <Button fullWidth onClick={() => { drawer.closeAll(); navigate(`/run?scenario=${sc.id}`) }}>
              Run it
            </Button>
          </div>
        </div>
      ),
    })
  }

  useEffect(() => {
    const id = params.get('scenario')
    if (!id) return
    const sc = all.find((s) => s.id === id)
    if (sc) openScenario(sc)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const groups = (['Positive', 'Negative', 'Regression'] as const).map((t) => ({
    type: t,
    items: forProcess.filter((s) => s.type === t),
  }))

  return (
    <>
      <JourneyBar step={3} />
      <PageHeader
        title="Test Studio"
        subtitle="Scenarios are written from the ontology and the live data, then approved by a key user before they run."
        tabs={TABS}
        actions={
          <Button
            variant="ai"
            leftIcon={<Sparkles size={15} />}
            loading={review === 'running'}
            onClick={() => {
              setReview('running')
              window.setTimeout(() => setReview('done'), REVIEW_LINES.length * 420 + 200)
            }}
          >
            AI review — all workflows
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-2">
          <span className="text-label font-semibold uppercase text-subtle">Workflows</span>
          {PROCESSES.map((p) => (
            <Chip key={p.id} selected={selected.includes(p.id)} onClick={() => toggle(p.id)}>
              {p.id} · {p.name}
            </Chip>
          ))}
          <Button size="sm" onClick={() => setSelected(PROCESSES.map((p) => p.id))}>
            Select all
          </Button>
          <Button size="sm" onClick={() => setSelected([])}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="ai"
            className="ml-auto"
            leftIcon={<Sparkles size={14} />}
            loading={phase === 'running'}
            disabled={selected.length === 0}
            onClick={() => {
              const next = writeForSelected()
              if (!next.length) {
                toast({
                  title: 'Nothing to add for these workflows',
                  description: 'Every stage already has a scenario and no check is failing.',
                  tone: 'info',
                })
                return
              }
              setPhase('running')
              window.setTimeout(() => {
                setGenerated((cur) => [...next.filter((n) => !cur.some((c) => c.id === n.id)), ...cur])
                next.forEach((g) => store.setScenarioStatus(g.id, 'Pending approval'))
                setPhase('done')
                toast({
                  title: `${next.length} scenarios generated`,
                  description: 'They are pending your approval.',
                  tone: 'info',
                  action: { label: 'Open approvals', onClick: () => navigate('/approvals') },
                })
              }, lines.length * 420 + 200)
            }}
          >
            Generate with AI ({selected.length} selected)
          </Button>
        </CardBody>
      </Card>

      {review !== 'idle' && (
        <Card className="mb-4" tone="ai">
          <CardHeader
            title="AI review of every workflow"
            subtitle="Coverage, gaps and risk, read from the scenario library and the live data."
            actions={
              review === 'done' ? (
                <Button size="sm" leftIcon={<Printer size={14} />} onClick={() => navigate('/studio-review')}>
                  Download report
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-4">
            <LiveLog lines={REVIEW_LINES} running={review === 'running'} height={150} />
            {review === 'done' && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatTile
                    label="Stage coverage"
                    value={`${reviewed.coverage} %`}
                    tone={reviewed.coverage >= 80 ? 'success' : reviewed.coverage >= 60 ? 'warning' : 'danger'}
                    hint={`${reviewed.tested} of ${reviewed.stages} stages have a scenario`}
                  />
                  <StatTile
                    label="Scenarios"
                    value={num(reviewed.total)}
                    hint={`${reviewed.byType.Positive} positive · ${reviewed.byType.Negative} negative · ${reviewed.byType.Regression} re-test`}
                  />
                  <StatTile
                    label="Approved"
                    value={num(reviewed.approved)}
                    tone="success"
                    hint={`${reviewed.pending} pending approval`}
                    onClick={() => navigate('/approvals')}
                  />
                  <StatTile
                    label="Last run"
                    value={reviewed.lastRun.verdict}
                    tone={reviewed.lastRun.verdict === 'PASS' ? 'success' : reviewed.lastRun.verdict === 'FAIL' ? 'danger' : 'warning'}
                    hint={`${reviewed.lastRun.id} · ${reviewed.lastRun.failed} failed`}
                    onClick={() => navigate(`/report/${reviewed.lastRun.id}`)}
                  />
                </div>

                <DataTable
                  rows={reviewed.workflows}
                  rowKey={(w) => w.id}
                  dense
                  rowTone={(w) => (w.risk === 'High' ? 'danger' : w.risk === 'Medium' ? 'warning' : undefined)}
                  columns={[
                    { key: 'id', header: 'Workflow', mono: true, width: 70 },
                    { key: 'name', header: 'Name' },
                    { key: 'coverage', header: 'Coverage', width: 100, align: 'right', render: (w) => `${w.coverage} %` },
                    { key: 'untested', header: 'Stages with no test', render: (w) => (w.untested.length ? w.untested.join(', ') : 'none') },
                    { key: 'failingChecks', header: 'Failing checks', width: 140, render: (w) => (w.failingChecks.length ? w.failingChecks.join(', ') : 'none') },
                    { key: 'openFindings', header: 'Open findings', width: 120, align: 'right', mono: true },
                    { key: 'risk', header: 'Risk', width: 90, render: (w) => <Badge tone={w.risk === 'High' ? 'danger' : w.risk === 'Medium' ? 'warning' : 'success'}>{w.risk}</Badge> },
                  ]}
                  empty="No workflows to review."
                />

                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-label font-semibold uppercase text-subtle">
                      Gaps and what the AI would add
                    </span>
                    <Button
                      size="sm"
                      variant="ai"
                      className="ml-auto"
                      disabled={reviewed.gaps.length === 0}
                      onClick={() => {
                        const next = scenariosFromGaps(reviewed.gaps)
                        setGenerated((cur) => [...next.filter((n) => !cur.some((c) => c.id === n.id)), ...cur])
                        next.forEach((g) => store.setScenarioStatus(g.id, 'Pending approval'))
                        toast({
                          title: `${next.length} scenarios generated`,
                          description: 'They are pending your approval.',
                          tone: 'info',
                          action: { label: 'Open approvals', onClick: () => navigate('/approvals') },
                        })
                      }}
                    >
                      Generate these
                    </Button>
                  </div>
                  <DataTable
                    rows={reviewed.gaps}
                    rowKey={(g) => g.id}
                    dense
                    columns={[
                      { key: 'workflow', header: 'Workflow', width: 190 },
                      { key: 'stage', header: 'Stage', width: 170 },
                      { key: 'type', header: 'Type', width: 100 },
                      { key: 'name', header: 'Scenario to add' },
                      { key: 'why', header: 'Why', width: 230 },
                    ]}
                    empty="No gaps. Every stage has a scenario and no check is failing."
                  />
                </div>

                <div>
                  <div className="mb-2 text-label font-semibold uppercase text-subtle">Requirement coverage</div>
                  <div className="flex flex-wrap gap-1.5">
                    {reviewed.requirements.map((r) => (
                      <Chip
                        key={r.id}
                        title={r.full}
                        onClick={() => navigate(r.screens[0]?.route ?? '/journey')}
                      >
                        {r.id} · {r.steps.length} {r.steps.length === 1 ? 'step' : 'steps'}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {phase !== 'idle' && (
        <Card className="mb-4" tone="ai">
          <CardHeader
            title="Scenario Writer agent"
            subtitle="Reading the ontology, the failing checks and the change feed."
            actions={<Badge tone="info">Based on process map v{appState.mapVersion}</Badge>}
          />
          <CardBody>
            <LiveLog lines={lines} running={phase === 'running'} height={150} />
          </CardBody>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Scenarios selected" value={num(forProcess.length)} hint={`${selected.length} of ${PROCESSES.length} workflows`} />
        <StatTile label="Approved" value={num(forProcess.filter((s) => (appState.scenarioStatus[s.id] ?? 'Approved') === 'Approved').length)} tone="success" />
        <StatTile
          label="Pending approval"
          value={num(forProcess.filter((s) => appState.scenarioStatus[s.id] === 'Pending approval').length)}
          tone="warning"
          onClick={() => navigate('/approvals')}
        />
        <StatTile label="Failing last run" value={num(forProcess.filter((s) => s.lastResult === 'Fail').length)} tone="danger" onClick={() => navigate('/run')} />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Turn a business rule into a data check"
          subtitle="Write the rule in plain English and it becomes a step inside the scenario."
          icon={<Sparkles size={16} className="text-ai" />}
        />
        <CardBody className="space-y-3">
          <Switch
            checked={rule}
            onChange={setRule}
            label="Add the rule “the net weight booked in SAP must equal the weighbridge net weight”"
            description="Adds a data-check step to every positive scenario in this workflow."
            size="sm"
          />
          {rule && (
            <CodeBlock>{`step 6  data check
  given  the gate pass from step 1
  read   yard.weighbridge_ticket.net_kg
  read   sap.mseg.menge where xblnr = gate_pass
  expect abs(net_kg - menge) <= 20`}</CodeBlock>
          )}
        </CardBody>
        <SourceNote
          title="Where scenarios come from"
          reads={[
            { label: 'Process Ontology', route: '/ontology', note: 'the stages, rules and systems' },
            { label: 'Failing live checks', route: '/flow/checks', note: 'what is actually going wrong today' },
            { label: 'Change feed', route: '/regression', note: 'what is about to change' },
          ]}
          computes="writes positive, negative and regression scenarios, then waits for a key user to approve them"
          feeds={[{ label: 'Run Centre', route: '/run' }, { label: 'Approvals', route: '/approvals' }]}
          steps={[
            'The agent reads the stage, its rule and the systems involved.',
            'It writes the happy path first, then the negatives that must be refused.',
            'A regression scenario is added for anything a current change could break.',
            'Nothing runs until a key user approves it here or in Approvals.',
          ]}
        />
      </Card>

      {groups.map((g) => (
        <div key={g.type} className="mb-5">
          <SectionTitle
            title={g.type}
            hint={
              g.type === 'Positive'
                ? 'The journey as it should happen'
                : g.type === 'Negative'
                  ? 'What must be refused'
                  : 'What must not change'
            }
          />
          {g.items.length === 0 ? (
            <Card>
              <CardBody className="py-6 text-center text-sm text-muted">No {g.type.toLowerCase()} scenarios for this workflow yet.</CardBody>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {g.items.map((sc) => {
                const status = appState.scenarioStatus[sc.id] ?? 'Approved'
                return (
                  <Card key={sc.id} interactive onClick={() => openScenario(sc)} tone={status === 'Pending approval' ? 'ai' : 'default'}>
                    <CardBody>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-mono text-[11px] text-subtle">{sc.id}</span>
                        <Badge tone={status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'warning'}>{status}</Badge>
                      </div>
                      <div className="text-sm font-medium text-text">{sc.name}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <Badge tone="neutral">{sc.steps.length} steps</Badge>
                        <Badge tone="neutral">{sc.requirement}</Badge>
                        <span
                          className={cn(
                            'ml-auto font-medium',
                            sc.lastResult === 'Pass' ? 'text-success' : sc.lastResult === 'Fail' ? 'text-danger' : sc.lastResult === 'Healed' ? 'text-accent' : 'text-subtle',
                          )}
                        >
                          {sc.lastResult}
                        </span>
                      </div>
                    </CardBody>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Test data                                                                  */
/* -------------------------------------------------------------------------- */

interface GeneratedRow {
  id: string
  entity: string
  linked: string
  detail: string
}

export function TestDataPage() {
  const { money } = useMoney()
  const toast = useToast()
  const [entity, setEntity] = useState('Scrap batch with chemistry')
  const [count, setCount] = useState(20)
  const [phase, setPhase] = useState<'idle' | 'running' | 'ready' | 'loaded'>('idle')
  const [rows, setRows] = useState<GeneratedRow[]>([])

  const lines = [
    `Reading the shape of "${entity}" from the ontology…`,
    'Finding the records it must link to so it is usable…',
    `Generating ${count} records with realistic weights and grades…`,
    'Checking that no real personal data is present…',
    'Ready to load into the test environment.',
  ]

  const generate = () => {
    setPhase('running')
    window.setTimeout(() => {
      const grades = ['SCR-304-BALE', 'SCR-316L-SOLID', 'SCR-430-TURN', 'SCR-321-SHRED']
      setRows(
        Array.from({ length: count }, (_, i) => {
          if (entity.startsWith('Purchase order')) {
            return {
              id: `45${String(90000000 + i)}`,
              entity: 'Purchase order',
              linked: `VEND-10${42 + (i % 4)} · SCRAP-STEEL-MIX`,
              detail: `${num(20 + (i % 9) * 2)} t at ${money(1850 + (i % 5) * 90)}/t`,
            }
          }
          if (entity.startsWith('Gate pass')) {
            return {
              id: `GP-PL01-2026-${9000 + i}`,
              entity: 'Gate pass',
              linked: `VH-${7000 + i} · VEND-10${42 + (i % 4)}`,
              detail: `gross ${num(32000 + i * 120)} kg · tare ${num(13000 + (i % 7) * 80)} kg`,
            }
          }
          return {
            id: `BT-9${String(1000 + i)}`,
            entity: 'Scrap batch',
            linked: `chemistry LAB-9${1000 + i}`,
            detail: `${grades[i % 4]} · ${num(9000 + i * 340)} kg · Ni ${(8 + (i % 4) * 0.7).toFixed(1)} %`,
          }
        }),
      )
      setPhase('ready')
    }, lines.length * 420 + 150)
  }

  return (
    <>
      <JourneyBar step={4} />
      <PageHeader
        title="Test Data"
        subtitle="Linked records that are safe to use: a purchase order arrives with its vendor and material, a scrap batch with its chemistry."
        tabs={TABS}
        actions={<Badge tone="success">No real personal data</Badge>}
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[260px] flex-1">
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">Entity</label>
            <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPhase('idle') }}>
              <option>Scrap batch with chemistry</option>
              <option>Purchase order with vendor and material</option>
              <option>Gate pass with vehicle and weights</option>
            </Select>
          </div>
          <div className="w-28">
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">How many</label>
            <Select value={String(count)} onChange={(e) => { setCount(Number(e.target.value)); setPhase('idle') }}>
              {[10, 20, 40, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </Select>
          </div>
          <Button variant="ai" leftIcon={<Sparkles size={15} />} loading={phase === 'running'} onClick={generate}>
            Generate linked records
          </Button>
          <Button
            variant="primary"
            leftIcon={<Database size={15} />}
            disabled={phase !== 'ready'}
            onClick={() => {
              setPhase('loaded')
              store.addApproval({
                kind: 'Test data',
                title: `${count} × ${entity}`,
                detail: 'Generated by the Test Data agent and loaded into the test environment.',
                requested: 'just now',
                route: '/test-data',
              })
              toast({ title: `${count} records loaded into the test environment`, tone: 'success' })
            }}
          >
            Load into test environment
          </Button>
        </CardBody>
      </Card>

      {phase !== 'idle' && (
        <Card className="mb-4" tone="ai">
          <CardHeader title="Test Data agent" subtitle="Generating records that link to each other, so a scenario can actually use them." />
          <CardBody>
            <LiveLog lines={lines} running={phase === 'running'} height={140} />
          </CardBody>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardHeader
            title="Generated records"
            subtitle={phase === 'loaded' ? 'Loaded into the test environment and ready for a run.' : 'Review them, then load them.'}
            actions={phase === 'loaded' ? <Badge tone="success">Loaded</Badge> : <Badge tone="warning">Not loaded yet</Badge>}
          />
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            searchable
            maxHeight={420}
            dense
            columns={[
              { key: 'id', header: 'Identifier', mono: true, width: 190 },
              { key: 'entity', header: 'Entity', width: 150 },
              { key: 'linked', header: 'Linked to', mono: true },
              { key: 'detail', header: 'Detail' },
            ]}
            footerNote={<span className="flex items-center gap-1.5"><Play size={11} /> run them from the Run Centre</span>}
          />
        </Card>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Record a key user                                                          */
/* -------------------------------------------------------------------------- */

type RecordPhase = 'idle' | 'recording' | 'captured' | 'converting' | 'converted'

export function RecordPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const appState = useStore()
  const [workflow, setWorkflow] = useState('P1')
  const [system, setSystem] = useState('YardLink')
  const [phase, setPhase] = useState<RecordPhase>('idle')
  const [count, setCount] = useState(0)

  const captured = RECORDED_ACTIONS.slice(0, count)
  const kept = RECORDED_ACTIONS.filter((a) => a.kind === 'action').length
  const clock = captured.length ? captured[captured.length - 1].at : '00:00'
  const sample = workflow !== 'P1'

  useEffect(() => {
    if (phase !== 'recording') return
    if (count >= RECORDED_ACTIONS.length) {
      setPhase('captured')
      return
    }
    const id = window.setTimeout(() => setCount((c) => c + 1), 1100)
    return () => window.clearTimeout(id)
  }, [phase, count])

  const start = () => {
    setCount(0)
    setPhase('recording')
  }

  const convert = () => {
    setPhase('converting')
    window.setTimeout(
      () => {
        store.addRecordedScenario(RECORDED_SCENARIO)
        store.addRecording({
          id: `RC-${104 + appState.recordings.length - 3}`,
          name: 'Gate pass to release',
          role: 'Gate operator',
          workflow: `${workflow} ${PROCESSES.find((p) => p.id === workflow)?.name ?? ''}`.trim(),
          system,
          date: new Date().toLocaleDateString('en-GB'),
          steps: RECORDED_ACTIONS.length,
          status: 'Converted',
          scenarioId: RECORDED_SCENARIO.id,
        })
        setPhase('converted')
        toast({
          title: `${RECORDED_SCENARIO.id} written from the recording`,
          description: 'It is waiting for your approval in Scenarios.',
          tone: 'info',
          action: { label: 'Open it', onClick: () => navigate(`/studio?scenario=${RECORDED_SCENARIO.id}`) },
        })
      },
      CONVERSION_LOG.length * 420 + 200,
    )
  }

  return (
    <>
      <PageHeader
        title="Record"
        subtitle="Watch a key user do the work once. The AI turns that recording into a test."
        tabs={TABS}
        actions={
          phase === 'recording' ? (
            <Button variant="danger" leftIcon={<Square size={14} />} onClick={() => setPhase('captured')}>
              Stop recording
            </Button>
          ) : (
            <Button variant="primary" leftIcon={<CircleDot size={15} />} onClick={start}>
              {phase === 'idle' ? 'Start recording' : 'Record again'}
            </Button>
          )
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">Workflow</label>
            <Select value={workflow} onChange={(e) => setWorkflow(e.target.value)} disabled={phase === 'recording'}>
              {PROCESSES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[220px]">
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">System</label>
            <Select value={system} onChange={(e) => setSystem(e.target.value)} disabled={phase === 'recording'}>
              {[
                'YardLink',
                'dOps Core',
                'Laboratory app',
                'SAP S/4HANA Stainless',
                'Esker',
                'D365 F&O OneCore',
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
          {phase === 'recording' && (
            <span className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 animate-pulseDot rounded-full bg-danger" />
              <span className="font-mono text-text">{clock}</span>
              <span className="text-muted">recording · {captured.length} actions</span>
            </span>
          )}
          {sample && (
            <span className="ml-auto text-xs text-muted">Sample actions are shown for the gate-to-invoice path.</span>
          )}
        </CardBody>
      </Card>

      {phase === 'idle' && (
        <Card className="mb-4">
          <EmptyState
            icon={<MonitorPlay size={28} />}
            title="Nothing recorded yet"
            description="Pick the workflow and the system, then record a key user doing the work once. Every click is captured with the screen it touched, and the AI writes the test from it."
            action={
              <Button variant="primary" leftIcon={<CircleDot size={15} />} onClick={start}>
                Start recording
              </Button>
            }
          />
        </Card>
      )}

      {captured.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title={phase === 'recording' ? 'Recording…' : `${captured.length} actions captured`}
            subtitle="Every click, with the screen it touched. Pauses and mis-clicks are kept here and removed by the AI."
            actions={
              phase === 'captured' ? (
                <Button variant="ai" leftIcon={<Sparkles size={15} />} onClick={convert}>
                  Turn into a test with AI
                </Button>
              ) : undefined
            }
          />
          <CardBody className="space-y-2">
            {captured.map((a) => (
              <div
                key={a.n}
                className={cn(
                  'flex items-center gap-3 rounded-md border px-3 py-2',
                  a.kind === 'action' ? 'border-line' : 'border-accent/40 bg-accent-soft/40',
                )}
              >
                <span className="w-10 shrink-0 font-mono text-[11px] text-subtle">{a.at}</span>
                <span className="min-w-0 flex-1 text-sm text-text">{a.action}</span>
                <Badge tone={a.kind === 'action' ? 'neutral' : 'warning'}>
                  {a.kind === 'action' ? 'action' : a.kind === 'wait' ? 'wait' : 'mis-click'}
                </Badge>
                <StepScreenshot screen={{ ...a.screen, system }} className="hidden sm:block" />
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {(phase === 'converting' || phase === 'converted') && (
        <Card className="mb-4" tone="ai">
          <CardHeader
            title="Scenario Writer agent"
            subtitle="Cleaning the recording up into a test that can run on its own."
          />
          <CardBody className="space-y-3">
            <LiveLog lines={CONVERSION_LOG} running={phase === 'converting'} height={160} />
            {phase === 'converted' && (
              <>
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface2/60 px-3 py-2.5 text-sm">
                  <span className="font-mono text-text">{RECORDED_ACTIONS.length} recorded actions</span>
                  <span className="text-subtle">→</span>
                  <span className="font-mono text-success">{RECORDED_SCENARIO.steps.length} test steps</span>
                  <span className="text-xs text-muted">
                    {RECORDED_ACTIONS.length - kept} pauses and mis-clicks removed, 2 checks added
                  </span>
                  <Badge tone="warning" className="ml-auto">
                    Pending approval
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={() => navigate(`/studio?scenario=${RECORDED_SCENARIO.id}`)}>
                    Open {RECORDED_SCENARIO.id} in Scenarios
                  </Button>
                  <Button leftIcon={<Play size={15} />} onClick={() => navigate('/run?demo=1')}>
                    Play back in the Run Centre
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Recordings" subtitle="What has been recorded so far, and what became of it." />
        <DataTable
          rows={appState.recordings}
          rowKey={(r) => r.id}
          onRowClick={(r) =>
            r.scenarioId
              ? navigate(`/studio?scenario=${r.scenarioId}`)
              : toast({
                  title: `${r.id} has not been turned into a test yet`,
                  description: 'Record it again here, or convert it with the AI.',
                  tone: 'info',
                })
          }
          columns={[
            { key: 'id', header: 'Recording', mono: true, width: 110 },
            { key: 'name', header: 'What was recorded' },
            { key: 'role', header: 'Role', width: 150 },
            { key: 'workflow', header: 'Workflow', width: 220 },
            { key: 'system', header: 'System', width: 180 },
            { key: 'date', header: 'Recorded', width: 120 },
            { key: 'steps', header: 'Actions', align: 'right', mono: true, width: 90 },
            {
              key: 'status',
              header: 'Status',
              width: 120,
              render: (r) => (
                <Badge tone={r.status === 'Approved' ? 'success' : r.status === 'Converted' ? 'info' : 'neutral'}>
                  {r.status}
                </Badge>
              ),
            },
          ]}
          empty="No recordings yet. Press Start recording above."
        />
        <SourceNote
          title="Where a recorded test comes from"
          reads={[
            { label: 'Key-user recording', note: 'every click, with the screen it touched' },
            { label: 'Process Ontology', route: '/ontology', note: 'the stage and the rule it belongs to' },
          ]}
          computes="removes waits and mis-clicks, swaps typed values for test data, and adds the checks the rule needs"
          feeds={[
            { label: 'Scenarios', route: '/studio' },
            { label: 'Run Centre', route: '/run' },
          ]}
          steps={[
            'A key user does the work once while the factory watches.',
            'Pauses and mis-clicks are stripped out, because a test should not repeat them.',
            'Typed values become test-data placeholders, so the test can run against generated records.',
            'Checks are added from the rule the stage has to prove, and a key user approves the result.',
          ]}
        />
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Master data check                                                          */
/* -------------------------------------------------------------------------- */

export function MasterDataPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const version = useSimVersion()
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [cleanCopies, setCleanCopies] = useState<string[]>([])

  /** The vehicle master really is out of date in the plant, so this part is live. */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live = useMemo(() => {
    const db = engine.db
    const byVehicle = new Map<string, { stored: number; weighed: number[]; gatePass: string }>()
    db.weighbridge_ticket.forEach((t) => {
      if (t.unit !== 'kg') return
      const row = byVehicle.get(t.vehicle) ?? { stored: t.registered_tare_kg, weighed: [], gatePass: t.gate_pass }
      row.stored = t.registered_tare_kg
      row.weighed.push(t.tare_kg)
      row.gatePass = t.gate_pass
      byVehicle.set(t.vehicle, row)
    })

    const problems: MasterDataProblem[] = []
    byVehicle.forEach((row, vehicle) => {
      const average = Math.round(row.weighed.reduce((a, b) => a + b, 0) / row.weighed.length)
      const drift = Math.abs(row.stored - average)
      if (drift <= 500) return
      problems.push({
        id: `MD-${vehicle}`,
        objectType: 'Vehicle',
        object: vehicle,
        system: 'YardLink',
        problem: `Stored empty weight ${num(row.stored)} kg, last weighed ${num(average)} kg — ${num(drift)} kg out.`,
        risk: drift > 1000 ? 'High' : 'Medium',
        fix: 'Re-weigh the vehicle empty and update the vehicle master, so a message that uses the stored weight is still right.',
        live: true,
        traceKey: row.gatePass,
      })
    })

    return {
      problems: problems.sort((a, b) => (a.risk === b.risk ? 0 : a.risk === 'High' ? -1 : 1)),
      vehicles: byVehicle.size,
      vendors: db.EKPO.length ? new Set(db.EKPO.map((e) => e.vendor)).size : 0,
      orders: db.EKPO.length,
      materials: new Set(db.scrap_batch.map((b) => b.grade)).size,
    }
  }, [version])

  const problems = [...live.problems, ...SAMPLE_PROBLEMS]
  const scanned = live.vehicles + live.vendors + live.orders + live.materials
  const cleanPct = scanned ? Math.max(0, Math.round(((scanned - problems.length) / scanned) * 100)) : 100
  const byType = (['Vehicle', 'Vendor', 'Purchase order', 'Material'] as const).map((t) => ({
    type: t,
    count: problems.filter((p) => p.objectType === t).length,
  }))

  const scan = () => {
    setPhase('scanning')
    window.setTimeout(() => setPhase('done'), SCAN_LOG.length * 420 + 200)
  }

  return (
    <>
      <PageHeader
        title="Master Data Check"
        subtitle="Bad master data makes a good test fail for the wrong reason. This finds it before the tests run."
        tabs={TABS}
        actions={
          <Button variant="ai" leftIcon={<Search size={15} />} loading={phase === 'scanning'} onClick={scan}>
            {phase === 'done' ? 'Scan again' : 'Scan master data'}
          </Button>
        }
      />

      {phase === 'idle' ? (
        <Card>
          <EmptyState
            icon={<Database size={28} />}
            title="Nothing scanned yet"
            description="The scan reads the vehicle master, the vendors, the purchase orders and the materials, and lists anything that would make a test fail for the wrong reason."
            action={
              <Button variant="ai" leftIcon={<Search size={15} />} onClick={scan}>
                Scan master data
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mb-4" tone="ai">
            <CardHeader title="Master Data agent" subtitle="Reading the master records behind the tests." />
            <CardBody>
              <LiveLog lines={SCAN_LOG} running={phase === 'scanning'} height={150} />
            </CardBody>
          </Card>

          {phase === 'done' && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatTile
                  label="Records scanned"
                  value={num(scanned)}
                  hint={`${num(live.vehicles)} vehicles · ${num(live.vendors)} vendors · ${num(live.orders)} orders · ${num(live.materials)} materials`}
                />
                <StatTile
                  label="Clean"
                  value={`${cleanPct} %`}
                  tone={cleanPct >= 90 ? 'success' : cleanPct >= 70 ? 'warning' : 'danger'}
                  hint={`${num(problems.length)} records need attention`}
                />
                <StatTile
                  label="High risk"
                  value={num(problems.filter((p) => p.risk === 'High').length)}
                  tone={problems.some((p) => p.risk === 'High') ? 'danger' : 'success'}
                  hint="would break a test or a booking"
                />
                <StatTile
                  label="Clean copies prepared"
                  value={num(cleanCopies.length)}
                  tone={cleanCopies.length ? 'info' : 'neutral'}
                  hint="ready for the test environment"
                  onClick={() => navigate('/test-data')}
                />
              </div>

              <Card className="mb-4">
                <CardHeader
                  title="Problems by type"
                  subtitle="Where the bad records sit."
                  actions={<Badge tone="neutral">{num(problems.length)} in total</Badge>}
                />
                <CardBody className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {byType.map((t) => (
                    <div key={t.type} className="rounded-md border border-line px-3 py-2">
                      <div className="text-label font-semibold uppercase text-subtle">{t.type}</div>
                      <div className="font-mono text-lg font-semibold text-text">{num(t.count)}</div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="What the scan found"
                  subtitle="Live rows come from the running plant. Rows marked sample are authored for the demo."
                />
                <DataTable
                  rows={problems}
                  rowKey={(p) => p.id}
                  maxHeight={520}
                  rowTone={(p) => (p.risk === 'High' ? 'danger' : p.risk === 'Medium' ? 'warning' : undefined)}
                  columns={[
                    {
                      key: 'object',
                      header: 'Object',
                      width: 190,
                      render: (p) => (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[12.5px] text-text">{p.object}</span>
                          {!p.live && <Badge tone="neutral">sample</Badge>}
                          {cleanCopies.includes(p.id) && <Badge tone="info">clean copy ready</Badge>}
                        </span>
                      ),
                    },
                    { key: 'objectType', header: 'Type', width: 120 },
                    { key: 'system', header: 'System', width: 180 },
                    { key: 'problem', header: 'Problem' },
                    {
                      key: 'risk',
                      header: 'Risk',
                      width: 100,
                      render: (p) => (
                        <Badge tone={p.risk === 'High' ? 'danger' : p.risk === 'Medium' ? 'warning' : 'neutral'}>
                          {p.risk}
                        </Badge>
                      ),
                    },
                    { key: 'fix', header: 'Suggested fix', render: (p) => <span className="text-xs text-muted">{p.fix}</span> },
                    {
                      key: 'actions',
                      header: '',
                      sortable: false,
                      width: 210,
                      render: (p) => (
                        <span className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (cleanCopies.includes(p.id)) {
                                toast({ title: `A clean copy of ${p.object} is already prepared`, tone: 'info' })
                                return
                              }
                              setCleanCopies((c) => [...c, p.id])
                              toast({
                                title: `Clean copy of ${p.object} prepared`,
                                description: 'It will be used in the test environment instead of the broken record.',
                                tone: 'success',
                                action: { label: 'Open Test Data', onClick: () => navigate('/test-data') },
                              })
                            }}
                          >
                            Use clean copy
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={(e) => {
                              e.stopPropagation()
                              const id = store.addFinding({
                                title: `Master data: ${p.object} — ${p.problem}`,
                                severity: p.risk === 'High' ? 'High' : 'Medium',
                                status: 'Open',
                                process: p.objectType === 'Vehicle' ? 'P1' : 'P3',
                                stage: 'Master data',
                                system: p.system,
                                raised: new Date().toLocaleString('en-GB'),
                                raisedBy: 'Master Data agent',
                                detail: `${p.problem} ${p.fix}`,
                                evidence: ['Master data scan', p.live ? 'Live plant records' : 'Sample record'],
                                affectedKeys: p.traceKey ? [p.traceKey] : [],
                              })
                              toast({
                                title: `Finding ${id} raised`,
                                description: `${p.object} is now in the findings list.`,
                                tone: 'warning',
                                action: { label: 'Open it', onClick: () => navigate(`/finding/${id}`) },
                              })
                            }}
                          >
                            Raise finding
                          </Button>
                        </span>
                      ),
                    },
                  ]}
                  empty="Nothing to fix. Every master record the scan read is usable."
                />
                <SourceNote
                  title="How the scan works"
                  reads={[
                    { table: 'weighbridge_ticket', note: 'the weights actually measured' },
                    { table: 'EKPO', note: 'vendors and purchase orders' },
                    { table: 'scrap_batch', note: 'the materials in use' },
                  ]}
                  computes="compares each stored master record against what the plant has recently recorded against it"
                  feeds={[
                    { label: 'Test Data', route: '/test-data' },
                    { label: 'Findings', route: '/run' },
                  ]}
                  steps={[
                    'The vehicle master is compared against the last weighings for that vehicle.',
                    'Anything more than 500 kg out is reported, because a message that uses the stored weight would be wrong.',
                    'Vendors, orders and materials are checked for missing fields and duplicates.',
                    'A clean copy can be prepared for the test environment without touching the real record.',
                  ]}
                />
              </Card>
            </>
          )}
        </>
      )}
    </>
  )
}
