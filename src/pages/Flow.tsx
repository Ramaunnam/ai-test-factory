import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronDown,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Search,
  Truck,
  Wrench,
} from 'lucide-react'
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
  EmptyState,
  MonoId,
  SearchInput,
  SectionTitle,
  StatTile,
  Switch,
  type Column,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { JourneyBar } from '@/components/domain/JourneyBar'
import { FlowMap, MapLegend } from '@/components/domain/FlowMap'
import { TraceTimeline } from '@/components/domain/TraceTimeline'
import { SourceNote } from '@/components/domain/SourceNote'
import { engine, FAULTS } from '@/sim/engine'
import { runAllChecks, runCheck, checkSummary, type CheckResult } from '@/sim/checks'
import { useSim, useSimVersion } from '@/sim/useSim'
import { trace, traceSuggestions } from '@/sim/trace'
import { SYSTEMS, SYSTEM_TABLES_BY_SYSTEM, interfaceById } from '@/data/flowHelpers'
import { fmtSim, num } from '@/lib/format'
import { useDrawer } from '@/providers/DrawerProvider'
import { useToast } from '@/providers/ToastProvider'
import { store } from '@/data/appStore'
import type { Message, TableName } from '@/sim/types'

/* -------------------------------------------------------------------------- */
/* shared                                                                     */
/* -------------------------------------------------------------------------- */

function useFlowTabs(results: CheckResult[]) {
  const failing = results.filter((r) => r.status === 'fail').length
  return [
    { label: 'Live Flow', path: '/flow' },
    { label: 'System Data', path: '/flow/data' },
    { label: 'Live Checks', path: '/flow/checks', count: failing, tone: 'danger' as const },
    { label: 'Trace', path: '/flow/trace' },
  ]
}

function failingBySystem(results: CheckResult[]) {
  const out: Record<string, number> = {}
  results.forEach((r) => {
    if (!r.rows.length) return
    r.systems.forEach((sim) => {
      const meta = SYSTEMS.find((s) => s.sim === sim)
      if (!meta) return
      out[meta.id] = (out[meta.id] ?? 0) + r.rows.length
    })
  })
  return out
}

function recordCounts() {
  const out: Record<string, number> = {}
  SYSTEMS.forEach((s) => {
    if (!s.sim) {
      out[s.id] = 0
      return
    }
    out[s.id] = (SYSTEM_TABLES_BY_SYSTEM[s.sim] ?? []).reduce(
      (sum, table) => sum + engine.db[table].length,
      0,
    )
  })
  return out
}

function trafficCounts(now: number) {
  const out: Record<string, number> = {}
  engine.messages.forEach((m) => {
    if (m.sentAt < now - 120) return
    out[m.interfaceId] = (out[m.interfaceId] ?? 0) + 1
  })
  return out
}

function useMessageDrawer() {
  const drawer = useDrawer()
  const navigate = useNavigate()
  return (m: Message) => {
    drawer.open({
      title: `${m.interfaceId} · ${m.summary}`,
      subtitle: `${m.from} → ${m.to} · sent ${fmtSim(m.sentAt)} · arrives ${fmtSim(m.arriveAt)}`,
      width: 'md',
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={m.status === 'delivered' ? 'success' : m.status === 'lost' ? 'danger' : m.status === 'duplicate' ? 'warning' : 'info'}>
              {m.status}
            </Badge>
            {m.fault && <Badge tone="danger">damaged by {m.fault}</Badge>}
            <Badge tone="neutral" mono>
              {m.key}
            </Badge>
          </div>
          <div>
            <div className="mb-1.5 text-label font-semibold uppercase text-subtle">Payload</div>
            <CodeBlock>{JSON.stringify(m.payload, null, 2)}</CodeBlock>
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              drawer.closeAll()
              navigate(`/flow/trace?q=${encodeURIComponent(m.key)}`)
            }}
          >
            Follow through every system
          </Button>
        </div>
      ),
    })
  }
}

/* -------------------------------------------------------------------------- */
/* Live Flow                                                                  */
/* -------------------------------------------------------------------------- */

export function LiveFlowPage() {
  const { engine: eng } = useSim()
  const navigate = useNavigate()
  const toast = useToast()
  const openMessage = useMessageDrawer()
  const [results, setResults] = useState<CheckResult[]>(() => runAllChecks())

  useEffect(() => {
    const id = window.setInterval(() => setResults(runAllChecks()), 2000)
    return () => window.clearInterval(id)
  }, [])

  const tabs = useFlowTabs(results)
  const counts = recordCounts()
  const failing = failingBySystem(results)
  const traffic = trafficCounts(eng.now)
  const inFlight = eng.messages.filter((m) => m.status === 'in flight' && m.arriveAt > eng.now)
  const delivered = eng.messages.filter((m) => m.status === 'delivered').length
  const damaged = eng.messages.filter((m) => m.status === 'lost' || m.status === 'duplicate' || m.fault).length
  const failingChecks = results.filter((r) => r.status === 'fail').length

  return (
    <>
      <PageHeader
        title="Live Data Flow"
        subtitle="The plant is running. Every record you see was produced by the simulation, moved across an interface and checked on arrival."
        tabs={tabs}
        actions={
          <>
            <Button leftIcon={<Truck size={15} />} onClick={() => { eng.addTruck(); toast({ title: 'A steel truck went through the gate', tone: 'success' }) }}>
              Truck arrives now
            </Button>
            <Button
              variant={eng.running ? 'secondary' : 'primary'}
              leftIcon={eng.running ? <Pause size={15} /> : <Play size={15} />}
              onClick={() => eng.toggle()}
            >
              {eng.running ? 'Pause' : 'Run the plant'}
            </Button>
          </>
        }
      />

      {/* control bar */}
      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-3 py-3">
          <div className="flex items-center gap-2">
            <span className="text-label font-semibold uppercase text-subtle">Plant clock</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-text">{fmtSim(eng.now)}</span>
          </div>
          <span className="h-5 w-px bg-line" />
          <div className="flex items-center gap-1.5">
            {([1, 4, 10, 30] as const).map((s) => (
              <Chip key={s} selected={eng.speed === s} onClick={() => eng.setSpeed(s)} title={`${s} simulated minutes per second`}>
                {s}x
              </Chip>
            ))}
          </div>
          <span className="h-5 w-px bg-line" />
          <Button size="sm" leftIcon={<Truck size={14} />} onClick={() => eng.addWagon()}>
            Wagon arrives now
          </Button>
          <Button size="sm" leftIcon={<FastForward size={14} />} onClick={() => { eng.fastForward(60); toast({ title: 'Skipped one hour', tone: 'info' }) }}>
            Skip 1 hour
          </Button>
          <Button
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            onClick={() => {
              eng.reset(eng.seed, 8)
              setResults(runAllChecks())
              toast({ title: 'Replayed the last eight hours', tone: 'info' })
            }}
          >
            Replay 8 hours
          </Button>
          <span className="ml-auto flex items-center gap-2 text-xs text-muted">
            <span className={cn('h-2 w-2 rounded-full', eng.running ? 'animate-pulseDot bg-success' : 'bg-subtle')} />
            {eng.running ? `running at ${eng.speed}x` : 'paused'}
          </span>
        </CardBody>
      </Card>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Vehicles through the gates" value={num(eng.counters.vehicles)} hint="last 24 simulated hours" onClick={() => navigate('/flow/data')} />
        <StatTile label="Records in all systems" value={num(eng.recordCount())} hint="nine systems" onClick={() => navigate('/flow/data')} />
        <StatTile label="Messages delivered" value={num(delivered)} tone="success" hint="across 9 live interfaces" onClick={() => navigate('/interfaces')} />
        <StatTile label="In flight" value={num(inFlight.length)} tone="info" hint="moving on the map right now" />
        <StatTile label="Damaged, lost or doubled" value={num(damaged)} tone={damaged ? 'danger' : 'neutral'} hint="caused by the fault switches" />
        <StatTile
          label="Live checks failing"
          value={`${failingChecks} of ${results.length}`}
          tone={failingChecks ? 'danger' : 'success'}
          hint="click to open the checks"
          onClick={() => navigate('/flow/checks')}
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="How the data moves"
          subtitle="Each dot is one message in flight, drawn at its real position between sending and arrival."
          actions={<MapLegend className="hidden xl:flex" />}
        />
        <div className="j2w-scroll overflow-x-auto p-3">
          <FlowMap
            counts={counts}
            failing={failing}
            trafficByInterface={traffic}
            messages={eng.messages}
            now={eng.now}
            onSystemClick={(s) => navigate(`/flow/data?system=${s.id}`)}
            onInterfaceClick={(id) => navigate(`/interfaces?interface=${id}`)}
            onMessageClick={openMessage}
          />
        </div>
        <div className="border-t border-line px-4 py-2 xl:hidden">
          <MapLegend />
        </div>
        <SourceNote
          title="What the dots actually are"
          reads={[
            { table: 'weighbridge_ticket', note: 'written when a vehicle is weighed' },
            { table: 'MSEG', note: 'written when SAP books the goods receipt' },
            { label: 'engine.messages', note: 'every message in flight between two systems' },
          ]}
          computes="interpolates each message between its send time and its arrival along the interface it travels on"
          feeds={[{ label: 'Live checks', route: '/flow/checks' }, { label: 'Interface Testing', route: '/interfaces' }]}
          steps={[
            'A truck, a recycling load or a heat creates rows in the system that owns them.',
            'Anything crossing a system boundary becomes a message with a payload and a travel time.',
            'A fault switch can damage, lose or duplicate that message on the way.',
            'The receiving system stores whatever arrived, which is what the live checks then compare.',
          ]}
        />
      </Card>

      <div className="mb-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader
            title="What can go wrong"
            subtitle="Every switch changes the data for real. Turn one off and replay to see the check turn green."
            actions={
              <div className="flex gap-2">
                <Button size="sm" onClick={() => { eng.setAllFaults(false); eng.reset(eng.seed + 1, 8); setResults(runAllChecks()); toast({ title: 'All faults off and replayed', tone: 'success' }) }}>
                  All faults off
                </Button>
                <Button size="sm" onClick={() => { eng.setAllFaults(true); eng.reset(eng.seed + 1, 8); setResults(runAllChecks()); toast({ title: 'All faults on and replayed', tone: 'warning' }) }}>
                  All faults on
                </Button>
              </div>
            }
          />
          <CardBody className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            {FAULTS.map((f) => (
              <div key={f.id} className="flex items-start gap-3">
                <Switch
                  checked={eng.faults[f.id]}
                  onChange={(v) => eng.setFault(f.id, v)}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text">{f.label}</span>
                    <Badge tone={eng.hits[f.id] ? 'danger' : 'neutral'} mono>
                      {eng.hits[f.id]} hits
                    </Badge>
                  </div>
                  <div className="font-mono text-[11px] text-subtle">{f.where}</div>
                  <p className="mt-0.5 text-xs text-muted">{f.breaks}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What just happened" subtitle="The plain-language event stream, newest first." />
          <div className="j2w-scroll j2w-log h-[420px] overflow-y-auto px-4 py-2">
            {[...eng.events].reverse().slice(0, 80).map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => navigate(`/flow/trace?q=${encodeURIComponent(e.key)}`)}
                className="flex w-full gap-2 rounded-sm px-1 py-1 text-left text-xs transition-colors hover:bg-surface2"
              >
                <span className="shrink-0 font-mono text-[11px] text-subtle">{fmtSim(e.at).slice(-5)}</span>
                <span className={cn('min-w-0 flex-1', e.tone === 'danger' ? 'text-danger' : e.tone === 'success' ? 'text-success' : 'text-muted')}>
                  {e.text}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Last messages" subtitle="The most recent traffic on the nine live interfaces." />
        <DataTable
          rows={[...eng.messages].reverse().slice(0, 60)}
          rowKey={(m) => m.id}
          onRowClick={openMessage}
          maxHeight={320}
          dense
          rowTone={(m) => (m.status === 'lost' || m.fault ? 'danger' : m.status === 'duplicate' ? 'warning' : undefined)}
          columns={[
            { key: 'sentAt', header: 'Sent', mono: true, width: 110, render: (m) => fmtSim(m.sentAt), value: (m) => m.sentAt },
            { key: 'interfaceId', header: 'Interface', mono: true, width: 90 },
            { key: 'summary', header: 'What moved' },
            { key: 'route', header: 'From → to', width: 240, render: (m) => `${m.from} → ${m.to}`, value: (m) => m.from },
            { key: 'status', header: 'Status', width: 110, render: (m) => (
              <Badge tone={m.status === 'delivered' ? 'success' : m.status === 'lost' ? 'danger' : m.status === 'duplicate' ? 'warning' : 'info'}>
                {m.status}
              </Badge>
            ) },
          ]}
        />
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* System Data                                                                */
/* -------------------------------------------------------------------------- */

export function SystemDataPage() {
  const version = useSimVersion()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [results, setResults] = useState<CheckResult[]>(() => runAllChecks())

  useEffect(() => {
    const id = window.setInterval(() => setResults(runAllChecks()), 2500)
    return () => window.clearInterval(id)
  }, [])

  const liveSystems = SYSTEMS.filter((s) => s.sim)
  const systemId = params.get('system') ?? liveSystems[0].id
  const system = liveSystems.find((s) => s.id === systemId) ?? liveSystems[0]
  const tables = system.sim ? SYSTEM_TABLES_BY_SYSTEM[system.sim] : []
  const tableName = (params.get('table') as TableName) ?? tables[0]
  const table = tables.includes(tableName) ? tableName : tables[0]

  const counts = useMemo(() => recordCounts(), [version])
  const failing = failingBySystem(results)

  const rows = useMemo(() => {
    const data = engine.db[table] as unknown as Record<string, unknown>[]
    return [...data].reverse().slice(0, 200)
  }, [table, version])

  const flaggedKeys = useMemo(() => {
    const set = new Set<string>()
    results.forEach((r) => r.rows.forEach((row) => row.cells.forEach((c) => c && set.add(String(c)))))
    return set
  }, [results])

  const columns: Column<Record<string, unknown>>[] = useMemo(() => {
    const sample = rows[0]
    if (!sample) return []
    return Object.keys(sample).map((k) => ({
      key: k,
      header: k,
      mono: true,
      align: typeof sample[k] === 'number' ? ('right' as const) : ('left' as const),
      render: (row) => {
        const v = row[k]
        if (v === null || v === undefined) return <span className="text-danger">empty</span>
        if (k.endsWith('ed') || k === 'arrived' || k === 'posted' || k === 'run_at') {
          if (typeof v === 'number' && v > 0 && v < 100000) return fmtSim(v)
        }
        return typeof v === 'number' ? num(v, Number.isInteger(v) ? 0 : 2) : String(v)
      },
      value: (row) => (typeof row[k] === 'number' ? (row[k] as number) : String(row[k] ?? '')),
    }))
  }, [rows])

  return (
    <>
      <PageHeader
        title="System Data"
        subtitle="The actual tables behind each system. Red rows are the ones a live check disagrees with."
        tabs={useFlowTabs(results)}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {liveSystems.map((s) => (
          <StatTile
            key={s.id}
            label={s.short}
            value={num(counts[s.id] ?? 0)}
            tone={failing[s.id] ? 'danger' : 'neutral'}
            hint={failing[s.id] ? `${failing[s.id]} failing records` : 'data agrees'}
            onClick={() => setParams({ system: s.id })}
          />
        ))}
      </div>

      <Card>
        <CardHeader
          title={system.name}
          subtitle={`${system.type} · ${system.method} · ${system.account}`}
          actions={
            <div className="flex flex-wrap gap-1.5">
              {tables.map((t) => (
                <Chip key={t} selected={t === table} onClick={() => setParams({ system: system.id, table: t })}>
                  {t}
                </Chip>
              ))}
            </div>
          }
        />
        {rows.length ? (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(_, i) => String(i)}
            searchable
            searchPlaceholder={`Search ${table}`}
            maxHeight={520}
            dense
            rowTone={(row) =>
              Object.values(row).some((v) => typeof v === 'string' && flaggedKeys.has(v)) ? 'danger' : undefined
            }
            onRowClick={(row) => {
              const key =
                (row.gate_pass as string) ??
                (row.xblnr as string) ??
                (row.heat as string) ??
                (row.batch as string) ??
                (row.vehicle as string) ??
                (row.receipt as string) ??
                (row.belnr as string)
              if (key) navigate(`/flow/trace?q=${encodeURIComponent(String(key))}`)
            }}
            footerNote={<span>newest 200 rows of the last 24 simulated hours</span>}
          />
        ) : (
          <EmptyState title="No rows yet" description="Let the plant run for a minute, or send a truck through the gate." />
        )}
      </Card>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Live Checks                                                                */
/* -------------------------------------------------------------------------- */

export function LiveChecksPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [live, setLive] = useState(true)
  const [results, setResults] = useState<CheckResult[]>(() => runAllChecks())
  const [running, setRunning] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>('C1')

  useEffect(() => {
    if (!live) return
    const id = window.setInterval(() => setResults(runAllChecks()), 2000)
    return () => window.clearInterval(id)
  }, [live])

  const summary = checkSummary(results)

  const runAllAnimated = () => {
    const ids = results.map((r) => r.id)
    let i = 0
    const step = () => {
      if (i >= ids.length) {
        setRunning(null)
        toast({ title: 'All checks finished', tone: 'info' })
        return
      }
      setRunning(ids[i])
      setResults((prev) => prev.map((r) => (r.id === ids[i] ? runCheck(r.id) : r)))
      i += 1
      window.setTimeout(step, 220)
    }
    step()
  }

  return (
    <>
      <JourneyBar step={6} />
      <PageHeader
        title="Live Checks"
        subtitle="Nine rules written in business language, run against the real data in all nine systems."
        tabs={useFlowTabs(results)}
        actions={
          <>
            <Switch checked={live} onChange={setLive} label="Re-check as data arrives" size="sm" />
            <Button variant="primary" onClick={runAllAnimated}>
              Run all checks now
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <span className="text-sm text-text">
            <span className={cn('font-mono font-semibold', summary.passing === summary.total ? 'text-success' : 'text-danger')}>
              {summary.passing} of {summary.total}
            </span>{' '}
            checks pass
          </span>
          <span className="text-sm text-muted">
            <span className="font-mono tabular-nums">{num(summary.compared)}</span> records compared
          </span>
          <span className="text-sm text-muted">
            <span className={cn('font-mono tabular-nums', summary.disagree ? 'text-danger' : 'text-success')}>
              {num(summary.disagree)}
            </span>{' '}
            disagree
          </span>
          <span className="ml-auto text-xs text-subtle">plant clock {fmtSim(engine.now)}</span>
        </CardBody>
        <SourceNote
          title="How a live check works"
          reads={[{ table: 'weighbridge_ticket' }, { table: 'MSEG' }, { table: 'chemistry' }, { table: 'stock_posting' }]}
          computes="joins the tables on their shared key and reports every row where two systems disagree"
          feeds={[{ label: 'Confidence score', route: '/' }, { label: 'Findings', route: '/run' }]}
          steps={[
            'Each check is one business rule written as a readable query.',
            'Records still in flight are ignored, so a check never fails just because a message has not landed yet.',
            'A failing row carries a plain-language cause, not just a difference.',
            'Raise finding turns those rows into a finding; Fix the cause switches the fault off and replays.',
          ]}
        />
      </Card>

      <div className="space-y-3">
        {results.map((r) => {
          const expanded = open === r.id
          const isRunning = running === r.id
          return (
            <Card key={r.id} tone={r.status === 'fail' ? 'danger' : 'default'}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : r.id)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface2/60"
              >
                <Badge tone={isRunning ? 'info' : r.status === 'pass' ? 'success' : 'danger'} mono>
                  {r.id}
                </Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{r.title}</span>
                  <span className="block truncate text-xs text-muted">{r.sentence}</span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted sm:block">
                  {num(r.compared)} compared · {r.rows.length ? `${num(r.rows.length)} disagree` : 'all agree'}
                </span>
                <Badge tone={isRunning ? 'info' : r.status === 'pass' ? 'success' : 'danger'}>
                  {isRunning ? 'running' : r.status === 'pass' ? 'pass' : 'fail'}
                </Badge>
                <ChevronDown size={16} className={cn('shrink-0 text-subtle transition-transform', expanded && 'rotate-180')} />
              </button>

              {expanded && (
                <div className="border-t border-line">
                  {r.rows.length > 0 ? (
                    <DataTable
                      rows={r.rows}
                      rowKey={(row, i) => `${row.key}-${i}`}
                      maxHeight={300}
                      dense
                      rowTone={() => 'danger'}
                      columns={[
                        ...r.columns.map((c, i) => ({
                          key: `c${i}`,
                          header: c,
                          mono: true,
                          render: (row: { cells: (string | number | null)[] }) =>
                            row.cells[i] === null || row.cells[i] === undefined ? (
                              <span className="text-danger">missing</span>
                            ) : typeof row.cells[i] === 'number' ? (
                              num(row.cells[i] as number, Number.isInteger(row.cells[i]) ? 0 : 2)
                            ) : (
                              String(row.cells[i])
                            ),
                          value: (row: { cells: (string | number | null)[] }) => row.cells[i] ?? '',
                        })),
                        {
                          key: 'why',
                          header: 'Why',
                          render: (row: { why: string }) => <span className="text-xs text-muted">{row.why}</span>,
                        },
                        {
                          key: 'trace',
                          header: '',
                          sortable: false,
                          width: 80,
                          render: (row: { key: string }) => (
                            <Button
                              size="sm"
                              variant="link"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate(`/flow/trace?q=${encodeURIComponent(row.key)}`)
                              }}
                            >
                              Trace
                            </Button>
                          ),
                        },
                      ] as Column<{ key: string; cells: (string | number | null)[]; why: string }>[]}
                    />
                  ) : (
                    <div className="px-5 py-6 text-sm text-success">
                      Every record agrees. {num(r.compared)} records were compared across {r.systems.join(' and ')}.
                    </div>
                  )}

                  <div className="grid gap-4 border-t border-line px-5 py-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-1.5 text-label font-semibold uppercase text-subtle">What feeds this check</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <Badge tone="neutral">{r.process}</Badge>
                        <Badge tone="neutral">{r.stage}</Badge>
                        <button
                          type="button"
                          className="rounded-sm font-mono text-primary hover:underline"
                          onClick={() => navigate(`/interfaces?interface=${r.interfaceId}`)}
                        >
                          {r.interfaceId}
                        </button>
                        <span>{interfaceById(r.interfaceId)?.name}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.faults.length === 0 && <span className="text-xs text-subtle">No fault switch affects this check.</span>}
                        {r.faults.map((f) => (
                          <Badge key={f} tone={engine.faults[f] ? 'danger' : 'neutral'}>
                            {f} {engine.faults[f] ? 'on' : 'off'}
                          </Badge>
                        ))}
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs font-medium text-muted hover:text-text">Show the query</summary>
                        <CodeBlock className="mt-2">{r.sql}</CodeBlock>
                      </details>
                    </div>

                    <div className="flex flex-col gap-2 lg:items-end lg:justify-start">
                      <Button
                        leftIcon={<AlertTriangle size={15} />}
                        disabled={!r.rows.length}
                        onClick={() => {
                          const id = store.addFinding({
                            title: `${r.title} — ${r.rows.length} records disagree`,
                            severity: r.rows.length > 8 ? 'Critical' : 'High',
                            status: 'Open',
                            process: r.process,
                            stage: r.stage,
                            system: r.systems.join(' / '),
                            interfaceId: r.interfaceId,
                            check: r.id,
                            raised: fmtSim(engine.now),
                            raisedBy: 'Interface Watch agent',
                            detail: `${r.sentence} ${r.rows.length} of ${r.compared} records compared do not agree. Typical cause: ${r.rows[0]?.why ?? ''}`,
                            evidence: [`Live check ${r.id}`, `Interface ${r.interfaceId}`, 'Plant data at ' + fmtSim(engine.now)],
                            affectedKeys: r.rows.slice(0, 12).map((row) => row.key),
                          })
                          toast({
                            title: `Finding ${id} raised`,
                            description: 'It is now in the Run Centre findings and the approvals queue.',
                            tone: 'warning',
                            action: { label: 'Open the finding', onClick: () => navigate(`/finding/${id}`) },
                          })
                          navigate(`/finding/${id}`)
                        }}
                      >
                        Raise finding
                      </Button>
                      <Button
                        variant="ai"
                        leftIcon={<Wrench size={15} />}
                        disabled={!r.faults.length}
                        onClick={() => {
                          engine.fixAndReplay(r.faults)
                          setResults(runAllChecks())
                          toast({
                            title: `${r.faults.join(' and ')} switched off and the plant replayed`,
                            description: `${r.id} should now be green.`,
                            tone: 'success',
                          })
                        }}
                      >
                        Fix the cause and replay
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Trace                                                                      */
/* -------------------------------------------------------------------------- */

export function TracePage() {
  const version = useSimVersion()
  const [params, setParams] = useSearchParams()
  const [results, setResults] = useState<CheckResult[]>(() => runAllChecks())
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)

  useEffect(() => setInput(q), [q])
  useEffect(() => {
    const id = window.setInterval(() => setResults(runAllChecks()), 4000)
    return () => window.clearInterval(id)
  }, [])

  const result = useMemo(() => (q ? trace(q) : null), [q, version])
  const failingKeys = results.flatMap((r) => r.rows.map((row) => row.key))
  const suggestions = traceSuggestions(failingKeys)

  return (
    <>
      <PageHeader
        title="Trace"
        subtitle="Start from a vehicle, gate pass, batch, heat or invoice and follow it through every system it touched."
        tabs={useFlowTabs(results)}
      />

      <Card className="mb-4">
        <CardBody className="space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setParams(input ? { q: input } : {})
            }}
            className="flex flex-wrap gap-2"
          >
            <SearchInput value={input} onChange={setInput} placeholder="VH-7741, GP-PL01-2026-4182, BT-00412, HT-26-48210…" className="min-w-[280px] flex-1" />
            <Button type="submit" variant="primary" leftIcon={<Search size={15} />}>
              Follow it
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-semibold uppercase text-subtle">Failing</span>
            {suggestions.failing.length === 0 && <span className="text-xs text-success">nothing is failing right now</span>}
            {suggestions.failing.map((k) => (
              <Chip key={k} tone="danger" onClick={() => setParams({ q: k })}>
                {k}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-semibold uppercase text-subtle">Clean</span>
            {suggestions.clean.map((k) => (
              <Chip key={k} onClick={() => setParams({ q: k })}>
                {k}
              </Chip>
            ))}
          </div>
        </CardBody>
      </Card>

      {!result && (
        <EmptyState
          icon={<Search size={28} />}
          title="Pick something to follow"
          description="Choose one of the chips above, or paste any reference from a table, a message or a finding."
        />
      )}

      {result && !result.found && (
        <EmptyState
          icon={<Search size={28} />}
          title={`Nothing found for “${result.query}”`}
          description="Only the last 24 simulated hours are kept. Try one of the suggestions above."
        />
      )}

      {result?.found && (
        <>
          <Card tone={result.tone === 'danger' ? 'danger' : 'success'} className="mb-4">
            <CardBody className="flex flex-wrap items-center gap-3">
              <Badge tone={result.tone === 'danger' ? 'danger' : 'success'}>
                {result.tone === 'danger' ? 'Systems disagree' : 'Systems agree'}
              </Badge>
              <span className="min-w-0 flex-1 text-sm text-text">{result.verdict}</span>
              <MonoId value={result.key} />
            </CardBody>
          </Card>

          <SectionTitle title="Record by record" hint={`${result.records.length} records and ${result.messages.length} messages, in the order they happened.`} />
          <TraceTimeline result={result} />
        </>
      )}
    </>
  )
}
