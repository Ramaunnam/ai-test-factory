import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, ChevronLeft, ChevronRight, ExternalLink, Pause, Play, Truck } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Badge, Button, Card, CardBody, CardHeader, Chip, EmptyState, MonoId, SectionTitle } from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { SourceNote } from '@/components/domain/SourceNote'
import {
  coveredRequirementCount,
  JOURNEY_REQUIREMENTS,
  JOURNEY_STEPS,
  JOURNEY_TOTAL,
  journeyStep,
  requirementById,
  stepsCovering,
} from '@/data/journey'
import { useSim } from '@/sim/useSim'
import { useToast } from '@/providers/ToastProvider'
import { fmtSim, num } from '@/lib/format'

const PLAY_MS = 4000

export function JourneyPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const { engine, version } = useSim()

  const fromUrl = Number(params.get('step'))
  const [current, setCurrent] = useState(fromUrl >= 1 && fromUrl <= JOURNEY_TOTAL ? fromUrl : 1)
  const [playing, setPlaying] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const loggedFor = useRef<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  const step = journeyStep(current)

  // deep link: /journey?step=4
  useEffect(() => {
    if (fromUrl >= 1 && fromUrl <= JOURNEY_TOTAL && fromUrl !== current) setCurrent(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl])

  const go = (n: number) => {
    const next = Math.min(JOURNEY_TOTAL, Math.max(1, n))
    setCurrent(next)
    setParams(
      (p) => {
        const q = new URLSearchParams(p)
        q.set('step', String(next))
        return q
      },
      { replace: true },
    )
  }

  /* --------------------------------------------------------------- play --- */
  useEffect(() => {
    if (!playing) return
    if (loggedFor.current !== current) {
      loggedFor.current = current
      const s = journeyStep(current)
      setLog((l) => [...l, `Step ${s.n} · ${s.name} — ${s.logLine}`])
    }
    if (current >= JOURNEY_TOTAL) {
      const stop = window.setTimeout(() => setPlaying(false), PLAY_MS)
      return () => window.clearTimeout(stop)
    }
    const id = window.setTimeout(() => go(current + 1), PLAY_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, current])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [log])

  const play = () => {
    setLog([])
    loggedFor.current = null
    go(1)
    setPlaying(true)
  }

  const highlightedSteps = highlight ? stepsCovering(highlight) : []

  const pickRequirement = (id: string) => {
    if (highlight === id) {
      setHighlight(null)
      return
    }
    setHighlight(id)
    const first = stepsCovering(id)[0]
    if (first) go(first)
  }

  /* -------------------------------------------------------------- truck --- */
  /** Everything the journey needs to know about one gate pass, read live. */
  const readTruck = (gatePass: string) => {
    const db = engine.db
    const gp = db.gate_pass.find((g) => g.gate_pass === gatePass && g.process === 'P1')
    if (!gp) return null
    const ticket = db.weighbridge_ticket.find((t) => t.gate_pass === gp.gate_pass)
    if (!ticket) return null
    const booked = db.MSEG.filter((m) => m.xblnr === gp.gate_pass)
    const invoice = db.RBKP.find((r) => r.gate_pass === gp.gate_pass)
    const doc = invoice && db.output_document.find((d) => d.ref === invoice.belnr)
    const diff = booked.length ? Math.abs(ticket.net_kg - booked[0].menge) : null
    // complete once the supplier invoice has arrived and been processed
    const complete = !!invoice
    const mismatch = (diff !== null && diff > 20) || invoice?.status === 'Parked'
    return { gp, ticket, booked, invoice, doc, diff, complete, mismatch }
  }

  type TruckView = NonNullable<ReturnType<typeof readTruck>>

  /** Newest first, so the first match is always the most recent one. */
  const candidates = (): TruckView[] =>
    engine.db.gate_pass
      .filter((g) => g.process === 'P1')
      .map((g) => readTruck(g.gate_pass))
      .filter((t): t is TruckView => t !== null)
      .reverse()

  const pickTruck = (kind: 'complete' | 'clean' | 'problem' | 'newest'): TruckView | null => {
    const all = candidates()
    if (kind === 'newest') return all[0] ?? null
    if (kind === 'complete') return all.find((t) => t.complete) ?? null
    if (kind === 'clean') return all.find((t) => t.complete && !t.mismatch && t.booked.length === 1) ?? null
    return all.find((t) => t.complete && t.mismatch) ?? null
  }

  const [pinned, setPinned] = useState<string>(() => params.get('truck') ?? '')

  const pin = (gatePass: string, announce = true, note?: string) => {
    setPinned(gatePass)
    setParams(
      (p) => {
        const q = new URLSearchParams(p)
        q.set('truck', gatePass)
        return q
      },
      { replace: true },
    )
    if (announce) {
      toast({ title: `Pinned ${gatePass}`, description: note, tone: 'info' })
    }
  }

  // pick one on open, and only re-pick if the pinned one is gone
  useEffect(() => {
    if (pinned && readTruck(pinned)) return
    const next = pickTruck('complete') ?? pickTruck('newest')
    if (next) pin(next.gp.gate_pass, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned, version])

  const pinKind = (kind: 'clean' | 'problem' | 'newest', missing: string) => {
    const found = pickTruck(kind)
    if (!found) {
      toast({ title: missing, description: 'Let the plant run for a minute and try again.', tone: 'info' })
      return
    }
    pin(
      found.gp.gate_pass,
      true,
      kind === 'clean'
        ? 'Every check on this one matches.'
        : kind === 'problem'
          ? 'Steps 6 and 7 show the mismatch and what it raised.'
          : 'The latest truck through the gate.',
    )
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const truck = useMemo(() => (pinned ? readTruck(pinned) : null), [pinned, version])

  const truckLines = useMemo<Record<number, string>>(() => {
    const out: Record<number, string> = {}
    if (!truck) return out
    const { gp, ticket, booked, invoice, doc, diff } = truck
    const first = booked[0]
    return Object.assign(out, {
      1: `Arrived at site ${gp.site} on gate pass ${gp.gate_pass}, by ${gp.transport.toLowerCase()} — the gate-to-invoice path the map describes.`,
      2: 'Stage 1 of the 5 stages the key users approved: gate and weighbridge.',
      3: 'Covered by SC-001, SC-004 and SC-005 in the scenario library.',
      4: `It arrived against vendor ${gp.vendor} and purchase order ${gp.po || 'none'} — the linked records a test needs.`,
      5: `Weighed at ${fmtSim(ticket.weighed)}: gross ${num(ticket.gross_kg)} kg, tare ${num(ticket.tare_kg)} kg, net ${num(ticket.net_kg)} kg.`,
      6: !first
        ? 'Nothing has been booked in SAP for this truck yet.'
        : diff !== null && diff <= 20
          ? `Weighbridge ${num(ticket.net_kg)} kg, SAP booked ${num(first.menge)} ${first.meins} — match.`
          : `Weighbridge ${num(ticket.net_kg)} kg, SAP booked ${num(first.menge)} ${first.meins} — ${num(Math.round(diff ?? 0))} kg out.`,
      7:
        booked.length > 1
          ? 'The same ticket arrived twice, so this truck is booked twice. Live check C2 lists it.'
          : diff !== null && diff > 20
            ? 'This difference is what a finding is raised from, and what the re-test checks afterwards.'
            : 'Nothing to fix for this truck.',
      8: invoice
        ? invoice.status === 'Posted'
          ? `Invoice ${invoice.ext_invoice} posted for € ${num(Math.round(invoice.amount_eur))}${doc ? `, document copy ${doc.doc} archived` : ''}.`
          : `Invoice ${invoice.ext_invoice} parked: ${invoice.reason.toLowerCase()}. It cannot be signed off until that clears.`
        : 'The supplier invoice has not arrived yet; it usually follows 35 to 110 minutes later.',
    })
  }, [truck])

  return (
    <>
      <PageHeader
        title="Testing Journey"
        subtitle="From how your people work today to a release you can trust — in 8 steps."
        actions={
          <>
            {playing ? (
              <Button leftIcon={<Pause size={15} />} onClick={() => setPlaying(false)}>
                Pause
              </Button>
            ) : (
              <Button variant="primary" leftIcon={<Play size={15} />} onClick={play}>
                Play the journey
              </Button>
            )}
            <Button rightIcon={<ExternalLink size={14} />} onClick={() => navigate(step.opens.route)}>
              Open this step
            </Button>
          </>
        }
      />

      {/* ----------------------------------------------------- requirements */}
      <Card className="mb-4">
        <CardHeader
          title="Your requirements and where they are covered"
          subtitle="The ten requirements you set. Pick one to see the steps that cover it."
        />
        <CardBody className="space-y-2.5">
          {(['Core', 'Advanced'] as const).map((group) => (
            <div key={group} className="flex flex-wrap items-center gap-2">
              <span className="w-[70px] shrink-0 text-label font-semibold uppercase text-subtle">{group}</span>
              {JOURNEY_REQUIREMENTS.filter((r) => r.group === group).map((r) => (
                <Chip key={r.id} selected={highlight === r.id} title={r.full} onClick={() => pickRequirement(r.id)}>
                  <span className="font-mono">{r.id}</span>
                  <span>{r.short}</span>
                </Chip>
              ))}
            </div>
          ))}
          <p className="text-xs text-muted">
            <span className="font-medium text-success">
              {coveredRequirementCount()} of {JOURNEY_REQUIREMENTS.length} requirements covered
            </span>
            {highlight && (
              <>
                {' · '}
                {highlight} is covered by step{highlightedSteps.length > 1 ? 's' : ''}{' '}
                {highlightedSteps.join(', ')}
              </>
            )}
          </p>
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------- stepper */}
      <Card className="mb-4">
        <CardBody>
          <div className="j2w-scroll overflow-x-auto pb-1">
            <ol className="flex min-w-[860px] items-start">
              {JOURNEY_STEPS.map((s, i) => {
                const done = s.n < current
                const active = s.n === current
                const lit = highlightedSteps.includes(s.n)
                return (
                  <Fragment key={s.n}>
                    {i > 0 && (
                      <li aria-hidden className={cn('mt-[18px] h-0.5 flex-1', done || active ? 'bg-primary/50' : 'bg-line')} />
                    )}
                    <li>
                      <button
                        type="button"
                        onClick={() => go(s.n)}
                        aria-current={active ? 'step' : undefined}
                        className={cn(
                          'flex w-[98px] flex-col items-center gap-1.5 rounded-md px-1 py-1 text-center transition-colors hover:bg-surface2',
                          lit && 'bg-ai-soft ring-1 ring-ai/40',
                        )}
                      >
                        <span
                          className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-full border font-mono text-sm font-semibold transition-colors',
                            active
                              ? 'border-primary bg-primary text-primary-fg ring-2 ring-primary/30'
                              : done
                                ? 'border-success bg-success-soft text-success'
                                : 'border-line bg-surface2 text-subtle',
                          )}
                        >
                          {done ? <Check size={16} /> : s.n}
                        </span>
                        <span className={cn('text-[11px] leading-4', active ? 'font-medium text-text' : 'text-muted')}>
                          {s.name}
                        </span>
                      </button>
                    </li>
                  </Fragment>
                )
              })}
            </ol>
          </div>

          {(playing || log.length > 0) && (
            <div
              ref={logRef}
              className="j2w-scroll j2w-log mt-3 h-20 overflow-y-auto rounded-md border border-line bg-surface2 p-2.5 font-mono text-[11.5px] leading-5 text-muted"
            >
              {log.map((l, i) => (
                <div key={i} className={cn(i === log.length - 1 && 'text-text')}>
                  {l}
                </div>
              ))}
              {!playing && log.length > 0 && <div className="text-subtle">Finished on step {JOURNEY_TOTAL}.</div>}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ------------------------------------------------------- step panel */}
      <Card className="mb-4" tone="ai">
        <CardHeader
          title={`Step ${step.n} of ${JOURNEY_TOTAL} · ${step.name}`}
          subtitle={`Checked by ${step.checkedBy}`}
          actions={
            <span className="flex flex-wrap items-center gap-1.5">
              {step.requirements.map((r) => (
                <Badge key={r.id} tone={r.id.startsWith('ADV') ? 'ai' : 'primary'} mono>
                  {r.id}
                </Badge>
              ))}
            </span>
          }
        />
        <CardBody className="space-y-4">
          <dl className="divide-y divide-line">
            {[
              ['What goes in', step.goesIn],
              ['What the AI does', step.aiDoes],
              ['What comes out', step.comesOut],
              ['Who checks or approves', step.checkedBy],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
                <dt className="text-label font-semibold uppercase text-subtle">{label}</dt>
                <dd className="text-sm text-text">{value}</dd>
              </div>
            ))}

            <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
              <dt className="text-label font-semibold uppercase text-subtle">Today vs with the factory</dt>
              <dd className="grid gap-2 sm:grid-cols-2">
                <span className="rounded-md border border-line bg-surface2/60 px-3 py-2">
                  <span className="block text-label font-semibold uppercase text-subtle">Today</span>
                  <span className="text-xs text-muted">{step.today}</span>
                </span>
                <span className="rounded-md border border-success/40 bg-success-soft/40 px-3 py-2">
                  <span className="block text-label font-semibold uppercase text-success">With the factory</span>
                  <span className="text-xs text-text">{step.withFactory}</span>
                </span>
              </dd>
            </div>

            <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr] sm:gap-4">
              <dt className="text-label font-semibold uppercase text-subtle">Requirement covered</dt>
              <dd className="space-y-2">
                {step.requirements.map((r) => {
                  const req = requirementById(r.id)
                  return (
                    <div
                      key={r.id}
                      className={cn(
                        'rounded-md border px-3 py-2',
                        highlight === r.id ? 'border-ai/50 bg-ai-soft/60' : 'border-line bg-surface2/50',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={req.group === 'Advanced' ? 'ai' : 'primary'} mono>
                          {req.id}
                        </Badge>
                        <span className="text-sm font-medium text-text">{req.short}</span>
                        <span className="text-xs text-muted">{req.full}</span>
                        {r.opens && (
                          <Button
                            size="sm"
                            variant="link"
                            className="ml-auto"
                            rightIcon={<ExternalLink size={12} />}
                            onClick={() => navigate(r.opens!.route)}
                          >
                            Open {r.opens.label}
                          </Button>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">{r.how}</p>
                    </div>
                  )
                })}
              </dd>
            </div>
          </dl>

          {/* the picture: in → AI → out */}
          <div className="flex flex-col items-stretch gap-2 rounded-md border border-line bg-surface2/50 p-3 sm:flex-row sm:items-center">
            <div className="flex-1 rounded-md border border-line bg-surface px-3 py-2.5 text-center">
              <div className="text-label font-semibold uppercase text-subtle">In</div>
              <div className="mt-0.5 text-xs text-text">{step.inShort}</div>
            </div>
            <ArrowRight size={16} className="mx-auto shrink-0 rotate-90 text-subtle sm:rotate-0" />
            <div className="flex-1 rounded-md border border-ai/50 bg-ai-soft px-3 py-2.5 text-center">
              <div className="text-label font-semibold uppercase text-ai">AI</div>
              <div className="mt-0.5 text-xs text-text">{step.aiShort}</div>
            </div>
            <ArrowRight size={16} className="mx-auto shrink-0 rotate-90 text-subtle sm:rotate-0" />
            <div className="flex-1 rounded-md border border-line bg-surface px-3 py-2.5 text-center">
              <div className="text-label font-semibold uppercase text-subtle">Out</div>
              <div className="mt-0.5 text-xs text-text">{step.outShort}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button leftIcon={<ChevronLeft size={15} />} disabled={current === 1} onClick={() => go(current - 1)}>
              Back
            </Button>
            <Button
              variant="primary"
              rightIcon={<ChevronRight size={15} />}
              disabled={current === JOURNEY_TOTAL}
              onClick={() => go(current + 1)}
            >
              Next step
            </Button>
            <Button
              className="ml-auto"
              rightIcon={<ExternalLink size={14} />}
              onClick={() => navigate(step.opens.route)}
            >
              Open this step in the app · {step.opens.label}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* ------------------------------------------------------- one truck */}
      <SectionTitle
        title="Follow one truck through the journey"
        hint="The most recent steel truck in the running plant, step by step."
      />
      <Card>
        {truck ? (
          <>
            <CardHeader
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span>
                    {truck.gp.vehicle} · {truck.gp.gate_pass}
                  </span>
                  <Badge tone="neutral">Pinned</Badge>
                  {truck.complete ? (
                    <Badge tone={truck.mismatch ? 'danger' : 'success'}>
                      {truck.mismatch ? 'has a problem' : 'clean journey'}
                    </Badge>
                  ) : (
                    <Badge tone="warning">journey still running</Badge>
                  )}
                </span>
              }
              subtitle={`Arrived ${fmtSim(truck.gp.arrived)} at ${truck.gp.site}`}
              icon={<Truck size={16} className="text-primary" />}
              actions={
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <Button size="sm" onClick={() => pinKind('clean', 'No clean finished truck yet')}>
                    Show a clean truck
                  </Button>
                  <Button size="sm" onClick={() => pinKind('problem', 'No finished truck with a problem yet')}>
                    Show a truck with a problem
                  </Button>
                  <Button size="sm" onClick={() => pinKind('newest', 'No truck has been through the gate yet')}>
                    Newest truck
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => navigate(`/flow/trace?q=${encodeURIComponent(truck.gp.gate_pass)}`)}
                  >
                    Follow it in Trace
                  </Button>
                </span>
              }
            />
            <CardBody className="space-y-1.5">
              {!truck.complete && (
                <div className="mb-1 rounded-md border border-accent/40 bg-accent-soft/50 px-3 py-2 text-xs text-muted">
                  No truck has finished its journey yet, so this is the newest one. Step 8 fills in when its supplier
                  invoice arrives, usually 35 to 110 minutes later.
                </div>
              )}
              {JOURNEY_STEPS.map((s) => (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => go(s.n)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                    s.n === current ? 'border-primary/40 bg-primary-soft/60' : 'border-line hover:bg-surface2',
                  )}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface2 font-mono text-[10px] text-muted">
                    {s.n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-subtle">{s.name}</span>
                    <span className="block text-sm text-text">{truckLines[s.n]}</span>
                  </span>
                </button>
              ))}
              <div className="pt-1">
                <MonoId value={truck.gp.gate_pass} />
              </div>
            </CardBody>
            <SourceNote
              title="Where this truck's story comes from"
              reads={[
                { table: 'gate_pass', note: 'the arrival, the site and the vendor' },
                { table: 'weighbridge_ticket', note: 'gross, tare and net' },
                { table: 'MSEG', note: 'what SAP booked against it' },
                { table: 'RBKP', note: 'the supplier invoice' },
              ]}
              computes="takes the newest steel truck and reads what each system recorded for it"
              feeds={[{ label: 'Trace', route: '/flow/trace' }, { label: 'Live checks', route: '/flow/checks' }]}
              steps={[
                'The newest gate pass on the steel path is picked from the running plant.',
                'Each step of the journey reads the record that step would have produced.',
                'Where a system has not written its record yet, the line says so rather than inventing one.',
                'Step 6 is the same comparison live check C1 makes.',
              ]}
            />
          </>
        ) : (
          <EmptyState
            icon={<Truck size={28} />}
            title="No truck has been through the gate yet"
            description="The journey is easier to follow with a real load. Send one through and the eight lines below will fill in from the running plant."
            action={
              <Button variant="primary" leftIcon={<Truck size={15} />} onClick={() => engine.addTruck()}>
                Send a truck through the gate
              </Button>
            }
          />
        )}
      </Card>
    </>
  )
}
