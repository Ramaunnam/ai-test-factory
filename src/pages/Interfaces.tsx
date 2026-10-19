import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Share2, Truck, X } from 'lucide-react'
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
  SearchInput,
  SectionTitle,
  Select,
  StatTile,
  Switch,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { INTERFACES, PROCESSES, SYSTEMS } from '@/data'
import { SourceNote } from '@/components/domain/SourceNote'
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

/* -------------------------------------------------------------------------- */
/* The filters                                                                */
/* -------------------------------------------------------------------------- */

type StatusKey = 'matched' | 'mismatched' | 'missing' | 'duplicated'

const STATUS_CHIPS: { key: StatusKey; label: string }[] = [
  { key: 'matched', label: 'Matched' },
  { key: 'mismatched', label: 'Mismatched' },
  { key: 'missing', label: 'Missing' },
  { key: 'duplicated', label: 'Duplicated' },
]

const WINDOWS = [
  { id: '24h', label: 'Last 24 hours', minutes: 24 * 60 },
  { id: '4h', label: 'Last 4 hours', minutes: 4 * 60 },
  { id: '1h', label: 'Last hour', minutes: 60 },
  { id: '15m', label: 'Last 15 minutes', minutes: 15 },
]

/** The handoffs that carry money rather than material. */
const FINANCIAL = new Set(['IF-06', 'IF-09', 'IF-11', 'IF-13', 'IF-15', 'IF-16', 'IF-17', 'IF-18'])

function typeOf(id: string) {
  return FINANCIAL.has(id) ? 'Financial' : 'Shop-floor'
}

function formatOf(method: string) {
  if (method === 'IDoc') return 'IDoc'
  if (method === 'REST' || method === 'OData') return 'API'
  return 'File'
}

/** What a single message counts as, for the records list. */
function statusOf(m: Message): StatusKey | 'in flight' {
  if (m.status === 'lost') return 'missing'
  if (m.status === 'duplicate') return 'duplicated'
  if (m.fault) return 'mismatched'
  if (m.status === 'delivered') return 'matched'
  return 'in flight'
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

  /* ----------------------------------------------------- filters in the URL */

  const q = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const process = params.get('process') ?? ''
  const health = params.get('health') ?? ''
  const kind = params.get('type') ?? ''
  const format = params.get('format') ?? ''
  const win = params.get('window') ?? '24h'
  const onlyLive = params.get('live') === '1'
  const statuses = (params.get('status') ?? '').split(',').filter(Boolean) as StatusKey[]

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const toggleStatus = (key: StatusKey) => {
    const next = statuses.includes(key) ? statuses.filter((s) => s !== key) : [...statuses, key]
    setFilter('status', next.length ? next.join(',') : null)
  }

  const clearFilters = () => {
    const next = new URLSearchParams()
    if (selected) next.set('interface', selected)
    setParams(next, { replace: true })
  }

  const windowMinutes = WINDOWS.find((w) => w.id === win)?.minutes ?? 24 * 60

  const activeChips: { label: string; clear: () => void }[] = [
    ...(q ? [{ label: `search “${q}”`, clear: () => setFilter('q', null) }] : []),
    ...(from ? [{ label: `from ${SYSTEMS.find((s) => s.id === from)?.short ?? from}`, clear: () => setFilter('from', null) }] : []),
    ...(to ? [{ label: `to ${SYSTEMS.find((s) => s.id === to)?.short ?? to}`, clear: () => setFilter('to', null) }] : []),
    ...(process ? [{ label: `workflow ${process}`, clear: () => setFilter('process', null) }] : []),
    ...statuses.map((s) => ({ label: STATUS_CHIPS.find((c) => c.key === s)?.label ?? s, clear: () => toggleStatus(s) })),
    ...(health ? [{ label: `health ${health}`, clear: () => setFilter('health', null) }] : []),
    ...(kind ? [{ label: kind, clear: () => setFilter('type', null) }] : []),
    ...(format ? [{ label: format, clear: () => setFilter('format', null) }] : []),
    ...(win !== '24h' ? [{ label: WINDOWS.find((w) => w.id === win)?.label ?? win, clear: () => setFilter('window', null) }] : []),
    ...(onlyLive ? [{ label: 'only live', clear: () => setFilter('live', null) }] : []),
  ]

  /* ------------------------------------------------------------- the data -- */

  const windowMessages = useMemo(
    () => engine.messages.filter((m) => m.sentAt >= engine.now - windowMinutes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version, tick, windowMinutes],
  )

  const byInterface = useMemo(() => {
    const map = new Map<string, Message[]>()
    windowMessages.forEach((m) => {
      const list = map.get(m.interfaceId) ?? []
      list.push(m)
      map.set(m.interfaceId, list)
    })
    return map
  }, [windowMessages])

  const rows = INTERFACES.map((i) => {
    const msgs = byInterface.get(i.id) ?? []
    const t = totalsFor(msgs)
    return {
      ...i,
      ...t,
      fromName: SYSTEMS.find((s) => s.id === i.from)?.short ?? i.from,
      toName: SYSTEMS.find((s) => s.id === i.to)?.short ?? i.to,
      kind: typeOf(i.id),
      format: formatOf(i.method),
      health: t.missing || t.mismatched || t.duplicated ? 'Problems' : t.sent ? 'Clean' : 'No traffic',
    }
  })

  const needle = q.trim().toLowerCase()
  const filtered = rows.filter((r) => {
    if (needle && ![r.id, r.name, r.fromName, r.toName, r.payload, r.method].join(' ').toLowerCase().includes(needle))
      return false
    if (from && r.from !== from) return false
    if (to && r.to !== to) return false
    if (process && r.process !== process) return false
    if (health && r.health !== health) return false
    if (kind && r.kind !== kind) return false
    if (format && r.format !== format) return false
    if (onlyLive && !r.live) return false
    if (statuses.length && !statuses.some((s) => r[s] > 0)) return false
    return true
  })

  const filteredIds = new Set(filtered.map((r) => r.id))
  const overall = totalsFor(windowMessages.filter((m) => filteredIds.has(m.interfaceId)))

  const detail = selected ? INTERFACES.find((i) => i.id === selected) : undefined
  const detailMessages = selected
    ? [...(byInterface.get(selected) ?? [])]
        .reverse()
        .filter((m) => (statuses.length ? statuses.includes(statusOf(m) as StatusKey) : true))
        .slice(0, 80)
    : []

  const sources = SYSTEMS.filter((s) => INTERFACES.some((i) => i.from === s.id))
  const targets = SYSTEMS.filter((s) => INTERFACES.some((i) => i.to === s.id))

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

  /** Follow the newest thing that is still in the filter, not just any truck. */
  const followNewest = () => {
    const pool = selected
      ? detailMessages
      : [...windowMessages].reverse().filter((m) => filteredIds.has(m.interfaceId))
    const first = pool.find((m) => m.key)
    if (!first) return
    navigate(`/flow/trace?q=${encodeURIComponent(first.key)}`)
  }

  const followable = selected
    ? detailMessages.length > 0
    : windowMessages.some((m) => filteredIds.has(m.interfaceId) && m.key)

  return (
    <>
      <PageHeader
        title="Interface Testing"
        subtitle="Every handoff between two systems, counted and compared field by field."
        actions={
          <span className="flex flex-wrap gap-2">
            <Button leftIcon={<Truck size={15} />} disabled={!followable} onClick={followNewest}>
              Follow the truck
            </Button>
            {selected ? (
              <Button onClick={() => setFilter('interface', null)}>Back to all interfaces</Button>
            ) : (
              <Button onClick={() => navigate('/flow')} leftIcon={<Share2 size={15} />}>
                Watch it live
              </Button>
            )}
          </span>
        }
      />

      {/* the filter bar ---------------------------------------------------- */}
      <Card className="mb-4">
        <CardHeader
          title="Narrow it down"
          subtitle="Everything below follows these filters: the totals, the table, the records and Follow the truck."
          actions={
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone={filtered.length === rows.length ? 'neutral' : 'info'}>
                Showing {num(filtered.length)} of {num(rows.length)} interfaces
              </Badge>
              <Button size="sm" disabled={!activeChips.length} onClick={clearFilters}>
                Clear all
              </Button>
            </span>
          }
        />
        <CardBody className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <SearchInput value={q} onChange={(v) => setFilter('q', v || null)} placeholder="Search interface, system or field" />
            <Select value={from} onChange={(e) => setFilter('from', e.target.value || null)}>
              <option value="">Any source system</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={to} onChange={(e) => setFilter('to', e.target.value || null)}>
              <option value="">Any target system</option>
              {targets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={process} onChange={(e) => setFilter('process', e.target.value || null)}>
              <option value="">Any business process</option>
              {PROCESSES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} · {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Select value={health} onChange={(e) => setFilter('health', e.target.value || null)}>
              <option value="">Any health</option>
              {['Clean', 'Problems', 'No traffic'].map((h) => (
                <option key={h}>{h}</option>
              ))}
            </Select>
            <Select value={kind} onChange={(e) => setFilter('type', e.target.value || null)}>
              <option value="">Any type</option>
              <option>Shop-floor</option>
              <option>Financial</option>
            </Select>
            <Select value={format} onChange={(e) => setFilter('format', e.target.value || null)}>
              <option value="">Any format</option>
              <option>IDoc</option>
              <option>API</option>
              <option>File</option>
            </Select>
            <Select value={win} onChange={(e) => setFilter('window', e.target.value === '24h' ? null : e.target.value)}>
              {WINDOWS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label font-semibold uppercase text-subtle">Status</span>
            {STATUS_CHIPS.map((c) => (
              <Chip key={c.key} selected={statuses.includes(c.key)} onClick={() => toggleStatus(c.key)}>
                {c.label}
              </Chip>
            ))}
            <span className="ml-auto">
              <Switch checked={onlyLive} onChange={(v) => setFilter('live', v ? '1' : null)} label="Only live" size="sm" />
            </span>
          </div>

          {activeChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-label font-semibold uppercase text-subtle">Filtering by</span>
              {activeChips.map((c) => (
                <Chip key={c.label} selected onClick={c.clear} title="Remove this filter">
                  {c.label}
                  <X size={11} />
                </Chip>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Sent" value={num(overall.sent)} hint={WINDOWS.find((w) => w.id === win)?.label.toLowerCase()} />
        <StatTile label="Received" value={num(overall.received)} tone="info" />
        <StatTile label="Matched" value={num(overall.matched)} tone="success" />
        <StatTile label="Mismatched" value={num(overall.mismatched)} tone={overall.mismatched ? 'danger' : 'neutral'} />
        <StatTile label="Missing" value={num(overall.missing)} tone={overall.missing ? 'danger' : 'neutral'} />
        <StatTile label="Duplicated" value={num(overall.duplicated)} tone={overall.duplicated ? 'warning' : 'neutral'} />
      </div>

      {!detail ? (
        <Card>
          <CardHeader
            title={activeChips.length ? 'The interfaces that match' : 'All nineteen interfaces'}
            subtitle="Fifteen carry live traffic; the other four are part of the landscape but quiet in this demo."
          />
          {filtered.length === 0 ? (
            <EmptyState
              title="No interface matches these filters"
              description="Nothing in the landscape carries this combination of source, target, status and format. Clear the filters and start again."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => setFilter('interface', r.id)}
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
                { key: 'kind', header: 'Type', width: 110 },
                { key: 'format', header: 'Format', width: 90 },
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
              empty="No interface matches these filters."
            />
          )}
          <SourceNote
            title="What is being compared here"
            reads={[
              { label: 'engine.messages', route: '/flow', note: 'every message sent on a live interface' },
              { table: 'MSEG', note: 'what the receiving system actually stored' },
            ]}
            computes="counts sent against received per interface, inside the chosen time window, and compares the payload field by field"
            feeds={[{ label: 'Confidence score', route: '/' }, { label: 'Month-End Load', route: '/load' }]}
            steps={[
              'Every message keeps the payload it was sent with.',
              'Mismatched means it arrived but a field was damaged on the way.',
              'Missing means it never arrived; duplicated means it arrived twice.',
              'The filters above are kept in the address bar, so a filtered view can be shared as a link.',
            ]}
          />
        </Card>
      ) : (
        <>
          <SectionTitle
            title={`${detail.id} · ${detail.name}`}
            hint={`${SYSTEMS.find((s) => s.id === detail.from)?.name} → ${SYSTEMS.find((s) => s.id === detail.to)?.name} · ${detail.method} · ${detail.frequency} · ${typeOf(detail.id)}`}
          />
          {detailMessages.length === 0 ? (
            <EmptyState
              title={statuses.length ? 'No record on this interface matches the filters' : 'No traffic on this interface in the demo'}
              description={
                statuses.length
                  ? 'The status chips above are hiding every record this interface carried in the chosen time window.'
                  : 'Fifteen of the nineteen interfaces carry live messages. This one is here for completeness of the landscape.'
              }
              action={
                <span className="flex flex-wrap gap-2">
                  {activeChips.length > 0 && <Button onClick={clearFilters}>Clear filters</Button>}
                  <Button onClick={() => setFilter('interface', null)}>Back to all interfaces</Button>
                </span>
              }
            />
          ) : (
            <Card>
              <CardHeader
                title="Messages"
                subtitle="Newest first, with the travel time and what arrived at the other end."
                actions={<Badge tone="neutral">{num(detailMessages.length)} records in this window</Badge>}
              />
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
                empty="No record matches these filters."
              />
            </Card>
          )}
        </>
      )}
    </>
  )
}
