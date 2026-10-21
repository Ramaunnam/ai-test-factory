import type { StepScreen } from '@/components/domain/StepScreenshot'
import type { Scenario } from '@/data'

export type RecordingStatus = 'Raw' | 'Converted' | 'Approved'

export interface Recording {
  id: string
  name: string
  role: string
  workflow: string
  system: string
  date: string
  steps: number
  status: RecordingStatus
  /** The scenario the AI wrote from it. */
  scenarioId?: string
}

export interface RecordedAction {
  n: number
  /** Time from the start of the recording. */
  at: string
  action: string
  /** Waits and mis-clicks are what the AI strips out. */
  kind: 'action' | 'wait' | 'misclick'
  screen: StepScreen
}

export const SEED_RECORDINGS: Recording[] = [
  {
    id: 'RC-101',
    name: 'Gate pass to release',
    role: 'Gate operator',
    workflow: 'P1 Gate to Invoice (steel)',
    system: 'YardLink',
    date: '09 Oct 2026',
    steps: 24,
    status: 'Approved',
    scenarioId: 'SC-001',
  },
  {
    id: 'RC-102',
    name: 'Invoice capture and send',
    role: 'Accounts payable',
    workflow: 'P1 Gate to Invoice (steel)',
    system: 'Esker',
    date: '09 Oct 2026',
    steps: 18,
    status: 'Converted',
    scenarioId: 'SC-002',
  },
  {
    id: 'RC-103',
    name: 'Sortation and batch labelling',
    role: 'Yard operator',
    workflow: 'P2 Scrap to Stock (recycling)',
    system: 'dOps Core',
    date: '10 Oct 2026',
    steps: 22,
    status: 'Raw',
  },
]

/** The sample recording the mock recorder plays back, action by action. */
export const RECORDED_ACTIONS: RecordedAction[] = [
  {
    n: 1,
    at: '00:00',
    kind: 'action',
    action: 'Open YardLink',
    screen: {
      system: 'YardLink',
      title: 'Home',
      fields: [
        { label: 'Signed in as', value: 'Gate operator' },
        { label: 'Site', value: 'PL01' },
      ],
    },
  },
  {
    n: 2,
    at: '00:04',
    kind: 'action',
    action: 'Search the expected deliveries for today',
    screen: {
      system: 'YardLink',
      title: 'Expected deliveries',
      fields: [
        { label: 'Date', value: '14 Oct 2026' },
        { label: 'Rows', value: '18' },
      ],
    },
  },
  {
    n: 3,
    at: '00:11',
    kind: 'wait',
    action: 'Waited six seconds for the list to load',
    screen: {
      system: 'YardLink',
      title: 'Expected deliveries',
      fields: [{ label: 'Status', value: 'loading…' }],
      banner: { tone: 'warning', text: 'Waiting for the screen' },
    },
  },
  {
    n: 4,
    at: '00:18',
    kind: 'misclick',
    action: 'Opened transport VH-7612 by mistake',
    screen: {
      system: 'YardLink',
      title: 'Transport VH-7612',
      fields: [
        { label: 'Vehicle', value: 'VH-7612', wrong: true },
        { label: 'Vendor', value: 'VEND-1044' },
      ],
      banner: { tone: 'warning', text: 'Wrong transport — the operator went back' },
    },
  },
  {
    n: 5,
    at: '00:23',
    kind: 'misclick',
    action: 'Went back to the list',
    screen: {
      system: 'YardLink',
      title: 'Expected deliveries',
      fields: [{ label: 'Rows', value: '18' }],
    },
  },
  {
    n: 6,
    at: '00:27',
    kind: 'action',
    action: 'Select transport VH-7741',
    screen: {
      system: 'YardLink',
      title: 'Transport VH-7741',
      fields: [
        { label: 'Vehicle', value: 'VH-7741', highlight: true },
        { label: 'Vendor', value: 'VEND-1042' },
        { label: 'Purchase order', value: '4500012044' },
      ],
    },
  },
  {
    n: 7,
    at: '00:33',
    kind: 'action',
    action: 'Create a gate pass',
    screen: {
      system: 'YardLink',
      title: 'Gate pass · new',
      fields: [
        { label: 'Gate pass', value: 'GP-PL01-2026-4182', highlight: true },
        { label: 'Site', value: 'PL01' },
      ],
      action: 'Create',
    },
  },
  {
    n: 8,
    at: '00:41',
    kind: 'action',
    action: 'Type the vendor VEND-1042',
    screen: {
      system: 'YardLink',
      title: 'Gate pass · new',
      fields: [{ label: 'Vendor', value: 'VEND-1042', highlight: true }],
    },
  },
  {
    n: 9,
    at: '00:48',
    kind: 'action',
    action: 'Type the purchase order 4500012044',
    screen: {
      system: 'YardLink',
      title: 'Gate pass · new',
      fields: [{ label: 'Purchase order', value: '4500012044', highlight: true }],
      action: 'Save',
    },
  },
  {
    n: 10,
    at: '00:56',
    kind: 'wait',
    action: 'Waited four seconds, reading the screen',
    screen: {
      system: 'YardLink',
      title: 'Gate pass · GP-PL01-2026-4182',
      fields: [{ label: 'Status', value: 'saved' }],
      banner: { tone: 'warning', text: 'No action — the operator was reading' },
    },
  },
  {
    n: 11,
    at: '01:02',
    kind: 'action',
    action: 'Send the vehicle to the weighbridge',
    screen: {
      system: 'YardLink',
      title: 'Weighbridge · GP-PL01-2026-4182',
      fields: [{ label: 'Status', value: 'waiting for the weighing' }],
      action: 'Send',
    },
  },
  {
    n: 12,
    at: '01:10',
    kind: 'action',
    action: 'Confirm the gross weight 38 420 kg',
    screen: {
      system: 'YardLink',
      title: 'Weighbridge',
      fields: [{ label: 'Gross weight', value: '38 420 kg', highlight: true }],
      action: 'Confirm',
    },
  },
  {
    n: 13,
    at: '01:19',
    kind: 'action',
    action: 'Confirm the tare weight 13 560 kg',
    screen: {
      system: 'YardLink',
      title: 'Weighbridge',
      fields: [
        { label: 'Tare weight', value: '13 560 kg', highlight: true },
        { label: 'Net weight', value: '24 860 kg' },
      ],
      action: 'Confirm',
    },
  },
  {
    n: 14,
    at: '01:27',
    kind: 'action',
    action: 'Release the vehicle',
    screen: {
      system: 'YardLink',
      title: 'Gate pass · GP-PL01-2026-4182',
      fields: [
        { label: 'Status', value: 'released', highlight: true },
        { label: 'Net weight', value: '24 860 kg' },
      ],
      action: 'Release',
    },
  },
]

export const CONVERSION_LOG = [
  'Reading 14 recorded actions…',
  'Removing 2 pauses where the key user waited for a screen…',
  'Removing 2 clicks that went to the wrong transport and came back…',
  'Replacing typed values with test data: VEND-1042 → {vendor}, 4500012044 → {purchaseOrder}…',
  'Adding a check after the weighing: net weight = gross − tare…',
  'Adding a check that SAP booked exactly one goods receipt…',
  '8 steps written. The scenario is waiting for your approval.',
]

/** The scenario the AI writes from the sample recording. */
export const RECORDED_SCENARIO: Scenario = {
  id: 'SC-040',
  name: 'Recorded: gate pass to release, then booked in SAP',
  process: 'P1',
  stageId: 'P1-S1',
  type: 'Positive',
  requirement: 'R1',
  systems: ['YardLink', 'SAP S/4HANA Stainless'],
  lastResult: 'Not run',
  steps: [
    { n: 1, text: 'Open YardLink as a gate operator', technical: "page.goto('/yard')", system: 'YardLink' },
    { n: 2, text: 'Select the expected transport', technical: "click('[data-test=transport-{vehicle}]')", system: 'YardLink' },
    { n: 3, text: 'Create a gate pass for {vendor} and {purchaseOrder}', technical: "fill('#vendor', vendor); fill('#po', purchaseOrder)", system: 'YardLink' },
    { n: 4, text: 'Send the vehicle to the weighbridge', technical: "click('[data-test=send-weighbridge]')", system: 'YardLink' },
    { n: 5, text: 'Confirm the gross and tare weights', technical: "fill('#gross', gross); fill('#tare', tare)", system: 'YardLink' },
    { n: 6, text: 'Check that the net weight equals gross minus tare', technical: 'expect(net).toBe(gross - tare)', system: 'YardLink' },
    { n: 7, text: 'Release the vehicle', technical: "click('[data-test=release]')", system: 'YardLink' },
    { n: 8, text: 'Check that SAP booked exactly one goods receipt', technical: "odata.get('/MSEG?$filter=xblnr eq {gatePass}')", system: 'SAP S/4HANA Stainless' },
  ],
}
