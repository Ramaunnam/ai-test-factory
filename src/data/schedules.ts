import { ALL_PROJECTS } from './projects'

export const SCHEDULE_WHEN = [
  'Nightly at 02:00',
  'After every SAP transport',
  'After every D365 F&O OneCore update',
  'Before the month-end close',
  'Weekly on Sunday',
] as const

export type ScheduleWhen = (typeof SCHEDULE_WHEN)[number]

export type ScheduleResult = 'PASS' | 'CONDITIONAL' | 'FAIL' | 'Not run yet'

export interface Schedule {
  id: string
  name: string
  /** What it runs, in one line. */
  what: string
  when: ScheduleWhen
  /** A project id, or ALL_PROJECTS for a run that covers everything. */
  project: string
  scenarios: number
  lastResult: ScheduleResult
  lastRun: string
  lastRunId?: string
  nextRun: string
  /** Minutes from now, so the next three runs can be put in order. */
  nextInMinutes: number
  on: boolean
  recipients: string[]
}

export const SEED_SCHEDULES: Schedule[] = [
  {
    id: 'SCH-01',
    name: 'Nightly regression',
    what: 'Every approved scenario in every workflow',
    when: 'Nightly at 02:00',
    project: ALL_PROJECTS,
    scenarios: 30,
    lastResult: 'CONDITIONAL',
    lastRun: '17 Oct 2026 02:00',
    lastRunId: 'RUN-1042',
    nextRun: '18 Oct 2026 02:00',
    nextInMinutes: 14 * 60,
    on: true,
    recipients: ['Key User', 'QA Lead'],
  },
  {
    id: 'SCH-02',
    name: 'SAP transport check',
    what: 'Gate to invoice, plus the finance links',
    when: 'After every SAP transport',
    project: 'sap-nov',
    scenarios: 12,
    lastResult: 'PASS',
    lastRun: '16 Oct 2026 16:20',
    lastRunId: 'RUN-1040',
    nextRun: 'On the next transport',
    nextInMinutes: 3 * 60,
    on: true,
    recipients: ['QA Lead'],
  },
  {
    id: 'SCH-03',
    name: 'Recycling smoke test',
    what: 'Scrap to stock, quality orders and yard transfers',
    when: 'After every D365 F&O OneCore update',
    project: 'd365-recycling',
    scenarios: 8,
    lastResult: 'FAIL',
    lastRun: '16 Oct 2026 11:05',
    lastRunId: 'RUN-1038',
    nextRun: 'On the next D365 F&O OneCore update',
    nextInMinutes: 6 * 60,
    on: true,
    recipients: ['Key User', 'QA Lead'],
  },
  {
    id: 'SCH-04',
    name: 'Month-end readiness',
    what: 'The close checklist and the month-end load profile',
    when: 'Before the month-end close',
    project: ALL_PROJECTS,
    scenarios: 18,
    lastResult: 'CONDITIONAL',
    lastRun: '30 Sep 2026 18:00',
    lastRunId: 'RUN-1037',
    nextRun: '29 Oct 2026 18:00',
    nextInMinutes: 12 * 24 * 60,
    on: true,
    recipients: ['Plant Head', 'QA Lead'],
  },
  {
    id: 'SCH-05',
    name: 'Yard app weekly',
    what: 'Gate, weighbridge and Pegase confirmation',
    when: 'Weekly on Sunday',
    project: 'yard-app',
    scenarios: 6,
    lastResult: 'Not run yet',
    lastRun: '—',
    nextRun: '18 Oct 2026 06:00',
    nextInMinutes: 18 * 60,
    on: false,
    recipients: ['Plant Head'],
  },
]
