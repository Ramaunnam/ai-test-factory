import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useThemeTokens } from '@/lib/useThemeTokens'

/** Shared axis and tooltip styling that follows the theme. */
function useChartTheme() {
  const t = useThemeTokens()
  return {
    t,
    axis: { stroke: t.line, tick: { fill: t.subtle, fontSize: 11 }, tickLine: false, axisLine: { stroke: t.line } },
    tooltip: {
      contentStyle: {
        background: t.surface,
        border: `1px solid ${t.line}`,
        borderRadius: 10,
        fontSize: 12,
        color: t.text,
        boxShadow: 'var(--shadow-md)',
      },
      labelStyle: { color: t.muted, fontSize: 11 },
      itemStyle: { color: t.text },
      cursor: { fill: t['surface-2'], fillOpacity: 0.6 },
    },
  }
}

export function TrendChart({
  data,
  dataKey = 'score',
  xKey = 'day',
  height = 180,
}: {
  data: Record<string, string | number>[]
  dataKey?: string
  xKey?: string
  height?: number
}) {
  const { t, axis, tooltip } = useChartTheme()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={t.primary} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={t.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis domain={[40, 100]} {...axis} />
        <Tooltip {...tooltip} />
        <Area type="monotone" dataKey={dataKey} stroke={t.primary} strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function FindingsBar({
  data,
  onSelect,
  height = 200,
}: {
  data: { name: string; value: number; tone: 'danger' | 'accent' | 'info' | 'subtle' }[]
  onSelect?: (name: string) => void
  height?: number
}) {
  const { t, axis, tooltip } = useChartTheme()
  const colour = { danger: t.danger, accent: t.accent, info: t.info, subtle: t.subtle }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={t.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip {...tooltip} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} onClick={(d: { name?: string }) => d?.name && onSelect?.(d.name)}>
          {data.map((d) => (
            <Cell key={d.name} fill={colour[d.tone]} cursor={onSelect ? 'pointer' : 'default'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MultiLineChart({
  data,
  series,
  xKey = 'minute',
  height = 200,
  reference,
}: {
  data: Record<string, number | string>[]
  series: { key: string; label: string; tone: 'primary' | 'success' | 'danger' | 'accent' | 'info' }[]
  xKey?: string
  height?: number
  reference?: { y: number; label: string; tone?: 'danger' | 'accent' | 'success' }
}) {
  const { t, axis, tooltip } = useChartTheme()
  const colour = { primary: t.primary, success: t.success, danger: t.danger, accent: t.accent, info: t.info }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={t.line} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} />
        <Tooltip {...tooltip} />
        {reference && (
          <ReferenceLine
            y={reference.y}
            stroke={reference.tone === 'success' ? t.success : reference.tone === 'accent' ? t.accent : t.danger}
            strokeDasharray="5 4"
            label={{ value: reference.label, position: 'insideTopRight', fill: t.subtle, fontSize: 10 }}
          />
        )}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={colour[s.tone]}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
