import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/cn'
import type { NavTab } from './nav.config'

export interface TabBarTab extends NavTab {
  count?: number
  tone?: 'danger' | 'accent'
}

export function TabBar({ tabs }: { tabs: TabBarTab[] }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [bar, setBar] = useState({ left: 0, width: 0 })

  const index = Math.max(
    0,
    tabs.findIndex((t) => t.path === pathname),
  )

  useLayoutEffect(() => {
    const el = wrapRef.current?.querySelectorAll<HTMLElement>('[data-tab]')[index]
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth })
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [index, pathname, tabs.length])

  const move = (dir: 1 | -1) => {
    const next = (index + dir + tabs.length) % tabs.length
    navigate(tabs[next].path)
  }

  return (
    <div className="relative border-b border-line">
      <div
        ref={wrapRef}
        role="tablist"
        aria-label="Page sections"
        className="j2w-scroll relative flex gap-1 overflow-x-auto"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            move(1)
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            move(-1)
          } else if (e.key === 'Home') {
            e.preventDefault()
            navigate(tabs[0].path)
          } else if (e.key === 'End') {
            e.preventDefault()
            navigate(tabs[tabs.length - 1].path)
          }
        }}
      >
        {tabs.map((t, i) => {
          const active = i === index
          return (
            <button
              key={t.path}
              data-tab
              role="tab"
              type="button"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => navigate(t.path)}
              className={cn(
                'relative flex h-10 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm transition-colors duration-[120ms]',
                active ? 'font-medium text-primary' : 'text-muted hover:text-text',
              )}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums',
                    t.tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface2 text-muted',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
        <span
          aria-hidden
          className="absolute bottom-0 h-0.5 rounded-full bg-primary transition-[left,width] duration-[180ms] ease-enter"
          style={{ left: bar.left, width: bar.width }}
        />
      </div>
    </div>
  )
}
