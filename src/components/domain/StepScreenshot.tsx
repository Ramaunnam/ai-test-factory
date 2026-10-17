import { cn } from '@/lib/cn'

export interface ScreenField {
  label: string
  value: string
  /** The field this step is actually checking. */
  highlight?: boolean
  /** The field that is wrong, circled in red. */
  wrong?: boolean
}

export interface StepScreen {
  /** The system the screen belongs to. */
  system: string
  /** The screen or transaction title. */
  title: string
  fields: ScreenField[]
  /** A message the system itself showed, e.g. when an action was refused. */
  banner?: { tone: 'danger' | 'warning' | 'success'; text: string }
  /** For a failed step. */
  expected?: string
  actual?: string
  /** For a healed step. */
  renamed?: { from: string; to: string }
  /** The button the step pressed. */
  action?: string
}

export type StepOutcome = 'pass' | 'fail' | 'healed' | 'blocked'

const OUTCOME_RING: Record<StepOutcome, string> = {
  pass: 'border-line',
  fail: 'border-danger/50',
  healed: 'border-accent/50',
  blocked: 'border-success/40',
}

/**
 * A drawn mock of the system screen a step touched. No image files: it is laid
 * out from the step's own values, so the screenshot always matches the data.
 */
export function StepScreenshot({
  screen,
  outcome = 'pass',
  variant = 'thumb',
  onClick,
  className,
}: {
  screen: StepScreen
  outcome?: StepOutcome
  variant?: 'thumb' | 'large'
  onClick?: () => void
  className?: string
}) {
  const body = (
    <div className={cn('overflow-hidden rounded-md border bg-surface text-left', OUTCOME_RING[outcome])}>
      {/* window chrome */}
      <div className="flex items-center gap-1.5 border-b border-line bg-surface2 px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-danger/60" />
        <span className="h-2 w-2 rounded-full bg-accent/60" />
        <span className="h-2 w-2 rounded-full bg-success/60" />
        <span className="ml-1 truncate text-[10px] font-medium text-muted">{screen.system}</span>
        <span className="ml-auto rounded-sm border border-accent/40 bg-accent-soft px-1 text-[9px] font-semibold text-accent">
          TEST
        </span>
      </div>

      <div className="px-3 py-2.5">
        <div className="mb-2 text-[11px] font-semibold text-text">{screen.title}</div>

        {screen.banner && (
          <div
            className={cn(
              'mb-2 rounded-sm border px-2 py-1 text-[10px]',
              screen.banner.tone === 'danger'
                ? 'border-danger/40 bg-danger-soft text-danger'
                : screen.banner.tone === 'warning'
                  ? 'border-accent/40 bg-accent-soft text-accent'
                  : 'border-success/40 bg-success-soft text-success',
            )}
          >
            {screen.banner.text}
          </div>
        )}

        <dl className="space-y-1">
          {screen.fields.map((f) => (
            <div
              key={f.label}
              className={cn(
                'flex items-center justify-between gap-3 rounded-sm px-1.5 py-1',
                f.wrong && 'bg-danger-soft ring-2 ring-danger/60',
                f.highlight && !f.wrong && 'bg-primary-soft ring-1 ring-primary/40',
              )}
            >
              <dt className="truncate text-[10px] text-subtle">{f.label}</dt>
              <dd
                className={cn(
                  'shrink-0 font-mono text-[10.5px]',
                  f.wrong ? 'font-semibold text-danger' : 'text-text',
                )}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>

        {screen.renamed && (
          <div className="mt-2 rounded-sm border border-accent/40 bg-accent-soft/60 px-2 py-1 font-mono text-[10px] text-accent">
            {screen.renamed.from} → {screen.renamed.to}
          </div>
        )}

        {(screen.expected || screen.actual) && (
          <div className="mt-2 space-y-0.5 rounded-sm border border-danger/40 bg-danger-soft/60 px-2 py-1 text-[10px]">
            {screen.expected && (
              <div>
                <span className="text-subtle">Expected </span>
                <span className="text-text">{screen.expected}</span>
              </div>
            )}
            {screen.actual && (
              <div>
                <span className="text-subtle">Actual </span>
                <span className="font-semibold text-danger">{screen.actual}</span>
              </div>
            )}
          </div>
        )}

        {screen.action && (
          <div className="mt-2 flex justify-end">
            <span className="rounded-sm bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-fg">
              {screen.action}
            </span>
          </div>
        )}
      </div>
    </div>
  )

  if (variant === 'large') {
    return <div className={cn('w-full [&_*]:text-[inherit]', className)}>{body}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${screen.system} · ${screen.title}`}
      aria-label={`Screenshot of ${screen.system}, ${screen.title}`}
      className={cn(
        'group relative h-[108px] w-[176px] shrink-0 overflow-hidden rounded-md border border-line bg-surface shadow-sm transition-[transform,box-shadow,border-color] duration-[120ms] hover:-translate-y-px hover:border-line-strong hover:shadow-md',
        className,
      )}
    >
      <span className="pointer-events-none absolute left-0 top-0 block w-[352px] origin-top-left scale-50">
        {body}
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-surface/90 px-1.5 py-0.5 text-[9px] text-subtle group-hover:text-text">
        Screen mock · open
      </span>
    </button>
  )
}
