import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge, Button, Card, CardBody, CardHeader, DataTable, FieldGrid, StatTile } from '@/components/ui'
import { CHANGES, PROCESSES, RUNS, SCENARIOS, processById } from '@/data'
import { RUN_LOG_COUNT, RUN_STEPS, buildRunSteps } from '@/data/runSteps'
import { StepScreenshot } from '@/components/domain/StepScreenshot'
import { store, useStore } from '@/data/appStore'
import { WorkflowFlow } from '@/components/domain/WorkflowFlow'
import { num } from '@/lib/format'
import { studioReview } from '@/lib/studioReview'
import { useChecks } from '@/sim/useSim'

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

  // A run that named its own scenarios shows only those. One that did not (an older, pre-canned run) falls back to the old illustrative slice.
  const scenarioPool = [...appState.recordedScenarios, ...SCENARIOS]
  const scenarios = run.scenarioIds
    ? run.scenarioIds.map((id) => scenarioPool.find((s) => s.id === id)).filter((s): s is (typeof scenarioPool)[number] => !!s)
    : SCENARIOS.slice(0, run.scenarios)

  const runSteps = run.scenarioIds ? buildRunSteps(run.scenarioIds, appState.recordedScenarios) : RUN_STEPS
  const runProcessIds = run.scenarioIds
    ? Array.from(new Set(runSteps.map((s) => s.stageId.split('-')[0])))
    : [PROCESSES[0].id]

  const findings = run.findingIds
    ? appState.findings.filter((f) => run.findingIds!.includes(f.id))
    : appState.findings.slice(0, 3)

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
        <CardBody className="space-y-3 pt-4">
          {runProcessIds.map((pid) => {
            const proc = processById(pid) ?? PROCESSES[0]
            const marks = Object.fromEntries(
              proc.stages.map((s) => {
                const forStage = runSteps.filter((st) => st.stageId === s.id)
                if (forStage.length === 0) return [s.id, 'not in run' as const]
                if (forStage.some((st) => st.outcome === 'fail')) return [s.id, 'fail' as const]
                if (forStage.some((st) => st.outcome === 'healed')) return [s.id, 'healed' as const]
                return [s.id, 'pass' as const]
              }),
            )
            return (
              <div key={pid}>
                {runProcessIds.length > 1 && <div className="mb-1 font-mono text-[11px] text-subtle">{pid} · {proc.name}</div>}
                <WorkflowFlow process={proc} marks={marks} compact />
              </div>
            )
          })}
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
          {findings.length === 0 && <p className="text-sm text-muted">No findings for this run.</p>}
          {findings.map((f) => (
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
  const packSteps = run?.scenarioIds ? buildRunSteps(run.scenarioIds, appState.recordedScenarios) : RUN_STEPS
  const packLogCount = run?.scenarioIds ? packSteps.reduce((n, s) => n + s.logs.length, 0) : RUN_LOG_COUNT

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
            <CardBody className="space-y-3">
              <p className="rounded-md border border-line bg-surface2/60 px-3 py-2 text-sm text-text">
                Contains {packSteps.length} steps, {packSteps.length} screenshots, {packLogCount} log lines.
              </p>
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

          <Card>
            <CardHeader
              title="Every step, with its screenshot and log"
              subtitle={`${packSteps.length} steps · ${packLogCount} log lines · screens drawn from each step’s own values`}
            />
            <CardBody className="space-y-3">
              {packSteps.map((s, i) => (
                <div key={`${s.scenario}-${i}`} className="rounded-md border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-subtle">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-mono text-[11px] text-subtle">{s.scenario}</span>
                    <span className="min-w-0 flex-1 text-sm text-text">{s.text}</span>
                    <Badge
                      tone={
                        s.outcome === 'fail'
                          ? 'danger'
                          : s.outcome === 'healed'
                            ? 'warning'
                            : s.outcome === 'blocked'
                              ? 'info'
                              : 'success'
                      }
                    >
                      {s.outcome === 'blocked' ? 'blocked as expected' : s.outcome}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <StepScreenshot screen={s.screen} outcome={s.outcome} variant="large" className="sm:w-[320px]" />
                    <div className="min-w-0 flex-1 space-y-0.5 rounded-md border border-line bg-surface2/60 px-3 py-2 font-mono text-[11px]">
                      {s.logs.map((l) => (
                        <div key={l.at} className="flex flex-wrap gap-x-3">
                          <span className="shrink-0 text-subtle">{l.at}</span>
                          <span className="min-w-0 flex-1 text-text">{l.action}</span>
                          <span className="shrink-0 text-muted">{l.result}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
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

export function StudioReviewPage() {
  const appState = useStore()
  const checks = useChecks()
  const scenarios = [...appState.recordedScenarios, ...SCENARIOS]
  const r = studioReview({
    scenarios,
    scenarioStatus: appState.scenarioStatus,
    findings: appState.findings,
    checks,
    runs: appState.runs,
  })

  return (
    <ReportShell
      title="AI review of the test suite"
      subtitle={`Every workflow, read from the scenario library and the live plant · ${new Date().toLocaleString('en-GB')}`}
      badge={
        <Badge tone={r.coverage >= 80 ? 'success' : r.coverage >= 60 ? 'warning' : 'danger'}>
          {r.coverage} % stage coverage
        </Badge>
      }
    >
      <Card className="mb-4">
        <CardHeader title="Summary" />
        <CardBody className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Stage coverage" value={`${r.coverage} %`} hint={`${r.tested} of ${r.stages} stages`} />
          <StatTile
            label="Scenarios"
            value={num(r.total)}
            hint={`${r.byType.Positive} positive · ${r.byType.Negative} negative · ${r.byType.Regression} re-test`}
          />
          <StatTile label="Approved" value={num(r.approved)} hint={`${r.pending} pending approval`} />
          <StatTile label="Last run" value={r.lastRun.verdict} hint={`${r.lastRun.id} · ${r.lastRun.failed} failed`} />
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Workflow by workflow" />
        <DataTable
          rows={r.workflows}
          rowKey={(w) => w.id}
          dense
          columns={[
            { key: 'id', header: 'Workflow', mono: true, width: 70 },
            { key: 'name', header: 'Name' },
            { key: 'coverage', header: 'Coverage', width: 95, align: 'right', render: (w) => `${w.coverage} %` },
            { key: 'untested', header: 'Stages with no test', render: (w) => (w.untested.length ? w.untested.join(', ') : 'none') },
            { key: 'failingChecks', header: 'Failing checks', width: 130, render: (w) => (w.failingChecks.length ? w.failingChecks.join(', ') : 'none') },
            { key: 'openFindings', header: 'Findings', width: 90, align: 'right', mono: true },
            { key: 'risk', header: 'Risk', width: 80 },
          ]}
          empty="No workflows."
        />
      </Card>

      <Card className="mb-4">
        <CardHeader title="Gaps, and the scenarios we would add" />
        <DataTable
          rows={r.gaps}
          rowKey={(g) => g.id}
          dense
          columns={[
            { key: 'workflow', header: 'Workflow', width: 180 },
            { key: 'stage', header: 'Stage', width: 160 },
            { key: 'type', header: 'Type', width: 95 },
            { key: 'name', header: 'Scenario to add' },
            { key: 'why', header: 'Why', width: 220 },
          ]}
          empty="No gaps. Every stage has a scenario and no check is failing."
        />
      </Card>

      <Card>
        <CardHeader title="Requirement coverage" />
        <DataTable
          rows={r.requirements}
          rowKey={(q) => q.id}
          dense
          columns={[
            { key: 'id', header: 'Id', mono: true, width: 90 },
            { key: 'group', header: 'Group', width: 90 },
            { key: 'full', header: 'What you asked for' },
            { key: 'steps', header: 'Journey steps', width: 130, render: (q) => (q.steps.length ? q.steps.join(', ') : 'none') },
            { key: 'screens', header: 'Proven on', render: (q) => q.screens.map((sc) => sc.label).join(' · ') },
          ]}
          empty="No requirements."
        />
      </Card>
    </ReportShell>
  )
}
