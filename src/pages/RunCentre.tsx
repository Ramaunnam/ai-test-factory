import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileLock2,
  Loader2,
  Play,
  Send,
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
  EmptyState,
  Input,
  Modal,
  SectionTitle,
  Select,
  StatTile,
  Switch,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { JourneyBar } from '@/components/domain/JourneyBar'
import { WorkflowFlow, type StageMark } from '@/components/domain/WorkflowFlow'
import { SourceNote } from '@/components/domain/SourceNote'
import { PROCESSES, RUNS, SCENARIOS, processById } from '@/data'
import { buildRunSteps } from '@/data/runSteps'
import type { RunStep } from '@/data/runSteps'
import { StepScreenshot } from '@/components/domain/StepScreenshot'
import { store, useStore } from '@/data/appStore'
import {
  ALL_PROJECTS,
  PROJECTS,
  projectById,
  projectOfProcess,
  projectOfSystem,
  projectOfSystems,
  useProjectFilter,
} from '@/data/projects'
import { SCHEDULE_WHEN, type ScheduleWhen } from '@/data/schedules'
import { useToast } from '@/providers/ToastProvider'
import { useRole } from '@/providers/RoleProvider'
import { verdictOf } from '@/lib/score'
import { num } from '@/lib/format'

const TABS = [
  { label: 'Runs', path: '/run' },
  { label: 'Schedules', path: '/run/schedules' },
  { label: 'Evidence & Reports', path: '/evidence' },
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
  const [runScenarioIds, setRunScenarioIds] = useState<string[] | null>(null)
  const [runFindingIds, setRunFindingIds] = useState<string[]>([])
  const [stepFindingId, setStepFindingId] = useState<Record<number, string>>({})
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [shot, setShot] = useState<number | null>(null)
  const raisedForStep = useRef<Set<number>>(new Set())
  const runFindingIdsRef = useRef<string[]>([])
  const scheduleRef = useRef<string | null>(null)
  const { matches, withProject } = useProjectFilter()

  const steps: RunStep[] = useMemo(
    () => buildRunSteps(runScenarioIds ?? undefined, appState.recordedScenarios),
    [runScenarioIds, appState.recordedScenarios],
  )

  const filtered = SCENARIOS.filter(
    (s) => s.process === processFilter && (typeFilter === 'All' || s.type === typeFilter),
  ).filter((s) => matches(projectOfSystems(s.systems)))

  /** Start a run. With no ids, this is the default P1 demo run. */
  const start = (ids?: string[]) => {
    if (def.readOnly) {
      toast({
        title: 'This view is read only',
        description: `${def.id} can watch runs but not start them. Switch to Key User or QA Lead to run.`,
        tone: 'info',
      })
      return
    }
    raisedForStep.current = new Set()
    runFindingIdsRef.current = []
    setRunFindingIds([])
    setStepFindingId({})
    setRunScenarioIds(ids && ids.length ? ids : null)
    setRunId(`RUN-${1043 + appState.runs.length}`)
    setCursor(0)
    setRunning(true)
  }

  useEffect(() => {
    const demo = params.get('demo')
    const schedule = params.get('schedule')
    const scenario = params.get('scenario') ?? params.get('scenarios')
    if (!demo && !schedule && !scenario) return
    scheduleRef.current = schedule
    const next = new URLSearchParams(params)
    next.delete('demo')
    next.delete('schedule')
    next.delete('scenario')
    next.delete('scenarios')
    setParams(next, { replace: true })
    start(scenario ? scenario.split(',').map((s) => s.trim()).filter(Boolean) : undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => {
      setCursor((c) => {
        const next = c + 1
        if (next >= steps.length) {
          setRunning(false)
          return steps.length
        }
        return next
      })
    }, SPEED_MS[speed])
    return () => window.clearTimeout(id)
  }, [running, cursor, speed, steps])

  const done = cursor >= steps.length
  const visible = steps.slice(0, Math.max(0, Math.min(cursor + 1, steps.length)))
  const passed = visible.filter((s) => s.outcome === 'pass' || s.outcome === 'blocked').length
  const failed = visible.filter((s) => s.outcome === 'fail').length
  const healed = visible.filter((s) => s.outcome === 'healed').length
  const verdict = verdictOf(passed, failed, healed)
  const runScenarioCount = new Set(steps.map((s) => s.scenario)).size

  // raise a finding the moment each failing step runs (reusing one already written for it, if any)
  useEffect(() => {
    if (!runId) return
    visible.forEach((s, i) => {
      if (s.outcome !== 'fail' || raisedForStep.current.has(i)) return
      raisedForStep.current.add(i)
      if (s.findingId) {
        if (!runFindingIdsRef.current.includes(s.findingId)) runFindingIdsRef.current = [...runFindingIdsRef.current, s.findingId]
        setRunFindingIds((cur) => (cur.includes(s.findingId!) ? cur : [...cur, s.findingId!]))
        setStepFindingId((cur) => ({ ...cur, [i]: s.findingId! }))
        toast({
          title: `Finding ${s.findingId} raised during the run`,
          description: s.detail ?? `${s.scenario} failed on step ${i + 1}.`,
          tone: 'danger',
          action: { label: 'Open the finding', onClick: () => navigate(`/finding/${s.findingId}`) },
        })
        return
      }
      const id = store.addFinding({
        title: `${s.scenario} failed: ${s.text}`,
        severity: 'Critical',
        status: 'Open',
        process: s.stageId.split('-')[0],
        stage: s.stageId,
        system: s.system,
        raised: new Date().toLocaleString('en-GB'),
        raisedBy: 'Execution agent',
        detail: s.detail ?? `Step "${s.text}" failed during ${runId}.`,
        evidence: [`Run ${runId} step ${i + 1}`],
        affectedKeys: [],
      })
      runFindingIdsRef.current = [...runFindingIdsRef.current, id]
      setRunFindingIds((cur) => [...cur, id])
      setStepFindingId((cur) => ({ ...cur, [i]: id }))
      toast({
        title: `Finding ${id} raised during the run`,
        description: s.detail ?? `${s.scenario} failed on step ${i + 1}.`,
        tone: 'danger',
        action: { label: 'Open the finding', onClick: () => navigate(`/finding/${id}`) },
      })
    })
  }, [visible, runId, toast, navigate])

  // record the run when it finishes
  useEffect(() => {
    if (!done || !runId) return
    if (appState.runs.some((r) => r.id === runId)) return
    const startedBy = scheduleRef.current
    const schedule = startedBy ? appState.schedules.find((x) => x.id === startedBy) : undefined
    const when = new Date().toLocaleString('en-GB')
    const processes = Array.from(new Set(steps.map((s) => s.stageId.split('-')[0])))
    store.addRun({
      id: runId,
      when,
      trigger: schedule ? `${schedule.name} (scheduled)` : 'Key user on demand',
      scenarios: runScenarioCount,
      passed,
      failed,
      healed,
      verdict,
      duration: '2 min',
      process: processes.length === 1 ? processes[0] : processes.join(', ') || 'P1',
      live: true,
      scenarioIds: Array.from(new Set(steps.map((s) => s.scenario))),
      findingIds: runFindingIdsRef.current,
    })
    if (schedule) {
      store.recordScheduleRun(schedule.id, runId, verdict, when)
      scheduleRef.current = null
      toast({
        title: `Report sent to ${schedule.recipients.join(' and ')}`,
        description: `${schedule.name} ended ${verdict}.`,
        tone: verdict === 'FAIL' ? 'danger' : 'info',
        action: { label: 'Open the report', onClick: () => navigate(`/report/${runId}`) },
      })
    }
    toast({
      title: `Run ${runId} finished · ${verdict}`,
      description: `${passed} passed, ${failed} failed, ${healed} healed.`,
      tone: verdict === 'PASS' ? 'success' : verdict === 'FAIL' ? 'danger' : 'warning',
      action: { label: 'Open the summary', onClick: () => navigate(`/report/${runId}`) },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, runId])

  /** The processes touched by this run's own steps, in the order first seen. */
  const runProcessIds = useMemo(() => {
    const seen: string[] = []
    steps.forEach((s) => {
      const pid = s.stageId.split('-')[0]
      if (!seen.includes(pid)) seen.push(pid)
    })
    return seen.length ? seen : ['P1']
  }, [steps])

  /** One set of stage marks per process this run touches, so the strip only highlights this run's own workflow(s). */
  const marksByProcess = useMemo(() => {
    const out: Record<string, Record<string, StageMark>> = {}
    runProcessIds.forEach((pid) => {
      const m: Record<string, StageMark> = {}
      processById(pid)?.stages.forEach((s) => {
        m[s.id] = 'not in run'
      })
      out[pid] = m
    })
    visible.forEach((s, i) => {
      const pid = s.stageId.split('-')[0]
      const m = out[pid]
      if (!m) return
      const isCurrent = i === visible.length - 1 && running
      if (isCurrent) {
        m[s.stageId] = 'running'
        return
      }
      const existing = m[s.stageId]
      if (s.outcome === 'fail') m[s.stageId] = 'fail'
      else if (s.outcome === 'healed' && existing !== 'fail') m[s.stageId] = 'healed'
      else if (existing === 'not in run' || existing === undefined) m[s.stageId] = 'pass'
    })
    return out
  }, [runProcessIds, visible, running])

  /** What the run card header calls this run. */
  const runTitle = useMemo(() => {
    if (!runScenarioIds) return 'P1 Gate to Invoice'
    if (runScenarioIds.length === 1) {
      const sc = SCENARIOS.find((s) => s.id === runScenarioIds[0]) ?? appState.recordedScenarios.find((s) => s.id === runScenarioIds[0])
      return sc ? `${sc.id} · ${sc.name}` : runScenarioIds[0]
    }
    return `${runScenarioIds.length} scenarios · ${runProcessIds.join(', ')}`
  }, [runScenarioIds, runProcessIds, appState.recordedScenarios])

  const severityFilter = params.get('severity')
  const openFindings = appState.findings
    .filter((f) => f.status !== 'Closed')
    .filter((f) => !severityFilter || f.severity === severityFilter)
    .filter((f) => matches(projectOfSystem(f.system)))

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
            <Button variant="primary" leftIcon={<Play size={15} />} loading={running} onClick={() => start()}>
              Run the P1 demo now
            </Button>
          </>
        }
      />

      {cursor >= 0 && (
        <Card className="mb-4" tone={done ? (verdict === 'FAIL' ? 'danger' : verdict === 'PASS' ? 'success' : 'warning') : 'default'}>
          <CardHeader
            title={`${runId} · ${runTitle}`}
            subtitle={running ? `Running step ${Math.min(cursor + 1, steps.length)} of ${steps.length}` : done ? 'Finished' : 'Ready'}
            actions={
              done && (
                <>
                  <Button onClick={() => navigate(`/report/${runId}`)}>Open run summary</Button>
                  <Button
                    variant="primary"
                    leftIcon={<FileLock2 size={15} />}
                    onClick={() => {
                      const id = store.addEvidencePack(runId!, steps.length)
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
              <div className="mb-2 text-label font-semibold uppercase text-subtle">
                {runProcessIds.length > 1 ? 'Workflows being tested' : 'Workflow being tested'}
              </div>
              <div className="space-y-3">
                {runProcessIds.map((pid) => {
                  const proc = processById(pid)
                  if (!proc) return null
                  return (
                    <div key={pid}>
                      {runProcessIds.length > 1 && (
                        <div className="mb-1 font-mono text-[11px] text-subtle">{pid} · {proc.name}</div>
                      )}
                      <WorkflowFlow process={proc} marks={marksByProcess[pid]} compact />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Passed" value={num(passed)} tone="success" />
              <StatTile label="Failed" value={num(failed)} tone={failed ? 'danger' : 'neutral'} />
              <StatTile label="Healed" value={num(healed)} tone={healed ? 'warning' : 'neutral'} />
              <StatTile label="Verdict" value={done ? verdict : running ? 'running' : '—'} tone={verdict === 'FAIL' ? 'danger' : verdict === 'PASS' ? 'success' : 'warning'} />
            </div>

            <div className="space-y-1.5">
              {steps.map((s, i) => {
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
                        <span className="mt-2 block rounded-md border border-line bg-surface2/60 px-2.5 py-1.5 font-mono text-[11px]">
                          {s.logs.map((l) => (
                            <span key={l.at} className="flex flex-wrap gap-x-2">
                              <span className="shrink-0 text-subtle">{l.at}</span>
                              <span className="min-w-0 flex-1 text-text">{l.action}</span>
                              <span className="shrink-0 text-muted">{l.result}</span>
                            </span>
                          ))}
                        </span>
                      )}
                      {state !== 'waiting' && (
                        <Disclosure summary="Technical detail" className="mt-2">
                          <CodeBlock className="max-h-24">{s.technical}</CodeBlock>
                        </Disclosure>
                      )}
                    </span>
                    {state !== 'waiting' && (
                      <StepScreenshot
                        screen={s.screen}
                        outcome={s.outcome}
                        onClick={() => setShot(i)}
                        className="hidden sm:block"
                      />
                    )}
                    {s.outcome === 'fail' && state === 'fail' && stepFindingId[i] && (
                      <Button size="sm" variant="danger" onClick={() => navigate(`/finding/${stepFindingId[i]}`)}>
                        {stepFindingId[i]}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>

            {done && (
              <div>
                <div className="mb-2 text-label font-semibold uppercase text-subtle">Findings for this run</div>
                {runFindingIds.length === 0 ? (
                  <p className="text-sm text-muted">No findings for this run.</p>
                ) : (
                  <div className="space-y-1.5">
                    {runFindingIds.map((id) => {
                      const f = appState.findings.find((x) => x.id === id)
                      if (!f) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => navigate(`/finding/${id}`)}
                          className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm transition-colors hover:bg-surface2"
                        >
                          <span className="font-mono text-[11px] text-subtle">{f.id}</span>
                          <span className="min-w-0 flex-1 truncate text-text">{f.title}</span>
                          <Badge tone={f.severity === 'Critical' ? 'danger' : 'warning'}>{f.severity}</Badge>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader
          title="Choose what to run"
          subtitle={`${filtered.length} of ${SCENARIOS.length} approved scenarios, filtered by workflow, by type and by the project in the header.`}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Positive', 'Negative', 'Regression'] as const).map((t) => (
                <Chip key={t} selected={typeFilter === t} onClick={() => setTypeFilter(t)}>
                  {t}
                </Chip>
              ))}
              {selectedIds.length > 0 && (
                <Button size="sm" variant="primary" leftIcon={<Play size={13} />} onClick={() => start(selectedIds)}>
                  Run {selectedIds.length} selected
                </Button>
              )}
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
          empty="No approved scenario matches this workflow, type and project."
          columns={[
            {
              key: 'select',
              header: '',
              sortable: false,
              width: 36,
              render: (s) => (
                <span onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={selectedIds.includes(s.id)}
                    onChange={() =>
                      setSelectedIds((cur) => (cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id]))
                    }
                    aria-label={`Select ${s.id}`}
                  />
                </span>
              ),
            },
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
              render: (s) => (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    start([s.id])
                  }}
                >
                  Run
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={shot !== null}
        onClose={() => setShot(null)}
        width={760}
        title={shot === null ? '' : `Step ${shot + 1} of ${steps.length} · ${steps[shot].text}`}
        subtitle={
          shot === null
            ? undefined
            : `${steps[shot].system} · ${steps[shot].scenario} · ${
                steps[shot].outcome === 'blocked' ? 'blocked as expected' : steps[shot].outcome
              }`
        }
        footer={
          <>
            <Button
              leftIcon={<ChevronLeft size={15} />}
              disabled={shot === 0}
              onClick={() => setShot((i) => Math.max(0, (i ?? 0) - 1))}
            >
              Previous step
            </Button>
            <Button
              variant="primary"
              rightIcon={<ChevronRight size={15} />}
              disabled={shot === steps.length - 1}
              onClick={() => setShot((i) => Math.min(steps.length - 1, (i ?? 0) + 1))}
            >
              Next step
            </Button>
          </>
        }
      >
        {shot !== null && (
          <div className="space-y-3">
            <StepScreenshot screen={steps[shot].screen} outcome={steps[shot].outcome} variant="large" />
            {steps[shot].detail && (
              <p
                className={cn(
                  'text-sm',
                  steps[shot].outcome === 'fail'
                    ? 'text-danger'
                    : steps[shot].outcome === 'healed'
                      ? 'text-accent'
                      : 'text-success',
                )}
              >
                {steps[shot].detail}
              </p>
            )}
            <div>
              <div className="mb-1.5 text-label font-semibold uppercase text-subtle">Log</div>
              <div className="space-y-0.5 rounded-md border border-line bg-surface2 px-3 py-2 font-mono text-[11.5px]">
                {steps[shot].logs.map((l) => (
                  <div key={l.at} className="flex flex-wrap gap-x-3">
                    <span className="shrink-0 text-subtle">{l.at}</span>
                    <span className="min-w-0 flex-1 text-text">{l.action}</span>
                    <span className="shrink-0 text-muted">{l.result}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-subtle">
              The screen is drawn from the step’s own values, so it always matches the data behind it.
            </p>
          </div>
        )}
      </Modal>

      <SectionTitle
        title="Findings"
        hint="Everything raised by a run, a live check or an access proof, with the evidence attached."
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip selected={!severityFilter} onClick={() => setParams(withProject())}>
              All
            </Chip>
            {(['Critical', 'High', 'Medium', 'Low'] as const).map((s) => (
              <Chip key={s} selected={severityFilter === s} onClick={() => setParams(withProject({ severity: s }))}>
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
  const { matches } = useProjectFilter()
  const appState = useStore()
  const allRuns = [...appState.runs, ...RUNS].filter((r) => matches(projectOfProcess(r.process)))

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

/* -------------------------------------------------------------------------- */
/* Schedules                                                                  */
/* -------------------------------------------------------------------------- */

export function SchedulesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { def } = useRole()
  const appState = useStore()
  const { projectId, project, setProject, matches } = useProjectFilter()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: '',
    what: '',
    when: SCHEDULE_WHEN[0] as ScheduleWhen,
    project: ALL_PROJECTS,
    scenarios: 8,
  })

  const schedules = appState.schedules.filter((s) =>
    s.project === ALL_PROJECTS ? true : matches(s.project),
  )
  const on = schedules.filter((s) => s.on)
  const next = [...on].sort((a, b) => a.nextInMinutes - b.nextInMinutes).slice(0, 3)
  const failing = schedules.filter((s) => s.lastResult === 'FAIL').length

  const runNow = (id: string) => {
    if (def.readOnly) {
      toast({
        title: 'This view is read only',
        description: `${def.id} can watch runs but not start them. Switch to Key User or QA Lead to run.`,
        tone: 'info',
      })
      return
    }
    const params = new URLSearchParams()
    params.set('schedule', id)
    if (projectId !== ALL_PROJECTS) params.set('project', projectId)
    navigate(`/run?${params.toString()}`)
  }

  const save = () => {
    if (!form.name.trim()) return
    const id = store.addSchedule({
      name: form.name.trim(),
      what: form.what.trim() || 'Every approved scenario in the project',
      when: form.when,
      project: form.project,
      scenarios: Math.max(1, Number(form.scenarios) || 1),
      lastResult: 'Not run yet',
      lastRun: '—',
      nextRun: form.when === 'Nightly at 02:00' ? '18 Oct 2026 02:00' : `On the next ${form.when.toLowerCase()}`,
      nextInMinutes: 20 * 60,
      on: true,
      recipients: ['Key User', 'QA Lead'],
    })
    setAdding(false)
    setForm({ name: '', what: '', when: SCHEDULE_WHEN[0], project: ALL_PROJECTS, scenarios: 8 })
    toast({
      title: `${id} created and switched on`,
      description: 'It will run at the next trigger, and the report goes to Key User and QA Lead.',
      tone: 'success',
    })
  }

  return (
    <>
      <JourneyBar step={5} />
      <PageHeader
        title="Run Centre"
        subtitle="Tests do not wait to be asked. They run on a schedule, after every change, for every project."
        tabs={TABS}
        actions={
          <Button variant="primary" leftIcon={<CalendarClock size={15} />} onClick={() => setAdding(true)}>
            New schedule
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Schedules switched on"
          value={num(on.length)}
          hint={`of ${num(schedules.length)} in ${project ? project.name : 'all projects'}`}
        />
        <StatTile
          label="Next run"
          value={next[0]?.nextRun ?? '—'}
          tone="info"
          hint={next[0]?.name ?? 'nothing scheduled'}
        />
        <StatTile
          label="Failing last time"
          value={num(failing)}
          tone={failing ? 'danger' : 'success'}
          hint={failing ? 'look at these first' : 'every schedule ended clean'}
        />
        <StatTile
          label="Reports sent"
          value={num(appState.sentReports.length)}
          tone={appState.sentReports.length ? 'info' : 'neutral'}
          hint="to the key user and the QA lead"
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Schedules"
          subtitle="What runs, when it runs, and who owns it."
          actions={
            project ? (
              <Badge tone="info">{project.name}</Badge>
            ) : (
              <Badge tone="neutral">All projects</Badge>
            )
          }
        />
        {schedules.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={28} />}
            title="No schedule for this project yet"
            description="Nothing runs on its own for this project. Create a schedule, or look at every project at once."
            action={
              <span className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setAdding(true)}>
                  New schedule
                </Button>
                <Button onClick={() => setProject(ALL_PROJECTS)}>Show all projects</Button>
              </span>
            }
          />
        ) : (
          <DataTable
            rows={schedules}
            rowKey={(s) => s.id}
            rowTone={(s) => (s.lastResult === 'FAIL' ? 'danger' : s.lastResult === 'CONDITIONAL' ? 'warning' : undefined)}
            columns={[
              { key: 'id', header: 'ID', mono: true, width: 80 },
              { key: 'name', header: 'Schedule', width: 190 },
              { key: 'what', header: 'What it runs' },
              { key: 'when', header: 'When', width: 200 },
              {
                key: 'project',
                header: 'Project',
                width: 170,
                render: (s) => (
                  <Badge tone={s.project === ALL_PROJECTS ? 'neutral' : 'primary'}>
                    {s.project === ALL_PROJECTS ? 'All projects' : projectById(s.project)?.name ?? s.project}
                  </Badge>
                ),
              },
              { key: 'scenarios', header: 'Scenarios', align: 'right', mono: true, width: 100 },
              {
                key: 'lastResult',
                header: 'Last result',
                width: 130,
                render: (s) =>
                  s.lastRunId ? (
                    <button
                      type="button"
                      className="rounded-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/report/${s.lastRunId}`)
                      }}
                    >
                      <Badge
                        tone={
                          s.lastResult === 'PASS'
                            ? 'success'
                            : s.lastResult === 'FAIL'
                              ? 'danger'
                              : s.lastResult === 'CONDITIONAL'
                                ? 'warning'
                                : 'neutral'
                        }
                      >
                        {s.lastResult}
                      </Badge>
                    </button>
                  ) : (
                    <Badge tone="neutral">{s.lastResult}</Badge>
                  ),
              },
              { key: 'lastRun', header: 'Last run', width: 150 },
              { key: 'nextRun', header: 'Next run', width: 190 },
              {
                key: 'on',
                header: 'On',
                width: 110,
                sortable: false,
                render: (s) => (
                  <span onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={s.on}
                      size="sm"
                      onChange={() => {
                        store.toggleSchedule(s.id)
                        toast({
                          title: `${s.name} switched ${s.on ? 'off' : 'on'}`,
                          description: s.on ? 'It will not run again until it is switched back on.' : `Next run: ${s.nextRun}.`,
                          tone: s.on ? 'warning' : 'success',
                        })
                      }}
                    />
                  </span>
                ),
                value: (s) => (s.on ? 1 : 0),
              },
              {
                key: 'actions',
                header: '',
                sortable: false,
                width: 110,
                render: (s) => (
                  <Button
                    size="sm"
                    leftIcon={<Play size={13} />}
                    onClick={(e) => {
                      e.stopPropagation()
                      runNow(s.id)
                    }}
                  >
                    Run now
                  </Button>
                ),
              },
            ]}
            empty="No schedule matches this project."
          />
        )}
        <SourceNote
          title="How a schedule turns into a run"
          reads={[
            { label: 'Schedules on this page', note: 'what to run and when' },
            { label: 'Approved scenarios', route: '/studio', note: 'only approved scenarios are ever run' },
          ]}
          computes="starts the run at the trigger, keeps the verdict, and sends the report to the people named on the schedule"
          feeds={[
            { label: 'Run Centre', route: '/run' },
            { label: 'Evidence & Reports', route: '/evidence' },
            { label: 'Command Centre', route: '/' },
          ]}
          steps={[
            'A trigger fires: the clock, a SAP transport, a D365 F&O OneCore update or the month-end close.',
            'The scenarios approved for that project are run in the same order every time.',
            'The verdict is kept against the schedule, and the run appears in Evidence & Reports.',
            'The report is sent to the people named on the schedule, with a link to the run.',
          ]}
        />
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Next three runs" subtitle="What the factory will do on its own, without anyone asking." />
          <CardBody className="space-y-2">
            {next.length === 0 ? (
              <p className="text-sm text-muted">Nothing is switched on, so nothing will run on its own.</p>
            ) : (
              next.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => runNow(s.id)}
                  className="flex w-full flex-wrap items-center gap-2 rounded-md border border-line px-3 py-2 text-left transition-colors hover:bg-surface2"
                >
                  <CalendarClock size={14} className="text-primary" />
                  <span className="text-sm font-medium text-text">{s.name}</span>
                  <span className="text-xs text-muted">{s.what}</span>
                  <span className="ml-auto font-mono text-[11px] text-subtle">{s.nextRun}</span>
                </button>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Reports sent" subtitle="Every scheduled run sends its report to the people who own it." />
          {appState.sentReports.length === 0 ? (
            <EmptyState
              icon={<Send size={26} />}
              title="No report has been sent in this session"
              description="Press Run now on a schedule. When the run finishes the report is sent to the people named on it, and the link appears here."
            />
          ) : (
            <DataTable
              rows={appState.sentReports}
              rowKey={(r) => r.id}
              onRowClick={(r) => navigate(`/report/${r.runId}`)}
              columns={[
                { key: 'id', header: 'Report', mono: true, width: 90 },
                { key: 'schedule', header: 'Schedule' },
                { key: 'runId', header: 'Run', mono: true, width: 110 },
                { key: 'sentTo', header: 'Sent to', render: (r) => r.sentTo.join(', '), width: 170 },
                { key: 'sentAt', header: 'Sent', width: 160 },
              ]}
              empty="No report sent yet."
            />
          )}
        </Card>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="New schedule" subtitle="It starts switched on.">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Nightly recycling check"
            />
          </div>
          <div>
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">What it runs</label>
            <Input
              value={form.what}
              onChange={(e) => setForm((f) => ({ ...f, what: e.target.value }))}
              placeholder="Scrap to stock, end to end"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-label font-semibold uppercase text-subtle">When</label>
              <Select value={form.when} onChange={(e) => setForm((f) => ({ ...f, when: e.target.value as ScheduleWhen }))}>
                {SCHEDULE_WHEN.map((w) => (
                  <option key={w}>{w}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-label font-semibold uppercase text-subtle">Project</label>
              <Select value={form.project} onChange={(e) => setForm((f) => ({ ...f, project: e.target.value }))}>
                <option value={ALL_PROJECTS}>All projects</option>
                {PROJECTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-label font-semibold uppercase text-subtle">Scenarios</label>
            <Input
              type="number"
              min={1}
              value={form.scenarios}
              onChange={(e) => setForm((f) => ({ ...f, scenarios: Number(e.target.value) }))}
            />
          </div>
          <p className="text-xs text-muted">The report goes to the Key User and the QA Lead.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button variant="primary" disabled={!form.name.trim()} onClick={save}>
              Create the schedule
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
