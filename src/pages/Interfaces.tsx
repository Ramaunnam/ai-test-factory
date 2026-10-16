import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Share2, Truck } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CodeBlock,
  DataTable,
  EmptyState,
  SectionTitle,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { INTERFACES, SYSTEMS } from '@/data'
import { engine } from '@/sim/engine'
import { useSimVersion } from '@/sim/useSim'
import { fmtSim, num } from '@/lib/format'
import { useDrawer } from '@/providers/DrawerProvider'
import type { Message } from '@/sim/types'

interface Totals {
  sent: number
  received: number
  matched: number
  mismatched: number
  missing: number
  duplicated: number
}

function totalsFor(messages: Message[]): Totals {
  const sent = messages.length
  const received = messages.filter((m) => m.status === 'delivered' || m.status === 'duplicate').length
  const missing = messages.filter((m) => m.status === 'lost').length
  const duplicated = messages.filter((m) => m.status === 'duplicate').length
  const mismatched = messages.filter((m) => m.fault && m.status !== 'lost' && m.status !== 'duplicate').length
  return { sent, received, matched: received - mismatched - duplicated, mismatched, missing, duplicated }
}

export function InterfacesPage() {
  const version = useSimVersion()
  const navigate = useNavigate()
  const drawer = useDrawer()
  const [params, setParams] = useSearchParams()
  const selected = params.get('interface')

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1500)
    return () => window.clearInterval(id)
  }, [])

  const byInterface = useMemo(() => {
    const map = new Map<string, Message[]>()
    engine.messages.forEach((m) => {
      const list = map.get(m.interfaceId) ?? []
      list.push(m)
      map.set(m.interfaceId, list)
    })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick])

  const overall = totalsFor(engine.messages)
  const rows = INTERFACES.map((i) => {
    const msgs = byInterface.get(i.id) ?? []
    const t = totalsFor(msgs)
    return {
      ...i,
      ...t,
      fromName: SYSTEMS.find((s) => s.id === i.from)?.short ?? i.from,
      toName: SYSTEMS.find((s) => s.id === i.to)?.short ?? i.to,
      health: t.missing || t.mismatched || t.duplicated ? 'Problems' : t.sent ? 'Clean' : 'No traffic',
    }
  })

  const detail = selected ? INTERFACES.find((i) => i.id === selected) : undefined
  const detailMessages = selected ? [...(byInterface.get(selected) ?? [])].reverse().slice(0, 80) : []

  const openCompare = (m: Message) => {
    const payload = m.payload as Record<string, unknown>
    const fields = Object.entries(payload).filter(([k]) => k !== 'interface')
    drawer.open({
      title: `${m.interfaceId} · field by field`,
      subtitle: `${m.from} → ${m.to} · ${m.key}`,
      width: 'lg',
      content: (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={m.status === 'delivered' ? 'success' : m.status === 'lost' ? 'danger' : m.status === 'duplicate' ? 'warning' : 'info'}>
              {m.status}
            </Badge>
            {m.fault && <Badge tone="danger">damaged by {m.fault}</Badge>}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-label uppercase text-subtle">
                <th className="py-1.5 text-left">Field</th>
                <th className="py-1.5 text-left">Sent by {m.from}</th>
                <th className="py-1.5 text-left">Stored by {m.to}</th>
              </tr>
            </thead>
            <tbody>
              {fields.map(([k, v]) => {
                const lost = m.status === 'lost'
                const damaged = !!m.fault && (k === 'quantity' || k === 'unit' || k === 'purchaseOrder' || k === 'tareKg' || k === 'delayMin')
                return (
                  <tr key={k} className={cn('border-b border-line/70', (lost || damaged) && 'bg-danger-soft/50')}>
                    <td className="py-1.5 pr-3 font-mono text-[12px] text-muted">{k}</td>
                    <td className="py-1.5 pr-3 font-mono text-[12px] text-text">{String(v ?? 'null')}</td>
                    <td className={cn('py-1.5 font-mono text-[12px]', lost ? 'text-danger' : damaged ? 'text-danger' : 'text-text')}>
                      {lost ? 'nothing arrived' : String(v ?? 'null')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <CodeBlock>{JSON.stringify(m.payload, null, 2)}</CodeBlock>
          <Button
            variant="primary"
            fullWidth
            leftIcon={<Truck size={15} />}
            onClick={() => {
              drawer.closeAll()
              navigate(`/flow/trace?q=${encodeURIComponent(m.key)}`)
            }}
          >
            Follow the truck
          </Button>
        </div>
      ),
    })
  }

  return (
    <>
      <PageHeader
        title="Interface Testing"
        subtitle="Every handoff between two systems, counted and compared field by field."
        actions={
          selected ? (
            <Button onClick={() => setParams({})}>Back to all interfaces</Button>
          ) : (
            <Button onClick={() => navigate('/flow')} leftIcon={<Share2 size={15} />}>
              Watch it live
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardBody className="flex gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">1</div>
            <div>
              <div className="text-sm font-semibold text-text">Test Studio tests a whole business journey</div>
              <p className="mt-0.5 text-xs text-muted">
                A truck arrives, is weighed, booked, invoiced and paid. One scenario, many systems, judged on the
                business outcome.
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-info-soft text-info">2</div>
            <div>
              <div className="text-sm font-semibold text-text">Interface Testing checks every handoff</div>
              <p className="mt-0.5 text-xs text-muted">
                One message, two systems, every field compared. It catches the kilogram sent as a tonne long before the
                invoice is wrong.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Sent" value={num(overall.sent)} />
        <StatTile label="Received" value={num(overall.received)} tone="info" />
        <StatTile label="Matched" value={num(overall.matched)} tone="success" />
        <StatTile label="Mismatched" value={num(overall.mismatched)} tone={overall.mismatched ? 'danger' : 'neutral'} />
        <StatTile label="Missing" value={num(overall.missing)} tone={overall.missing ? 'danger' : 'neutral'} />
        <StatTile label="Duplicated" value={num(overall.duplicated)} tone={overall.duplicated ? 'warning' : 'neutral'} />
      </div>

      {!detail ? (
        <Card>
          <CardHeader title="All fourteen interfaces" subtitle="Click one to compare its messages field by field." />
          <DataTable
            rows={rows}
            rowKey={(r) => r.id}
            searchable
            onRowClick={(r) => setParams({ interface: r.id })}
            rowTone={(r) => (r.missing || r.mismatched || r.duplicated ? 'danger' : undefined)}
            columns={[
              { key: 'id', header: 'Interface', mono: true, width: 95 },
              { key: 'name', header: 'What it carries' },
              {
                key: 'route',
                header: 'From → to',
                width: 230,
                render: (r) => (
                  <span className="flex items-center gap-1.5 text-xs">
                    {r.fromName} <ArrowRight size={12} className="text-subtle" /> {r.toName}
                  </span>
                ),
                value: (r) => r.fromName,
              },
              { key: 'sent', header: 'Sent', align: 'right', mono: true, width: 80 },
              { key: 'received', header: 'Received', align: 'right', mono: true, width: 95 },
              { key: 'mismatched', header: 'Mismatched', align: 'right', mono: true, width: 110 },
              { key: 'missing', header: 'Missing', align: 'right', mono: true, width: 90 },
              { key: 'duplicated', header: 'Duplicated', align: 'right', mono: true, width: 105 },
              {
                key: 'health',
                header: 'Health',
                width: 120,
                render: (r) => (
                  <Badge tone={r.health === 'Clean' ? 'success' : r.health === 'Problems' ? 'danger' : 'neutral'}>{r.health}</Badge>
                ),
              },
            ]}
          />
        </Card>
      ) : (
        <>
          <SectionTitle
            title={`${detail.id} · ${detail.name}`}
            hint={`${SYSTEMS.find((s) => s.id === detail.from)?.name} → ${SYSTEMS.find((s) => s.id === detail.to)?.name} · ${detail.method} · ${detail.frequency}`}
          />
          {detailMessages.length === 0 ? (
            <EmptyState
              title="No traffic on this interface in the demo"
              description="Nine of the fourteen interfaces carry live messages. This one is here for completeness of the landscape."
              action={<Button onClick={() => setParams({})}>Back to all interfaces</Button>}
            />
          ) : (
            <Card>
              <CardHeader title="Messages" subtitle="Click a message to compare the fields on both sides." />
              <DataTable
                rows={detailMessages}
                rowKey={(m) => m.id}
                onRowClick={openCompare}
                maxHeight={520}
                dense
                rowTone={(m) => (m.status === 'lost' || m.fault ? 'danger' : m.status === 'duplicate' ? 'warning' : undefined)}
                columns={[
                  { key: 'sentAt', header: 'Sent', mono: true, width: 110, render: (m) => fmtSim(m.sentAt), value: (m) => m.sentAt },
                  { key: 'key', header: 'Reference', mono: true, width: 190 },
                  { key: 'summary', header: 'What moved' },
                  { key: 'travel', header: 'Travel', align: 'right', mono: true, width: 90, render: (m) => `${Math.round(m.arriveAt - m.sentAt)} min`, value: (m) => m.arriveAt - m.sentAt },
                  {
                    key: 'status',
                    header: 'Status',
                    width: 115,
                    render: (m) => (
                      <Badge tone={m.status === 'delivered' ? 'success' : m.status === 'lost' ? 'danger' : m.status === 'duplicate' ? 'warning' : 'info'}>
                        {m.status}
                      </Badge>
                    ),
                  },
                  { key: 'fault', header: 'Damaged by', width: 120, mono: true, render: (m) => m.fault ?? '—' },
                ]}
              />
            </Card>
          )}
        </>
      )}
    </>
  )
}
