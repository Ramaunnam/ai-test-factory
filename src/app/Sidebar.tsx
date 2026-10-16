import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/cn'
import { GROUP_ORDER, navForRole, type NavItem } from './nav.config'
import { useRole } from '@/providers/RoleProvider'
import { useStore } from '@/data/appStore'
import { runAllChecks } from '@/sim/checks'

function useFailingChecks() {
  const [count, setCount] = useState(() => runAllChecks().filter((c) => c.status === 'fail').length)
  useEffect(() => {
    const id = window.setInterval(() => {
      setCount(runAllChecks().filter((c) => c.status === 'fail').length)
    }, 2500)
    return () => window.clearInterval(id)
  }, [])
  return count
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('j2w.sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  const toggle = () => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem('j2w.sidebar', next ? 'collapsed' : 'open')
      } catch {
        /* ignore */
      }
      return next
    })
  }
  return { collapsed, toggle }
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const { role, def } = useRole()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = navForRole(role)
  const store = useStore()
  const failing = useFailingChecks()
  const listRef = useRef<HTMLDivElement>(null)

  const pendingApprovals = store.approvals.filter((a) => a.status === 'Pending').length

  const counterFor = (item: NavItem) => {
    if (item.counter === 'approvals') return pendingApprovals || undefined
    if (item.counter === 'failingChecks') return failing || undefined
    return undefined
  }

  const isActive = (item: NavItem) =>
    item.path === pathname || (item.tabs?.some((t) => t.path === pathname) ?? false)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    const links = Array.from(listRef.current?.querySelectorAll<HTMLElement>('a[data-nav]') ?? [])
    const i = links.indexOf(document.activeElement as HTMLElement)
    if (i < 0) return
    e.preventDefault()
    const next =
      e.key === 'ArrowDown'
        ? links[(i + 1) % links.length]
        : e.key === 'ArrowUp'
          ? links[(i - 1 + links.length) % links.length]
          : e.key === 'Home'
            ? links[0]
            : links[links.length - 1]
    next?.focus()
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[39] bg-[rgb(var(--overlay)/var(--overlay-alpha))] no-print lg:hidden"
          onClick={onCloseMobile}
          aria-hidden
        />
      )}
      <nav
        aria-label="Main"
        className={cn(
          'z-40 flex h-full shrink-0 flex-col border-r border-line bg-surface no-print',
          'transition-[width,transform] duration-[180ms] ease-enter',
          collapsed ? 'w-[68px]' : 'w-[264px]',
          'max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:w-[264px] max-lg:shadow-lg',
          mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-line px-3">
          <button
            type="button"
            onClick={() => {
              navigate(def.landing)
              onCloseMobile()
            }}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-1 text-left transition-colors hover:bg-surface2"
            title="J2W AI Test Factory"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary font-mono text-[11px] font-bold text-primary-fg">
              J2W
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-4 text-text">AI Test Factory</span>
                <span className="block truncate text-[11px] leading-4 text-subtle">Enterprise quality</span>
              </span>
            )}
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Collapse the menu"
              title="Collapse the menu"
              className="hidden rounded-md p-1.5 text-subtle transition-colors hover:bg-surface2 hover:text-text lg:block"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        <div ref={listRef} onKeyDown={onKeyDown} className="j2w-scroll flex-1 overflow-y-auto px-2.5 py-3">
          {GROUP_ORDER.map((group) => {
            const groupItems = items.filter((i) => i.group === group)
            if (!groupItems.length) return null
            return (
              <div key={group} className="mb-4 last:mb-0">
                {collapsed ? (
                  <div className="mx-2 mb-2 border-t border-line" />
                ) : (
                  <div className="mb-1.5 px-2 text-label font-semibold uppercase text-subtle">{group}</div>
                )}
                <ul className="space-y-0.5">
                  {groupItems.map((item) => {
                    const active = isActive(item)
                    const count = counterFor(item)
                    const Icon = item.icon
                    return (
                      <li key={item.id}>
                        <Link
                          to={item.path}
                          data-nav
                          aria-current={active ? 'page' : undefined}
                          onClick={onCloseMobile}
                          title={collapsed ? item.label : item.blurb}
                          className={cn(
                            'group relative flex h-[38px] items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-[120ms] active:translate-y-[0.5px]',
                            active
                              ? 'bg-primary-soft font-medium text-primary before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary'
                              : 'text-muted hover:bg-surface2 hover:text-text',
                            collapsed && 'justify-center px-0',
                          )}
                        >
                          <Icon
                            size={18}
                            strokeWidth={1.75}
                            className={cn('shrink-0', active ? 'text-primary' : 'text-subtle group-hover:text-text')}
                          />
                          {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                          {!collapsed && count !== undefined && (
                            <span
                              className={cn(
                                'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
                                item.counter === 'failingChecks'
                                  ? 'bg-danger-soft text-danger'
                                  : 'bg-accent-soft text-accent',
                              )}
                            >
                              {count}
                            </span>
                          )}
                          {collapsed && count !== undefined && (
                            <span
                              className={cn(
                                'absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full',
                                item.counter === 'failingChecks' ? 'bg-danger' : 'bg-accent',
                              )}
                            />
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="border-t border-line p-2.5">
          {collapsed ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand the menu"
              title="Expand the menu"
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface2 hover:text-text"
            >
              <PanelLeftOpen size={16} />
            </button>
          ) : (
            <p className="px-1 text-[11px] leading-4 text-subtle">
              J2W · POC
              <br />
              mock data for demonstration
            </p>
          )}
        </div>
      </nav>
    </>
  )
}
