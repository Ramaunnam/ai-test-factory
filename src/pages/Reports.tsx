import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge, Button, Card, CardBody, CardHeader, DataTable, FieldGrid } from '@/components/ui'
import { CHANGES, PROCESSES, RUNS, SCENARIOS } from '@/data'
import { store, useStore } from '@/data/appStore'
import { WorkflowFlow } from '@/components/domain/WorkflowFlow'
import { num } from '@/lib/format'

function ReportShell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string
  subtitle: string
  badge?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="j2w-scroll h-full overflow-y-auto bg-bg print-flow">
      <div className="mx-auto w-full max-w-[1000px] px-6 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-2 inline-flex items-center gap-1.5 rounded-sm text-xs text-muted transition-colors hover:text-text no-print"
            >
              <ArrowLeft size={13} /> Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-text">{title}</h1>
              {badge}
            </div>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
          <Button variant="primary" leftIcon={<Printer size={15} />} onClick={() => window.print()} className="no-print">
            Print / Save as PDF
          </Button>
        </div>
        <div className="space-y-4">{children}</div>
        <footer className="mt-8 border-t border-line pt-3 text-xs text-subtle">
          J2W · POC – mock data for demonstration · generated {new Date().toLocaleString('en-GB')}
        </footer>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export function FindingPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const appState = useStore()
  const finding = appState.findings.find((f) => f.id === id)

  if (!finding) {
    return (
      <ReportShell title="Finding not found" subtitle={`No finding with the id ${id}.`}>
        <Card>
          <CardBody>
            <Button variant="primary" onClick={() => navigate('/run')}>
              Back to the findings list
            </Button>
          </CardBody>
        </Card>
      </ReportShell>
    )
  }

  return (
    <ReportShell
      title={`${finding.id} · ${finding.title}`}
      subtitle={`Raised ${finding.raised} by the ${finding.raisedBy}`}
      badge={
        <>
          <Badge tone={finding.severity === 'Critical' ? 'danger' : finding.severity === 'High' ? 'warning' : 'info'}>
            {finding.severity}
          </Badge>
          <Badge tone={finding.status === 'Open' ? 'danger' : finding.status === 'In progress' ? 'warning' : 'success'}>
            {finding.status}
          </Badge>
        </>
      }
    >
      <Card>
        <CardHeader title="What is wrong" />
        <CardBody className="space-y-4">
          <p className="text-sm text-text">{finding.detail}</p>
          <FieldGrid
            columns={3}
            fields={[
              { label: 'Workflow', value: finding.process },
              { label: 'Stage', value: finding.stage },
              { label: 'System', value: finding.system },
              { label: 'Interface', value: finding.interfaceId ?? '—' },
              { label: 'Live check', value: finding.check ?? '—' },
              { label: 'Status', value: finding.status },
            ]}
          />
        </CardBody>
      </Card>

      {finding.affectedKeys.length > 0 && (
        <Card>
          <CardHeader title="Records affected" subtitle="The exact loads this finding was raised against." />
          <CardBody className="flex flex-wrap gap-1.5">
            {finding.affectedKeys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => navigate(`/flow/trace?q=${encodeURIComponent(k)}`)}
                className="rounded-full border border-danger/30 bg-danger-soft px-2.5 py-1 font-mono text-[11px] text-danger transition-colors hover:brightness-105"
              >
                {k}
              </button>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Evidence" />
        <CardBody>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {finding.evidence.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card className="no-print">
        <CardHeader title="What now" />
        <CardBody className="flex flex-wrap gap-2">
          {finding.status !== 'Closed' && (
            <>
              <Button
                variant="primary"
                onClick={() => {
                  store.setFindingStatus(finding.id, 'In progress')
                  navigate(`/finding/${finding.id}`)
                }}
              >
                Take it on
              </Button>
              <Button onClick={() => store.setFindingStatus(finding.id, 'Closed')}>Close it</Button>
            </>
          )}
          {finding.check && <Button onClick={() => navigate('/flow/checks')}>Open live check {finding.check}</Button>}
          {finding.interfaceId && (
            <Button onClick={() => navigate(`/interfaces?interface=${finding.interfaceId}`)}>
              Open {finding.interfaceId}
            </Button>
          )}
        </CardBody>
      </Card>
    </ReportShell>
  )
}

/* -------------------------------------------------------------------------- */

export function RunReportPage() {
  const { runId } = useParams()
  const appState = useStore()
  const navigate = useNavigate()
  const run = [...appState.runs, ...RUNS].find((r) => r.id === runId)

  if (!run) {
    return (
      <ReportShell title="Run not found" subtitle={`No run with the id ${runId}.`}>
        <Card>
          <CardBody>
            <Button variant="primary" onClick={() => navigate('/run')}>
              Back to the Run Centre
            </Button>
          </CardBody>
        </Card>
      </ReportShell>
    )
  }

  const scenarios = SCENARIOS.slice(0, run.scenarios)

  return (
    <ReportShell
      title={`Run summary ${run.id}`}
      subtitle={`${run.trigger} · ${run.when} · ${run.duration}`}
      badge={<Badge tone={run.verdict === 'PASS' ? 'success' : run.verdict === 'FAIL' ? 'danger' : 'warning'}>{run.verdict}</Badge>}
    >
      <Card>
        <CardHeader title="Result" />
        <CardBody>
          <FieldGrid
            columns={3}
            fields={[
              { label: 'Scenarios', value: num(run.scenarios) },
              { label: 'Passed', value: num(run.passed) },
              { label: 'Failed', value: num(run.failed), flagged: run.failed > 0 },
              { label: 'Healed', value: num(run.healed) },
              { label: 'Duration', value: run.duration },
              { label: 'Workflow', value: run.process },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Workflow coverage" subtitle="Which stages this run actually proved." />
        <CardBody className="pt-4">
          <WorkflowFlow
            process={PROCESSES[0]}
            marks={Object.fromEntries(
              PROCESSES[0].stages.map((s, i) => [s.id, run.failed > 0 && i === 1 ? ('fail' as const) : ('pass' as const)]),
            )}
            compact
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Scenarios in this run" />
        <DataTable
          rows={scenarios}
          rowKey={(s) => s.id}
          dense
          columns={[
            { key: 'id', header: 'Scenario', mono: true, width: 100 },
            { key: 'name', header: 'What it proves' },
            { key: 'type', header: 'Type', width: 110 },
            {
              key: 'lastResult',
              header: 'Result',
              width: 110,
              render: (s) => (
                <Badge tone={s.lastResult === 'Pass' ? 'success' : s.lastResult === 'Fail' ? 'danger' : s.lastResult === 'Healed' ? 'warning' : 'neutral'}>
                  {s.lastResult}
                </Badge>
              ),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Findings raised" />
        <CardBody className="space-y-2">
          {appState.findings.slice(0, 3).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => navigate(`/finding/${f.id}`)}
              className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm transition-colors hover:bg-surface2"
            >
              <span className="font-mono text-[11px] text-subtle">{f.id}</span>
              <span className="min-w-0 flex-1 truncate text-text">{f.title}</span>
              <Badge tone={f.severity === 'Critical' ? 'danger' : 'warning'}>{f.severity}</Badge>
            </button>
          ))}
        </CardBody>
      </Card>
    </ReportShell>
  )
}

/* -------------------------------------------------------------------------- */

export function ReleaseReportPage() {
  const { id } = useParams()
  const appState = useStore()
  const changes = CHANGES.filter((c) => c.release === id)
  const blockers = appState.findings.filter((f) => f.severity === 'Critical' && f.status === 'Open')
  const decision = blockers.length > 1 ? 'NO-GO' : blockers.length ? 'CONDITIONAL' : 'GO'

  return (
    <ReportShell
      title={`Release report ${id}`}
      subtitle={`${changes.length} changes · ${blockers.length} critical findings open`}
      badge={<Badge tone={decision === 'GO' ? 'success' : decision === 'NO-GO' ? 'danger' : 'warning'}>{decision}</Badge>}
    >
      <Card>
        <CardHeader title="Changes in this release" />
        <DataTable
          rows={changes}
          rowKey={(c) => c.id}
          dense
          columns={[
            { key: 'id', header: 'Change', mono: true, width: 100 },
            { key: 'title', header: 'What it is' },
            { key: 'system', header: 'System', width: 200 },
            { key: 'risk', header: 'Risk', align: 'right', mono: true, width: 80 },
            {
              key: 'safeBeforeClose',
              header: 'Before the close',
              width: 140,
              render: (c) => <Badge tone={c.safeBeforeClose ? 'success' : 'danger'}>{c.safeBeforeClose ? 'Safe' : 'Hold'}</Badge>,
              value: (c) => (c.safeBeforeClose ? 1 : 0),
            },
          ]}
        />
      </Card>

      <Card>
        <CardHeader title="Blockers" />
        <CardBody className="space-y-2">
          {blockers.length === 0 && <p className="text-sm text-success">No critical findings are open.</p>}
          {blockers.map((b) => (
            <div key={b.id} className={cn('rounded-md border px-3 py-2', 'border-danger/40 bg-danger-soft/40')}>
              <div className="font-mono text-[11px] text-subtle">{b.id}</div>
              <div className="text-sm text-text">{b.title}</div>
              <div className="text-xs text-muted">{b.detail}</div>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recommendation" />
        <CardBody>
          <p className="text-sm text-text">
            {decision === 'GO'
              ? 'Ship it. Every workflow behaves as it did in the baseline and no critical finding is open.'
              : decision === 'CONDITIONAL'
                ? 'Ship with conditions: hold the changes marked Hold until the open critical finding is closed, and re-run the P1 regression pack afterwards.'
                : 'Do not ship before the close. Two critical findings touch the weighbridge to invoice chain, which is also the chain the month-end stock value depends on.'}
          </p>
        </CardBody>
      </Card>
    </ReportShell>
  )
}

/* -------------------------------------------------------------------------- */

export function EvidencePackPage() {
  const { runId } = useParams()
  const appState = useStore()
  const pack = appState.evidencePacks.find((p) => p.runId === runId)
  const run = [...appState.runs, ...RUNS].find((r) => r.id === runId)

  return (
    <ReportShell
      title={`Evidence pack ${pack?.id ?? runId}`}
      subtitle={pack ? `Locked ${pack.created} · signed off by ${pack.signedBy}` : `No pack exists yet for ${runId}.`}
      badge={pack ? <Badge tone="success">Locked</Badge> : <Badge tone="warning">Not created</Badge>}
    >
      {pack && (
        <>
          <Card>
            <CardHeader title="Integrity" subtitle="The hash covers every item in the pack. Any change produces a different hash." />
            <CardBody>
              <FieldGrid
                columns={2}
                fields={[
                  { label: 'Pack', value: pack.id },
                  { label: 'Run', value: pack.runId },
                  { label: 'Items', value: num(pack.items) },
                  { label: 'Hash', value: pack.hash },
                  { label: 'Created', value: pack.created },
                  { label: 'Signed off by', value: pack.signedBy },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="What is inside" />
            <CardBody>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Every step with its result, timestamp and the system it ran against</li>
                <li>The payload of every interface message the run produced</li>
                <li>The before and after of each self-healed step, with its confidence</li>
                <li>The data checks, their queries and the rows compared</li>
                <li>The findings raised, with the records affected</li>
                <li>The approval trail: who approved what, and when</li>
              </ul>
            </CardBody>
          </Card>
        </>
      )}

      {run && (
        <Card>
          <CardHeader title="Run covered by this pack" />
          <CardBody>
            <FieldGrid
              columns={3}
              fields={[
                { label: 'Run', value: run.id },
                { label: 'When', value: run.when },
                { label: 'Verdict', value: run.verdict, flagged: run.verdict === 'FAIL' },
                { label: 'Scenarios', value: num(run.scenarios) },
                { label: 'Passed', value: num(run.passed) },
                { label: 'Failed', value: num(run.failed), flagged: run.failed > 0 },
              ]}
            />
          </CardBody>
        </Card>
      )}
    </ReportShell>
  )
}
