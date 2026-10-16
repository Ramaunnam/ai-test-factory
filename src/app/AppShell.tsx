import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sidebar, useSidebarState } from './Sidebar'
import { Header } from './Header'
import { CommandPalette } from './CommandPalette'
import { ShortcutsModal } from './ShortcutsModal'
import { locate } from './nav.config'
import { Skeleton } from '@/components/ui'
import { RoleGuard } from '@/components/domain/RoleGuard'
import { useTheme } from '@/providers/ThemeProvider'
import { useToast } from '@/providers/ToastProvider'
import { engine } from '@/sim/engine'

export function AppShell() {
  const { collapsed, toggle } = useSidebarState()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [chord, setChord] = useState<string | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const { pathname, key } = useLocation()
  const navigate = useNavigate()
  const { cycle } = useTheme()
  const toast = useToast()
  const scrollMemory = useRef(new Map<string, number>())

  // document title
  useEffect(() => {
    const here = locate(pathname)
    const parts = [here?.item.label, here?.tab?.label].filter(Boolean)
    document.title = parts.length ? `${parts.join(' · ')} — J2W AI Test Factory` : 'J2W AI Test Factory'
  }, [pathname])

  // scroll to top on navigation, restore on back
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const saved = scrollMemory.current.get(key)
    el.scrollTo({ top: saved ?? 0 })
    const onScroll = () => scrollMemory.current.set(key, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pathname, key])

  // global shortcuts
  useEffect(() => {
    let chordTimer = 0
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (typing) return

      if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen(true)
        return
      }
      if (e.key === '\\') {
        e.preventDefault()
        toggle()
        return
      }
      if (e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        const next = cycle()
        toast({ title: `Theme set to ${next}`, tone: 'info' })
        return
      }
      if (e.key === '[' || e.key === ']') {
        const here = locate(pathname)
        const tabs = here?.item.tabs
        if (!tabs?.length) return
        e.preventDefault()
        const i = Math.max(0, tabs.findIndex((t) => t.path === pathname))
        const next = (i + (e.key === ']' ? 1 : -1) + tabs.length) % tabs.length
        navigate(tabs[next].path)
        return
      }
      if (e.key === ' ' && pathname.startsWith('/flow')) {
        e.preventDefault()
        engine.toggle()
        return
      }
      if (chord === 'g') {
        const map: Record<string, string> = {
          h: '/',
          f: '/flow',
          c: '/flow/checks',
          t: '/flow/trace',
          r: '/run',
          i: '/interfaces',
          o: '/ontology',
          a: '/approvals',
        }
        const dest = map[e.key.toLowerCase()]
        setChord(null)
        if (dest) {
          e.preventDefault()
          navigate(dest)
        }
        return
      }
      if (e.key.toLowerCase() === 'g') {
        setChord('g')
        window.clearTimeout(chordTimer)
        chordTimer = window.setTimeout(() => setChord(null), 1200)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(chordTimer)
    }
  }, [chord, cycle, navigate, pathname, toast, toggle])

  return (
    <div className="flex h-full w-full overflow-hidden bg-bg">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />

        <main ref={mainRef} id="main-scroll" tabIndex={-1} className="j2w-scroll relative flex-1 overflow-y-auto outline-none">
          <div key={pathname} className="mx-auto w-full max-w-[1680px] animate-fadeUp px-6 py-6 2xl:px-8">
            <Suspense
              fallback={
                <div className="space-y-4">
                  <Skeleton className="h-8 w-64" />
                  <div className="grid gap-4 md:grid-cols-3">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                  </div>
                  <Skeleton className="h-72" />
                </div>
              }
            >
              <RoleGuard>
                <Outlet />
              </RoleGuard>
            </Suspense>
          </div>
          <footer className="mx-auto w-full max-w-[1680px] px-6 pb-8 pt-2 text-xs text-subtle 2xl:px-8">
            J2W · POC – mock data for demonstration
          </footer>
        </main>
      </div>

      {chord && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[75] -translate-x-1/2 rounded-md border border-line bg-surface px-3 py-1.5 font-mono text-xs text-muted shadow-md no-print">
          g … (h, f, c, t, r, i, o, a)
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  )
}
