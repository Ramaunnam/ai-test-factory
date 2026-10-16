import { ChevronRight, CircleCheck, CircleDashed, CircleX, Loader2, Sparkles, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Process, StageHealth } from '@/data'

export type StageMark = 'pass' | 'fail' | 'running' | 'healed' | 'change' | 'downstream' | 'not in run'

const HEALTH_STYLE: Record<StageHealth, string> = {
  working: 'border-success/40 bg-success-soft/50',
  watch: 'border-accent/40 bg-accent-soft/50',
  issue: 'border-danger/45 bg-danger-soft/50',
  'not tested': 'border-line bg-surface2/60',
}

const HEALTH_LABEL: Record<StageHealth, string> = {
  working: 'Working',
  watch: 'Watch',
  issue: 'Issue',
  'not tested': 'Not tested',
}

const MARK_STYLE: Record<StageMark, string> = {
  pass: 'border-success/50 bg-success-soft/60',
  fail: 'border-danger/55 bg-danger-soft/60',
  running: 'border-info/55 bg-info-soft/60',
  healed: 'border-accent/55 bg-accent-soft/60',
  change: 'border-danger/60 bg-danger-soft/70',
  downstream: 'border-accent/50 bg-accent-soft/50',
  'not in run': 'border-line bg-surface2/60',
}

const MARK_LABEL: Record<StageMark, string> = {
  pass: 'Passed',
  fail: 'Failed',
  running: 'Running',
  healed: 'Healed',
  change: 'Change hits here',
  downstream: 'Feels it downstream',
  'not in run': 'Not in this run',
}

function MarkIcon({ mark }: { mark: StageMark }) {
  const common = 'shrink-0'
  switch (mark) {
    case 'pass':
      return <CircleCheck size={14} className={cn(common, 'text-success')} />
    case 'fail':
      return <CircleX size={14} className={cn(common, 'text-danger')} />
    case 'running':
      return <Loader2 size={14} className={cn(common, 'animate-spin text-info')} />
    case 'healed':
      return <Sparkles size={14} className={cn(common, 'text-accent')} />
    case 'change':
      return <Zap size={14} className={cn(common, 'text-danger')} />
    case 'downstream':
      return <Zap size={14} className={cn(common, 'text-accent')} />
    default:
      return <CircleDashed size={14} className={cn(common, 'text-subtle')} />
  }
}

export function WorkflowFlow({
  process,
  marks,
  onStageClick,
  selectedStageId,
  compact,
}: {
  process: Process
  marks?: Partial<Record<string, StageMark>>
  onStageClick?: (stageId: string) => void
  selectedStageId?: string
  compact?: boolean
}) {
  return (
    <div className="j2w-scroll flex min-w-0 items-stretch gap-1 overflow-x-auto pb-1">
      {process.stages.map((stage, i) => {
        const mark = marks?.[stage.id]
        const tone = mark ? MARK_STYLE[mark] : HEALTH_STYLE[stage.health]
        const label = mark ? MARK_LABEL[mark] : HEALTH_LABEL[stage.health]
        const selected = selectedStageId === stage.id
        return (
          <div key={stage.id} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onStageClick?.(stage.id)}
              disabled={!onStageClick}
              title={`${stage.name} — ${label}`}
              className={cn(
                'flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-[transform,box-shadow,border-color] duration-[120ms]',
                compact ? 'w-[150px]' : 'w-[178px]',
                tone,
                onStageClick && 'cursor-pointer hover:-translate-y-px hover:shadow-md',
                selected && 'ring-2 ring-focusring/60',
              )}
            >
              <span className="flex w-full items-center gap-1.5">
                {mark ? <MarkIcon mark={mark} /> : null}
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{stage.name}</span>
              </span>
              <span className="truncate text-[11px] text-muted">{label}</span>
              {!compact && (
                <span className="truncate text-[11px] text-subtle" title={stage.system}>
                  {stage.system}
                </span>
              )}
            </button>
            {i < process.stages.length - 1 && <ChevronRight size={14} className="shrink-0 text-subtle" />}
          </div>
        )
      })}
    </div>
  )
}

export function HealthLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
      {(['working', 'watch', 'issue', 'not tested'] as StageHealth[]).map((h) => (
        <span key={h} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-sm border', HEALTH_STYLE[h])} />
          {HEALTH_LABEL[h]}
        </span>
      ))}
    </div>
  )
}
