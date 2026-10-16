import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TOUR_SCENES } from './scenes'
import { useRole } from '@/providers/RoleProvider'

const TRAVEL_MS = 850
const SETTLE_MS = 420

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * A self-driving walkthrough of the real application: it navigates, moves a
 * cursor, clicks, zooms and captions itself. Record one take of it, or run it
 * live in front of a client.
 */
export function GuidedTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { setRole } = useRole()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const [spot, setSpot] = useState<Rect | null>(null)
  const [pressing, setPressing] = useState(false)

  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const locationRef = useRef(location.pathname)
  locationRef.current = location.pathname

  const scene = TOUR_SCENES[index]
  const last = index >= TOUR_SCENES.length - 1

  const resetZoom = useCallback(() => {
    const main = document.getElementById('main-scroll')
    if (!main) return
    main.style.transition = 'transform 500ms cubic-bezier(.2,.8,.2,1)'
    main.style.transform = 'none'
  }, [])

  const stop = useCallback(() => {
    resetZoom()
    setCursor(null)
    setSpot(null)
    setIndex(0)
    setPaused(false)
    setRole('Key User')
    onClose()
  }, [onClose, resetZoom, setRole])

  /* ------------------------------------------------------------------ */
  /* the scene runner                                                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!open) return
    let cancelled = false

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(resolve, ms)
        if (cancelled) window.clearTimeout(id)
      })

    const waitWhilePaused = async () => {
      while (pausedRef.current && !cancelled) await wait(140)
    }

    const run = async () => {
      // 1. the right page, the right role
      if (scene.role) setRole(scene.role)
      if (scene.route && locationRef.current !== scene.route) {
        resetZoom()
        setSpot(null)
        navigate(scene.route)
        await wait(850)
      }
      if (cancelled) return
      scene.before?.()
      await wait(250)

      // 2. find the target and bring it into view
      const el = scene.target ? document.querySelector<HTMLElement>(scene.target) : null
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        await wait(600)
      }
      if (cancelled) return

      // 3. zoom first, then measure, so the spotlight lands on the scaled target
      if (el && scene.zoom && scene.zoom > 1) {
        const main = document.getElementById('main-scroll')
        const r = el.getBoundingClientRect()
        if (main) {
          const m = main.getBoundingClientRect()
          main.style.transformOrigin = `${r.left + r.width / 2 - m.left}px ${r.top + r.height / 2 - m.top}px`
          main.style.transition = 'transform 700ms cubic-bezier(.2,.8,.2,1)'
          main.style.transform = `scale(${scene.zoom})`
          await wait(750)
        }
      } else {
        resetZoom()
        await wait(200)
      }
      if (cancelled) return

      // 4. move the cursor on to it
      if (el) {
        const r = el.getBoundingClientRect()
        setSpot({ top: r.top, left: r.left, width: r.width, height: r.height })
        setCursor({ x: r.left + Math.min(r.width / 2, 220), y: r.top + Math.min(r.height / 2, 34) })
        await wait(TRAVEL_MS)
      } else {
        setSpot(null)
        setCursor(null)
      }
      if (cancelled) return

      // 5. click it for real
      if (scene.click && el) {
        setPressing(true)
        await wait(260)
        el.click()
        setPressing(false)
        await wait(SETTLE_MS)
        if (scene.closeAfter) {
          await wait(scene.hold)
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
          await wait(400)
          if (cancelled) return
          await waitWhilePaused()
          if (!cancelled && !last) setIndex((i) => i + 1)
          return
        }
      }

      // 6. hold, then move on
      await wait(scene.hold)
      if (cancelled) return
      await waitWhilePaused()
      if (cancelled) return
      if (last) {
        setPaused(true)
        return
      }
      setIndex((i) => i + 1)
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index])

  /* ------------------------------------------------------------------ */
  /* keyboard                                                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        stop()
      } else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, TOUR_SCENES.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, stop])

  useEffect(() => {
    if (!open) resetZoom()
  }, [open, resetZoom])

  if (!open) return null

  return (
    <>
      {/* spotlight: everything outside the target dims */}
      {spot && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[46] rounded-lg transition-all duration-500 ease-enter no-print"
          style={{
            top: spot.top - 8,
            left: spot.left - 8,
            width: spot.width + 16,
            height: spot.height + 16,
            boxShadow: '0 0 0 9999px rgb(var(--overlay) / 0.55)',
            outline: '2px solid rgb(var(--focus))',
            outlineOffset: '2px',
          }}
        />
      )}

      {/* the cursor */}
      {cursor && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[95] no-print"
          style={{
            transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`,
            transition: `transform ${TRAVEL_MS}ms cubic-bezier(.3,.7,.2,1)`,
          }}
        >
          <span
            className={cn(
              'absolute -left-5 -top-5 block h-10 w-10 rounded-full border-2 border-focusring transition-all duration-200',
              pressing ? 'scale-75 bg-focusring/30' : 'scale-100 bg-focusring/10',
            )}
          />
          <svg width="22" height="22" viewBox="0 0 24 24" className="relative drop-shadow">
            <path
              d="M5 3l14 8-6.2 1.6L9.8 19 5 3z"
              fill="rgb(var(--text))"
              stroke="rgb(var(--surface))"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {/* caption bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[96] flex justify-center px-4 pb-5 no-print">
        <div className="pointer-events-auto w-full max-w-3xl overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <div className="h-0.5 w-full bg-surface2">
            <div
              className="h-full bg-primary transition-[width] duration-500"
              style={{ width: `${((index + 1) / TOUR_SCENES.length) * 100}%` }}
            />
          </div>
          <div className="flex items-start gap-4 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2 text-label font-semibold uppercase text-subtle">
                <span>
                  Scene {index + 1} of {TOUR_SCENES.length}
                </span>
                <span className="text-line">·</span>
                <span className="text-primary">{scene.title}</span>
                {paused && <span className="text-accent">paused</span>}
              </div>
              <p className="text-sm leading-6 text-text">{scene.caption}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label="Previous scene"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-text disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label={paused ? 'Resume' : 'Pause'}
                onClick={() => setPaused((p) => !p)}
                className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-fg transition-colors hover:bg-primary-hover"
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
              </button>
              <button
                type="button"
                aria-label="Next scene"
                onClick={() => setIndex((i) => Math.min(TOUR_SCENES.length - 1, i + 1))}
                disabled={last}
                className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-text disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                aria-label="End the tour"
                onClick={stop}
                className="ml-1 grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface2 hover:text-text"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 border-t border-line bg-surface2/60 px-5 py-1.5">
            {TOUR_SCENES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                title={s.title}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i === index ? 'bg-primary' : i < index ? 'bg-primary/40' : 'bg-line',
                )}
              />
            ))}
            <span className="ml-2 hidden shrink-0 text-[10px] text-subtle sm:block">
              space pause · ← → scenes · esc end
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
