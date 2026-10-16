import { Fragment, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Database, GitCompareArrows, Play, Sparkles, X } from 'lucide-react'
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
import { SourceNote } from '@/components/domain/SourceNote'
import { CHANGES, HEALING, PROCESSES, RECON_SETS, RUNS, SCENARIOS, SYSTEMS, type ReconRow, type ReconSet } from '@/data'
import { engine } from '@/sim/engine'
import { useSimVersion } from '@/sim/useSim'
import { useDrawer } from '@/providers/DrawerProvider'
import { store, useStore } from '@/data/appStore'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'
import { fmtSim, num } from '@/lib/format'

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

      <SectionTitle title="Change feed" hint="Six changes in flight across two releases, highest risk first." />
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
        <SourceNote
          title="How change impact is worked out"
          reads={[
            { label: 'Change feed', note: 'transports, schema changes and vendor upgrades' },
            { label: 'Process Ontology', route: '/ontology', note: 'which stage uses which system and field' },
            { label: 'Baseline run', route: '/evidence', note: 'how the same scenarios behaved before' },
          ]}
          computes="maps each change onto the stages that use what it touches, then walks downstream from there"
          feeds={[{ label: 'Impact Simulator', route: '/simulator' }, { label: 'Release gate', route: '/release' }]}
          steps={[
            'A change names the system and the field or behaviour it alters.',
            'The ontology says which stages read that field, which is where the change lands.',
            'Everything after those stages in the same workflow feels it downstream.',
            'Regression re-runs the affected scenarios and compares them against the baseline run.',
          ]}
        />
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

/** The two cross-system sets compare the live plant, not a stored sample. */
function liveBatchRows(): ReconRow[] {
  const db = engine.db
  return db.scrap_batch
    .slice(-14)
    .reverse()
    .map((b) => {
      const posting = db.stock_posting.find((p) => p.batch === b.batch)
      const receipt = db.receipt.find((r) => r.receipt === b.receipt)
      const wrongUnit = !!posting && posting.unit !== 'KG'
      const wrongQty = !!posting && Math.abs(posting.qty - b.weight_kg) > 1
      const status: ReconRow['status'] = !posting ? 'Missing' : wrongUnit || wrongQty ? 'Differs' : 'Match'
      return {
        key: b.batch,
        source: `${num(b.weight_kg)} kg`,
        target: posting ? `${num(posting.qty)} ${posting.unit}` : '—',
        status,
        fields: [
          { field: 'batch', source: b.batch, target: posting?.batch ?? null },
          { field: 'grade / item', source: b.grade, target: posting?.item ?? null },
          { field: 'quantity', source: b.weight_kg, target: posting?.qty ?? null },
          { field: 'unit', source: 'KG', target: posting?.unit ?? null },
          { field: 'warehouse', source: 'RAW', target: posting?.warehouse ?? null },
          { field: 'journal', source: '—', target: posting?.journal ?? null },
          { field: 'recorded', source: fmtSim(b.created), target: posting ? fmtSim(posting.posted) : null },
        ],
        reason: !posting
          ? 'Nothing was posted to D365 for this batch, so the yard holds material the warehouse does not know about.'
          : wrongUnit
            ? `The quantity is right but the unit says ${posting.unit}. D365 understates this batch by a factor of a thousand, and the warehouse total with it. The message arrived that way on IF-03.`
            : wrongQty
              ? 'The posted quantity does not match the weight the yard recorded for this batch.'
              : undefined,
        fix: !posting
          ? 'Re-send the stock posting on IF-03 and check the queue for a lost message.'
          : wrongUnit
            ? 'This is fault F6 on IF-03. Switch it off on Live Data Flow, then re-post the journal. Live check C6 watches for it.'
            : wrongQty
              ? 'Compare the sortation record with the journal and correct the posting.'
              : undefined,
        sourceRef: {
          system: 'Scrap Yard Operations',
          table: 'scrap.scrap_batch',
          note: `sorted from receipt ${b.receipt}`,
          route: '/flow/data?system=scrap&table=scrap_batch',
        },
        targetRef: {
          system: 'D365 F&O – Recycling',
          table: 'd365.stock_posting',
          note: posting ? `journal ${posting.journal}, posted ${fmtSim(posting.posted)}` : 'no row was written',
          route: '/flow/data?system=d365&table=stock_posting',
        },
        traceKey: receipt?.gate_pass,
        link: status === 'Match' ? undefined : { label: 'Open live check C6', route: '/flow/checks' },
      }
    })
}

function liveInvoiceRows(): ReconRow[] {
  const db = engine.db
  return db.RBKP.slice(-14)
    .reverse()
    .map((r) => {
      const pay = db.payment.find((p) => p.belnr === r.belnr)
      const parked = r.status === 'Parked'
      const status: ReconRow['status'] = pay ? 'Match' : 'Missing'
      return {
        key: r.belnr,
        source: `€ ${num(Math.round(r.amount_eur))}`,
        target: pay ? `€ ${num(Math.round(pay.amount_eur))}` : '—',
        status,
        expected: parked,
        fields: [
          { field: 'document', source: r.belnr, target: pay?.belnr ?? null },
          { field: 'external invoice', source: r.ext_invoice, target: null },
          { field: 'gate pass', source: r.gate_pass, target: null },
          { field: 'status in SAP', source: r.status, target: pay ? 'paid' : 'not in a payment file' },
          { field: 'amount', source: Math.round(r.amount_eur), target: pay ? Math.round(pay.amount_eur) : null },
          { field: 'posted', source: fmtSim(r.posted), target: pay ? fmtSim(pay.run_at) : null },
        ],
        reason: pay
          ? undefined
          : parked
            ? `The invoice is parked: ${r.reason.toLowerCase()}. Parked invoices are excluded from the payment file on purpose, so this difference is the control working rather than a defect.`
            : 'The invoice is posted but has not been picked up yet. The payment run is hourly, so it will appear in the next file.',
        fix: pay
          ? undefined
          : parked
            ? 'No action on the interface. Resolve the park itself: live check C7 lists every parked invoice with its reason.'
            : 'No action. Re-check after the next hourly payment run.',
        sourceRef: {
          system: 'SAP S/4HANA – Steel',
          table: 'sap.rbkp',
          note: `invoice ${r.ext_invoice} against gate pass ${r.gate_pass}`,
          route: '/flow/data?system=sap-steel&table=RBKP',
        },
        targetRef: {
          system: 'Reval',
          table: 'reval.payment',
          note: pay ? `payment ${pay.pay} on the ${fmtSim(pay.run_at).slice(0, 6)} run` : 'no payment row',
          route: '/flow/data?system=reval&table=payment',
        },
        traceKey: r.gate_pass,
        link: parked ? { label: 'Open live check C7', route: '/flow/checks' } : undefined,
      }
    })
}

function rowsFor(set: ReconSet): ReconRow[] {
  if (set.liveSource === 'batches') return liveBatchRows()
  if (set.liveSource === 'invoices') return liveInvoiceRows()
  return set.sample
}

export function ReconciliationPage() {
  const navigate = useNavigate()
  const drawer = useDrawer()
  const version = useSimVersion()
  const [selected, setSelected] = useState(RECON_SETS[0].id)
  const set = RECON_SETS.find((r) => r.id === selected) ?? RECON_SETS[0]

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => rowsFor(set), [set, version])
  const live = !!set.liveSource

  const openRow = (row: ReconRow) => {
    const problem = row.status !== 'Match'
    drawer.open({
      title: `${row.key} · ${row.status.toLowerCase()}`,
      subtitle: `${set.id} ${set.name}`,
      width: 'lg',
      content: (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={row.status === 'Match' ? 'success' : row.expected ? 'warning' : 'danger'}>{row.status}</Badge>
            {row.expected && <Badge tone="neutral">correct by design</Badge>}
            {live && <Badge tone="info">live comparison</Badge>}
          </div>

          {/* where each side came from */}
          <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
            {[row.sourceRef, row.targetRef].map((ref, i) => (
              <Fragment key={i === 0 ? 'source' : 'target'}>
                {i === 1 && (
                  <div className="hidden items-center justify-center text-subtle sm:flex">
                    <ArrowRight size={16} />
                  </div>
                )}
                <button
                  type="button"
                  disabled={!ref?.route}
                  onClick={() => {
                    if (!ref?.route) return
                    drawer.closeAll()
                    navigate(ref.route)
                  }}
                  className={cn(
                    'rounded-md border border-line bg-surface2/60 px-3 py-2.5 text-left transition-colors',
                    ref?.route && 'hover:bg-surface2',
                  )}
                >
                  <div className="text-label font-semibold uppercase text-subtle">{i === 0 ? 'Source' : 'Target'}</div>
                  <div className="mt-0.5 text-sm font-medium text-text">{ref?.system ?? (i === 0 ? set.source : set.target)}</div>
                  <div className="font-mono text-[11px] text-primary">{ref?.table ?? '—'}</div>
                  {ref?.note && <div className="mt-0.5 text-xs text-muted">{ref.note}</div>}
                </button>
              </Fragment>
            ))}
          </div>

          {/* field by field */}
          {row.fields?.length ? (
            <div>
              <div className="mb-2 text-label font-semibold uppercase text-subtle">Field by field</div>
              <div className="overflow-hidden rounded-md border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-surface2">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-label uppercase text-subtle">Field</th>
                      <th className="px-3 py-1.5 text-left text-label uppercase text-subtle">Source</th>
                      <th className="px-3 py-1.5 text-left text-label uppercase text-subtle">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.fields.map((f) => {
                      const differs =
                        f.target === null ||
                        String(f.source).replace(/\s/g, '') !== String(f.target).replace(/\s/g, '')
                      return (
                        <tr key={f.field} className={cn('border-t border-line', differs && 'bg-danger-soft/50')}>
                          <td className="px-3 py-1.5 font-mono text-muted">{f.field}</td>
                          <td className="px-3 py-1.5 font-mono text-text">
                            {f.source === null ? <span className="text-subtle">—</span> : String(f.source)}
                          </td>
                          <td className={cn('px-3 py-1.5 font-mono', differs ? 'font-semibold text-danger' : 'text-text')}>
                            {f.target === null ? 'nothing on this side' : String(f.target)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-[11px] text-subtle">
                Rows in red are the fields that do not agree. Everything else matched exactly.
              </p>
            </div>
          ) : null}

          {row.reason && (
            <div className={cn('rounded-md border px-4 py-3', row.expected ? 'border-accent/40 bg-accent-soft/40' : 'border-danger/40 bg-danger-soft/40')}>
              <div className="text-label font-semibold uppercase text-subtle">Why it differs</div>
              <p className="mt-0.5 text-sm text-text">{row.reason}</p>
            </div>
          )}

          {row.fix && (
            <div className="rounded-md border border-line bg-surface2/60 px-4 py-3">
              <div className="text-label font-semibold uppercase text-subtle">What to do</div>
              <p className="mt-0.5 text-sm text-text">{row.fix}</p>
            </div>
          )}

          {!problem && !row.reason && (
            <p className="text-sm text-success">Every field agrees. Nothing to explain on this row.</p>
          )}

          <div className="flex flex-wrap gap-2">
            {row.traceKey && (
              <Button
                variant="primary"
                onClick={() => {
                  drawer.closeAll()
                  navigate(`/flow/trace?q=${encodeURIComponent(row.traceKey!)}`)
                }}
              >
                Follow this load through every system
              </Button>
            )}
            {row.link && (
              <Button
                onClick={() => {
                  drawer.closeAll()
                  navigate(row.link!.route)
                }}
              >
                {row.link.label}
              </Button>
            )}
          </div>
        </div>
      ),
    })
  }

  return (
    <>
      <PageHeader
        title="Migration Reconciliation"
        subtitle="Source against target, row counts and totals, and every difference explained down to the field."
        tabs={TABS}
      />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {RECON_SETS.map((r) => (
          <Card key={r.id} interactive tone={r.id === selected ? 'ai' : r.matchPct < 99 ? 'warning' : 'default'} onClick={() => setSelected(r.id)}>
            <CardBody>
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-[11px] text-subtle">{r.id}</span>
                <Badge tone={r.kind === 'Migration' ? 'info' : 'neutral'}>{r.kind}</Badge>
                {r.liveSource && <Badge tone="info" className="ml-auto">live</Badge>}
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
          <CardHeader
            title="Row sample"
            subtitle={
              live
                ? `The newest ${rows.length} records compared between ${set.source} and ${set.target}, live from the plant. Each row opens its field-by-field comparison.`
                : `A slice of the comparison between ${set.source} and ${set.target}. Each row opens its field-by-field comparison.`
            }
            actions={
              <Badge tone={rows.some((r) => r.status !== 'Match' && !r.expected) ? 'danger' : 'success'}>
                {rows.filter((r) => r.status !== 'Match').length} of {rows.length} differ
              </Badge>
            }
          />
          <DataTable
            rows={rows}
            rowKey={(r) => r.key}
            dense
            onRowClick={openRow}
            rowTone={(r) => (r.status === 'Match' ? undefined : r.expected ? 'warning' : 'danger')}
            columns={[
              { key: 'key', header: 'Key', mono: true },
              { key: 'source', header: 'Source', mono: true, align: 'right' },
              { key: 'target', header: 'Target', mono: true, align: 'right' },
              {
                key: 'status',
                header: 'Status',
                width: 150,
                render: (r) => (
                  <span className="flex items-center gap-1.5">
                    <Badge tone={r.status === 'Match' ? 'success' : r.expected ? 'warning' : 'danger'}>{r.status}</Badge>
                    {r.expected && <span className="text-[10px] text-subtle">expected</span>}
                  </span>
                ),
              },
            ]}
            empty="No records to compare yet. Let the plant run for a minute."
          />
          {live && (
            <SourceNote
              title="How this comparison is made"
              reads={
                set.liveSource === 'batches'
                  ? [{ table: 'scrap_batch' }, { table: 'stock_posting' }, { table: 'receipt' }]
                  : [{ table: 'RBKP' }, { table: 'payment' }]
              }
              computes={
                set.liveSource === 'batches'
                  ? 'joins every batch to its D365 journal on the batch number, then compares quantity, unit and warehouse'
                  : 'joins every invoice to its Reval payment on the document number, then compares status and amount'
              }
              feeds={[{ label: 'Confidence score', route: '/' }, { label: 'Release gate', route: '/release' }]}
              steps={[
                'The two sides are read straight from the live tables, not from an export.',
                'They are joined on the key the interface carries between them.',
                'Each field is compared, and the first field that disagrees explains the row.',
                'Differences that are correct by design are labelled expected, so they are never chased.',
              ]}
            />
          )}
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
            {live && (
              <div className="rounded-md border border-info/40 bg-info-soft/40 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Database size={14} className="text-info" />
                  <span className="text-sm font-medium text-text">Measured on this run</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {rows.filter((r) => r.status !== 'Match' && !r.expected).length} genuine differences and{' '}
                  {rows.filter((r) => r.expected).length} expected ones across the newest {rows.length} records. The
                  numbers move while the plant runs.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Systems compared" />
        <CardBody className="flex flex-wrap gap-2">
          {SYSTEMS.filter((sys) => set.source.includes(sys.name) || set.target.includes(sys.name) || set.source.includes(sys.short) || set.target.includes(sys.short)).map((sys) => (
            <Badge key={sys.id} tone="neutral">
              {sys.name}
            </Badge>
          ))}
          {!SYSTEMS.some((sys) => set.source.includes(sys.name)) && <Badge tone="neutral">{set.source}</Badge>}
        </CardBody>
      </Card>
    </>
  )
}
