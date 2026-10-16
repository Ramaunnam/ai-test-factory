import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, CircleAlert, Play, Workflow as WorkflowIcon } from 'lucide-react'
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
  SegmentedControl,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { HealthLegend, WorkflowFlow } from '@/components/domain/WorkflowFlow'
import { AGENTS, PROCESSES, REQUIREMENTS, SCENARIOS, processById } from '@/data'
import { SourceNote } from '@/components/domain/SourceNote'
import { TABLE_LABEL, tableCount, tableRoute } from '@/lib/live'
import type { TableName } from '@/sim/types'
import { useStore } from '@/data/appStore'
import { useThemeTokens } from '@/lib/useThemeTokens'
import { num } from '@/lib/format'
import { useToast } from '@/providers/ToastProvider'

const TABS = [
  { label: 'Workflows', path: '/ontology' },
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
  const [view, setView] = useState<'lanes' | 'graph'>('lanes')

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
        actions={
          <SegmentedControl
            value={view}
            onChange={setView}
            ariaLabel="Ontology view"
            options={[
              { value: 'lanes', label: 'Swim lanes' },
              { value: 'graph', label: 'Ontology graph' },
            ]}
          />
        }
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

      {view === 'lanes' ? (
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
      ) : (
        <Card className="mb-4">
          <CardHeader title="Ontology graph" subtitle="Workflow → stages → systems → business data → AI agents." />
          <div className="j2w-scroll overflow-x-auto p-4">
            <OntologyGraph processId={process.id} />
          </div>
        </Card>
      )}

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

function OntologyGraph({ processId }: { processId: string }) {
  const t = useThemeTokens()
  const [hover, setHover] = useState<string | null>(null)
  const process = processById(processId) ?? PROCESSES[0]

  const columns = useMemo(() => {
    const stages = process.stages.map((s) => ({ id: s.id, label: s.name, parents: [process.id] }))
    const systems = Array.from(new Set(process.stages.map((s) => s.system))).map((sys) => ({
      id: `sys:${sys}`,
      label: sys,
      parents: process.stages.filter((s) => s.system === sys).map((s) => s.id),
    }))
    const data = Array.from(new Set(process.stages.flatMap((s) => s.data.split(', ')))).map((d) => ({
      id: `data:${d}`,
      label: d,
      parents: process.stages.filter((s) => s.data.includes(d)).map((s) => `sys:${s.system}`),
    }))
    const agents = Array.from(new Set(process.stages.flatMap((s) => s.agents))).map((a) => ({
      id: `agent:${a}`,
      label: a,
      parents: process.stages
        .filter((s) => s.agents.includes(a))
        .flatMap((s) => s.data.split(', ').map((d) => `data:${d}`)),
    }))
    return [
      [{ id: process.id, label: process.name, parents: [] as string[] }],
      stages,
      systems,
      data,
      agents,
    ]
  }, [process])

  const COL_W = 196
  const NODE_H = 30
  const GAP = 12
  const height = Math.max(...columns.map((c) => c.length)) * (NODE_H + GAP) + 50
  const width = COL_W * columns.length

  const pos = new Map<string, { x: number; y: number }>()
  columns.forEach((col, ci) => {
    const colHeight = col.length * (NODE_H + GAP)
    col.forEach((n, ri) => {
      pos.set(n.id, { x: ci * COL_W + 10, y: (height - colHeight) / 2 + ri * (NODE_H + GAP) + 20 })
    })
  })

  const titles = ['Workflow', 'Stages', 'Systems', 'Business data', 'AI agents']

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-[980px]">
      {titles.map((title, i) => (
        <text key={title} x={i * COL_W + 10} y={14} fontSize={10} fontWeight={600} letterSpacing={1} fill={t.subtle}>
          {title.toUpperCase()}
        </text>
      ))}
      {columns.flatMap((col) =>
        col.flatMap((n) =>
          n.parents.map((p) => {
            const a = pos.get(p)
            const b = pos.get(n.id)
            if (!a || !b) return null
            const active = hover === n.id || hover === p
            return (
              <path
                key={`${p}->${n.id}`}
                d={`M ${a.x + COL_W - 26} ${a.y + NODE_H / 2} C ${a.x + COL_W + 10} ${a.y + NODE_H / 2}, ${b.x - 30} ${b.y + NODE_H / 2}, ${b.x} ${b.y + NODE_H / 2}`}
                fill="none"
                stroke={active ? t.ai : t.line}
                strokeWidth={active ? 1.8 : 1}
                opacity={hover && !active ? 0.25 : 1}
              />
            )
          }),
        ),
      )}
      {columns.flatMap((col, ci) =>
        col.map((n) => {
          const p = pos.get(n.id)!
          const active = hover === n.id
          return (
            <g
              key={n.id}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
              className="cursor-default"
              opacity={hover && !active && !columns.flat().find((x) => x.id === hover)?.parents.includes(n.id) ? 0.55 : 1}
            >
              <rect
                x={p.x}
                y={p.y}
                width={COL_W - 36}
                height={NODE_H}
                rx={8}
                fill={ci === 4 ? t['ai-soft'] : ci === 0 ? t['primary-soft'] : t.surface}
                stroke={active ? t.ai : t.line}
                strokeWidth={active ? 1.8 : 1}
              />
              <text x={p.x + 10} y={p.y + 19} fontSize={11} fill={t.text}>
                {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
              </text>
            </g>
          )
        }),
      )}
    </svg>
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
  const proven = REQUIREMENTS.filter((r) => r.status === 'Proven').length

  return (
    <>
      <PageHeader
        title="Requirement Coverage"
        subtitle="The ten requirements behind this programme, and the screen that proves each one."
        tabs={TABS}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Requirements" value={num(REQUIREMENTS.length)} />
        <StatTile label="Proven" value={num(proven)} tone="success" />
        <StatTile label="Partly proven" value={num(REQUIREMENTS.length - proven)} tone="warning" />
        <StatTile label="Scenarios tied to them" value={num(SCENARIOS.length)} onClick={() => navigate('/studio')} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {REQUIREMENTS.map((r) => (
          <Card key={r.id} tone={r.status === 'Proven' ? 'success' : 'warning'}>
            <CardBody>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={r.status === 'Proven' ? 'success' : 'warning'} mono>
                  {r.id}
                </Badge>
                <span className="text-sm font-medium text-text">{r.title}</span>
              </div>
              <div className="mb-2 text-xs text-muted">
                Covered by {SCENARIOS.filter((s) => s.requirement === r.id).length} scenarios.
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.provenBy.map((p) => (
                  <Chip key={p.route} onClick={() => navigate(p.route)}>
                    {p.label}
                  </Chip>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  )
}
