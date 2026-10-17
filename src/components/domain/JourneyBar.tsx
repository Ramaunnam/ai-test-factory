import { Link } from 'react-router-dom'
import { JOURNEY_STEPS, JOURNEY_TOTAL, journeyStep } from '@/data/journey'

/**
 * One thin line at the top of a page that is part of the testing journey, so a
 * visitor always knows which of the eight steps they are looking at.
 */
export function JourneyBar({ step }: { step: number }) {
  const here = journeyStep(step)
  const prev = JOURNEY_STEPS.find((s) => s.n === step - 1)
  const next = JOURNEY_STEPS.find((s) => s.n === step + 1)

  /** If the neighbouring step opens this very page, go to the journey instead. */
  const target = (s: { n: number; opens: { route: string } }) =>
    s.opens.route === here.opens.route ? `/journey?step=${s.n}` : s.opens.route

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-line bg-surface2/60 px-3 py-1.5 text-xs no-print">
      <Link to={`/journey?step=${here.n}`} className="rounded-sm font-medium text-primary hover:underline">
        Testing Journey
      </Link>
      <span className="text-subtle">·</span>
      <span className="text-muted">
        Step {here.n} of {JOURNEY_TOTAL}
      </span>
      <span className="text-subtle">·</span>
      <span className="font-medium text-text">{here.name}</span>

      <span className="ml-auto flex flex-wrap items-center gap-x-3">
        {prev && (
          <Link to={target(prev)} className="rounded-sm text-muted transition-colors hover:text-primary">
            ← Back to step {prev.n}
          </Link>
        )}
        {next && (
          <Link to={target(next)} className="rounded-sm text-muted transition-colors hover:text-primary">
            Next: step {next.n} →
          </Link>
        )}
      </span>
    </div>
  )
}
