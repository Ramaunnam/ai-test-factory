import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Play, Sparkles } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CodeBlock,
  DataTable,
  FieldGrid,
  Input,
  LiveLog,
  SegmentedControl,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { FlowMap, MapLegend } from '@/components/domain/FlowMap'
import { INTERFACES, SYSTEMS, type SystemMeta } from '@/data'
import { SYSTEM_TABLES_BY_SYSTEM } from '@/data/flowHelpers'
import { engine } from '@/sim/engine'
import { useChecks } from '@/sim/useSim'
import { num } from '@/lib/format'
import { useDrawer } from '@/providers/DrawerProvider'

export function LandscapePage() {
  const navigate = useNavigate()
  const drawer = useDrawer()
  const checks = useChecks()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'map' | 'sources'>('map')

  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    SYSTEMS.forEach((s) => {
      out[s.id] = s.sim ? (SYSTEM_TABLES_BY_SYSTEM[s.sim] ?? []).reduce((n, t) => n + engine.db[t].length, 0) : 0
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checks])

  const failing = useMemo(() => {
    const out: Record<string, number> = {}
    checks.forEach((c) => {
      if (!c.rows.length) return
      c.systems.forEach((sim) => {
        const meta = SYSTEMS.find((s) => s.sim === sim)
        if (meta) out[meta.id] = (out[meta.id] ?? 0) + c.rows.length
      })
    })
    return out
  }, [checks])

  const openSystem = (s: SystemMeta) => {
    drawer.open({
      title: s.name,
      subtitle: `${s.type} · owned by ${s.owner}`,
      width: 'md',
      content: (
        <div className="space-y-4">
          <FieldGrid
            columns={2}
            fields={[
              { label: 'Band', value: s.band },
              { label: 'Method', value: s.method },
              { label: 'Service account', value: s.account },
              { label: 'Response', value: `${s.responseMs} ms` },
              { label: 'Records held', value: num(counts[s.id] ?? 0) },
              { label: 'Failing records', value: num(failing[s.id] ?? 0), flagged: !!failing[s.id] },
            ]}
          />
          <div>
            <div className="mb-1.5 text-label font-semibold uppercase text-subtle">Data sources</div>
            <div className="flex flex-wrap gap-1.5">
              {s.sources.length ? s.sources.map((src) => <Badge key={src} mono>{src}</Badge>) : <span className="text-xs text-subtle">none wired for this POC</span>}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-label font-semibold uppercase text-subtle">Interfaces</div>
            <div className="space-y-1.5">
              {INTERFACES.filter((i) => i.from === s.id || i.to === s.id).map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    drawer.closeAll()
                    navigate(`/interfaces?interface=${i.id}`)
                  }}
                  className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface2"
                >
                  <span className="font-mono font-semibold text-text">{i.id}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{i.name}</span>
                  <Badge tone={i.live ? 'info' : 'neutral'}>{i.live ? 'live' : 'static'}</Badge>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {s.sim && (
              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  drawer.closeAll()
                  navigate(`/flow/data?system=${s.id}`)
                }}
              >
                Open its tables
              </Button>
            )}
            <Button
              fullWidth
              onClick={() => {
                drawer.closeAll()
                navigate('/systems')
              }}
            >
              Connection details
            </Button>
          </div>
        </div>
      ),
    })
  }

  const openInterface = (id: string) => {
    const i = INTERFACES.find((x) => x.id === id)
    if (!i) return
    const from = SYSTEMS.find((s) => s.id === i.from)!
    const to = SYSTEMS.find((s) => s.id === i.to)!
    drawer.open({
      title: `${i.id} · ${i.name}`,
      subtitle: `${from.name} → ${to.name}`,
      width: 'md',
      content: (
        <div className="space-y-4">
          <FieldGrid
            columns={2}
            fields={[
              { label: 'Method', value: i.method },
              { label: 'Frequency', value: i.frequency },
              { label: 'Process', value: i.process },
              { label: 'Traffic', value: i.live ? 'live in this demo' : 'static reference' },
            ]}
          />
          <div>
            <div className="mb-1.5 text-label font-semibold uppercase text-subtle">Payload fields</div>
            <CodeBlock>{i.payload.split(', ').join('\n')}</CodeBlock>
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => {
              drawer.closeAll()
              navigate(`/interfaces?interface=${i.id}`)
            }}
          >
            Open interface testing
          </Button>
        </div>
      ),
    })
  }

  // deep link ?system=
  useEffect(() => {
    const id = params.get('system')
    if (!id) return
    const s = SYSTEMS.find((x) => x.id === id)
    if (s) openSystem(s)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  return (
    <>
      <PageHeader
        title="Enterprise Map"
        subtitle="Ten systems and fourteen interfaces. Nine of the interfaces carry live traffic in this demo."
        actions={
          <SegmentedControl
            value={view}
            onChange={setView}
            ariaLabel="Map view"
            options={[
              { value: 'map', label: 'Map' },
              { value: 'sources', label: 'Data sources and checks' },
            ]}
          />
        }
      />

      {view === 'map' ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Systems" value={num(SYSTEMS.length)} hint="three bands" />
            <StatTile label="Interfaces" value={num(INTERFACES.length)} hint={`${INTERFACES.filter((i) => i.live).length} carry live traffic`} />
            <StatTile label="Records held" value={num(Object.values(counts).reduce((a, b) => a + b, 0))} hint="last 24 simulated hours" onClick={() => navigate('/flow/data')} />
            <StatTile
              label="Systems with failing records"
              value={num(Object.keys(failing).length)}
              tone={Object.keys(failing).length ? 'danger' : 'success'}
              onClick={() => navigate('/flow/checks')}
            />
          </div>

          <Card>
            <CardHeader title="The landscape" subtitle="Click a system or an interface for its details." actions={<MapLegend className="hidden xl:flex" />} />
            <div className="j2w-scroll overflow-x-auto p-3">
              <FlowMap counts={counts} failing={failing} onSystemClick={openSystem} onInterfaceClick={openInterface} />
            </div>
          </Card>

          <Card className="mt-4">
            <CardHeader title="Every interface" subtitle="Click a row to open it in interface testing." />
            <DataTable
              rows={INTERFACES}
              rowKey={(i) => i.id}
              onRowClick={(i) => navigate(`/interfaces?interface=${i.id}`)}
              searchable
              columns={[
                { key: 'id', header: 'Interface', mono: true, width: 100 },
                { key: 'name', header: 'What it carries' },
                { key: 'from', header: 'From', render: (i) => SYSTEMS.find((s) => s.id === i.from)?.short ?? i.from },
                { key: 'to', header: 'To', render: (i) => SYSTEMS.find((s) => s.id === i.to)?.short ?? i.to },
                { key: 'method', header: 'Method', width: 110 },
                { key: 'frequency', header: 'Frequency', width: 130 },
                { key: 'live', header: 'Traffic', width: 100, render: (i) => <Badge tone={i.live ? 'info' : 'neutral'}>{i.live ? 'live' : 'static'}</Badge>, value: (i) => (i.live ? 1 : 0) },
              ]}
            />
          </Card>
        </>
      ) : (
        <DataSourcesTab />
      )}
    </>
  )
}

function DataSourcesTab() {
  const [rule, setRule] = useState('net weight must equal gross minus tare')
  const [phase, setPhase] = useState<'idle' | 'writing' | 'done'>('idle')

  const lines = [
    `Reading the rule: "${rule}"`,
    'Finding the data: yard.weighbridge_ticket (gross_kg, tare_kg, net_kg)',
    'Choosing a tolerance: 20 kg, the weighbridge resolution',
    'Writing the query…',
    'Running it against the last 24 hours of plant data…',
    'Result: every row agrees. The check is now live.',
  ]

  const sql = `select t.ticket, t.gross_kg, t.tare_kg, t.net_kg,
       (t.gross_kg - t.tare_kg) as expected_net
from   yard.weighbridge_ticket t
where  abs(t.net_kg - (t.gross_kg - t.tare_kg)) > 20`

  const rows = engine.db.weighbridge_ticket.slice(-6).map((t) => ({
    ticket: t.ticket,
    gross: t.gross_kg,
    tare: t.tare_kg,
    net: t.net_kg,
    expected: t.gross_kg - t.tare_kg,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Write a rule in plain English" subtitle="The agent turns it into a query, runs it, and keeps it running." icon={<Sparkles size={16} className="text-ai" />} />
        <CardBody className="space-y-3">
          <Input value={rule} onChange={(e) => setRule(e.target.value)} placeholder="net weight must equal gross minus tare" />
          <div className="flex flex-wrap gap-2">
            {['net weight must equal gross minus tare', 'every batch must have a molybdenum value', 'stock must be posted in KG'].map((r) => (
              <Button key={r} size="sm" variant="ghost" onClick={() => { setRule(r); setPhase('idle') }}>
                {r}
              </Button>
            ))}
          </div>
          <Button
            variant="ai"
            leftIcon={<Play size={15} />}
            loading={phase === 'writing'}
            onClick={() => {
              setPhase('writing')
              window.setTimeout(() => setPhase('done'), lines.length * 420 + 150)
            }}
          >
            Write and run the check
          </Button>
          {phase !== 'idle' && <LiveLog lines={lines} running={phase === 'writing'} height={160} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What the agent produced" subtitle="The query and the rows it compared." />
        <CardBody className="space-y-3">
          {phase === 'done' ? (
            <>
              <CodeBlock>{sql}</CodeBlock>
              <DataTable
                rows={rows}
                rowKey={(r) => r.ticket}
                dense
                columns={[
                  { key: 'ticket', header: 'Ticket', mono: true },
                  { key: 'gross', header: 'Gross', align: 'right', mono: true },
                  { key: 'tare', header: 'Tare', align: 'right', mono: true },
                  { key: 'net', header: 'Net', align: 'right', mono: true },
                  { key: 'expected', header: 'Expected net', align: 'right', mono: true },
                ]}
              />
              <p className="text-xs text-success">All rows agree. This check now runs with the other nine on Live Checks.</p>
            </>
          ) : (
            <p className="py-10 text-center text-sm text-muted">Run the rule to see the query and the result.</p>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
