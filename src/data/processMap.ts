/* -------------------------------------------------------------------------- */
/* The process map the discovery agent draws, and what key users say about it */
/* -------------------------------------------------------------------------- */

export type FeedbackStatus = 'Open' | 'Applied' | 'Dismissed'
export type FeedbackVerdict = 'Correct' | 'Not right' | 'Comment'

export const FEEDBACK_REASONS = [
  'Wrong order',
  'Missing step',
  'Not a real step',
  'Wrong system',
  'Other',
] as const

export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]

export interface ProcessFeedback {
  id: string
  /** What the key user pressed on: a box, an arrow between two boxes, or a loop. */
  targetKind: 'Stage' | 'Arrow' | 'Loop'
  targetId: string
  target: string
  verdict: FeedbackVerdict
  reason?: FeedbackReason
  comment?: string
  by: string
  at: string
  status: FeedbackStatus
}

/** The live measure an arrow is counted with, so the map is never a stored picture. */
export type CountKey = 'tickets' | 'deviations' | 'receipts' | 'captures' | 'parked' | 'posted' | 'documents'

export interface MapStage {
  id: string
  name: string
  system: string
  /** What happens here, in one line. */
  note: string
  /** The ontology stage it belongs to, so a box can open the rule behind it. */
  stageId?: string
  /** True for a box the key users added in version 2. */
  added?: boolean
}

export interface MapArrow {
  id: string
  from: string
  to: string
  label: string
  count: CountKey
}

export interface MapLoop {
  id: string
  /** Where the work goes backwards from, and back to. */
  from: string
  to: string
  label: string
  count: CountKey
  /** Minutes of handling each time it happens. */
  minutesEach: number
}

export interface ProcessMapVersion {
  version: 1 | 2
  stages: MapStage[]
  arrows: MapArrow[]
  loops: MapLoop[]
  /** The boxes on the path a case takes when nothing goes wrong. */
  clean: string[]
}

export const MAP_V1: ProcessMapVersion = {
  version: 1,
  stages: [
    {
      id: 'M1',
      name: 'Gate and weighbridge',
      system: 'YardLink',
      note: 'Gate pass, gross weight, tare weight, release.',
      stageId: 'P1-S1',
    },
    {
      id: 'M2',
      name: 'Goods receipt',
      system: 'SAP S/4HANA Stainless',
      note: 'The weighbridge ticket becomes a delivery booking.',
      stageId: 'P1-S2',
    },
    {
      id: 'M3',
      name: 'Invoice capture',
      system: 'SAP S/4HANA Stainless',
      note: 'The supplier invoice is read and the lines typed in.',
      stageId: 'P1-S3',
    },
    {
      id: 'M5',
      name: 'Document output',
      system: 'Lasernet',
      note: 'The invoice copy is rendered and archived.',
      stageId: 'P1-S5',
    },
    {
      id: 'M4',
      name: 'Invoice posting',
      system: 'SAP S/4HANA Stainless',
      note: 'Order, delivery and invoice are matched, then posted.',
      stageId: 'P1-S4',
    },
  ],
  arrows: [
    { id: 'A1', from: 'M1', to: 'M2', label: 'weighbridge ticket', count: 'tickets' },
    { id: 'A2', from: 'M2', to: 'M3', label: 'delivery booked', count: 'receipts' },
    { id: 'A3', from: 'M3', to: 'M5', label: 'captured invoice', count: 'captures' },
    { id: 'A4', from: 'M5', to: 'M4', label: 'document rendered', count: 'documents' },
  ],
  loops: [
    {
      id: 'L1',
      from: 'M4',
      to: 'M1',
      label: 'invoice parked → ask the yard → re-weigh → re-post',
      count: 'parked',
      minutesEach: 28,
    },
  ],
  clean: ['M1', 'M2', 'M3', 'M5', 'M4'],
}

export const MAP_V2: ProcessMapVersion = {
  version: 2,
  stages: [
    {
      id: 'M1',
      name: 'Gate and weighbridge',
      system: 'YardLink',
      note: 'Gate pass, gross weight, tare weight, release.',
      stageId: 'P1-S1',
    },
    {
      id: 'M1b',
      name: 'Deviation check at the gate',
      system: 'YardLink',
      note: 'Anything more than 20 kg off the delivery note is queried before the vehicle leaves.',
      stageId: 'P1-S1',
      added: true,
    },
    {
      id: 'M2',
      name: 'Goods receipt',
      system: 'SAP S/4HANA Stainless',
      note: 'The weighbridge ticket becomes a delivery booking.',
      stageId: 'P1-S2',
    },
    {
      id: 'M3',
      name: 'Invoice capture',
      system: 'Esker',
      note: 'The supplier invoice is read and the lines typed in.',
      stageId: 'P1-S3',
    },
    {
      id: 'M4',
      name: 'Invoice posting',
      system: 'SAP S/4HANA Stainless',
      note: 'Order, delivery and invoice are matched, then posted.',
      stageId: 'P1-S4',
    },
    {
      id: 'M5',
      name: 'Document output',
      system: 'Lasernet',
      note: 'The invoice copy is rendered and archived after posting, not before.',
      stageId: 'P1-S5',
    },
  ],
  arrows: [
    { id: 'A0', from: 'M1', to: 'M1b', label: 'weight confirmed', count: 'tickets' },
    { id: 'A1', from: 'M1b', to: 'M2', label: 'weighbridge ticket', count: 'tickets' },
    { id: 'A2', from: 'M2', to: 'M3', label: 'delivery booked', count: 'receipts' },
    { id: 'A3', from: 'M3', to: 'M4', label: 'captured invoice', count: 'captures' },
    { id: 'A4', from: 'M4', to: 'M5', label: 'invoice booked', count: 'posted' },
  ],
  loops: [
    {
      id: 'L1',
      from: 'M4',
      to: 'M1',
      label: 'invoice parked → ask the yard → re-weigh → re-post',
      count: 'parked',
      minutesEach: 28,
    },
    {
      id: 'L2',
      from: 'M1b',
      to: 'M1',
      label: 'weight queried → vehicle weighed again',
      count: 'deviations',
      minutesEach: 15,
    },
  ],
  clean: ['M1', 'M1b', 'M2', 'M3', 'M4', 'M5'],
}

/** What the key users changed, shown side by side when the two versions are compared. */
export const MAP_CORRECTIONS = [
  {
    id: 'C1',
    reason: 'Missing step' as FeedbackReason,
    what: 'A step the agent never saw, because it happens on the phone',
    before: 'Gate and weighbridge → Goods receipt',
    after: 'Gate and weighbridge → Deviation check at the gate → Goods receipt',
  },
  {
    id: 'C2',
    reason: 'Wrong system' as FeedbackReason,
    what: 'Invoice capture was drawn on the wrong system',
    before: 'Invoice capture in SAP S/4HANA Stainless',
    after: 'Invoice capture in Esker',
  },
  {
    id: 'C3',
    reason: 'Wrong order' as FeedbackReason,
    what: 'The document is produced after the booking, not before it',
    before: 'Invoice capture → Document output → Invoice posting',
    after: 'Invoice capture → Invoice posting → Document output',
  },
]

export const APPLY_LOG = [
  'Reading the corrections the key users left on the map…',
  'Missing step: inserting “Deviation check at the gate” after the weighbridge…',
  'Wrong system: moving “Invoice capture” from SAP to Esker…',
  'Wrong order: putting “Document output” after “Invoice posting”…',
  'Re-counting every arrow against the live plant data…',
  'Adding a second rework loop for the queried weights…',
  'Map redrawn. Version 2 is the one the scenarios will be written from.',
]

export const DISCOVERY_LINES = [
  'Reading 6 recorded key-user sessions (123 steps in total)…',
  'Reading the plant log from YardLink, SAP, Esker and the laboratory…',
  'Reading 4 standard operating procedures…',
  'Grouping steps into activities by screen and action…',
  'Ordering activities by the timestamps in the log…',
  'Found the happy path: gate pass → weighbridge → goods receipt → capture → match → post…',
  'Found a rework loop: parked invoice → ask the yard → re-weigh → re-post…',
  'Mapped 5 stages, 3 systems and 1 rework loop. Open the process map to check it.',
]
