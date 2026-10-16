import { useNavigate } from 'react-router-dom'
import { ArrowRight, Database, Workflow } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge, Button } from '@/components/ui'
import { sampleRows, TABLE_LABEL, tableCount, tableRoute } from '@/lib/live'
import { useThemeTokens } from '@/lib/useThemeTokens'
import { useDrawer } from '@/providers/DrawerProvider'
import { num } from '@/lib/format'
import type { TableName } from '@/sim/types'

export interface SourceRef {
  /** A live table: the label, count and link are filled in automatically. */
  table?: TableName
  /** Anything else: a screen, a document, a static data set. */
  label?: string
  route?: string
  note?: string
}

function refLabel(r: SourceRef) {
  return r.table ? TABLE_LABEL[r.table] : (r.label ?? '')
}

function refRoute(r: SourceRef) {
  return r.table ? tableRoute(r.table) : r.route
}

function refCount(r: SourceRef) {
  return r.table ? tableCount(r.table) : undefined
}

/**
 * The provenance strip that sits under a card: where the numbers come from,
 * what is done to them, and where they go next. "How this works" opens the
 * detail with live sample rows.
 */
export function SourceNote({
  reads,
  computes,
  feeds,
  steps,
  title,
  className,
}: {
  reads: SourceRef[]
  computes: string
  feeds?: SourceRef[]
  steps?: string[]
  title?: string
  className?: string
}) {
  const navigate = useNavigate()
  const drawer = useDrawer()

  const chip = (r: SourceRef, key: string) => {
    const route = refRoute(r)
    const count = refCount(r)
    const label = refLabel(r)
    const content = (
      <>
        {label}
        {count !== undefined && <span className="ml-1 text-subtle">{num(count)}</span>}
      </>
    )
    return route ? (
      <button
        key={key}
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          navigate(route)
        }}
        title={r.note ?? `Open ${label}`}
        className="rounded-sm border border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-primary transition-colors hover:border-line-strong hover:bg-surface2"
      >
        {content}
      </button>
    ) : (
      <span key={key} className="rounded-sm border border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
        {content}
      </span>
    )
  }

  const openDetail = () =>
    drawer.open({
      title: title ?? 'Where this comes from',
      subtitle: computes,
      width: 'lg',
      content: <SourceDetail reads={reads} computes={computes} feeds={feeds} steps={steps} />,
    })

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line bg-surface2/50 px-5 py-2 text-[11px] text-muted',
        className,
      )}
    >
      <Database size={12} className="shrink-0 text-subtle" />
      <span className="text-subtle">from</span>
      {reads.map((r, i) => chip(r, `r${i}`))}
      <ArrowRight size={11} className="shrink-0 text-subtle" />
      <span className="min-w-0 truncate">{computes}</span>
      {feeds?.length ? (
        <>
          <ArrowRight size={11} className="shrink-0 text-subtle" />
          <span className="text-subtle">into</span>
          {feeds.map((r, i) => chip(r, `f${i}`))}
        </>
      ) : null}
      <button
        type="button"
        onClick={openDetail}
        className="ml-auto shrink-0 rounded-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        How this works
      </button>
    </div>
  )
}

/** Exported so the smoke test can prove drawer content renders inside the Router. */
export function SourceDetail({
  reads,
  computes,
  feeds,
  steps,
}: {
  reads: SourceRef[]
  computes: string
  feeds?: SourceRef[]
  steps?: string[]
}) {
  const navigate = useNavigate()
  const drawer = useDrawer()
  const t = useThemeTokens()
  const primary = reads.find((r) => r.table)
  const rows = primary?.table ? sampleRows(primary.table, 5) : []
  const columns = rows.length ? Object.keys(rows[0]).slice(0, 6) : []

  const go = (route?: string) => {
    if (!route) return
    drawer.closeAll()
    navigate(route)
  }

  return (
    <div className="space-y-5">
      {/* the picture */}
      <svg viewBox="0 0 640 150" width="100%" height={150} role="img" aria-label="How this number is produced">
        {reads.slice(0, 3).map((r, i) => (
          <g key={`in${i}`}>
            <rect x={8} y={14 + i * 44} width={190} height={34} rx={8} fill={t.surface} stroke={t.line} />
            <text x={20} y={35 + i * 44} fontSize={11} fontFamily="JetBrains Mono, monospace" fill={t.text}>
              {refLabel(r).slice(0, 24)}
            </text>
            <path
              d={`M 198 ${31 + i * 44} C 240 ${31 + i * 44}, 240 75, 270 75`}
              fill="none"
              stroke={t.line}
              strokeWidth={1.4}
            />
          </g>
        ))}
        <rect x={270} y={56} width={120} height={38} rx={10} fill={t['ai-soft']} stroke={t.ai} />
        <text x={330} y={79} fontSize={11} fontWeight={600} textAnchor="middle" fill={t.ai}>
          computed here
        </text>
        {(feeds ?? []).slice(0, 3).map((r, i) => (
          <g key={`out${i}`}>
            <path
              d={`M 390 75 C 420 75, 420 ${31 + i * 44}, 450 ${31 + i * 44}`}
              fill="none"
              stroke={t.line}
              strokeWidth={1.4}
            />
            <rect x={450} y={14 + i * 44} width={182} height={34} rx={8} fill={t.surface} stroke={t.line} />
            <text x={462} y={35 + i * 44} fontSize={11} fill={t.text}>
              {refLabel(r).slice(0, 24)}
            </text>
          </g>
        ))}
        {!feeds?.length && (
          <>
            <path d="M 390 75 L 450 75" fill="none" stroke={t.line} strokeWidth={1.4} />
            <rect x={450} y={58} width={182} height={34} rx={8} fill={t.surface} stroke={t.line} />
            <text x={462} y={79} fontSize={11} fill={t.text}>
              shown on this card
            </text>
          </>
        )}
      </svg>

      <div>
        <div className="mb-2 text-label font-semibold uppercase text-subtle">Where it comes from</div>
        <div className="space-y-1.5">
          {reads.map((r, i) => (
            <button
              key={i}
              type="button"
              disabled={!refRoute(r)}
              onClick={() => go(refRoute(r))}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md border border-line px-3 py-2 text-left text-xs transition-colors',
                refRoute(r) ? 'hover:bg-surface2' : 'opacity-80',
              )}
            >
              <Database size={13} className="shrink-0 text-subtle" />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-text">{refLabel(r)}</span>
                {r.note && <span className="block text-muted">{r.note}</span>}
              </span>
              {refCount(r) !== undefined && <Badge tone="neutral" mono>{num(refCount(r)!)} rows</Badge>}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-label font-semibold uppercase text-subtle">What happens to it</div>
        {steps?.length ? (
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 rounded-md border border-line bg-surface2/60 px-3 py-2 text-xs">
                <span className="font-mono text-subtle">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-text">{s}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-md border border-line bg-surface2/60 px-3 py-2 text-xs text-text">{computes}</p>
        )}
      </div>

      {feeds?.length ? (
        <div>
          <div className="mb-2 text-label font-semibold uppercase text-subtle">Where it goes next</div>
          <div className="space-y-1.5">
            {feeds.map((r, i) => (
              <button
                key={i}
                type="button"
                disabled={!refRoute(r)}
                onClick={() => go(refRoute(r))}
                className="flex w-full items-center gap-2.5 rounded-md border border-line px-3 py-2 text-left text-xs transition-colors hover:bg-surface2"
              >
                <Workflow size={13} className="shrink-0 text-subtle" />
                <span className="min-w-0 flex-1 text-text">{refLabel(r)}</span>
                <ArrowRight size={13} className="shrink-0 text-subtle" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {rows.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-label font-semibold uppercase text-subtle">
              Live rows from {TABLE_LABEL[primary!.table!]}
            </span>
            <Button size="sm" variant="link" onClick={() => go(tableRoute(primary!.table!))}>
              Open the table
            </Button>
          </div>
          <div className="j2w-scroll overflow-x-auto rounded-md border border-line">
            <table className="w-full text-[11px]">
              <thead className="bg-surface2">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-2.5 py-1.5 text-left font-mono text-subtle">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-2.5 py-1.5 font-mono text-text">
                        {r[c] === null || r[c] === undefined ? (
                          <span className="text-danger">empty</span>
                        ) : typeof r[c] === 'number' ? (
                          num(r[c] as number, Number.isInteger(r[c]) ? 0 : 2)
                        ) : (
                          String(r[c])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px] text-subtle">
            These are the newest five rows the simulated plant produced, right now.
          </p>
        </div>
      )}
    </div>
  )
}
