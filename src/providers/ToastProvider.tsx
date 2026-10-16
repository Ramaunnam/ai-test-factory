import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ToastTone = 'neutral' | 'success' | 'danger' | 'warning' | 'info'

export interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
  action?: { label: string; onClick: () => void }
}

interface Toast extends ToastInput {
  id: number
}

interface ToastCtx {
  toast: (t: ToastInput) => void
}

const Ctx = createContext<ToastCtx | null>(null)

const ICONS: Record<ToastTone, typeof Info> = {
  neutral: Info,
  success: CheckCircle2,
  danger: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const TONE: Record<ToastTone, string> = {
  neutral: 'text-muted',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-accent',
  info: 'text-info',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const seq = useRef(1)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
    const h = timers.current.get(id)
    if (h) window.clearTimeout(h)
    timers.current.delete(id)
  }, [])

  const toast = useCallback(
    (t: ToastInput) => {
      const id = seq.current++
      setItems((list) => [...list.slice(-2), { ...t, id }])
      const handle = window.setTimeout(() => dismiss(id), t.action ? 6000 : 4000)
      timers.current.set(id, handle)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-[70] flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-2 no-print"
        aria-live="polite"
        role="status"
      >
        {items.map((t) => {
          const tone = t.tone ?? 'neutral'
          const Icon = ICONS[tone]
          return (
            <div
              key={t.id}
              className="animate-fadeUp rounded-lg border border-line bg-surface p-3 shadow-lg"
              onMouseEnter={() => {
                const h = timers.current.get(t.id)
                if (h) window.clearTimeout(h)
              }}
              onMouseLeave={() => {
                timers.current.set(t.id, window.setTimeout(() => dismiss(t.id), 2200))
              }}
            >
              <div className="flex items-start gap-2.5">
                <Icon size={16} className={cn('mt-0.5 shrink-0', TONE[tone])} strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text">{t.title}</div>
                  {t.description && <div className="mt-0.5 text-xs text-muted">{t.description}</div>}
                  {t.action && (
                    <button
                      type="button"
                      className="mt-2 rounded-sm text-xs font-medium text-primary hover:text-primary-hover focus-visible:underline"
                      onClick={() => {
                        t.action?.onClick()
                        dismiss(t.id)
                      }}
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="rounded-sm p-0.5 text-subtle transition-colors hover:bg-surface2 hover:text-text"
                  onClick={() => dismiss(t.id)}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx.toast
}
