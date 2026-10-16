import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Radar, Sparkles } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  LiveLog,
  SectionTitle,
  StatTile,
} from '@/components/ui'
import { PageHeader } from '@/app/PageHeader'
import { DISCOVERY_SESSIONS, PROCESSES } from '@/data'
import { WorkflowFlow } from '@/components/domain/WorkflowFlow'
import { useThemeTokens } from '@/lib/useThemeTokens'
import { num } from '@/lib/format'
import { useToast } from '@/providers/ToastProvider'

const LINES = [
  'Reading 6 recorded key-user sessions (123 steps in total)…',
  'Reading 41 280 log lines from Yard Management, SAP and Esker…',
  'Grouping steps into activities by screen and action…',
  'Finding the happy path: gate pass → weighbridge → goods receipt → capture → match → post…',
  'Found a rework loop: parked invoice → ask the yard → re-weigh → re-post (14 % of cases)…',
  'Found a second loop: chemistry incomplete → re-sample (9 % of cases)…',
  'Mapped 5 stages, 3 systems and 2 rework loops. Ready to write scenarios.',
]

export function DiscoveryPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')

  return (
    <>
      <PageHeader
        title="Process Discovery"
        subtitle="Recorded key-user sessions plus system logs become a process map, including the rework loops nobody documents."
        actions={
          <Button
            variant="ai"
            leftIcon={<Radar size={15} />}
            loading={phase === 'running'}
            onClick={() => {
              setPhase('running')
              window.setTimeout(() => setPhase('done'), LINES.length * 420 + 200)
            }}
          >
            Discover the process
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Recorded sessions" value={num(DISCOVERY_SESSIONS.length)} />
        <StatTile label="Steps captured" value={num(DISCOVERY_SESSIONS.reduce((s, d) => s + d.steps, 0))} />
        <StatTile label="Log lines read" value="41 280" />
        <StatTile label="Rework loops found" value={phase === 'done' ? '2' : '—'} tone={phase === 'done' ? 'warning' : 'neutral'} />
      </div>

      <Card className="mb-4">
        <CardHeader title="What was recorded" subtitle="Key users worked normally. Nothing was scripted." />
        <DataTable
          rows={DISCOVERY_SESSIONS}
          rowKey={(d) => d.id}
          columns={[
            { key: 'id', header: 'Session', mono: true, width: 100 },
            { key: 'name', header: 'What they did' },
            { key: 'role', header: 'Role', width: 160 },
            { key: 'system', header: 'System', width: 200 },
            { key: 'steps', header: 'Steps', align: 'right', mono: true, width: 80 },
            { key: 'minutes', header: 'Minutes', align: 'right', mono: true, width: 90 },
            { key: 'recorded', header: 'Recorded', width: 130 },
          ]}
        />
      </Card>

      {phase !== 'idle' && (
        <Card className="mb-4" tone="ai">
          <CardHeader title="Discovery agent" subtitle="Turning clicks and log lines into a process." />
          <CardBody>
            <LiveLog lines={LINES} running={phase === 'running'} height={180} />
          </CardBody>
        </Card>
      )}

      {phase === 'done' && (
        <>
          <SectionTitle
            title="The process it found"
            hint="This is P1 Gate to Invoice as the plant actually runs it, not as the manual describes it."
            actions={
              <Button
                variant="primary"
                leftIcon={<Sparkles size={15} />}
                onClick={() => {
                  toast({ title: 'Opening Test Studio with this process selected', tone: 'info' })
                  navigate('/studio')
                }}
              >
                Generate scenarios
              </Button>
            }
          />
          <Card className="mb-4">
            <CardBody className="space-y-4 pt-5">
              <WorkflowFlow process={PROCESSES[0]} onStageClick={(id) => navigate(`/ontology?process=P1&stage=${id}`)} />
              <ReworkDiagram />
            </CardBody>
          </Card>
        </>
      )}
    </>
  )
}

function ReworkDiagram() {
  const t = useThemeTokens()
  const loops = [
    { from: 'Invoice posting', to: 'Gate and weighbridge', label: 'parked invoice → re-weigh', pct: 14, y: 70 },
    { from: 'Chemistry check', to: 'Sortation', label: 'chemistry incomplete → re-sample', pct: 9, y: 150 },
  ]
  return (
    <div>
      <div className="mb-2 text-label font-semibold uppercase text-subtle">Rework loops</div>
      <svg viewBox="0 0 900 210" width="100%" height={210} className="min-w-[640px]">
        {loops.map((l, i) => (
          <g key={l.label}>
            <path
              d={`M 760 ${l.y} C 600 ${l.y + 60}, 260 ${l.y + 60}, 120 ${l.y}`}
              fill="none"
              stroke={i === 0 ? t.danger : t.accent}
              strokeWidth={1.8}
              strokeDasharray="6 5"
              markerEnd=""
            />
            <rect x={340} y={l.y + 24} width={250} height={28} rx={14} fill={t.surface} stroke={t.line} />
            <text x={356} y={l.y + 42} fontSize={11} fill={t.muted}>
              {l.label}
            </text>
            <text x={600} y={l.y + 42} fontSize={11} fontFamily="JetBrains Mono, monospace" fill={i === 0 ? t.danger : t.accent}>
              {l.pct} % of cases
            </text>
            <rect x={60} y={l.y - 16} width={130} height={32} rx={8} fill={t['surface-2']} stroke={t.line} />
            <text x={74} y={l.y + 4} fontSize={11} fill={t.text}>
              {l.to.length > 16 ? `${l.to.slice(0, 15)}…` : l.to}
            </text>
            <rect x={700} y={l.y - 16} width={140} height={32} rx={8} fill={t['surface-2']} stroke={t.line} />
            <text x={714} y={l.y + 4} fontSize={11} fill={t.text}>
              {l.from}
            </text>
          </g>
        ))}
        <g>
          <RotateCcwIcon x={436} y={14} colour={t.subtle} />
          <text x={462} y={26} fontSize={11} fill={t.subtle}>
            Loops cost roughly 3.5 hours per working day across both plants.
          </text>
        </g>
      </svg>
    </div>
  )
}

function RotateCcwIcon({ x, y, colour }: { x: number; y: number; colour: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(0.7)`} stroke={colour} fill="none" strokeWidth={2}>
      <path d="M3 2v6h6" />
      <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
    </g>
  )
}

