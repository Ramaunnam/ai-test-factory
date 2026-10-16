import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Database, Play, Sparkles, X } from 'lucide-react'
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
  LiveLog,
  SectionTitle,
  Select,
  StatTile,
  Switch,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { PROCESSES, SCENARIOS, type Scenario } from '@/data'
import { store, useStore } from '@/data/appStore'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'
import { num } from '@/lib/format'

const TABS = [
  { label: 'Scenarios', path: '/studio' },
  { label: 'Test Data', path: '/test-data' },
]

const GENERATED: Scenario[] = [
  {
    id: 'SC-031',
    name: 'Weighbridge message without a unit is rejected',
    process: 'P1',
    stageId: 'P1-S2',
    type: 'Negative',
    requirement: 'R5',
    systems: ['Yard Management', 'SAP S/4HANA – Steel'],
    lastResult: 'Not run',
    steps: [
      { n: 1, text: 'Send a weighbridge ticket with the unit field empty', technical: "payload.unit = ''", system: 'Yard Management' },
      { n: 2, text: 'Expect SAP to refuse the message rather than guess', technical: 'expect(response.status).toBe(422)', system: 'SAP S/4HANA – Steel' },
      { n: 3, text: 'Expect no goods receipt to exist for that gate pass', technical: 'expect(mseg).toHaveLength(0)', system: 'SAP S/4HANA – Steel' },
    ],
  },
  {
    id: 'SC-032',
    name: 'Quantity below one tonne is challenged before posting',
    process: 'P1',
    stageId: 'P1-S2',
    type: 'Negative',
    requirement: 'R5',
    systems: ['SAP S/4HANA – Steel'],
    lastResult: 'Not run',
    steps: [
      { n: 1, text: 'Post a goods receipt of 21.92 KG against a 24 t purchase order', technical: 'sap.post(gr, 21.92)', system: 'SAP S/4HANA – Steel' },
      { n: 2, text: 'Expect a plausibility warning before the document is created', technical: "expect(message).toContain('plausibility')", system: 'SAP S/4HANA – Steel' },
    ],
  },
  {
    id: 'SC-033',
    name: 'Chemistry rule: molybdenum present for every 316L batch',
    process: 'P2',
    stageId: 'P2-S3',
    type: 'Regression',
    requirement: 'R2',
    systems: ['Laboratory app', 'Scrap Yard Operations'],
    lastResult: 'Not run',
    steps: [
      { n: 1, text: 'Read every batch of grade SCR-316L-SOLID from the last 24 hours', technical: "select * from scrap_batch where grade = 'SCR-316L-SOLID'", system: 'Scrap Yard Operations' },
      { n: 2, text: 'Join the chemistry record for each batch', technical: 'join chemistry on chemistry.batch = scrap_batch.batch', system: 'Scrap Yard Operations' },
      { n: 3, text: 'Expect molybdenum to be present and within the grade window', technical: 'expect(mo_pct).toBeGreaterThan(1.8)', system: 'Scrap Yard Operations' },
    ],
  },
]

export function StudioPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const drawer = useDrawer()
  const appState = useStore()
  const { def } = useRole()
  const [params, setParams] = useSearchParams()
  const [processId, setProcessId] = useState('P1')
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [generated, setGenerated] = useState<Scenario[]>([])
  const [rule, setRule] = useState(false)

  const all = useMemo(() => [...generated, ...SCENARIOS], [generated])
  const forProcess = all.filter((s) => s.process === processId)

  const lines = [
    `Reading the ontology for ${processId} and its five stages…`,
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
      <PageHeader
        title="Test Studio"
        subtitle="Scenarios are written from the ontology and the live data, then approved by a key user before they run."
        tabs={TABS}
        actions={
          <Button
            variant="ai"
            leftIcon={<Sparkles size={15} />}
            loading={phase === 'running'}
            onClick={() => {
              setPhase('running')
              window.setTimeout(() => {
                setGenerated(GENERATED)
                GENERATED.forEach((g) => store.setScenarioStatus(g.id, 'Pending approval'))
                setPhase('done')
                toast({
                  title: '3 scenarios generated',
                  description: 'They are pending your approval.',
                  tone: 'info',
                  action: { label: 'Open approvals', onClick: () => navigate('/approvals') },
                })
              }, lines.length * 420 + 200)
            }}
          >
            Generate scenarios with AI
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3">
          <span className="text-label font-semibold uppercase text-subtle">Workflow</span>
          {PROCESSES.map((p) => (
            <Chip key={p.id} selected={p.id === processId} onClick={() => setProcessId(p.id)}>
              {p.id} · {p.name}
            </Chip>
          ))}
        </CardBody>
      </Card>

      {phase !== 'idle' && (
        <Card className="mb-4" tone="ai">
          <CardHeader title="Scenario Writer agent" subtitle="Reading the ontology, the failing checks and the change feed." />
          <CardBody>
            <LiveLog lines={lines} running={phase === 'running'} height={150} />
          </CardBody>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Scenarios for this workflow" value={num(forProcess.length)} />
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
              detail: `${num(20 + (i % 9) * 2)} t at € ${num(1850 + (i % 5) * 90)}/t`,
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
