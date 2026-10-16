import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, GitCompareArrows, Play, Sparkles, X } from 'lucide-react'
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
  Progress,
  RiskDial,
  SectionTitle,
  Select,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { WorkflowFlow, type StageMark } from '@/components/domain/WorkflowFlow'
import { CHANGES, HEALING, PROCESSES, RECON_SETS, RUNS, SCENARIOS, SYSTEMS } from '@/data'
import { store, useStore } from '@/data/appStore'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'
import { num } from '@/lib/format'

const TABS = [
  { label: 'Change Impact', path: '/regression' },
  { label: 'Self-Healing', path: '/self-healing' },
  { label: 'Migration Reconciliation', path: '/reconciliation' },
]

/* -------------------------------------------------------------------------- */
/* Change impact                                                              */
/* -------------------------------------------------------------------------- */

export function ChangeImpactPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [baseline, setBaseline] = useState(RUNS[1].id)
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')

  const changeId = params.get('change') ?? CHANGES[0].id
  const change = CHANGES.find((c) => c.id === changeId) ?? CHANGES[0]

  const marks = useMemo(() => {
    const out: Record<string, StageMark> = {}
    change.stages.forEach((s) => {
      out[s] = 'change'
    })
    PROCESSES.forEach((p) => {
      let seen = false
      p.stages.forEach((s) => {
        if (out[s.id] === 'change') {
          seen = true
          return
        }
        if (seen && !out[s.id]) out[s.id] = 'downstream'
      })
    })
    return out
  }, [change])

  const touched = PROCESSES.filter((p) => p.stages.some((s) => marks[s.id] === 'change'))

  const regressionLines = [
    `Loading baseline ${baseline} and its stage results…`,
    `Applying change ${change.id} to the test environment…`,
    'Selecting the scenarios that touch the changed stages…',
    'Running them against the changed build…',
    'Comparing stage by stage against the baseline…',
    change.safeBeforeClose
      ? 'No regression found. The change behaves the same as the baseline.'
      : 'Regression found: two stages behave differently from the baseline.',
  ]

  const beforeMarks: Record<string, StageMark> = Object.fromEntries(
    PROCESSES[0].stages.map((s) => [s.id, 'pass' as StageMark]),
  )
  const afterMarks: Record<string, StageMark> = Object.fromEntries(
    PROCESSES[0].stages.map((s) => [
      s.id,
      change.stages.includes(s.id) ? (change.safeBeforeClose ? 'pass' : 'fail') : ('pass' as StageMark),
    ]),
  )

  return (
    <>
      <PageHeader
        title="Change & Regression"
        subtitle="Six changes are in flight. For each one: what changed, what could go wrong, and what we do about it."
        tabs={TABS}
      />

      <SectionTitle title="Change feed" hint="Highest risk first. Click a card to open it." />
      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[...CHANGES]
          .sort((a, b) => b.risk - a.risk)
          .map((c) => (
            <Card
              key={c.id}
              interactive
              tone={c.id === change.id ? 'ai' : c.risk >= 70 ? 'danger' : 'default'}
              onClick={() => setParams({ change: c.id })}
            >
              <CardBody className="flex gap-3">
                <RiskDial value={c.risk} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-subtle">{c.id}</span>
                    <Badge tone={c.safeBeforeClose ? 'success' : 'danger'}>{c.safeBeforeClose ? 'Safe' : 'Not safe'}</Badge>
                  </div>
                  <div className="truncate text-sm font-medium text-text">{c.title}</div>
                  <div className="truncate text-xs text-muted">
                    {c.system} · {c.type} · {c.release}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
      </div>

      <Card className="mb-4">
        <CardHeader
          title={`${change.id} · ${change.title}`}
          subtitle={`${change.system} · ${change.type} · release ${change.release}`}
          actions={<Badge tone={change.risk >= 70 ? 'danger' : change.risk >= 40 ? 'warning' : 'success'}>risk {change.risk}</Badge>}
        />
        <CardBody className="grid gap-3 lg:grid-cols-3">
          {[
            { title: 'What changed', body: change.whatChanged, tone: 'neutral' as const },
            { title: 'What could go wrong', body: change.whatCouldGoWrong, tone: 'danger' as const },
            { title: 'What we do', body: change.whatWeDo, tone: 'success' as const },
          ].map((box) => (
            <div
              key={box.title}
              className={cn(
                'rounded-md border px-4 py-3',
                box.tone === 'danger' ? 'border-danger/40 bg-danger-soft/40' : box.tone === 'success' ? 'border-success/40 bg-success-soft/40' : 'border-line bg-surface2/60',
              )}
            >
              <div className="mb-1 text-label font-semibold uppercase text-subtle">{box.title}</div>
              <p className="text-sm text-text">{box.body}</p>
            </div>
          ))}
        </CardBody>
        <CardFooterNote text={change.business} />
      </Card>

      <SectionTitle title="Where the change hits your workflows" hint="Red is where it lands. Amber is what feels it afterwards." />
      <div className="mb-4 grid gap-3">
        {touched.map((p) => (
          <Card key={p.id}>
            <CardHeader title={`${p.id} · ${p.name}`} />
            <CardBody className="pt-4">
              <WorkflowFlow process={p} marks={marks} onStageClick={(id) => navigate(`/ontology?process=${p.id}&stage=${id}`)} />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Regression: before the change and after"
          subtitle="The same scenarios, run against the baseline and against the changed build."
          icon={<GitCompareArrows size={16} />}
          actions={
            <div className="flex items-center gap-2">
              <Select value={baseline} onChange={(e) => { setBaseline(e.target.value); setPhase('idle') }} className="w-[180px]">
                {RUNS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {r.when.slice(0, 11)}
                  </option>
                ))}
              </Select>
              <Button
                variant="primary"
                leftIcon={<Play size={15} />}
                loading={phase === 'running'}
                onClick={() => {
                  setPhase('running')
                  window.setTimeout(() => {
                    setPhase('done')
                    toast({
                      title: change.safeBeforeClose ? 'No regression found' : 'Regression found',
                      tone: change.safeBeforeClose ? 'success' : 'danger',
                    })
                  }, regressionLines.length * 420 + 200)
                }}
              >
                Run regression
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div>
            <div className="mb-2 text-label font-semibold uppercase text-subtle">Before the change · {baseline}</div>
            <WorkflowFlow process={PROCESSES[0]} marks={beforeMarks} compact />
          </div>
          <div>
            <div className="mb-2 text-label font-semibold uppercase text-subtle">After the change · live run</div>
            <WorkflowFlow process={PROCESSES[0]} marks={phase === 'done' ? afterMarks : {}} compact />
          </div>

          {phase === 'done' && (
            <div
              className={cn(
                'rounded-md border px-4 py-3 text-sm',
                change.safeBeforeClose ? 'border-success/40 bg-success-soft/40 text-success' : 'border-danger/40 bg-danger-soft/40 text-danger',
              )}
            >
              {change.safeBeforeClose
                ? `Every stage behaves exactly as it did in ${baseline}. This change can go in before the close.`
                : `Two stages differ from ${baseline}. Hold this change until the critical findings behind it are closed.`}
            </div>
          )}

          {phase !== 'idle' && (
            <Disclosure summary="AI log" defaultOpen>
              <LiveLog lines={regressionLines} running={phase === 'running'} height={150} />
            </Disclosure>
          )}

          <div>
            <div className="mb-2 text-label font-semibold uppercase text-subtle">Scenarios selected for this change</div>
            <div className="flex flex-wrap gap-1.5">
              {SCENARIOS.filter((s) => change.stages.includes(s.stageId)).map((s) => (
                <Chip key={s.id} onClick={() => navigate(`/studio?scenario=${s.id}`)}>
                  {s.id} · {s.type}
                </Chip>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
    </>
  )
}

function CardFooterNote({ text }: { text: string }) {
  return (
    <div className="border-t border-line bg-surface2/60 px-5 py-3 text-sm text-muted">
      <span className="font-medium text-text">For the business:</span> {text.replace('For the business: ', '')}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Self-healing                                                               */
/* -------------------------------------------------------------------------- */

export function SelfHealingPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { def } = useRole()
  const appState = useStore()
  const [selected, setSelected] = useState(HEALING[0].id)
  const event = HEALING.find((h) => h.id === selected) ?? HEALING[0]
  const status = appState.healingStatus[event.id] ?? event.status
  const change = CHANGES.find((c) => c.id === event.change)

  const decide = (next: 'Approved' | 'Rejected') => {
    if (def.readOnly) {
      toast({ title: 'This view is read only', description: 'Switch to Key User to approve a repair.', tone: 'info' })
      return
    }
    store.setHealingStatus(event.id, next)
    toast({
      title: `${event.id} ${next.toLowerCase()}`,
      description: next === 'Approved' ? `${event.scenario} will use the repaired step from the next run.` : 'The script stays as it was.',
      tone: next === 'Approved' ? 'success' : 'warning',
    })
  }

  return (
    <>
      <PageHeader
        title="Self-Healing"
        subtitle="When a change breaks a step, the agent proposes a repair with a confidence score. A key user decides."
        tabs={TABS}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Repairs proposed" value={num(HEALING.length)} />
        <StatTile label="Pending" value={num(HEALING.filter((h) => (appState.healingStatus[h.id] ?? h.status) === 'Pending').length)} tone="warning" />
        <StatTile label="Approved" value={num(HEALING.filter((h) => (appState.healingStatus[h.id] ?? h.status) === 'Approved').length)} tone="success" />
        <StatTile label="Average confidence" value={`${Math.round(HEALING.reduce((s, h) => s + h.confidence, 0) / HEALING.length)} %`} tone="ai" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader title="Repairs" subtitle="Newest first." />
          <div className="j2w-scroll max-h-[520px] overflow-y-auto p-2">
            {HEALING.map((h) => {
              const st = appState.healingStatus[h.id] ?? h.status
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelected(h.id)}
                  className={cn(
                    'mb-1.5 flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors',
                    h.id === selected ? 'border-ai/50 bg-ai-soft/60' : 'border-line hover:bg-surface2',
                  )}
                >
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-ai" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-subtle">{h.id}</span>
                      <Badge tone={st === 'Approved' ? 'success' : st === 'Rejected' ? 'danger' : 'warning'}>{st}</Badge>
                    </span>
                    <span className="block truncate text-sm text-text">{h.scenario} · {h.change}</span>
                    <span className="block text-[11px] text-subtle">{h.when} · {h.confidence} % confidence</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Card>

        <Card tone="ai">
          <CardHeader
            title={`${event.id} · repair for ${event.scenario}`}
            subtitle={change ? `${change.id} ${change.title}` : undefined}
            actions={<Badge tone={status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'warning'}>{status}</Badge>}
          />
          <CardBody className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-label font-semibold uppercase text-subtle">Confidence</span>
                <span className="font-mono text-sm text-ai">{event.confidence} %</span>
              </div>
              <Progress value={event.confidence} tone="ai" />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-1.5 text-label font-semibold uppercase text-subtle">Before</div>
                <CodeBlock className="border-danger/40 bg-danger-soft/30">{event.before}</CodeBlock>
              </div>
              <div>
                <div className="mb-1.5 text-label font-semibold uppercase text-subtle">After</div>
                <CodeBlock className="border-success/40 bg-success-soft/30">{event.after}</CodeBlock>
              </div>
            </div>

            <div className="rounded-md border border-line bg-surface2/60 px-4 py-3 text-sm text-muted">
              The agent matched the old and new field by name similarity, data type and position in the payload, then
              re-ran the step to confirm the repair works. The scenario is not changed until you approve it.
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" leftIcon={<Check size={15} />} onClick={() => decide('Approved')}>
                Approve the repair
              </Button>
              <Button variant="danger" leftIcon={<X size={15} />} onClick={() => decide('Rejected')}>
                Reject
              </Button>
              <Button onClick={() => navigate(`/studio?scenario=${event.scenario}`)}>Open {event.scenario}</Button>
              {change && <Button onClick={() => navigate(`/regression?change=${change.id}`)}>Open {change.id}</Button>}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Reconciliation                                                             */
/* -------------------------------------------------------------------------- */

export function ReconciliationPage() {
  const [selected, setSelected] = useState(RECON_SETS[0].id)
  const set = RECON_SETS.find((r) => r.id === selected) ?? RECON_SETS[0]

  return (
    <>
      <PageHeader
        title="Migration Reconciliation"
        subtitle="Source against target, row counts and totals, with every difference explained in words."
        tabs={TABS}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {RECON_SETS.map((r) => (
          <Card key={r.id} interactive tone={r.id === selected ? 'ai' : r.matchPct < 99 ? 'warning' : 'default'} onClick={() => setSelected(r.id)}>
            <CardBody>
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[11px] text-subtle">{r.id}</span>
                <Badge tone={r.kind === 'Migration' ? 'info' : 'neutral'}>{r.kind}</Badge>
              </div>
              <div className="truncate text-sm font-medium text-text">{r.name}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={cn('font-mono text-lg font-semibold', r.matchPct === 100 ? 'text-success' : r.matchPct >= 99 ? 'text-accent' : 'text-danger')}>
                  {r.matchPct} %
                </span>
                <span className="text-xs text-muted">match</span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Source rows" value={num(set.sourceRows)} hint={set.source} />
        <StatTile label="Target rows" value={num(set.targetRows)} hint={set.target} tone={set.sourceRows === set.targetRows ? 'success' : 'danger'} />
        <StatTile label="Source total" value={set.sourceTotal} />
        <StatTile label="Target total" value={set.targetTotal} tone={set.sourceTotal === set.targetTotal ? 'success' : 'warning'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Row sample" subtitle="A readable slice of the comparison." />
          <DataTable
            rows={set.sample}
            rowKey={(r) => r.key}
            dense
            rowTone={(r) => (r.status === 'Missing' ? 'danger' : r.status === 'Differs' ? 'warning' : undefined)}
            columns={[
              { key: 'key', header: 'Key', mono: true },
              { key: 'source', header: 'Source', mono: true },
              { key: 'target', header: 'Target', mono: true },
              {
                key: 'status',
                header: 'Status',
                width: 110,
                render: (r) => (
                  <Badge tone={r.status === 'Match' ? 'success' : r.status === 'Differs' ? 'warning' : 'danger'}>{r.status}</Badge>
                ),
              },
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="Differences explained" subtitle="Grouped by cause, written by the Reconciliation agent." />
          <CardBody className="space-y-2">
            {set.groups.length === 0 && (
              <p className="text-sm text-success">Nothing differs. Source and target agree row for row.</p>
            )}
            {set.groups.map((g) => (
              <div key={g.reason} className="rounded-md border border-line bg-surface2/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text">{g.reason}</span>
                  <Badge tone="warning" mono>
                    {g.rows} rows
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{g.explanation}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Systems compared" />
        <CardBody className="flex flex-wrap gap-2">
          {SYSTEMS.filter((s) => set.source.includes(s.name) || set.target.includes(s.name) || set.source.includes(s.short) || set.target.includes(s.short)).map((s) => (
            <Badge key={s.id} tone="neutral">
              {s.name}
            </Badge>
          ))}
          {!SYSTEMS.some((s) => set.source.includes(s.name)) && <Badge tone="neutral">{set.source}</Badge>}
        </CardBody>
      </Card>
    </>
  )
}
