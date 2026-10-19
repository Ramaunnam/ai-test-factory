import { ArrowDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge, Card, FieldGrid } from '@/components/ui'
import { fmtSim } from '@/lib/format'
import { useMoney } from '@/lib/currency'
import type { TraceResult } from '@/sim/trace'
import type { Message } from '@/sim/types'

function MessageHop({ m }: { m: Message }) {
  const tone =
    m.status === 'lost' ? 'danger' : m.status === 'duplicate' ? 'warning' : m.fault ? 'danger' : 'info'
  return (
    <div className="my-1 flex items-center gap-3 pl-6">
      <ArrowDown size={14} className="shrink-0 text-subtle" />
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-1.5 text-xs',
          tone === 'danger' ? 'border-danger/40 bg-danger-soft/50' : tone === 'warning' ? 'border-accent/40 bg-accent-soft/50' : 'border-line bg-surface2/70',
        )}
      >
        <span className="font-mono font-semibold text-text">{m.interfaceId}</span>
        <span className="min-w-0 flex-1 truncate text-muted">{m.summary}</span>
        <span className="font-mono text-[11px] text-subtle">
          {m.from} → {m.to}
        </span>
        <span className="font-mono text-[11px] text-subtle">{Math.round(m.arriveAt - m.sentAt)} min</span>
        <Badge tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'info'}>{m.status}</Badge>
      </div>
    </div>
  )
}

export function TraceTimeline({ result }: { result: TraceResult }) {
  const { text } = useMoney()
  if (!result.found) return null

  const hops = [...result.messages]

  return (
    <div className="space-y-2">
      {result.records.map((r, i) => {
        const hop = hops.find((m) => m.sentAt >= (result.records[i - 1]?.at ?? -1) && m.arriveAt <= r.at + 1)
        if (hop) hops.splice(hops.indexOf(hop), 1)
        return (
          <div key={`${r.table}-${r.title}-${i}`}>
            {hop && <MessageHop m={hop} />}
            <Card tone={r.flagged ? 'danger' : 'default'}>
              <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={r.flagged ? 'danger' : 'neutral'}>{r.system}</Badge>
                    <span className="truncate text-sm font-medium text-text">{r.title}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-subtle">
                    {r.table} · {fmtSim(r.at)}
                  </div>
                </div>
              </div>
              <div className="px-4 py-3">
                <FieldGrid
                  columns={3}
                  fields={r.fields.map((f) => ({
                    ...f,
                    value: typeof f.value === 'string' ? text(f.value) : f.value,
                  }))}
                />
              </div>
            </Card>
          </div>
        )
      })}
      {hops.length > 0 && (
        <div className="pt-2">
          <div className="mb-1 text-label font-semibold uppercase text-subtle">Messages still moving</div>
          {hops.map((m) => (
            <MessageHop key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}
