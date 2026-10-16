import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ChevronLeft, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DrawerSpec {
  title: string
  subtitle?: string
  width?: 'md' | 'lg' | 'xl'
  content: ReactNode
}

interface DrawerCtx {
  open: (spec: DrawerSpec) => void
  push: (spec: DrawerSpec) => void
  close: () => void
  closeAll: () => void
  depth: number
}

const Ctx = createContext<DrawerCtx | null>(null)

const WIDTH = { md: 'w-[480px]', lg: 'w-[720px]', xl: 'w-[960px]' }

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<DrawerSpec[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreTo = useRef<HTMLElement | null>(null)

  const open = useCallback((spec: DrawerSpec) => {
    restoreTo.current = document.activeElement as HTMLElement
    setStack([spec])
  }, [])
  const push = useCallback((spec: DrawerSpec) => setStack((s) => [...s, spec]), [])
  const close = useCallback(() => setStack((s) => s.slice(0, -1)), [])
  const closeAll = useCallback(() => setStack([]), [])

  const current = stack[stack.length - 1]

  useEffect(() => {
    if (!current) {
      restoreTo.current?.focus?.()
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      window.clearTimeout(t)
    }
  }, [current, close])

  const value = useMemo(
    () => ({ open, push, close, closeAll, depth: stack.length }),
    [open, push, close, closeAll, stack.length],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {current && (
        <div className="fixed inset-0 z-[50] no-print">
          <div
            className="absolute inset-0 backdrop-blur-[2px]"
            style={{ background: 'rgb(var(--overlay) / var(--overlay-alpha))' }}
            onClick={closeAll}
            aria-hidden
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={current.title}
            className={cn(
              'absolute right-0 top-0 z-[51] flex h-full max-w-full flex-col border-l border-line bg-surface shadow-lg animate-slideIn',
              WIDTH[current.width ?? 'lg'],
            )}
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              {stack.length > 1 && (
                <button
                  type="button"
                  onClick={close}
                  aria-label="Back"
                  className="mt-0.5 rounded-md p-1 text-muted transition-colors hover:bg-surface2 hover:text-text"
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-text">{current.title}</h2>
                {current.subtitle && <p className="mt-0.5 text-xs text-muted">{current.subtitle}</p>}
              </div>
              <button
                type="button"
                data-autofocus
                onClick={closeAll}
                aria-label="Close"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface2 hover:text-text"
              >
                <X size={16} />
              </button>
            </div>
            <div className="j2w-scroll flex-1 overflow-y-auto px-5 py-4">{current.content}</div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useDrawer() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDrawer must be used inside DrawerProvider')
  return ctx
}
