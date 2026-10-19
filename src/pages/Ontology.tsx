import { useCallback, useMemo, useState, type ReactNode } from 'react'
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
  OBJECT_LINKS,
  neighboursOf,
  objectById,
  type BusinessObject,
  type ObjLink,
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

/** Confirmed is green, anything still open is amber. */
function statusTone(status: ObjStatus): 'success' | 'warning' {
  return status === 'Confirmed' ? 'success' : 'warning'
}

function StatusDot({ status }: { status: ObjStatus }) {
  return (
    <span
      title={status}
      className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', status === 'Confirmed' ? 'bg-success' : 'bg-accent')}
    />
  )
}

/** The small all-caps heading the panel is divided up with. */
function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('text-label font-semibold uppercase tracking-wider text-subtle', className)}>{children}</div>
  )
}

/** A chip that reads as a thing you could press in the real ontology manager. */
function MetaChip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex items-center rounded border border-line px-1.5 py-0.5 text-[11px] text-muted"
    >
      {children}
    </span>
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
  const [params] = useSearchParams()
  const rows = useLiveRows()

  /* The choice is kept here, not in the address bar: changing the address is a
     navigation, and the shell scrolls a navigation back to the top. Picking an
     object has to leave the page exactly where the reader left it. */
  const [selectedId, setSelectedId] = useState(() => {
    const wanted = params.get('object')
    return wanted && objectById(wanted) ? wanted : BUSINESS_OBJECTS[0].id
  })
  const object = objectById(selectedId) ?? BUSINESS_OBJECTS[0]
  const open = BUSINESS_OBJECTS.filter((o) => o.status !== 'Confirmed').length

  return (
    <>
      <PageHeader
        title="Process Ontology"
        subtitle="The objects the landscape keeps, what each one is made of, and how they join up."
        tabs={TABS}
      />

      {/* ------------------------------------------------------- the model */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-text">Unified data model · ontology</h2>
          <p className="mt-0.5 text-xs text-muted">
            Object types, links, actions and functions. Correct the{' '}
            <span className="font-medium text-accent">To confirm</span> and{' '}
            <span className="font-medium text-accent">Proposed</span> items with us in the workshop.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {open} still open
          </span>
          <span className="font-mono text-subtle">
            {BUSINESS_OBJECTS.length} object types · {OBJECT_LINKS.length} link types
          </span>
        </div>
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Model overview"
          subtitle="The full model at a glance. Press any node to inspect it in the panel below."
        />
        <div className="j2w-scroll overflow-x-auto px-4 pb-4">
          <ModelOverview selectedId={object.id} onSelect={setSelectedId} />
        </div>
      </Card>

      {/* ------------------------------------------- object types and detail */}
      <div className="grid gap-4 lg:grid-cols-[292px_minmax(0,1fr)] lg:items-start">
        <Card className="overflow-hidden lg:sticky lg:top-2">
          <Eyebrow className="border-b border-line bg-surface2 px-4 py-2">Object types</Eyebrow>
          <div className="j2w-scroll max-h-[640px] overflow-y-auto">
            {BUSINESS_OBJECTS.map((o, i) => {
              const Icon = OBJECT_ICONS[o.icon] ?? Boxes
              const active = o.id === object.id
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedId(o.id)}
                  className={cn(
                    'relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    i > 0 && 'border-t border-line',
                    active ? 'bg-primary-soft' : 'hover:bg-surface2',
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-primary" />}
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-md',
                      active ? 'bg-primary/15' : 'bg-surface2',
                    )}
                  >
                    <Icon size={15} className={active ? 'text-primary' : 'text-subtle'} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-text">{o.name}</span>
                    <span className="block truncate text-[11px] text-subtle">{o.grain}</span>
                  </span>
                  <StatusDot status={o.status} />
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="min-w-0">
          <CardBody className="space-y-5">
            {/* ------------------------------------------------- the header */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Eyebrow>Object type</Eyebrow>
                  <div className="mt-0.5 text-lg font-semibold text-text">{object.name}</div>
                </div>
                <Badge tone={statusTone(object.status)}>{object.status}</Badge>
              </div>
              <div className="mt-1 font-mono text-[11px] text-subtle">{object.technicalId}</div>
              <p className="mt-2 text-xs text-muted">{object.what}</p>

              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted">Grain</span>
                  <span className="text-right font-medium text-text">{object.grain}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted">Primary key</span>
                  <span className="text-right font-mono font-medium text-text">{object.primaryKey}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-muted">Live rows now</span>
                  <span className="text-right font-mono font-medium text-text">{num(rows[object.id] ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* --------------------------------------------- the properties */}
            <div>
              <Eyebrow className="mb-2">Properties</Eyebrow>
              <div className="space-y-2.5">
                {object.properties.map((f) => (
                  <div key={f.name} className="border-b border-line pb-2 text-xs last:border-b-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-mono font-medium text-text">{f.name}</span>
                        {f.key && (
                          <span
                            title={f.key === 'PK' ? 'Primary key' : 'Points at another object'}
                            className={cn(
                              'rounded px-1 text-[9px] font-semibold',
                              f.key === 'PK' ? 'bg-primary-soft text-primary' : 'bg-surface2 text-muted',
                            )}
                          >
                            {f.key}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-subtle">{f.type}</span>
                        <StatusDot status={f.status} />
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-subtle">{f.means}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10.5px] text-muted">{f.from}</span>
                      {f.computedBy && <MetaChip title="Computed by a rule">ƒ computed by {f.computedBy}</MetaChip>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ------------------------------------ actions and functions */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Eyebrow className="mb-2">Action types</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {object.actions.length === 0 ? (
                    <span className="text-xs text-muted">none</span>
                  ) : (
                    object.actions.map((a) => <MetaChip key={a}>{a}</MetaChip>)
                  )}
                </div>
              </div>
              <div>
                <Eyebrow className="mb-2">Functions</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {object.functions.length === 0 ? (
                    <span className="text-xs text-muted">none</span>
                  ) : (
                    object.functions.map((f) => <MetaChip key={f}>ƒ {f}</MetaChip>)
                  )}
                </div>
              </div>
            </div>

            {/* ------------------------------------------- the link graph */}
            <div>
              <Eyebrow className="mb-2">Link types</Eyebrow>
              <LinkTypeGraph object={object} onSelect={setSelectedId} />
            </div>

            {/* ----------------------------------------- where it is bound */}
            <div>
              <Eyebrow className="mb-2">Data binding</Eyebrow>
              <div className="space-y-1.5 rounded-md border border-line bg-surface2/60 p-2.5 text-xs">
                <Bound label="System" value={object.source.system} />
                <Bound label="Table" value={object.source.table ? TABLE_LABEL[object.source.table] : 'no table of its own'} mono />
                <Bound label="Layer" value={object.source.layer} />
                <Bound
                  label="Interface"
                  value={object.source.interfaceId ?? 'none'}
                  mono
                  onClick={
                    object.source.interfaceId
                      ? () => navigate(`/interfaces?interface=${object.source.interfaceId}`)
                      : undefined
                  }
                />
                <Bound label="Refresh" value={object.source.refresh} />
                <div className="flex items-center justify-between gap-3">
                  <span className="shrink-0 text-muted">Checks that guard it</span>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {object.source.checks.length === 0 ? (
                      <span className="text-muted">none</span>
                    ) : (
                      object.source.checks.map((c) => (
                        <Chip key={c} onClick={() => navigate('/flow/checks')}>
                          {c}
                        </Chip>
                      ))
                    )}
                  </span>
                </div>
                <div className="pt-0.5">
                  <Badge tone={statusTone(object.source.status)}>{object.source.status}</Badge>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Bound({
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
  const text = <span className={cn('text-right font-medium text-text', mono && 'font-mono')}>{value}</span>
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-muted">{label}</span>
      {onClick ? (
        <button type="button" onClick={onClick} className="rounded-sm text-right transition-colors hover:underline">
          {text}
        </button>
      ) : (
        text
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* The two graphs                                                             */
/* -------------------------------------------------------------------------- */

/** One node, drawn at a percentage position on either graph. */
function GraphNode({
  object,
  left,
  top,
  state,
  onSelect,
  onHover,
}: {
  object: BusinessObject
  left: number
  top: number
  state: 'selected' | 'linked' | 'dim'
  onSelect?: () => void
  onHover?: (id: string | null) => void
}) {
  const Icon = OBJECT_ICONS[object.icon] ?? Boxes
  return (
    <button
      type="button"
      disabled={!onSelect}
      onClick={onSelect}
      onMouseEnter={() => onHover?.(object.id)}
      onMouseLeave={() => onHover?.(null)}
      title={`${object.name} — ${object.grain}`}
      style={{ left: `${left}%`, top: `${top}%` }}
      className={cn(
        'absolute flex w-[138px] -translate-x-1/2 -translate-y-1/2 items-start gap-1.5 rounded-md border px-2 py-1.5 text-left shadow-sm transition-all duration-150',
        state === 'selected'
          ? 'border-primary bg-primary-soft shadow-md ring-2 ring-primary/25'
          : state === 'linked'
            ? 'border-line-strong bg-surface hover:-translate-y-[calc(50%+1px)] hover:shadow-md'
            : 'border-line bg-surface opacity-60 hover:opacity-100',
      )}
    >
      <Icon size={13} className={cn('mt-[1px] shrink-0', state === 'selected' ? 'text-primary' : 'text-subtle')} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'min-w-0 flex-1 text-[11px] font-semibold leading-tight',
              state === 'selected' ? 'text-primary' : 'text-text',
            )}
          >
            {object.name}
          </span>
          <StatusDot status={object.status} />
        </span>
      </span>
    </button>
  )
}

/**
 * The canvas is stretched to fit, so one per cent across is not one per cent
 * down. Both graphs pass their drawn size in, and a link is pulled back to the
 * edge of each node so the arrowhead never lands on top of a box.
 */
/** Half a node chip, for stopping a link at its edge. */
const NODE_BOX = { w: 138, h: 40 }
const NODE_GAP = 9

/** Measure the canvas, so the graph can be drawn in real pixels. */
function useCanvasSize() {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const ref = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
  }, [])
  return [ref, size] as const
}

/** Where a node sits on the canvas, in pixels. */
function spot(pos: { x: number; y: number }, size: { w: number; h: number }) {
  return { x: (pos.x / 100) * size.w, y: (pos.y / 100) * size.h }
}

/**
 * Pull a link back to the edge of the chip at each end, so the arrowhead
 * lands in clear space instead of on top of a box.
 */
function edges(
  a: { x: number; y: number },
  b: { x: number; y: number },
  box: { w: number; h: number } = NODE_BOX,
  gap: number = NODE_GAP,
) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const hitX = Math.abs(ux) < 1e-6 ? Infinity : box.w / 2 / Math.abs(ux)
  const hitY = Math.abs(uy) < 1e-6 ? Infinity : box.h / 2 / Math.abs(uy)
  const back = Math.min(hitX, hitY) + gap
  // Two chips almost touching would turn the link inside out.
  if (back * 2 >= len) return null
  return { a: { x: a.x + ux * back, y: a.y + uy * back }, b: { x: b.x - ux * back, y: b.y - uy * back } }
}

/** The relation name, with the cardinality written at each end of the line. */
function LinkMarks({
  a,
  b,
  label,
  cardinality,
  accent,
}: {
  a: { x: number; y: number }
  b: { x: number; y: number }
  label: string
  cardinality: string
  accent?: boolean
}) {
  const [one, many] = cardinality.split('\u2192').map((v) => v.trim())
  const at = (t: number) => ({ left: a.x + (b.x - a.x) * t, top: a.y + (b.y - a.y) * t })
  // On a short link the two ends would sit under the name, so leave them off.
  const room = Math.hypot(b.x - a.x, b.y - a.y) > 110
  return (
    <>
      <span
        style={at(0.5)}
        className={cn(
          'pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border px-1.5 py-px text-[11px] font-semibold shadow-sm',
          accent ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-surface text-text',
        )}
      >
        {label}
      </span>
      {room && (
        <>
          <span
            style={at(0.08)}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold text-muted"
          >
            {one}
          </span>
          <span
            style={at(0.92)}
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold text-muted"
          >
            {many}
          </span>
        </>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* The model overview                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The overview is drawn on a canvas of a known size: the cards are a fixed
 * number of pixels, their positions are a percentage of the canvas, and every
 * link is cut back to the card edges at both ends. The positions in the data
 * were chosen against that geometry, so no line passes behind a card and no
 * chip lands on one. Widening the canvas only pushes the cards further apart,
 * which can only add clearance.
 */
const CARD = { w: 180, h: 94 }
const CARD_GAP = 10
const MARK_AT = 11 // how far along the line the cardinality is written
const CANVAS = { w: 1240, h: 860 }

/** Green once the object is agreed, amber while it is still open. */
function cardTone(status: ObjStatus) {
  return status === 'Confirmed'
    ? { border: 'border-success', dot: 'bg-success' }
    : { border: 'border-accent', dot: 'bg-accent' }
}

/** One object type, as a card on the model overview. */
function OverviewCard({
  object,
  selected,
  onSelect,
  onHover,
}: {
  object: BusinessObject
  selected: boolean
  onSelect: () => void
  onHover: (id: string | null) => void
}) {
  const tone = cardTone(object.status)
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(object.id)}
      onMouseLeave={() => onHover(null)}
      title={`${object.name} — ${object.grain}`}
      style={{ left: `${object.pos.x}%`, top: `${object.pos.y}%`, width: CARD.w, height: CARD.h }}
      className={cn(
        'absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col justify-center gap-1 overflow-hidden',
        'rounded-lg border-2 bg-surface px-3 text-left shadow-sm transition-shadow duration-150 hover:shadow-md',
        selected ? 'border-primary shadow-md ring-2 ring-primary/20' : tone.border,
      )}
    >
      <span className="flex items-start gap-2">
        <span className={cn('mt-[5px] h-2 w-2 shrink-0 rounded-full', selected ? 'bg-primary' : tone.dot)} />
        <span
          className={cn(
            'min-w-0 text-[16px] font-semibold leading-[19px]',
            selected ? 'text-primary' : 'text-text',
          )}
        >
          {object.name}
        </span>
      </span>
      <span className="pl-4 text-[11px] leading-[14px] text-subtle">{object.grain}</span>
    </button>
  )
}

/** The link name in a chip, with the cardinality just outside each card. */
function OverviewLinkMarks({
  a,
  b,
  link,
  on,
}: {
  a: { x: number; y: number }
  b: { x: number; y: number }
  link: ObjLink
  on: boolean
}) {
  const [one, many] = link.cardinality.split('→').map((v) => v.trim())
  const at = (t: number) => ({ left: a.x + (b.x - a.x) * t, top: a.y + (b.y - a.y) * t })
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const mark = 'pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted'
  return (
    <>
      <span
        style={at(link.at ?? 0.5)}
        className={cn(
          'pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap',
          'rounded-full border px-2 py-[2px] text-[10.5px] font-medium shadow-sm',
          on ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted',
        )}
      >
        {link.label}
      </span>
      <span style={at(MARK_AT / len)} className={mark}>
        {one}
      </span>
      <span style={at(1 - MARK_AT / len)} className={mark}>
        {many}
      </span>
    </>
  )
}

/** Every object type and every link type, on one canvas. */
function ModelOverview({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const t = useThemeTokens()
  const [ref, size] = useCanvasSize()
  const [hover, setHover] = useState<string | null>(null)
  const active = hover ?? selectedId

  // The layout was solved against CANVAS exactly, so the graph is drawn in
  // that coordinate space and then scaled up to fill whatever room it is
  // given. Scaling, rather than stretching, keeps every clearance intact.
  const scale = size.w > 0 ? Math.max(1, size.w / CANVAS.w) : 1

  const drawn = OBJECT_LINKS.map((l) => ({
    link: l,
    on: l.from === active || l.to === active,
    e: edges(spot(objectById(l.from)!.pos, CANVAS), spot(objectById(l.to)!.pos, CANVAS), CARD, CARD_GAP),
  })).filter((d): d is { link: ObjLink; on: boolean; e: NonNullable<typeof d.e> } => d.e !== null)

  const line = (d: (typeof drawn)[number]) => (
    <line
      key={`${d.link.from}-${d.link.to}-${d.link.label}`}
      x1={d.e.a.x}
      y1={d.e.a.y}
      x2={d.e.b.x}
      y2={d.e.b.y}
      stroke={d.on ? t.primary : t['line-strong']}
      strokeWidth={d.on ? 2.2 : 1.3}
      markerEnd={d.on ? 'url(#ont-arrow-on)' : 'url(#ont-arrow)'}
    />
  )

  return (
    <div ref={ref} className="relative" style={{ height: CANVAS.h * scale, minWidth: CANVAS.w }}>
      <div
        className="absolute left-0 top-0"
        style={{ width: CANVAS.w, height: CANVAS.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            {[
              { id: 'ont-arrow', fill: t['line-strong'] },
              { id: 'ont-arrow-on', fill: t.primary },
            ].map((m) => (
              <marker
                key={m.id}
                id={m.id}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={m.fill} />
              </marker>
            ))}
          </defs>
          {/* the quiet links first, so a highlighted one is never drawn under one */}
          {drawn.filter((d) => !d.on).map(line)}
          {drawn.filter((d) => d.on).map(line)}
        </svg>

        {BUSINESS_OBJECTS.map((o) => (
          <OverviewCard
            key={o.id}
            object={o}
            selected={o.id === selectedId}
            onSelect={() => onSelect(o.id)}
            onHover={setHover}
          />
        ))}

        {drawn.map((d) => (
          <OverviewLinkMarks
            key={`m-${d.link.from}-${d.link.to}-${d.link.label}`}
            a={d.e.a}
            b={d.e.b}
            link={d.link}
            on={d.on}
          />
        ))}
      </div>
    </div>
  )
}

/** The chosen object in the middle, everything joined to it around it. */
function LinkTypeGraph({ object, onSelect }: { object: BusinessObject; onSelect: (id: string) => void }) {
  const t = useThemeTokens()
  const [ref, size] = useCanvasSize()
  const list = neighboursOf(object.id)
  if (!list.length) return <p className="text-xs text-muted">Nothing joins to this object yet.</p>

  // A ring of two needs far less room than a ring of eight.
  const height = list.length <= 2 ? 230 : list.length <= 4 ? 330 : 420
  const centre = { x: 50, y: 50 }
  const points = list.map((n, i) => {
    const angle = (i / list.length) * Math.PI * 2 - Math.PI / 2
    return { ...n, x: 50 + Math.cos(angle) * 31, y: 50 + Math.sin(angle) * 33 }
  })
  const run = (n: (typeof points)[number]) =>
    edges(
      spot(n.outgoing ? centre : { x: n.x, y: n.y }, size),
      spot(n.outgoing ? { x: n.x, y: n.y } : centre, size),
    )

  return (
    <div className="j2w-scroll overflow-x-auto">
      <div
        ref={ref}
        style={{ height }}
        className="relative min-w-[620px] rounded-md border border-line bg-surface2/50"
      >
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker id="olg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={t.subtle} />
            </marker>
          </defs>
          {size.w > 0 &&
            points.map((n) => {
              const e = run(n)
              if (!e) return null
              return (
                <line
                  key={`l-${n.other.id}-${n.link.label}`}
                  x1={e.a.x}
                  y1={e.a.y}
                  x2={e.b.x}
                  y2={e.b.y}
                  stroke={t.subtle}
                  strokeOpacity={1}
                  strokeWidth={1.8}
                  markerEnd="url(#olg-arrow)"
                />
              )
            })}
        </svg>

        {points.map((n) => (
          <GraphNode
            key={n.other.id}
            object={n.other}
            left={n.x}
            top={n.y}
            state="linked"
            onSelect={() => onSelect(n.other.id)}
          />
        ))}

        {size.w > 0 &&
          points.map((n) => {
            const e = run(n)
            if (!e) return null
            return (
              <LinkMarks
                key={`m-${n.other.id}-${n.link.label}`}
                a={e.a}
                b={e.b}
                label={n.link.label}
                cardinality={n.link.cardinality}
              />
            )
          })}

        <GraphNode object={object} left={centre.x} top={centre.y} state="selected" />
      </div>
    </div>
  )
}

