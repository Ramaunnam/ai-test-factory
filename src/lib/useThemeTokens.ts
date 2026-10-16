import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '@/providers/ThemeProvider'

const TOKENS = [
  'bg',
  'surface',
  'surface-2',
  'surface-3',
  'line',
  'line-strong',
  'text',
  'muted',
  'subtle',
  'primary',
  'primary-soft',
  'accent',
  'accent-soft',
  'success',
  'success-soft',
  'danger',
  'danger-soft',
  'info',
  'info-soft',
  'ai',
  'ai-soft',
] as const

export type TokenName = (typeof TOKENS)[number]
export type Tokens = Record<TokenName, string>

function read(): Tokens {
  const style = getComputedStyle(document.documentElement)
  const out = {} as Tokens
  for (const t of TOKENS) {
    const raw = style.getPropertyValue(`--${t}`).trim()
    out[t] = raw ? `rgb(${raw})` : '#888888'
  }
  return out
}

/**
 * Real colour strings for SVG / recharts / canvas, re-read whenever the
 * resolved theme changes. Never hard-code a hex inside a chart.
 */
export function useThemeTokens(): Tokens {
  const { resolved } = useTheme()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    // let the CSS variables settle after the class flip
    const id = window.setTimeout(() => setTick((t) => t + 1), 0)
    return () => window.clearTimeout(id)
  }, [resolved])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => read(), [resolved, tick])
}

export function withAlpha(rgb: string, alpha: number): string {
  return rgb.replace('rgb(', 'rgba(').replace(')', ` / ${alpha})`)
}
