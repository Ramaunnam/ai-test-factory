import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronDown, FolderGit2, HelpCircle, Menu, Monitor, Moon, Search, Sun, UserCog } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge, IconButton, SegmentedControl } from '@/components/ui'
import { useTheme, type ThemeMode } from '@/providers/ThemeProvider'
import { ROLES, useRole } from '@/providers/RoleProvider'
import { ALL_PROJECTS, PROJECTS, useProjectFilter } from '@/data/projects'
import { useToast } from '@/providers/ToastProvider'
import { locate } from './nav.config'

export function Header({
  onOpenPalette,
  onOpenShortcuts,
  onOpenMobileNav,
}: {
  onOpenPalette: () => void
  onOpenShortcuts: () => void
  onOpenMobileNav: () => void
}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { mode, setMode } = useTheme()
  const { role, setRole } = useRole()
  const toast = useToast()
  const [roleOpen, setRoleOpen] = useState(false)
  const roleRef = useRef<HTMLDivElement>(null)
  const [projectOpen, setProjectOpen] = useState(false)
  const projectRef = useRef<HTMLDivElement>(null)
  const { projectId, project, setProject } = useProjectFilter()

  const here = locate(pathname)
  const group = here?.item.group ?? 'OVERVIEW'
  const page = here?.item.label ?? 'Report'
  const tab = here?.tab?.label

  useEffect(() => {
    setRoleOpen(false)
    setProjectOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!roleOpen) return
    const onDown = (e: MouseEvent) => {
      if (!roleRef.current?.contains(e.target as Node)) setRoleOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRoleOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [roleOpen])

  useEffect(() => {
    if (!projectOpen) return
    const onDown = (e: MouseEvent) => {
      if (!projectRef.current?.contains(e.target as Node)) setProjectOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProjectOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [projectOpen])

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur no-print">
      <IconButton label="Open the menu" className="lg:hidden" onClick={onOpenMobileNav}>
        <Menu size={18} />
      </IconButton>

      <div className="min-w-0">
        <div className="truncate text-[11px] leading-4 text-subtle">
          J2W AI Test Factory ·{' '}
          <button
            type="button"
            className="rounded-sm underline-offset-2 transition-colors hover:text-muted hover:underline"
            onClick={() => navigate(here?.item.path ?? '/')}
          >
            {group.charAt(0) + group.slice(1).toLowerCase()}
          </button>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold leading-5">
          <button
            type="button"
            onClick={() => navigate(here?.item.path ?? '/')}
            className="truncate rounded-sm text-text transition-colors hover:text-primary"
          >
            {page}
          </button>
          {tab && (
            <>
              <span className="text-subtle">/</span>
              <span className="truncate font-normal text-muted">{tab}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenPalette}
        className="hidden h-[34px] w-[230px] items-center gap-2 rounded-md border border-line bg-surface2 px-2.5 text-left text-sm text-subtle transition-colors hover:border-line-strong hover:text-muted xl:flex"
      >
        <Search size={15} />
        <span className="flex-1 truncate">Search or jump to…</span>
        <kbd>Ctrl K</kbd>
      </button>
      <IconButton label="Search or jump to" className="xl:hidden" onClick={onOpenPalette}>
        <Search size={17} />
      </IconButton>

      <Badge tone="warning" className="hidden sm:inline-flex" title="Simulated environment, no production data">
        TEST
      </Badge>

      <div className="relative" ref={projectRef}>
        <button
          type="button"
          onClick={() => setProjectOpen((o) => !o)}
          aria-expanded={projectOpen}
          aria-haspopup="menu"
          title="Which change project you are looking at"
          className="flex h-[34px] items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-text transition-colors hover:bg-surface2"
        >
          <FolderGit2 size={15} className={cn(project ? 'text-primary' : 'text-subtle')} />
          <span className="hidden max-w-[130px] truncate lg:block">{project ? project.name : 'All projects'}</span>
          <ChevronDown size={14} className={cn('text-subtle transition-transform', projectOpen && 'rotate-180')} />
        </button>
        {projectOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[38px] z-[80] w-[320px] overflow-hidden rounded-lg border border-line bg-surface shadow-lg animate-scaleIn"
          >
            <div className="border-b border-line px-3 py-2 text-label font-semibold uppercase text-subtle">
              Change project
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setProject(ALL_PROJECTS)
                setProjectOpen(false)
                toast({ title: 'Showing every project', tone: 'info' })
              }}
              className={cn(
                'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface2',
                projectId === ALL_PROJECTS && 'bg-primary-soft/60',
              )}
            >
              <Check
                size={15}
                className={cn('mt-0.5 shrink-0', projectId === ALL_PROJECTS ? 'text-primary' : 'text-transparent')}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text">All projects</span>
                <span className="block text-xs text-muted">
                  Everything running at once, which is how the landscape really is.
                </span>
              </span>
            </button>
            {PROJECTS.map((pr) => (
              <button
                key={pr.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setProject(pr.id)
                  setProjectOpen(false)
                  toast({
                    title: `Showing ${pr.name}`,
                    description: 'Scenarios, runs, changes, findings and schedules are filtered to this project.',
                    tone: 'info',
                  })
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface2',
                  pr.id === projectId && 'bg-primary-soft/60',
                )}
              >
                <Check size={15} className={cn('mt-0.5 shrink-0', pr.id === projectId ? 'text-primary' : 'text-transparent')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text">{pr.name}</span>
                  <span className="block text-xs text-muted">{pr.blurb}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-subtle">
                    {pr.release} · owned by {pr.owner}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative" ref={roleRef}>
        <button
          type="button"
          onClick={() => setRoleOpen((o) => !o)}
          aria-expanded={roleOpen}
          aria-haspopup="menu"
          className="flex h-[34px] items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-text transition-colors hover:bg-surface2"
        >
          <UserCog size={15} className="text-subtle" />
          <span className="hidden max-w-[110px] truncate lg:block">{role}</span>
          <ChevronDown size={14} className={cn('text-subtle transition-transform', roleOpen && 'rotate-180')} />
        </button>
        {roleOpen && (
          <div
            role="menu"
            className="absolute right-0 top-[38px] z-[80] w-[300px] overflow-hidden rounded-lg border border-line bg-surface shadow-lg animate-scaleIn"
          >
            <div className="border-b border-line px-3 py-2 text-label font-semibold uppercase text-subtle">
              View the factory as
            </div>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setRole(r.id)
                  setRoleOpen(false)
                  navigate(r.landing)
                  toast({
                    title: `Now viewing as ${r.id}`,
                    description: r.readOnly ? 'Read only. Run actions will explain themselves.' : r.description,
                    tone: 'info',
                  })
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface2',
                  r.id === role && 'bg-primary-soft/60',
                )}
              >
                <Check size={15} className={cn('mt-0.5 shrink-0', r.id === role ? 'text-primary' : 'text-transparent')} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text">{r.id}</span>
                  <span className="block text-xs text-muted">{r.description}</span>
                  <span className="mt-0.5 block font-mono text-[11px] text-subtle">lands on {r.landing}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <SegmentedControl<ThemeMode>
        ariaLabel="Colour theme"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'light', label: <Sun size={14} />, title: 'Light' },
          { value: 'dark', label: <Moon size={14} />, title: 'Dark' },
          { value: 'system', label: <Monitor size={14} />, title: 'Follow the system' },
        ]}
      />

      <IconButton label="Keyboard shortcuts" onClick={onOpenShortcuts}>
        <HelpCircle size={17} />
      </IconButton>
    </header>
  )
}
