import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  Boxes,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Flame,
  FlaskConical,
  Inbox,
  Layers,
  PackageCheck,
  Play,
  Printer,
  ReceiptText,
  Scale,
  Ticket,
  Truck,
  Warehouse,
  Workflow as WorkflowIcon,
  type LucideIcon,
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
  SectionTitle,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import {
  JOURNEY_REQUIREMENTS,
  coveredRequirementCount,
  screensForRequirement,
  stepsCovering,
} from '@/data/journey'
import { HealthLegend, WorkflowFlow } from '@/components/domain/WorkflowFlow'
import { AGENTS, PROCESSES, SCENARIOS, processById } from '@/data'
import { SourceNote } from '@/components/domain/SourceNote'
import { TABLE_LABEL, tableCount, tableRoute } from '@/lib/live'
import {
  BUSINESS_OBJECTS,
  OBJECT_BANDS,
  OBJECT_LINKS,
  neighboursOf,
  objectById,
  type BusinessObject,
  type ObjStatus,
} from '@/data/objects'
import { engine } from '@/sim/engine'
import { useSimVersion } from '@/sim/useSim'
import type { TableName } from '@/sim/types'
import { useStore } from '@/data/appStore'
import { useThemeTokens } from '@/lib/useThemeTokens'
import { num } from '@/lib/format'
import { useToast } from '@/providers/ToastProvider'

const TABS = [
  { label: 'Workflows', path: '/ontology' },
  { label: 'Business Objects', path: '/ontology/objects' },
  { label: 'AI Agents', path: '/ontology/agents' },
  { label: 'Requirement Coverage', path: '/coverage' },
]

/* -------------------------------------------------------------------------- */
/* Workflows                                                                  */
/* -------------------------------------------------------------------------- */

export function OntologyPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const store = useStore()
  const [params, setParams] = useSearchParams()

  const processId = params.get('process') ?? 'P1'
  const process = processById(processId) ?? PROCESSES[0]
  const stageId = params.get('stage')
  const stage = process.stages.find((s) => s.id === stageId)

  const select = (p: string, s?: string) => setParams(s ? { process: p, stage: s } : { process: p })

  const stageScenarios = stage ? SCENARIOS.filter((sc) => sc.stageId === stage.id) : []
  const stageFindings = stage
    ? store.findings.filter((f) => f.status !== 'Closed' && f.stage === stage.name)
    : []

  return (
    <>
      <PageHeader
        title="Process Ontology"
        subtitle="Every workflow written down once: who does it, in which system, against which rule, proven by which test."
        tabs={TABS}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PROCESSES.map((p) => {
          const active = p.id === process.id
          const issues = p.stages.filter((s) => s.health === 'issue').length
          return (
            <Card key={p.id} interactive tone={active ? 'ai' : 'default'} onClick={() => select(p.id)}>
              <CardBody className="py-3.5">
                <div className="flex items-start gap-2">
                  <WorkflowIcon size={16} className={cn('mt-0.5 shrink-0', active ? 'text-ai' : 'text-subtle')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-subtle">{p.id}</span>
                      {issues > 0 && <Badge tone="danger">{issues} issues</Badge>}
                    </div>
                    <div className="truncate text-sm font-medium text-text">{p.name}</div>
                    <div className="truncate text-xs text-muted">{p.summary}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <Card className="mb-4">
        <CardHeader
          title={`${process.id} · ${process.name}`}
          subtitle={`${process.stages.length} stages · owned by ${process.owner}`}
          actions={<HealthLegend />}
        />
        <CardBody className="pt-4">
          <WorkflowFlow process={process} selectedStageId={stage?.id} onStageClick={(id) => select(process.id, id)} />
        </CardBody>
      </Card>

      <Card className="mb-4">
          <CardHeader title="Stage by stage" subtitle="Who does it, how, in which system, against which rule, and how much data it holds today." />
          <DataTable
            rows={process.stages}
            rowKey={(s) => s.id}
            onRowClick={(s) => select(process.id, s.id)}
            columns={[
              { key: 'name', header: 'Stage', width: 170, render: (s) => <span className="font-medium text-text">{s.name}</span> },
              { key: 'who', header: 'Who', width: 150 },
              { key: 'sop', header: 'How it is done', render: (s) => (
                <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted">
                  {s.sop.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              ) },
              { key: 'system', header: 'System', width: 170 },
              { key: 'data', header: 'Data', width: 150, mono: true },
              { key: 'rule', header: 'Rule tested', render: (s) => <span className="text-xs text-muted">{s.rule}</span> },
              { key: 'agents', header: 'AI agents', width: 170, render: (s) => (
                <span className="flex flex-wrap gap-1">
                  {s.agents.map((a) => (
                    <Badge key={a} tone="ai">
                      {a}
                    </Badge>
                  ))}
                </span>
              ) },
              { key: 'tests', header: 'Tests', align: 'right', mono: true, width: 80 },
              {
                key: 'live',
                header: 'Live rows',
                align: 'right',
                width: 110,
                render: (s) => {
                  const tables = s.data.split(', ').filter((d): d is TableName => d in TABLE_LABEL)
                  if (!tables.length) return <span className="text-subtle">not simulated</span>
                  const total = tables.reduce((n, t) => n + tableCount(t), 0)
                  return (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(tableRoute(tables[0]))
                      }}
                      className="font-mono text-[12.5px] text-primary hover:underline"
                      title={tables.map((t) => TABLE_LABEL[t]).join(', ')}
                    >
                      {num(total)}
                    </button>
                  )
                },
                value: (s) =>
                  s.data
                    .split(', ')
                    .filter((d): d is TableName => d in TABLE_LABEL)
                    .reduce((n, t) => n + tableCount(t), 0),
              },
            ]}
          />
          <SourceNote
            title="Where the ontology comes from"
            reads={[
              { label: 'Process Discovery', route: '/discovery', note: 'recordings, the plant log and the procedures' },
              { table: 'gate_pass', note: 'the live tables each stage writes to' },
            ]}
            computes="one row per stage: who does it, in which system, against which rule, proven by which test"
            feeds={[{ label: 'Test Studio', route: '/studio' }, { label: 'Change Impact', route: '/regression' }]}
            steps={[
              'Discovery produces the stages and the order they happen in.',
              'Each stage is tied to the system and the tables it writes to, so the live row count is real.',
              'The rule column is what a test must prove for that stage.',
              'Change Impact uses the same map to work out what a change touches.',
            ]}
          />
      </Card>

      {stage && (
        <Card tone="ai">
          <CardHeader
            title={`${stage.name}`}
            subtitle={`${stage.who} · ${stage.system} · rule: ${stage.rule}`}
            actions={
              <Button
                variant="ai"
                leftIcon={<Play size={15} />}
                onClick={() => {
                  toast({ title: `Queued ${stageScenarios.length || 1} scenarios for ${stage.name}`, tone: 'info' })
                  navigate('/run?stage=' + stage.id)
                }}
              >
                Test this stage
              </Button>
            }
          />
          <CardBody className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-label font-semibold uppercase text-subtle">Scenarios covering it</div>
              {stageScenarios.length === 0 && <p className="text-xs text-muted">No scenario is tied to this stage yet.</p>}
              <div className="space-y-1.5">
                {stageScenarios.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => navigate(`/studio?scenario=${sc.id}`)}
                    className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface2"
                  >
                    <span className="font-mono text-subtle">{sc.id}</span>
                    <span className="min-w-0 flex-1 truncate text-text">{sc.name}</span>
                    <Badge tone={sc.lastResult === 'Pass' ? 'success' : sc.lastResult === 'Fail' ? 'danger' : sc.lastResult === 'Healed' ? 'warning' : 'neutral'}>
                      {sc.lastResult}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-label font-semibold uppercase text-subtle">Open issues here</div>
              {stageFindings.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 size={14} /> Nothing open at this stage.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {stageFindings.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => navigate(`/finding/${f.id}`)}
                      className="flex w-full items-center gap-2 rounded-md border border-danger/40 bg-danger-soft/40 px-3 py-1.5 text-left text-xs transition-colors hover:brightness-105"
                    >
                      <CircleAlert size={13} className="shrink-0 text-danger" />
                      <span className="font-mono text-subtle">{f.id}</span>
                      <span className="min-w-0 flex-1 truncate text-text">{f.title}</span>
                      <Badge tone="danger">{f.severity}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* AI agents                                                                  */
/* -------------------------------------------------------------------------- */

export function AgentsPage() {
  const navigate = useNavigate()
  const groups = ['Build', 'Run', 'Govern'] as const

  return (
    <>
      <PageHeader
        title="AI Agents"
        subtitle="Eleven agents. Each one reads something, produces something, and works on a screen you can open."
        tabs={TABS}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Agents" value={num(AGENTS.length)} />
        <StatTile label="Build" value={num(AGENTS.filter((a) => a.group === 'Build').length)} tone="ai" />
        <StatTile label="Run" value={num(AGENTS.filter((a) => a.group === 'Run').length)} tone="info" />
        <StatTile label="Govern" value={num(AGENTS.filter((a) => a.group === 'Govern').length)} tone="primary" />
      </div>

      {groups.map((g) => (
        <div key={g} className="mb-5">
          <SectionTitle title={g} hint={g === 'Build' ? 'Turn knowledge into tests' : g === 'Run' ? 'Execute and watch' : 'Prove and control'} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {AGENTS.filter((a) => a.group === g).map((a) => (
              <Card key={a.id} interactive onClick={() => navigate(a.route)}>
                <CardBody>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone="ai">{a.id}</Badge>
                    <span className="text-sm font-semibold text-text">{a.name}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-subtle">reads</span>
                      <span className="text-muted">{a.reads}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-subtle">produces</span>
                      <span className="text-muted">{a.produces}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="w-16 shrink-0 text-subtle">works on</span>
                      <span className="font-medium text-primary">{a.worksOn}</span>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Requirement coverage                                                       */
/* -------------------------------------------------------------------------- */

export function CoveragePage() {
  const navigate = useNavigate()
  const core = JOURNEY_REQUIREMENTS.filter((r) => r.group === 'Core').length
  const covered = coveredRequirementCount()

  return (
    <>
      <PageHeader
        title="Requirement Coverage"
        subtitle="The ten requirements you set, the journey steps that cover each one, and the screen that proves it."
        tabs={TABS}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Requirements" value={num(JOURNEY_REQUIREMENTS.length)} />
        <StatTile label="Core" value={num(core)} tone="primary" />
        <StatTile label="Advanced" value={num(JOURNEY_REQUIREMENTS.length - core)} tone="info" />
        <StatTile
          label="Covered by a journey step"
          value={num(covered)}
          tone={covered === JOURNEY_REQUIREMENTS.length ? 'success' : 'warning'}
          onClick={() => navigate('/journey')}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {JOURNEY_REQUIREMENTS.map((r) => {
          const steps = stepsCovering(r.id)
          const screens = screensForRequirement(r.id)
          return (
            <Card key={r.id} tone={steps.length ? 'success' : 'warning'}>
              <CardBody>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={steps.length ? 'success' : 'warning'} mono>
                    {r.id}
                  </Badge>
                  <span className="text-sm font-medium text-text">{r.short}</span>
                  <Badge tone={r.group === 'Core' ? 'primary' : 'info'} className="ml-auto">
                    {r.group}
                  </Badge>
                </div>
                <p className="mb-2 text-xs text-muted">{r.full}</p>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-label font-semibold uppercase text-subtle">Covered by</span>
                  {steps.length === 0 ? (
                    <span className="text-xs text-muted">no journey step yet</span>
                  ) : (
                    steps.map((n) => (
                      <Chip key={n} onClick={() => navigate(`/journey?step=${n}`)}>
                        Step {n}
                      </Chip>
                    ))
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-label font-semibold uppercase text-subtle">Proven on</span>
                  {screens.map((sc) => (
                    <Chip key={sc.route} onClick={() => navigate(sc.route)}>
                      {sc.label}
                    </Chip>
                  ))}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      <SourceNote
        title="Where this list comes from"
        reads={[{ label: 'The Testing Journey', route: '/journey', note: 'the same ten requirements and the same screens' }]}
        computes="reads each journey step, collects the requirements it covers and the screen each one opens"
        feeds={[{ label: 'Testing Journey', route: '/journey' }]}
        steps={[
          'The requirements are the ones you set: six core and four advanced.',
          'A step covers a requirement when it says so, in one sentence, on the Testing Journey.',
          'A requirement opens the screen named against it, or the step\u2019s own screen when it names none.',
          'Nothing here is kept in a second place, so the two pages can never disagree.',
        ]}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Business objects                                                           */
/* -------------------------------------------------------------------------- */

const OBJECT_ICONS: Record<string, LucideIcon> = {
  Truck,
  Ticket,
  Scale,
  Building2,
  FileText,
  PackageCheck,
  ReceiptText,
  Banknote,
  Printer,
  Inbox,
  Boxes,
  FlaskConical,
  BadgeCheck,
  Warehouse,
  ArrowLeftRight,
  Flame,
  ClipboardCheck,
  Layers,
}

function StatusDot({ status }: { status: ObjStatus }) {
  return (
    <span
      title={status}
      className={cn('inline-block h-2 w-2 shrink-0 rounded-full', status === 'Confirmed' ? 'bg-success' : 'bg-accent')}
    />
  )
}

/** Rows held right now for an object, counted from the running plant. */
function useLiveRows(): Record<string, number> {
  const version = useSimVersion()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const db = engine.db
    const out: Record<string, number> = {}
    BUSINESS_OBJECTS.forEach((o) => {
      if (o.source.table) out[o.id] = tableCount(o.source.table)
    })
    out.vehicle = new Set(db.gate_pass.map((g) => g.vehicle)).size
    out.vendor = new Set(db.EKPO.map((e) => e.vendor)).size
    out.material = new Set(db.scrap_batch.map((b) => b.grade)).size
    return out
  }, [version])
}

export function BusinessObjectsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rows = useLiveRows()
  const selectedId = params.get('object') ?? BUSINESS_OBJECTS[0].id
  const object = objectById(selectedId) ?? BUSINESS_OBJECTS[0]
  const select = (id: string) => setParams({ object: id }, { replace: true })

  const toConfirm = BUSINESS_OBJECTS.filter((o) => o.status === 'To confirm').length

  return (
    <>
      <PageHeader
        title="Process Ontology"
        subtitle="The objects the landscape keeps, what each one is made of, and how they join up."
        tabs={TABS}
        actions={
          <Badge tone={toConfirm ? 'warning' : 'success'}>
            {toConfirm} of {BUSINESS_OBJECTS.length} still to confirm
          </Badge>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ------------------------------------------------------- the list */}
        <Card className="self-start">
          <CardHeader title="Business objects" />
          <CardBody className="max-h-[720px] space-y-0.5 overflow-y-auto p-2 j2w-scroll">
            {BUSINESS_OBJECTS.map((o) => {
              const Icon = OBJECT_ICONS[o.icon] ?? Boxes
              const active = o.id === object.id
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => select(o.id)}
                  className={cn(
                    'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors',
                    active ? 'bg-primary-soft text-text' : 'hover:bg-surface2',
                  )}
                >
                  <Icon size={15} className={cn('mt-0.5 shrink-0', active ? 'text-primary' : 'text-subtle')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{o.name}</span>
                    <span className="block truncate text-[11px] text-muted">{o.grain}</span>
                  </span>
                  <StatusDot status={o.status} />
                </button>
              )
            })}
          </CardBody>
        </Card>

        {/* ----------------------------------------------------- the detail */}
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader
              title={object.name}
              subtitle={object.what}
              actions={
                <span className="flex items-center gap-2">
                  <Badge tone="neutral" mono>
                    {object.technicalId}
                  </Badge>
                  <Badge tone={object.status === 'Confirmed' ? 'success' : 'warning'}>{object.status}</Badge>
                </span>
              }
            />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
                <div className="text-label font-semibold uppercase text-subtle">Grain</div>
                <div className="mt-0.5 text-sm text-text">{object.grain}</div>
              </div>
              <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
                <div className="text-label font-semibold uppercase text-subtle">Primary key</div>
                <div className="mt-0.5 font-mono text-sm text-text">{object.primaryKey}</div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Properties" actions={<Badge tone="neutral">{object.properties.length} fields</Badge>} />
            <DataTable
              rows={object.properties}
              rowKey={(f) => f.name}
              dense
              rowTone={(f) => (f.status === 'To confirm' ? 'warning' : undefined)}
              columns={[
                {
                  key: 'name',
                  header: 'Field',
                  width: 200,
                  render: (f) => (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[12px] text-text">{f.name}</span>
                      {f.key && <Badge tone={f.key === 'PK' ? 'primary' : 'neutral'}>{f.key}</Badge>}
                    </span>
                  ),
                },
                { key: 'means', header: 'What it means' },
                { key: 'from', header: 'Comes from', width: 250, mono: true },
                { key: 'type', header: 'Type', width: 90 },
                {
                  key: 'status',
                  header: '',
                  width: 40,
                  sortable: false,
                  render: (f) => <StatusDot status={f.status} />,
                },
              ]}
              empty="No fields recorded."
            />
          </Card>

          <Card>
            <CardHeader title="Connected to" subtitle="Press a neighbour to open it." />
            <CardBody>
              <NeighbourGraph object={object} onSelect={select} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Where the data comes from" />
            <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Fact label="System" value={object.source.system} />
              <Fact label="Table" value={object.source.table ? TABLE_LABEL[object.source.table] : 'no table of its own'} mono />
              <Fact
                label="Interface"
                value={object.source.interfaceId ?? 'none'}
                mono
                onClick={object.source.interfaceId ? () => navigate(`/interfaces?interface=${object.source.interfaceId}`) : undefined}
              />
              <Fact label="Live rows now" value={num(rows[object.id] ?? 0)} mono />
              <Fact label="Refresh" value={object.source.refresh} />
              <div className="rounded-md border border-line bg-surface2/60 px-3 py-2">
                <div className="text-label font-semibold uppercase text-subtle">Checks that guard it</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {object.source.checks.length === 0 ? (
                    <span className="text-xs text-muted">none</span>
                  ) : (
                    object.source.checks.map((c) => (
                      <Chip key={c} onClick={() => navigate('/flow/checks')}>
                        {c}
                      </Chip>
                    ))
                  )}
                  <Badge tone={object.source.status === 'Confirmed' ? 'success' : 'warning'} className="ml-auto">
                    {object.source.status}
                  </Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="How everything connects"
          subtitle="Hover an object to pick out its links. Press one to open it above."
        />
        <div className="j2w-scroll overflow-x-auto p-3">
          <ObjectMap selectedId={object.id} onSelect={select} />
        </div>
      </Card>
    </>
  )
}

function Fact({
  label,
  value,
  mono,
  onClick,
}: {
  label: string
  value: string
  mono?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="text-label font-semibold uppercase text-subtle">{label}</div>
      <div className={cn('mt-0.5 truncate text-sm text-text', mono && 'font-mono text-[12.5px]')}>{value}</div>
    </>
  )
  if (!onClick) return <div className="min-w-0 rounded-md border border-line bg-surface2/60 px-3 py-2">{body}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-md border border-line bg-surface2/60 px-3 py-2 text-left transition-colors hover:bg-surface2"
    >
      {body}
    </button>
  )
}

/** The selected object in the middle, everything joined to it around the edge. */
function NeighbourGraph({ object, onSelect }: { object: BusinessObject; onSelect: (id: string) => void }) {
  const t = useThemeTokens()
  const list = neighboursOf(object.id)
  const W = 860
  const H = Math.max(210, 120 + list.length * 22)
  const cx = W / 2
  const cy = H / 2
  const rx = W / 2 - 110
  const ry = H / 2 - 34

  if (!list.length) return <p className="text-sm text-muted">Nothing joins to this object yet.</p>

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="min-w-[640px]">
      {list.map((n, i) => {
        const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(angle) * rx
        const y = cy + Math.sin(angle) * ry
        const mx = (cx + x) / 2
        const my = (cy + y) / 2
        return (
          <g key={n.link.from + n.link.to + n.other.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={t.line} strokeWidth={1.4} />
            <rect x={mx - 48} y={my - 9} width={96} height={18} rx={9} fill={t.surface} stroke={t.line} />
            <text x={mx} y={my + 4} fontSize={8.5} textAnchor="middle" fill={t.muted}>
              {n.outgoing ? n.link.label : `${n.link.label} ←`}
            </text>
            <text x={mx} y={my + 17} fontSize={8} textAnchor="middle" fill={t.subtle} fontFamily="JetBrains Mono, monospace">
              {n.link.cardinality}
            </text>
            <g className="cursor-pointer" onClick={() => onSelect(n.other.id)}>
              <rect
                x={x - 62}
                y={y - 15}
                width={124}
                height={30}
                rx={8}
                fill={t.surface}
                stroke={n.other.status === 'Confirmed' ? t['line-strong'] : t.accent}
              />
              <text x={x} y={y + 4} fontSize={10.5} textAnchor="middle" fill={t.text}>
                {n.other.name.length > 18 ? `${n.other.name.slice(0, 17)}…` : n.other.name}
              </text>
            </g>
          </g>
        )
      })}
      <rect x={cx - 70} y={cy - 17} width={140} height={34} rx={9} fill={t['primary-soft']} stroke={t.primary} strokeWidth={1.6} />
      <text x={cx} y={cy + 5} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={t.primary}>
        {object.name.length > 20 ? `${object.name.slice(0, 19)}…` : object.name}
      </text>
    </svg>
  )
}

/** Every object at once, in four bands. */
function ObjectMap({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const t = useThemeTokens()
  const [hover, setHover] = useState<string | null>(null)

  const W = 1180
  const BAND_H = 132
  const H = OBJECT_BANDS.length * BAND_H + 24
  const NODE_W = 132
  const NODE_H = 34

  const place = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = {}
    OBJECT_BANDS.forEach((band, bi) => {
      const inBand = BUSINESS_OBJECTS.filter((o) => o.band === band)
      const gap = (W - 80) / inBand.length
      inBand.forEach((o, i) => {
        out[o.id] = { x: 40 + gap * i + gap / 2 - NODE_W / 2, y: 46 + bi * BAND_H }
      })
    })
    return out
  }, [])

  const centre = (id: string) => {
    const p = place[id]
    return { x: p.x + NODE_W / 2, y: p.y + NODE_H / 2 }
  }

  const active = hover ?? selectedId
  const lit = (id: string) =>
    id === active || OBJECT_LINKS.some((l) => (l.from === active && l.to === id) || (l.to === active && l.from === id))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ minWidth: W }}>
      {OBJECT_BANDS.map((band, bi) => (
        <g key={band}>
          <rect
            x={14}
            y={22 + bi * BAND_H}
            width={W - 28}
            height={BAND_H - 16}
            rx={12}
            fill={t['surface-2']}
            fillOpacity={0.5}
            stroke={t.line}
            strokeDasharray="6 6"
          />
          <text x={26} y={38 + bi * BAND_H} fontSize={10} fontWeight={600} letterSpacing={0.8} fill={t.subtle}>
            {band.toUpperCase()}
          </text>
        </g>
      ))}

      {OBJECT_LINKS.map((l, i) => {
        const a = centre(l.from)
        const b = centre(l.to)
        const on = l.from === active || l.to === active
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2 + ((i % 3) - 1) * 13
        return (
          <g key={`${l.from}-${l.to}-${l.label}`} opacity={on ? 1 : 0.28}>
            <path
              d={`M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`}
              fill="none"
              stroke={on ? t.primary : t['line-strong']}
              strokeWidth={on ? 1.8 : 1}
            />
            {on && (
              <>
                <rect x={mx - 52} y={my - 9} width={104} height={17} rx={8} fill={t.surface} stroke={t.line} />
                <text x={mx} y={my + 3} fontSize={8.5} textAnchor="middle" fill={t.muted}>
                  {l.label} {l.cardinality}
                </text>
              </>
            )}
          </g>
        )
      })}

      {BUSINESS_OBJECTS.map((o) => {
        const p = place[o.id]
        const isActive = o.id === selectedId
        return (
          <g
            key={o.id}
            className="cursor-pointer"
            opacity={lit(o.id) ? 1 : 0.4}
            onMouseEnter={() => setHover(o.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect(o.id)}
          >
            <rect
              x={p.x}
              y={p.y}
              width={NODE_W}
              height={NODE_H}
              rx={8}
              fill={isActive ? t['primary-soft'] : t.surface}
              stroke={isActive ? t.primary : o.status === 'Confirmed' ? t['line-strong'] : t.accent}
              strokeWidth={isActive ? 1.8 : 1}
            />
            <circle cx={p.x + 11} cy={p.y + NODE_H / 2} r={3} fill={o.status === 'Confirmed' ? t.success : t.accent} />
            <text x={p.x + 20} y={p.y + NODE_H / 2 + 4} fontSize={10.5} fill={isActive ? t.primary : t.text}>
              {o.name.length > 19 ? `${o.name.slice(0, 18)}…` : o.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
