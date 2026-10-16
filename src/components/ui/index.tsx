import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, ChevronDown, ChevronUp, Copy, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { num } from '@/lib/format'

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'ai' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary-press border border-transparent',
  secondary:
    'bg-surface text-text border border-line-strong hover:bg-surface2 active:bg-surface3',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-surface2 hover:text-text active:bg-surface3',
  danger: 'bg-danger text-white hover:brightness-110 active:brightness-95 border border-transparent dark:text-[rgb(var(--bg))]',
  ai: 'bg-ai text-white hover:brightness-110 active:brightness-95 border border-transparent dark:text-[rgb(var(--bg))]',
  link: 'bg-transparent text-primary hover:text-primary-hover underline-offset-2 hover:underline border border-transparent px-0',
}

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-[34px] px-3.5 text-sm gap-2 rounded-md',
  lg: 'h-10 px-5 text-base gap-2 rounded-md',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', leftIcon, rightIcon, loading, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,color,border-color,transform] duration-[120ms]',
        'active:translate-y-[0.5px] disabled:pointer-events-none disabled:opacity-50',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  variant?: ButtonVariant
  size?: 'sm' | 'md'
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-colors duration-[120ms] active:translate-y-[0.5px] disabled:opacity-50',
        size === 'sm' ? 'h-7 w-7' : 'h-[34px] w-[34px]',
        BTN_VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  tone?: 'default' | 'danger' | 'success' | 'warning' | 'ai'
}

const CARD_TONE = {
  default: 'border-line',
  danger: 'border-danger/45',
  success: 'border-success/45',
  warning: 'border-accent/45',
  ai: 'border-ai/45',
}

export function Card({ interactive, tone = 'default', className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-surface shadow-sm',
        CARD_TONE[tone],
        interactive &&
          'cursor-pointer transition-[transform,box-shadow,border-color] duration-[120ms] hover:-translate-y-px hover:border-line-strong hover:shadow-md active:translate-y-0',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-3 border-b border-line px-5 py-3.5', className)}>
      {icon && <div className="mt-0.5 text-muted">{icon}</div>}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[15px] font-semibold text-text">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-t border-line px-5 py-3', className)} {...rest} />
}

/* -------------------------------------------------------------------------- */
/* Badge / Chip                                                               */
/* -------------------------------------------------------------------------- */

export type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'ai'

const BADGE: Record<Tone, string> = {
  neutral: 'bg-surface2 text-muted border-line',
  primary: 'bg-primary-soft text-primary border-primary/25',
  success: 'bg-success-soft text-success border-success/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  warning: 'bg-accent-soft text-accent border-accent/30',
  info: 'bg-info-soft text-info border-info/30',
  ai: 'bg-ai-soft text-ai border-ai/30',
}

const DOT: Record<Tone, string> = {
  neutral: 'bg-subtle',
  primary: 'bg-primary',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-accent',
  info: 'bg-info',
  ai: 'bg-ai',
}

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
  mono,
  title,
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
  mono?: boolean
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        BADGE[tone],
        mono && 'font-mono',
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT[tone])} />}
      {children}
    </span>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  tone = 'neutral',
  className,
  title,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  tone?: Tone
  className?: string
  title?: string
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-[120ms] active:translate-y-[0.5px]',
        selected
          ? 'border-primary/40 bg-primary-soft text-primary'
          : tone === 'danger'
            ? 'border-danger/30 bg-danger-soft text-danger hover:brightness-105'
            : 'border-line bg-surface text-muted hover:bg-surface2 hover:text-text',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  size = 'md',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const id = useId()
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative shrink-0 rounded-full border transition-colors duration-[150ms] disabled:opacity-50',
          size === 'md' ? 'h-5 w-9' : 'h-4 w-7',
          checked ? 'border-primary bg-primary' : 'border-line-strong bg-surface2',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-[150ms] dark:bg-[rgb(var(--surface))]',
            size === 'md' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5',
            checked ? (size === 'md' ? 'left-[18px]' : 'left-[14px]') : 'left-[3px]',
          )}
        />
      </button>
      {(label || description) && (
        <label htmlFor={id} className="cursor-pointer select-none">
          {label && <div className="text-sm font-medium text-text">{label}</div>}
          {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
        </label>
      )}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-[34px] w-full rounded-sm border border-line-strong bg-surface px-3 text-sm text-text placeholder:text-subtle',
        'transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focusring/40',
        className,
      )}
      {...rest}
    />
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-sm border border-line-strong bg-surface px-3 py-2 text-sm text-text placeholder:text-subtle',
          'transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focusring/40',
          className,
        )}
        {...rest}
      />
    )
  },
)

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  className,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[34px] w-full rounded-sm border border-line-strong bg-surface pl-8 pr-8 text-sm text-text placeholder:text-subtle transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focusring/40"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-subtle hover:bg-surface2 hover:text-text"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'h-[34px] w-full appearance-none rounded-sm border border-line-strong bg-surface pl-3 pr-8 text-sm text-text',
          'transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focusring/40',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle" />
    </div>
  )
})

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  title?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
  className,
}: {
  options: SegmentOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
  className?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  useLayoutEffect(() => {
    const el = wrapRef.current?.children[index + 1] as HTMLElement | undefined
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth })
  }, [index, options.length, size])

  return (
    <div
      ref={wrapRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('relative inline-flex rounded-md border border-line bg-surface2 p-0.5', className)}
    >
      <span
        aria-hidden
        className="absolute top-0.5 rounded-[7px] bg-surface shadow-sm transition-[left,width] duration-[180ms] ease-enter"
        style={{ left: indicator.left, width: indicator.width, bottom: 2 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.preventDefault()
              const dir = e.key === 'ArrowRight' ? 1 : -1
              const next = options[(index + dir + options.length) % options.length]
              onChange(next.value)
            }
          }}
          className={cn(
            'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium transition-colors duration-[120ms]',
            size === 'md' ? 'h-[28px] px-3 text-xs' : 'h-[24px] px-2.5 text-[11px]',
            o.value === value ? 'text-text' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Progress / Gauge / RiskDial                                                */
/* -------------------------------------------------------------------------- */

export function Progress({ value, tone = 'primary', className }: { value: number; tone?: Tone; className?: string }) {
  const fill: Record<Tone, string> = {
    neutral: 'bg-subtle',
    primary: 'bg-primary',
    success: 'bg-success',
    danger: 'bg-danger',
    warning: 'bg-accent',
    info: 'bg-info',
    ai: 'bg-ai',
  }
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface2', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-enter', fill[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function Gauge({
  value,
  size = 168,
  label,
  caption,
}: {
  value: number
  size?: number
  label?: string
  caption?: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = window.setTimeout(() => setShown(value), 60)
    return () => window.clearTimeout(id)
  }, [value])

  const r = size / 2 - 14
  const circ = Math.PI * r // half circle
  const tone = value >= 80 ? 'rgb(var(--success))' : value >= 60 ? 'rgb(var(--accent))' : 'rgb(var(--danger))'
  const offset = circ * (1 - Math.max(0, Math.min(100, shown)) / 100)

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 14} viewBox={`0 0 ${size} ${size / 2 + 14}`} role="img" aria-label={`${value} out of 100`}>
        <path
          d={`M 14 ${size / 2} A ${r} ${r} 0 0 1 ${size - 14} ${size / 2}`}
          fill="none"
          stroke="rgb(var(--surface-2))"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d={`M 14 ${size / 2} A ${r} ${r} 0 0 1 ${size - 14} ${size / 2}`}
          fill="none"
          stroke={tone}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.2,.8,.2,1)' }}
        />
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          className="fill-[rgb(var(--text))] font-mono"
          style={{ fontSize: 30, fontWeight: 600 }}
        >
          {Math.round(value)}
        </text>
      </svg>
      {label && <div className="-mt-1 text-sm font-medium text-text">{label}</div>}
      {caption && <div className="mt-0.5 text-center text-xs text-muted">{caption}</div>}
    </div>
  )
}

export function RiskDial({ value, size = 52 }: { value: number; size?: number }) {
  const tone = value >= 70 ? 'rgb(var(--danger))' : value >= 40 ? 'rgb(var(--accent))' : 'rgb(var(--success))'
  const r = size / 2 - 5
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Risk ${value} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={tone}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - value / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }}
      />
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        className="fill-[rgb(var(--text))] font-mono"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        {value}
      </text>
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 520,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 no-print">
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgb(var(--overlay) / var(--overlay-alpha))' }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[85vh] w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg animate-scaleIn"
        style={{ maxWidth: width }}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-text">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} size="sm">
            <X size={15} />
          </IconButton>
        </div>
        <div className="j2w-scroll max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* DataTable                                                                  */
/* -------------------------------------------------------------------------- */

export interface Column<T> {
  key: string
  header: string
  align?: 'left' | 'right' | 'center'
  width?: number | string
  mono?: boolean
  sortable?: boolean
  render?: (row: T) => ReactNode
  value?: (row: T) => string | number | null | undefined
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowTone,
  searchable,
  searchPlaceholder = 'Search',
  empty,
  maxHeight,
  dense,
  footerNote,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T, i: number) => string
  onRowClick?: (row: T) => void
  rowTone?: (row: T) => 'danger' | 'warning' | 'success' | undefined
  searchable?: boolean
  searchPlaceholder?: string
  empty?: ReactNode
  maxHeight?: number
  dense?: boolean
  footerNote?: ReactNode
}) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)

  const text = (row: T, col: Column<T>) => {
    const v = col.value ? col.value(row) : (row as Record<string, unknown>)[col.key]
    return v === null || v === undefined ? '' : String(v)
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = rows
    if (needle) out = rows.filter((r) => columns.some((c) => text(r, c).toLowerCase().includes(needle)))
    if (sort) {
      const col = columns.find((c) => c.key === sort.key)
      if (col) {
        out = [...out].sort((a, b) => {
          const av = col.value ? col.value(a) : (a as Record<string, unknown>)[col.key]
          const bv = col.value ? col.value(b) : (b as Record<string, unknown>)[col.key]
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * sort.dir
          return String(av ?? '').localeCompare(String(bv ?? '')) * sort.dir
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, columns])

  return (
    <div className="flex min-w-0 flex-col">
      {searchable && (
        <div className="border-b border-line px-4 py-2.5">
          <SearchInput value={q} onChange={setQ} placeholder={searchPlaceholder} className="max-w-xs" />
        </div>
      )}
      <div className="j2w-scroll min-w-0 overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface2">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}
                    style={{ width: c.width }}
                    className={cn(
                      'whitespace-nowrap border-b border-line px-3 py-2 text-label font-semibold uppercase text-subtle',
                      c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                    )}
                  >
                    {c.sortable === false ? (
                      c.header
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))
                        }
                        className={cn(
                          'inline-flex items-center gap-1 rounded-sm transition-colors hover:text-text',
                          active && 'text-primary',
                        )}
                      >
                        {c.header}
                        {active && (sort!.dir === 1 ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                      </button>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const tone = rowTone?.(row)
              return (
                <tr
                  key={rowKey(row, i)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRowClick(row)
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    'border-b border-line/70 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-surface2',
                    tone === 'danger' && 'bg-danger-soft/60 border-l-2 border-l-danger',
                    tone === 'warning' && 'bg-accent-soft/50 border-l-2 border-l-accent',
                    tone === 'success' && 'bg-success-soft/50 border-l-2 border-l-success',
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-3 text-text',
                        dense ? 'py-1.5' : 'py-2.5',
                        c.mono && 'font-mono tabular-nums text-[12.5px]',
                        c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left',
                      )}
                    >
                      {c.render ? c.render(row) : text(row, c) || <span className="text-subtle">—</span>}
                    </td>
                  ))}
                </tr>
              )
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-muted">
                  {empty ?? 'Nothing to show here.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-subtle">
        <span>
          {num(filtered.length)} {filtered.length === 1 ? 'row' : 'rows'}
          {q && ` of ${num(rows.length)}`}
        </span>
        {footerNote}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      <div className="text-sm font-semibold text-text">{title}</div>
      {description && <div className="mt-1 max-w-sm text-xs text-muted">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-surface2', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[rgb(var(--surface-3))] to-transparent" />
    </div>
  )
}

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={`${label} ${value}`}
      title={`${label} ${value}`}
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard?.writeText(value).catch(() => undefined)
        setDone(true)
        window.setTimeout(() => setDone(false), 1200)
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-subtle opacity-0 transition-opacity hover:bg-surface2 hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
    >
      {done ? <Check size={12} className="text-success" /> : <Copy size={12} />}
    </button>
  )
}

export function MonoId({ value, onClick, tone }: { value: string; onClick?: () => void; tone?: 'danger' | 'muted' }) {
  return (
    <span className="group inline-flex items-center gap-1">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'rounded-sm font-mono text-[12.5px] underline-offset-2 transition-colors hover:underline',
            tone === 'danger' ? 'text-danger' : 'text-primary',
          )}
        >
          {value}
        </button>
      ) : (
        <span className={cn('font-mono text-[12.5px]', tone === 'muted' ? 'text-muted' : 'text-text')}>{value}</span>
      )}
      <CopyButton value={value} />
    </span>
  )
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
  icon,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tone
  onClick?: () => void
  icon?: ReactNode
}) {
  const toneText: Record<Tone, string> = {
    neutral: 'text-text',
    primary: 'text-primary',
    success: 'text-success',
    danger: 'text-danger',
    warning: 'text-accent',
    info: 'text-info',
    ai: 'text-ai',
  }
  const Comp: 'button' | 'div' = onClick ? 'button' : 'div'
  return (
    <Comp
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex min-w-0 flex-col items-start gap-1 rounded-lg border border-line bg-surface px-4 py-3 text-left shadow-sm',
        onClick &&
          'cursor-pointer transition-[transform,box-shadow,border-color] duration-[120ms] hover:-translate-y-px hover:border-line-strong hover:shadow-md',
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-label font-semibold uppercase text-subtle">{label}</span>
        {icon && <span className="text-subtle">{icon}</span>}
      </div>
      <span className={cn('font-mono text-xl font-semibold tabular-nums', toneText[tone])}>{value}</span>
      {hint && <span className="truncate text-xs text-muted">{hint}</span>}
    </Comp>
  )
}

export function Disclosure({
  summary,
  children,
  defaultOpen,
  className,
}: {
  summary: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <div className={cn('rounded-md border border-line bg-surface2/60', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:text-text"
      >
        {summary}
        <ChevronDown size={14} className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-line px-3 py-2.5">{children}</div>}
    </div>
  )
}

export function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <pre
      className={cn(
        'j2w-scroll j2w-log max-h-72 overflow-auto rounded-md border border-line bg-surface2 p-3 font-mono text-[12px] leading-5 text-text',
        className,
      )}
    >
      {children}
    </pre>
  )
}

export function FieldGrid({
  fields,
  columns = 2,
}: {
  fields: { label: string; value: ReactNode; flagged?: boolean; note?: string }[]
  columns?: 2 | 3
}) {
  return (
    <div className={cn('grid gap-x-5 gap-y-2.5', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {fields.map((f) => (
        <div key={f.label} className="min-w-0">
          <div className="text-label font-semibold uppercase text-subtle">{f.label}</div>
          <div
            className={cn(
              'mt-0.5 truncate font-mono text-[12.5px]',
              f.flagged ? 'font-semibold text-danger' : 'text-text',
            )}
            title={typeof f.value === 'string' ? f.value : undefined}
          >
            {f.value}
          </div>
          {f.note && <div className="text-[11px] text-danger">{f.note}</div>}
        </div>
      ))}
    </div>
  )
}

/** Animated, skippable live log used for every simulated AI action. */
export function LiveLog({
  lines,
  running,
  onDone,
  height = 180,
  speed = 420,
}: {
  lines: string[]
  running: boolean
  onDone?: () => void
  height?: number
  speed?: number
}) {
  const [shown, setShown] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (!running) return
    setShown([])
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setShown(lines.slice(0, i))
      if (i >= lines.length) {
        window.clearInterval(id)
        doneRef.current?.()
      }
    }, speed)
    return () => window.clearInterval(id)
  }, [running, lines, speed])

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight })
  }, [shown])

  return (
    <div
      ref={ref}
      className="j2w-scroll j2w-log overflow-y-auto rounded-md border border-line bg-surface2 p-3 font-mono text-[12px] leading-[1.7] text-muted"
      style={{ height }}
    >
      {shown.length === 0 && <span className="text-subtle">Waiting to start…</span>}
      {shown.map((l, i) => (
        <div key={i} className={cn(i === shown.length - 1 && running && 'text-text')}>
          <span className="text-subtle">{String(i + 1).padStart(2, '0')}</span> {l}
        </div>
      ))}
    </div>
  )
}

export function SectionTitle({ title, hint, actions }: { title: string; hint?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>
}
