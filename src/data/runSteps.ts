import type { StepOutcome, StepScreen } from '@/components/domain/StepScreenshot'

export interface RunLogLine {
  /** Time from the start of the run. */
  at: string
  action: string
  result: string
}

export interface RunStep {
  scenario: string
  stageId: string
  text: string
  system: string
  outcome: StepOutcome
  detail?: string
  technical: string
  /** The drawn mock of the screen this step touched. */
  screen: StepScreen
  logs: RunLogLine[]
}

/** The scripted P1 demo run. Every step carries its screen and its log. */
export const RUN_STEPS: RunStep[] = [
  {
    scenario: 'SC-001',
    stageId: 'P1-S1',
    text: 'Create a gate pass for VH-7741 at PL01',
    system: 'YardLink',
    outcome: 'pass',
    technical: "page.goto('/yard/gate-pass/new')",
    screen: {
      system: 'YardLink',
      title: 'Gate pass · new',
      fields: [
        { label: 'Gate pass', value: 'GP-PL01-2026-4182', highlight: true },
        { label: 'Site', value: 'PL01' },
        { label: 'Vehicle', value: 'VH-7741' },
        { label: 'Vendor', value: 'VEND-1042' },
        { label: 'Purchase order', value: '4500012044' },
      ],
      action: 'Save',
    },
    logs: [
      { at: '00:00.0', action: 'Open YardLink, gate pass screen', result: 'screen ready' },
      { at: '00:01.2', action: 'Enter vehicle VH-7741 and vendor VEND-1042', result: 'fields accepted' },
      { at: '00:02.4', action: 'Save the gate pass', result: 'GP-PL01-2026-4182 created' },
    ],
  },
  {
    scenario: 'SC-001',
    stageId: 'P1-S1',
    text: 'Weigh gross 38 420 kg and tare 13 560 kg',
    system: 'YardLink',
    outcome: 'pass',
    technical: "fill('#gross','38420'); fill('#tare','13560')",
    screen: {
      system: 'YardLink',
      title: 'Weighbridge · GP-PL01-2026-4182',
      fields: [
        { label: 'Gross weight', value: '38 420 kg', highlight: true },
        { label: 'Tare weight', value: '13 560 kg', highlight: true },
        { label: 'Net weight', value: '24 860 kg' },
        { label: 'Weighed at', value: '14 Oct 09:41' },
      ],
      action: 'Confirm',
    },
    logs: [
      { at: '00:03.1', action: 'Read gross from the scale', result: '38 420 kg' },
      { at: '00:04.0', action: 'Read tare after tipping', result: '13 560 kg' },
      { at: '00:04.6', action: 'Confirm the weighing', result: 'net 24 860 kg stored' },
    ],
  },
  {
    scenario: 'SC-001',
    stageId: 'P1-S1',
    text: 'Read the net weight from the ticket',
    system: 'YardLink',
    outcome: 'healed',
    detail:
      'The field was renamed. Self-healing mapped netWeightKg to net_weight_kg with 96 % confidence and the step continued.',
    technical: 'expect(payload.net_weight_kg ?? payload.netWeightKg).toBe(24860)',
    screen: {
      system: 'YardLink',
      title: 'Weighbridge ticket · WB-00412',
      fields: [
        { label: 'Ticket', value: 'WB-00412' },
        { label: 'net_weight_kg', value: '24 860 kg', highlight: true },
        { label: 'Vehicle', value: 'VH-7741' },
      ],
      renamed: { from: 'netWeightKg', to: 'net_weight_kg' },
    },
    logs: [
      { at: '00:05.2', action: 'Read field netWeightKg', result: 'not found on the screen' },
      { at: '00:05.4', action: 'Self-healing looks for a close match', result: 'net_weight_kg, 96 % confidence' },
      { at: '00:05.9', action: 'Re-read with the new field name', result: '24 860 kg, step continued' },
    ],
  },
  {
    scenario: 'SC-001',
    stageId: 'P1-S2',
    text: 'Send the ticket on IF-01 and wait for SAP',
    system: 'SAP S/4HANA Stainless',
    outcome: 'pass',
    technical: 'queue.publish("IF-01", payload)',
    screen: {
      system: 'SAP S/4HANA Stainless',
      title: 'Goods receipt · 5000001234',
      fields: [
        { label: 'Material document', value: '5000001234' },
        { label: 'Reference', value: 'GP-PL01-2026-4182' },
        { label: 'Quantity', value: '24 860 KG', highlight: true },
        { label: 'Purchase order', value: '4500012044' },
        { label: 'Posted', value: '14 Oct 09:45' },
      ],
    },
    logs: [
      { at: '00:06.3', action: 'Publish the ticket on IF-01', result: 'accepted by the gateway' },
      { at: '00:09.8', action: 'Wait for SAP to post', result: 'document 5000001234 posted' },
      { at: '00:10.1', action: 'Read the posted quantity', result: '24 860 KG' },
    ],
  },
  {
    scenario: 'SC-001',
    stageId: 'P1-S2',
    text: 'Check that exactly one goods receipt exists',
    system: 'SAP S/4HANA Stainless',
    outcome: 'pass',
    technical: "odata.get('/MSEG?$filter=xblnr eq {gatePass}')",
    screen: {
      system: 'SAP S/4HANA Stainless',
      title: 'Material documents for GP-PL01-2026-4182',
      fields: [
        { label: 'Documents found', value: '1', highlight: true },
        { label: 'Document', value: '5000001234' },
        { label: 'Quantity', value: '24 860 KG' },
      ],
    },
    logs: [
      { at: '00:10.6', action: 'Query material documents by reference', result: '1 row' },
      { at: '00:10.8', action: 'Check the count is exactly one', result: 'pass' },
    ],
  },
  {
    scenario: 'SC-004',
    stageId: 'P1-S2',
    text: 'Compare the last 50 weighbridge tickets against SAP',
    system: 'SAP S/4HANA Stainless',
    outcome: 'fail',
    detail:
      'Three trucks were booked with the wrong weight. Two are a kilogram / tonne mix-up and one used a stale tare. Raised as finding F-001.',
    technical: 'expect(abs(net_kg - menge)).toBeLessThan(20)',
    screen: {
      system: 'SAP S/4HANA Stainless',
      title: 'Weight comparison · last 50 tickets',
      fields: [
        { label: 'Tickets compared', value: '50' },
        { label: 'Matching', value: '47' },
        { label: 'Not matching', value: '3', wrong: true },
      ],
      expected: 'net weight equals the booked quantity, within 20 kg',
      actual: '3 trucks differ, one booked as 21.92 KG for 21 920 kg',
    },
    logs: [
      { at: '00:11.4', action: 'Read the last 50 weighbridge tickets', result: '50 rows' },
      { at: '00:12.0', action: 'Read the matching goods receipts', result: '50 rows' },
      { at: '00:12.7', action: 'Compare net weight against quantity', result: 'FAIL · 3 of 50 differ' },
      { at: '00:12.9', action: 'Raise a finding', result: 'F-001 created, severity critical' },
    ],
  },
  {
    scenario: 'SC-003',
    stageId: 'P1-S3',
    text: 'Capture an invoice with no purchase order',
    system: 'Esker',
    outcome: 'blocked',
    detail:
      'Blocked as expected. The three-way match parked the invoice with the reason “No purchase order reference”.',
    technical: 'payload.purchaseOrder = null',
    screen: {
      system: 'Esker',
      title: 'Invoice capture · INV-884120',
      fields: [
        { label: 'External invoice', value: 'INV-884120' },
        { label: 'Purchase order', value: '—', wrong: true },
        { label: 'Quantity', value: '24 860 kg' },
        { label: 'Amount', value: '€ 51 420' },
      ],
      banner: { tone: 'danger', text: 'No purchase order reference — invoice parked for review' },
      action: 'Send to ERP',
    },
    logs: [
      { at: '00:13.5', action: 'Capture the invoice with the purchase order left empty', result: 'captured' },
      { at: '00:14.2', action: 'Send it to SAP on IF-06', result: 'delivered' },
      { at: '00:15.0', action: 'Expect the three-way match to refuse it', result: 'parked · blocked as expected' },
    ],
  },
  {
    scenario: 'SC-002',
    stageId: 'P1-S4',
    text: 'Post a clean supplier invoice through the three-way match',
    system: 'SAP S/4HANA Stainless',
    outcome: 'pass',
    technical: 'sap.run("MIRO")',
    screen: {
      system: 'SAP S/4HANA Stainless',
      title: 'Invoice posting · MIRO',
      fields: [
        { label: 'Invoice', value: '5100004412' },
        { label: 'Purchase order', value: '4500012044' },
        { label: 'Quantity', value: '24 860 kg' },
        { label: 'Amount', value: '€ 51 420' },
        { label: 'Status', value: 'Posted', highlight: true },
      ],
      action: 'Post',
    },
    logs: [
      { at: '00:15.8', action: 'Match purchase order, goods receipt and invoice', result: 'all three agree' },
      { at: '00:16.4', action: 'Post the invoice', result: '5100004412 posted' },
    ],
  },
  {
    scenario: 'SC-007',
    stageId: 'P1-S5',
    text: 'Check that Lasernet produced the invoice copy',
    system: 'Lasernet',
    outcome: 'pass',
    technical: 'await lasernet.poll(belnr)',
    screen: {
      system: 'Lasernet',
      title: 'Output documents',
      fields: [
        { label: 'Document', value: 'LN-00231' },
        { label: 'Type', value: 'Invoice copy' },
        { label: 'Reference', value: '5100004412', highlight: true },
        { label: 'Created', value: '14 Oct 09:52' },
      ],
    },
    logs: [
      { at: '00:17.1', action: 'Poll Lasernet for the invoice copy', result: 'LN-00231 found' },
      { at: '00:17.4', action: 'Check the reference matches the invoice', result: 'pass' },
    ],
  },
  {
    scenario: 'SC-008',
    stageId: 'P1-S5',
    text: 'Check that only posted invoices reached Reval',
    system: 'Reval',
    outcome: 'pass',
    technical: 'expect(reval.payments).toContainOnly(posted)',
    screen: {
      system: 'Reval',
      title: 'Payment file · hourly run',
      fields: [
        { label: 'Invoices in the file', value: '1' },
        { label: 'Parked invoices included', value: '0', highlight: true },
        { label: 'Amount', value: '€ 51 420' },
      ],
    },
    logs: [
      { at: '00:18.0', action: 'Read the payment file sent on IF-11', result: '1 invoice' },
      { at: '00:18.3', action: 'Check no parked invoice is in it', result: 'pass' },
    ],
  },
]

export const RUN_STEP_COUNT = RUN_STEPS.length
export const RUN_LOG_COUNT = RUN_STEPS.reduce((n, s) => n + s.logs.length, 0)
