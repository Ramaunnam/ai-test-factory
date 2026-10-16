import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Resolved = 'light' | 'dark'

interface ThemeCtx {
  mode: ThemeMode
  resolved: Resolved
  setMode: (m: ThemeMode) => void
  cycle: () => Resolved | ThemeMode
}

const Ctx = createContext<ThemeCtx | null>(null)
const KEY = 'j2w.theme'
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* private mode */
  }
  return 'light'
}

function resolve(mode: ThemeMode): Resolved {
  if (mode === 'system') return mq().matches ? 'dark' : 'light'
  return mode
}

function apply(resolved: Resolved) {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#0B1420' : '#F4F7FA')
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode)
  const [resolved, setResolved] = useState<Resolved>(() => resolve(readMode()))

  // follow the OS while in system mode
  useEffect(() => {
    if (mode !== 'system') return
    const m = mq()
    const onChange = () => setResolved(m.matches ? 'dark' : 'light')
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [mode])

  useEffect(() => {
    setResolved(resolve(mode))
  }, [mode])

  useEffect(() => {
    apply(resolved)
  }, [resolved])

  const setMode = useCallback((m: ThemeMode) => {
    try {
      localStorage.setItem(KEY, m)
    } catch {
      /* ignore */
    }
    // short, scoped transition only on an explicit switch
    const root = document.documentElement
    root.classList.add('theme-shift')
    window.setTimeout(() => root.classList.remove('theme-shift'), 220)
    setModeState(m)
  }, [])

  const cycle = useCallback(() => {
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light'
    setMode(next)
    return next
  }, [mode, setMode])

  const value = useMemo(() => ({ mode, resolved, setMode, cycle }), [mode, resolved, setMode, cycle])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
