import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CornerDownLeft,
  FlaskConical,
  Hash,
  LayoutDashboard,
  Play,
  Search,
  Server,
  Share2,
  Sun,
  UserCog,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { NAV } from './nav.config'
import { INTERFACES, PROCESSES, SCENARIOS, SYSTEMS } from '@/data'
import { useStore } from '@/data/appStore'
import { engine } from '@/sim/engine'
import { useTheme } from '@/providers/ThemeProvider'
import { ROLES, useRole } from '@/providers/RoleProvider'
import { useToast } from '@/providers/ToastProvider'

interface Entry {
  id: string
  group: string
  title: string
  subtitle?: string
  icon: LucideIcon
  run: () => void
}

const RECENT_KEY = 'j2w.recent'

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function pushRecent(id: string) {
  try {
    const list = [id, ...readRecent().filter((r) => r !== id)].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

/** Simple subsequence fuzzy score: lower is better, null means no match. */
function score(needle: string, haystack: string): number | null {
  if (!needle) return 0
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h.includes(n)) return h.indexOf(n)
  let i = 0
  let gaps = 0
  for (const ch of h) {
    if (ch === n[i]) i += 1
    else if (i > 0) gaps += 1
    if (i === n.length) return 100 + gaps
  }
  return null
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const { cycle } = useTheme()
  const { setRole } = useRole()
  const store = useStore()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []

    NAV.forEach((item) => {
      out.push({
        id: `nav:${item.path}`,
        group: 'Pages',
        title: item.label,
        subtitle: item.blurb,
        icon: item.icon,
        run: () => navigate(item.path),
      })
      item.tabs?.forEach((tab) => {
        if (tab.path === item.path) return
        out.push({
          id: `nav:${tab.path}`,
          group: 'Pages',
          title: `${item.label} · ${tab.label}`,
          subtitle: tab.path,
          icon: item.icon,
          run: () => navigate(tab.path),
        })
      })
    })

    SYSTEMS.forEach((s) =>
      out.push({
        id: `sys:${s.id}`,
        group: 'Systems',
        title: s.name,
        subtitle: `${s.type} · ${s.sources.join(', ') || 'no live tables'}`,
        icon: Server,
        run: () => navigate(`/landscape?system=${s.id}`),
      }),
    )

    INTERFACES.forEach((i) =>
      out.push({
        id: `if:${i.id}`,
        group: 'Interfaces',
        title: `${i.id} ${i.name}`,
        subtitle: `${i.method} · ${i.frequency}`,
        icon: Share2,
        run: () => navigate(`/interfaces?interface=${i.id}`),
      }),
    )

    SCENARIOS.forEach((s) =>
      out.push({
        id: `sc:${s.id}`,
        group: 'Scenarios',
        title: `${s.id} ${s.name}`,
        subtitle: `${s.type} · ${s.process}`,
        icon: FlaskConical,
        run: () => navigate(`/studio?scenario=${s.id}`),
      }),
    )

    store.findings
      .filter((f) => f.status !== 'Closed')
      .forEach((f) =>
        out.push({
          id: `fd:${f.id}`,
          group: 'Findings',
          title: `${f.id} ${f.title}`,
          subtitle: `${f.severity} · ${f.system}`,
          icon: AlertTriangle,
          run: () => navigate(`/finding/${f.id}`),
        }),
      )

    PROCESSES.forEach((p) =>
      out.push({
        id: `pr:${p.id}`,
        group: 'Workflows',
        title: `${p.id} ${p.name}`,
        subtitle: p.summary,
        icon: Workflow,
        run: () => navigate(`/ontology?process=${p.id}`),
      }),
    )

    const cmd = (id: string, title: string, subtitle: string, icon: LucideIcon, run: () => void) =>
      out.push({ id: `cmd:${id}`, group: 'Commands', title, subtitle, icon, run })

    cmd('theme', 'Toggle the theme', 'Light, dark, then follow the system', Sun, () => {
      const next = cycle()
      toast({ title: `Theme set to ${next}`, tone: 'info' })
    })
    ROLES.forEach((r) =>
      cmd(`role-${r.id}`, `Switch role to ${r.id}`, r.description, UserCog, () => {
        setRole(r.id)
        navigate(r.landing)
        toast({ title: `Now viewing as ${r.id}`, tone: 'info' })
      }),
    )
    cmd('demo', 'Run the P1 demo now', 'Opens Run Centre and starts the live run', Play, () =>
      navigate('/run?demo=1'),
    )
    cmd('truck', 'Truck arrives now', 'Push a steel truck through the gate', Activity, () => {
      engine.addTruck()
      navigate('/flow')
      toast({ title: 'A truck was sent through the gate', tone: 'success' })
    })
    cmd('wagon', 'Wagon arrives now', 'Push a recycling load through the gate', Activity, () => {
      engine.addWagon()
      navigate('/flow')
      toast({ title: 'A recycling load was sent through the gate', tone: 'success' })
    })
    cmd('skip', 'Skip one hour', 'Fast forward the plant by 60 minutes', Activity, () => {
      engine.fastForward(60)
      toast({ title: 'The plant moved on by one hour', tone: 'info' })
    })
    cmd('replay', 'Replay eight hours', 'Reset and warm up the plant again', Activity, () => {
      engine.reset(engine.seed, 8)
      toast({ title: 'The plant was replayed from the start of the shift', tone: 'info' })
    })
    cmd('faults-off', 'Turn all faults off', 'Then replay to see every check pass', Activity, () => {
      engine.setAllFaults(false)
      engine.reset(engine.seed + 1, 8)
      navigate('/flow/checks')
      toast({ title: 'All faults are off and the plant was replayed', tone: 'success' })
    })
    cmd('faults-on', 'Turn all faults on', 'Break the data again', Activity, () => {
      engine.setAllFaults(true)
      engine.reset(engine.seed + 1, 8)
      navigate('/flow/checks')
      toast({ title: 'All faults are on again', tone: 'warning' })
    })
    cmd('checks', 'Run all checks now', 'Compare every system', Hash, () => navigate('/flow/checks'))
    cmd('kitchen', 'Open the design system', 'Every component in both themes', LayoutDashboard, () =>
      navigate('/kitchen-sink'),
    )
    cmd('print', 'Print the current page', 'Opens the browser print dialogue', Hash, () => window.print())

    return out
  }, [navigate, toast, cycle, setRole, store.findings])

  const results = useMemo(() => {
    if (!q.trim()) {
      const recent = readRecent()
        .map((id) => entries.find((e) => e.id === id))
        .filter(Boolean) as Entry[]
      const jump = NAV.slice(0, 6)
        .map((n) => entries.find((e) => e.id === `nav:${n.path}`))
        .filter(Boolean) as Entry[]
      return [
        ...recent.map((e) => ({ ...e, group: 'Recent' })),
        ...jump.filter((j) => !recent.some((r) => r.id === j.id)).map((e) => ({ ...e, group: 'Jump to' })),
      ]
    }
    return entries
      .map((e) => ({ e, s: score(q.trim(), `${e.title} ${e.subtitle ?? ''}`) }))
      .filter((r) => r.s !== null)
      .sort((a, b) => (a.s as number) - (b.s as number))
      .slice(0, 40)
      .map((r) => r.e)
  }, [q, entries])

  useEffect(() => setActive(0), [q])

  useEffect(() => {
    if (!open) {
      setQ('')
      setActive(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const entry = results[active]
        if (entry) {
          pushRecent(entry.id)
          entry.run()
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, results, active, onClose])

  useEffect(() => {
    listRef.current?.querySelectorAll('[data-row]')[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  let lastGroup = ''

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh] no-print">
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgb(var(--overlay) / var(--overlay-alpha))' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-[640px] overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-scaleIn"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={17} className="text-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pages, systems, interfaces, scenarios, findings and commands"
            className="h-12 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-subtle"
          />
          <kbd>Esc</kbd>
        </div>

        <div ref={listRef} className="j2w-scroll max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted">Nothing matches “{q}”.</p>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  navigate(`/flow/trace?q=${encodeURIComponent(q)}`)
                  onClose()
                }}
              >
                Search the plant data for it instead
              </button>
            </div>
          )}
          {results.map((e, i) => {
            const header = e.group !== lastGroup ? e.group : null
            lastGroup = e.group
            const Icon = e.icon
            return (
              <div key={e.id}>
                {header && (
                  <div className="sticky top-0 bg-surface px-4 py-1.5 text-label font-semibold uppercase text-subtle">
                    {header}
                  </div>
                )}
                <button
                  data-row
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    pushRecent(e.id)
                    e.run()
                    onClose()
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors',
                    i === active ? 'bg-primary-soft' : 'hover:bg-surface2',
                  )}
                >
                  <Icon size={16} className={cn('shrink-0', i === active ? 'text-primary' : 'text-subtle')} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', i === active ? 'text-primary' : 'text-text')}>
                      {e.title}
                    </span>
                    {e.subtitle && <span className="block truncate text-xs text-muted">{e.subtitle}</span>}
                  </span>
                  {i === active && <CornerDownLeft size={14} className="shrink-0 text-primary" />}
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-surface2 px-4 py-2 text-[11px] text-subtle">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> move
          </span>
          <span>
            <kbd>⏎</kbd> open
          </span>
          <span>
            <kbd>Esc</kbd> close
          </span>
          <span className="ml-auto">{results.length} results</span>
        </div>
      </div>
    </div>
  )
}
