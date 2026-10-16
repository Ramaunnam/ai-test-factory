import { useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { BANDS, CARD_H, CARD_W, INTERFACES, SYSTEMS, type SystemMeta } from '@/data'
import type { Message } from '@/sim/types'
import { useThemeTokens } from '@/lib/useThemeTokens'

export interface FlowMapProps {
  counts?: Record<string, number>
  failing?: Record<string, number>
  trafficByInterface?: Record<string, number>
  messages?: Message[]
  now?: number
  onSystemClick?: (system: SystemMeta) => void
  onInterfaceClick?: (interfaceId: string) => void
  onMessageClick?: (message: Message) => void
  liveOnly?: boolean
  height?: number
}

function centre(s: SystemMeta) {
  return { x: s.x + CARD_W / 2, y: s.y + CARD_H / 2 }
}

function control(ax: number, ay: number, bx: number, by: number) {
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  return { cx: mx + (-dy / len) * 38, cy: my + (dx / len) * 38 }
}

function pointAt(t: number, ax: number, ay: number, cx: number, cy: number, bx: number, by: number) {
  const u = 1 - t
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  }
}

export function FlowMap({
  counts = {},
  failing = {},
  trafficByInterface = {},
  messages = [],
  now = 0,
  onSystemClick,
  onInterfaceClick,
  onMessageClick,
  liveOnly,
  height = 560,
}: FlowMapProps) {
  const t = useThemeTokens()
  const [hover, setHover] = useState<string | null>(null)

  const links = useMemo(
    () =>
      INTERFACES.filter((i) => (liveOnly ? i.live : true)).map((i) => {
        const from = SYSTEMS.find((s) => s.id === i.from)!
        const to = SYSTEMS.find((s) => s.id === i.to)!
        const a = centre(from)
        const b = centre(to)
        const c = control(a.x, a.y, b.x, b.y)
        return { i, a, b, c, path: `M ${a.x} ${a.y} Q ${c.cx} ${c.cy} ${b.x} ${b.y}` }
      }),
    [liveOnly],
  )

  const dots = messages
    .filter((m) => m.status === 'in flight' && m.arriveAt > now)
    .map((m) => {
      const link = links.find((l) => l.i.id === m.interfaceId)
      if (!link) return null
      const span = Math.max(0.0001, m.arriveAt - m.sentAt)
      const p = Math.max(0, Math.min(1, (now - m.sentAt) / span))
      const pt = pointAt(p, link.a.x, link.a.y, link.c.cx, link.c.cy, link.b.x, link.b.y)
      return { m, ...pt }
    })
    .filter(Boolean) as { m: Message; x: number; y: number }[]

  return (
    <svg
      viewBox="0 0 1000 560"
      width="100%"
      height={height}
      role="img"
      aria-label="Data flow between the connected systems"
      className="min-w-[860px] select-none"
    >
      {/* bands */}
      {BANDS.map((b) => (
        <g key={b.id}>
          <rect
            x={14}
            y={b.y}
            width={972}
            height={b.height}
            rx={14}
            fill={t['surface-2']}
            fillOpacity={0.55}
            stroke={t.line}
            strokeDasharray="6 6"
          />
          <text x={26} y={b.y + 18} fontSize={11} fontWeight={600} letterSpacing={1} fill={t.subtle}>
            {b.id.toUpperCase()}
          </text>
        </g>
      ))}

      {/* interfaces */}
      {links.map(({ i, c, path }) => {
        const dim = hover !== null && hover !== i.from && hover !== i.to && hover !== i.id
        const traffic = trafficByInterface[i.id] ?? 0
        const stroke = i.live ? t.info : t.line
        return (
          <g
            key={i.id}
            opacity={dim ? 0.22 : 1}
            className="cursor-pointer"
            onClick={() => onInterfaceClick?.(i.id)}
            onMouseEnter={() => setHover(i.id)}
            onMouseLeave={() => setHover(null)}
          >
            <path d={path} fill="none" stroke={stroke} strokeWidth={dim ? 1 : 1.6} strokeDasharray={i.live ? undefined : '5 5'} />
            <path d={path} fill="none" stroke="transparent" strokeWidth={14} />
            <g transform={`translate(${c.cx - 30} ${c.cy - 9})`}>
              <rect width={traffic ? 72 : 44} height={18} rx={9} fill={t.surface} stroke={t.line} />
              <text x={8} y={13} fontSize={10} fontFamily="JetBrains Mono, monospace" fill={t.muted}>
                {i.id}
                {traffic ? ` · ${traffic}/2h` : ''}
              </text>
            </g>
          </g>
        )
      })}

      {/* systems */}
      {SYSTEMS.map((s) => {
        const bad = failing[s.id] ?? 0
        const dim = hover !== null && hover !== s.id && !INTERFACES.some((i) => i.id === hover && (i.from === s.id || i.to === s.id))
        return (
          <g
            key={s.id}
            opacity={dim ? 0.3 : 1}
            className="cursor-pointer"
            onClick={() => onSystemClick?.(s)}
            onMouseEnter={() => setHover(s.id)}
            onMouseLeave={() => setHover(null)}
          >
            <rect
              x={s.x}
              y={s.y}
              width={CARD_W}
              height={CARD_H}
              rx={11}
              fill={t.surface}
              stroke={bad ? t.danger : t['line-strong']}
              strokeWidth={bad ? 2 : 1}
            />
            <text x={s.x + 12} y={s.y + 23} fontSize={12.5} fontWeight={600} fill={t.text}>
              {s.short}
            </text>
            <text x={s.x + 12} y={s.y + 41} fontSize={10.5} fill={t.subtle} fontFamily="JetBrains Mono, monospace">
              {(counts[s.id] ?? 0).toLocaleString('en-GB')} records
            </text>
            <text x={s.x + 12} y={s.y + 59} fontSize={10.5} fill={bad ? t.danger : t.success} fontWeight={bad ? 600 : 400}>
              {bad ? `${bad} failing records` : 'data agrees'}
            </text>
          </g>
        )
      })}

      {/* in-flight messages */}
      {dots.map(({ m, x, y }) => (
        <g key={m.id} className="cursor-pointer" onClick={() => onMessageClick?.(m)}>
          <circle cx={x} cy={y} r={9} fill="transparent" />
          <circle
            cx={x}
            cy={y}
            r={4.5}
            fill={m.fault ? t.danger : t.info}
            stroke={t.surface}
            strokeWidth={1.5}
            style={{ transition: 'cx 220ms linear, cy 220ms linear' }}
          />
        </g>
      ))}
    </svg>
  )
}

export function MapLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-4 text-[11px] text-muted', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-info" /> message in flight
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-danger" /> damaged message
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-4 rounded-sm border-2 border-danger" /> system with failing records
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-0 w-5 border-t border-dashed border-line-strong" /> interface without live traffic
      </span>
    </div>
  )
}
