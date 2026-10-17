export * from './systems'

/* -------------------------------------------------------------------------- */
/* Processes                                                                  */
/* -------------------------------------------------------------------------- */

export type StageHealth = 'working' | 'watch' | 'issue' | 'not tested'

export interface Stage {
  id: string
  name: string
  who: string
  sop: string[]
  system: string
  data: string
  rule: string
  agents: string[]
  tests: number
  health: StageHealth
  interfaceId?: string
}

export interface Process {
  id: 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6'
  name: string
  summary: string
  owner: string
  stages: Stage[]
}

export const PROCESSES: Process[] = [
  {
    id: 'P1',
    name: 'Gate to Invoice (steel)',
    summary: 'A supplier truck is weighed, booked, invoiced and paid.',
    owner: 'Key User',
    stages: [
      {
        id: 'P1-S1',
        name: 'Gate and weighbridge',
        who: 'Gate operator',
        sop: ['Check the transport against the gate pass', 'Weigh gross and tare', 'Release the vehicle'],
        system: 'Yard Management',
        data: 'gate_pass, weighbridge_ticket',
        rule: 'Net weight equals gross minus tare',
        agents: ['Discovery', 'Execution'],
        tests: 6,
        health: 'working',
        interfaceId: 'IF-01',
      },
      {
        id: 'P1-S2',
        name: 'Goods receipt',
        who: 'Interface, no human',
        sop: ['Receive the ticket', 'Match the purchase order', 'Post the goods receipt'],
        system: 'SAP S/4HANA – Steel',
        data: 'MSEG',
        rule: 'One goods receipt per truck with the measured quantity in KG',
        agents: ['Interface Watch', 'Execution'],
        tests: 8,
        health: 'issue',
        interfaceId: 'IF-01',
      },
      {
        id: 'P1-S3',
        name: 'Invoice capture',
        who: 'Accounts payable',
        sop: ['Receive the supplier invoice', 'Capture header and lines', 'Send to the ERP'],
        system: 'Esker',
        data: 'captured_invoice',
        rule: 'Every capture carries a purchase order reference',
        agents: ['Scenario Writer', 'Execution'],
        tests: 5,
        health: 'watch',
        interfaceId: 'IF-06',
      },
      {
        id: 'P1-S4',
        name: 'Invoice posting',
        who: 'Accounts payable',
        sop: ['Run the three-way match', 'Resolve parked invoices', 'Post'],
        system: 'SAP S/4HANA – Steel',
        data: 'RBKP',
        rule: 'Purchase order, goods receipt and invoice agree within 1 %',
        agents: ['Execution', 'Change Impact'],
        tests: 7,
        health: 'issue',
        interfaceId: 'IF-06',
      },
      {
        id: 'P1-S5',
        name: 'Document output',
        who: 'Interface, no human',
        sop: ['Render the invoice copy', 'Archive it', 'Send the payment file'],
        system: 'Lasernet',
        data: 'output_document',
        rule: 'Every posted invoice has a document copy',
        agents: ['Evidence'],
        tests: 4,
        health: 'working',
        interfaceId: 'IF-09',
      },
    ],
  },
  {
    id: 'P2',
    name: 'Scrap to Stock (recycling)',
    summary: 'A recycling load is received, sorted, analysed and booked to stock.',
    owner: 'Key User',
    stages: [
      {
        id: 'P2-S1',
        name: 'Gate receipt',
        who: 'Yard operator',
        sop: ['Weigh the transport', 'Create the receipt', 'Send it to the scrap yard'],
        system: 'Yard Management',
        data: 'gate_pass, weighbridge_ticket',
        rule: 'Every weighed load reaches Scrap Yard Operations',
        agents: ['Interface Watch'],
        tests: 5,
        health: 'issue',
        interfaceId: 'IF-02',
      },
      {
        id: 'P2-S2',
        name: 'Sortation',
        who: 'Yard operator',
        sop: ['Sort into grades', 'Weigh each batch', 'Label the batch'],
        system: 'Scrap Yard Operations',
        data: 'scrap_batch',
        rule: 'Batch weights add up to the receipt',
        agents: ['Test Data', 'Execution'],
        tests: 4,
        health: 'working',
      },
      {
        id: 'P2-S3',
        name: 'Chemistry check',
        who: 'Laboratory technician',
        sop: ['Take the sample', 'Run the spectrometer', 'Release the result'],
        system: 'Laboratory app',
        data: 'chemistry, lab_result',
        rule: 'Ni, Cr and Mo are present for every batch',
        agents: ['Interface Watch', 'Self-Healing'],
        tests: 6,
        health: 'issue',
        interfaceId: 'IF-14',
      },
      {
        id: 'P2-S4',
        name: 'Stock posting',
        who: 'Interface, no human',
        sop: ['Convert to stock keeping unit', 'Post to the warehouse', 'Confirm'],
        system: 'D365 F&O – Recycling',
        data: 'stock_posting, quality_order',
        rule: 'Tonnes received × 1 000 = kilograms in stock, and every tested batch gets a quality order',
        agents: ['Reconciliation'],
        tests: 5,
        health: 'watch',
        interfaceId: 'IF-03',
      },
      {
        id: 'P2-S4b',
        name: 'Yard transfer',
        who: 'Yard operator',
        sop: ['Pick the batch', 'Send it to the other yard', 'Book the arrival'],
        system: 'D365 F&O – Recycling',
        data: 'transfer',
        rule: 'A transfer arrives with the weight it left with',
        agents: ['Interface Watch', 'Reconciliation'],
        tests: 3,
        health: 'watch',
        interfaceId: 'IF-19',
      },
      {
        id: 'P2-S5',
        name: 'Document output',
        who: 'Interface, no human',
        sop: ['Render the self-billing document', 'Archive it'],
        system: 'Lasernet',
        data: 'output_document',
        rule: 'Every booked scrap purchase produces a self-billing document',
        agents: ['Evidence'],
        tests: 3,
        health: 'working',
      },
    ],
  },
  {
    id: 'P3',
    name: 'Procure to Pay',
    summary: 'Requisition through to supplier payment.',
    owner: 'Finance Key User',
    stages: [
      { id: 'P3-S1', name: 'Requisition', who: 'Buyer', sop: ['Raise the requisition', 'Add the material', 'Submit'], system: 'SAP S/4HANA – Steel', data: 'EBAN', rule: 'Requisition carries a cost centre', agents: ['Scenario Writer'], tests: 4, health: 'working' },
      { id: 'P3-S2', name: 'Purchase order', who: 'Buyer', sop: ['Convert to a purchase order', 'Approve', 'Send to the supplier'], system: 'SAP S/4HANA – Steel', data: 'EKKO, EKPO', rule: 'Approval follows the release strategy', agents: ['Access'], tests: 6, health: 'working' },
      { id: 'P3-S3', name: 'Goods receipt', who: 'Gate operator', sop: ['Receive goods', 'Post the receipt'], system: 'SAP S/4HANA – Steel', data: 'MSEG', rule: 'Receipt quantity within tolerance', agents: ['Execution'], tests: 5, health: 'watch' },
      { id: 'P3-S4', name: 'Invoice', who: 'Accounts payable', sop: ['Capture', 'Match', 'Post'], system: 'Esker', data: 'RBKP', rule: 'Three-way match passes', agents: ['Execution'], tests: 7, health: 'issue' },
      { id: 'P3-S5', name: 'Payment', who: 'Treasury', sop: ['Select invoices', 'Run payment', 'Transmit'], system: 'Reval', data: 'payment', rule: 'Only posted invoices are paid', agents: ['Evidence'], tests: 4, health: 'working' },
    ],
  },
  {
    id: 'P4',
    name: 'Produce to Dispatch',
    summary: 'Heat, coils, certificate and dispatch.',
    owner: 'Production Key User',
    stages: [
      { id: 'P4-S1', name: 'Charge plan', who: 'Planner', sop: ['Plan the heat', 'Reserve the scrap mix'], system: 'Mill Execution System', data: 'plan', rule: 'Plan matches available stock', agents: ['Test Data'], tests: 3, health: 'working' },
      { id: 'P4-S2', name: 'Melt and cast', who: 'Operator', sop: ['Melt', 'Cast', 'Record the heat'], system: 'Mill Execution System', data: 'heat', rule: 'Heat weight within the plan', agents: ['Execution'], tests: 4, health: 'working' },
      { id: 'P4-S3', name: 'Confirmation', who: 'Interface, no human', sop: ['Send confirmation', 'Post in the ERP'], system: 'SAP S/4HANA – Steel', data: 'AFRU', rule: 'Confirmation within 15 minutes', agents: ['Interface Watch'], tests: 5, health: 'issue', interfaceId: 'IF-04' },
      { id: 'P4-S4', name: 'Certificate', who: 'Quality', sop: ['Generate the mill certificate', 'Release it'], system: 'Lasernet', data: 'output_document', rule: 'Certificate per heat', agents: ['Evidence'], tests: 3, health: 'working', interfaceId: 'IF-10' },
      { id: 'P4-S5', name: 'Dispatch', who: 'Logistics', sop: ['Pick', 'Load', 'Send the delivery note'], system: 'SAP S/4HANA – Steel', data: 'LIKP', rule: 'Delivery matches the order', agents: ['Execution'], tests: 4, health: 'not tested' },
    ],
  },
  {
    id: 'P5',
    name: 'Order to Cash',
    summary: 'Customer order through to cash collection.',
    owner: 'Sales Key User',
    stages: [
      { id: 'P5-S1', name: 'Order entry', who: 'Sales', sop: ['Enter the order', 'Check credit'], system: 'SAP S/4HANA – Service Centre', data: 'VBAK', rule: 'Credit limit respected', agents: ['Scenario Writer'], tests: 5, health: 'working' },
      { id: 'P5-S2', name: 'Availability', who: 'Planner', sop: ['Check stock', 'Confirm the date'], system: 'SAP S/4HANA – Service Centre', data: 'VBAP', rule: 'Confirmed date is achievable', agents: ['Execution'], tests: 3, health: 'watch' },
      { id: 'P5-S3', name: 'Delivery', who: 'Logistics', sop: ['Create the delivery', 'Pick and pack'], system: 'SAP S/4HANA – Service Centre', data: 'LIKP', rule: 'Delivery matches the order', agents: ['Execution'], tests: 4, health: 'working' },
      { id: 'P5-S4', name: 'Billing', who: 'Finance', sop: ['Create the billing document', 'Send it'], system: 'Lasernet', data: 'VBRK', rule: 'Billing equals the delivery', agents: ['Reconciliation'], tests: 4, health: 'working' },
      { id: 'P5-S5', name: 'Cash', who: 'Treasury', sop: ['Match the receipt', 'Clear the item'], system: 'Reval', data: 'payment', rule: 'Open items cleared within terms', agents: ['Evidence'], tests: 3, health: 'not tested' },
    ],
  },
  {
    id: 'P6',
    name: 'Month-End Close',
    summary: 'Cut-off, reconciliation and the close run.',
    owner: 'Finance Key User',
    stages: [
      { id: 'P6-S1', name: 'Cut-off', who: 'Finance', sop: ['Freeze postings', 'Publish the calendar'], system: 'SAP S/4HANA – Steel', data: 'BKPF', rule: 'No postings after the freeze', agents: ['Access'], tests: 4, health: 'watch' },
      { id: 'P6-S2', name: 'Interface drain', who: 'IT operations', sop: ['Drain the queues', 'Confirm zero backlog'], system: 'All', data: 'queues', rule: 'Backlog is zero at the cut-off', agents: ['Load', 'Interface Watch'], tests: 6, health: 'issue' },
      { id: 'P6-S3', name: 'Reconciliation', who: 'Finance', sop: ['Compare the ledgers', 'Explain the differences'], system: 'D365 F&O – Recycling', data: 'recon', rule: 'Stock and ledger agree', agents: ['Reconciliation'], tests: 5, health: 'watch' },
      { id: 'P6-S4', name: 'Close run', who: 'Finance', sop: ['Run the close', 'Review the log'], system: 'SAP S/4HANA – Steel', data: 'close', rule: 'Close completes without errors', agents: ['Execution'], tests: 4, health: 'working' },
      { id: 'P6-S5', name: 'Reporting', who: 'Finance', sop: ['Publish the pack', 'Sign off'], system: 'Lasernet', data: 'reports', rule: 'Pack is complete and signed', agents: ['Evidence'], tests: 3, health: 'working' },
    ],
  },
]

export function processById(id: string) {
  return PROCESSES.find((p) => p.id === id)
}

export function stageById(id: string) {
  for (const p of PROCESSES) {
    const s = p.stages.find((st) => st.id === id)
    if (s) return { process: p, stage: s }
  }
  return undefined
}

/* -------------------------------------------------------------------------- */
/* AI agents                                                                  */
/* -------------------------------------------------------------------------- */

export interface Agent {
  id: string
  name: string
  group: 'Build' | 'Run' | 'Govern'
  reads: string
  produces: string
  worksOn: string
  route: string
}

export const AGENTS: Agent[] = [
  { id: 'A1', name: 'Discovery', group: 'Build', reads: 'Recorded key-user sessions and system logs', produces: 'A process map with rework loops', worksOn: 'Process Discovery', route: '/discovery' },
  { id: 'A2', name: 'Scenario Writer', group: 'Build', reads: 'The process map and business rules', produces: 'Positive, negative and regression scenarios', worksOn: 'Test Studio', route: '/studio' },
  { id: 'A3', name: 'Test Data', group: 'Build', reads: 'Entity definitions and linked master data', produces: 'Linked test records with no personal data', worksOn: 'Test Data', route: '/test-data' },
  { id: 'A4', name: 'Execution', group: 'Run', reads: 'Approved scenarios', produces: 'Run results with evidence per step', worksOn: 'Run Centre', route: '/run' },
  { id: 'A5', name: 'Interface Watch', group: 'Run', reads: 'Messages on every interface', produces: 'Field-by-field mismatches and missing messages', worksOn: 'Interface Testing', route: '/interfaces' },
  { id: 'A6', name: 'Reconciliation', group: 'Run', reads: 'Source and target data sets', produces: 'Explained difference groups', worksOn: 'Migration Reconciliation', route: '/reconciliation' },
  { id: 'A7', name: 'Self-Healing', group: 'Run', reads: 'Failing steps and the change feed', produces: 'Repaired selectors and field names', worksOn: 'Self-Healing', route: '/self-healing' },
  { id: 'A8', name: 'Change Impact', group: 'Run', reads: 'Transports, releases and the code graph', produces: 'Which workflows a change hits', worksOn: 'Change Impact', route: '/regression' },
  { id: 'A9', name: 'Load', group: 'Run', reads: 'Month-end volume profiles', produces: 'Throughput, p95 and backlog curves', worksOn: 'Month-End Load', route: '/load' },
  { id: 'A10', name: 'Access', group: 'Govern', reads: 'Roles, rules and user assignments', produces: 'Segregation of duty conflicts with proof', worksOn: 'Roles & SoD', route: '/access-sod' },
  { id: 'A11', name: 'Evidence', group: 'Govern', reads: 'Run results and approvals', produces: 'Locked, hashed evidence packs', worksOn: 'Evidence & Reports', route: '/evidence' },
]

/* -------------------------------------------------------------------------- */
/* Requirements                                                               */
/* -------------------------------------------------------------------------- */

export interface Requirement {
  id: string
  title: string
  provenBy: { label: string; route: string }[]
  status: 'Proven' | 'Partly proven' | 'Open'
}

export const REQUIREMENTS: Requirement[] = [
  { id: 'R1', title: 'Script generation from process discovery', status: 'Proven', provenBy: [{ label: 'Process Discovery', route: '/discovery' }, { label: 'Test Studio', route: '/studio' }] },
  { id: 'R2', title: 'Positive, negative and regression tests', status: 'Proven', provenBy: [{ label: 'Test Studio', route: '/studio' }, { label: 'Change & Regression', route: '/regression' }] },
  { id: 'R3', title: 'Audit-ready evidence', status: 'Proven', provenBy: [{ label: 'Evidence & Reports', route: '/evidence' }] },
  { id: 'R4', title: 'AI generated test master data', status: 'Proven', provenBy: [{ label: 'Test Data', route: '/test-data' }] },
  { id: 'R5', title: 'Integration and API testing', status: 'Partly proven', provenBy: [{ label: 'Interface Testing', route: '/interfaces' }, { label: 'Live Data Flow', route: '/flow' }] },
  { id: 'R6', title: 'Month-end load testing', status: 'Partly proven', provenBy: [{ label: 'Month-End Load', route: '/load' }] },
  { id: 'R7', title: 'Segregation of duty and role testing', status: 'Proven', provenBy: [{ label: 'Roles & SoD', route: '/access-sod' }] },
  { id: 'R8', title: 'Data migration reconciliation', status: 'Partly proven', provenBy: [{ label: 'Migration Reconciliation', route: '/reconciliation' }] },
  { id: 'R9', title: 'Self-healing scripts', status: 'Proven', provenBy: [{ label: 'Self-Healing', route: '/self-healing' }] },
  { id: 'R10', title: 'One end-to-end framework', status: 'Proven', provenBy: [{ label: 'Command Centre', route: '/' }, { label: 'Enterprise Map', route: '/landscape' }] },
]

/* -------------------------------------------------------------------------- */
/* Scenarios                                                                  */
/* -------------------------------------------------------------------------- */

export interface ScenarioStep {
  n: number
  text: string
  technical: string
  system: string
}

export interface Scenario {
  id: string
  name: string
  process: Process['id']
  stageId: string
  type: 'Positive' | 'Negative' | 'Regression'
  requirement: string
  systems: string[]
  lastResult: 'Pass' | 'Fail' | 'Healed' | 'Not run'
  steps: ScenarioStep[]
}

function steps(list: [string, string, string][]): ScenarioStep[] {
  return list.map(([text, technical, system], i) => ({ n: i + 1, text, technical, system }))
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'SC-001',
    name: 'Steel truck arrives, is weighed and booked in SAP',
    process: 'P1',
    stageId: 'P1-S2',
    type: 'Positive',
    requirement: 'R1',
    systems: ['Yard Management', 'SAP S/4HANA – Steel'],
    lastResult: 'Pass',
    steps: steps([
      ['Open Yard Management and create a gate pass for the vehicle', "page.goto('/yard/gate-pass/new')", 'Yard Management'],
      ['Weigh gross and tare, and confirm the net weight', "fill('#gross', '38420'); fill('#tare', '13560')", 'Yard Management'],
      ['Release the vehicle and send the ticket', "click('[data-test=release]')", 'Yard Management'],
      ['Check that SAP created one goods receipt', "odata.get('/MSEG?$filter=xblnr eq {gatePass}')", 'SAP S/4HANA – Steel'],
      ['Check that the quantity equals the weighbridge net weight', 'expect(mseg.menge).toBe(ticket.net_kg)', 'SAP S/4HANA – Steel'],
    ]),
  },
  {
    id: 'SC-002',
    name: 'Supplier invoice posts after a clean three-way match',
    process: 'P1',
    stageId: 'P1-S4',
    type: 'Positive',
    requirement: 'R2',
    systems: ['Esker', 'SAP S/4HANA – Steel'],
    lastResult: 'Pass',
    steps: steps([
      ['Capture the supplier invoice in Esker', "esker.post('/invoices', payload)", 'Esker'],
      ['Send the captured invoice on IF-06', 'queue.publish("IF-06", payload)', 'Esker'],
      ['Run the three-way match', 'sap.run("MIRO")', 'SAP S/4HANA – Steel'],
      ['Check that the invoice is Posted, not Parked', "expect(rbkp.status).toBe('Posted')", 'SAP S/4HANA – Steel'],
    ]),
  },
  {
    id: 'SC-003',
    name: 'Invoice without a purchase order is blocked',
    process: 'P1',
    stageId: 'P1-S4',
    type: 'Negative',
    requirement: 'R2',
    systems: ['Esker', 'SAP S/4HANA – Steel'],
    lastResult: 'Pass',
    steps: steps([
      ['Capture an invoice with the purchase order field empty', "payload.purchaseOrder = null", 'Esker'],
      ['Send it to SAP', 'queue.publish("IF-06", payload)', 'Esker'],
      ['Expect the invoice to be parked with a clear reason', "expect(rbkp.reason).toBe('No purchase order reference')", 'SAP S/4HANA – Steel'],
    ]),
  },
  {
    id: 'SC-004',
    name: 'Weighbridge net weight equals the goods receipt quantity',
    process: 'P1',
    stageId: 'P1-S2',
    type: 'Regression',
    requirement: 'R5',
    systems: ['Yard Management', 'SAP S/4HANA – Steel'],
    lastResult: 'Fail',
    steps: steps([
      ['Read the last 50 weighbridge tickets', 'select * from weighbridge_ticket order by weighed desc limit 50', 'Yard Management'],
      ['Read the matching goods receipts', 'select * from mseg where xblnr in (...)', 'SAP S/4HANA – Steel'],
      ['Compare net weight against quantity within 20 kg', 'expect(abs(net - menge)).toBeLessThan(20)', 'SAP S/4HANA – Steel'],
    ]),
  },
  {
    id: 'SC-005',
    name: 'Duplicate weighbridge message does not double the stock',
    process: 'P1',
    stageId: 'P1-S2',
    type: 'Negative',
    requirement: 'R5',
    systems: ['Yard Management', 'SAP S/4HANA – Steel'],
    lastResult: 'Fail',
    steps: steps([
      ['Send the same ticket twice on IF-01', 'queue.publish("IF-01", payload); queue.publish("IF-01", payload)', 'Yard Management'],
      ['Expect exactly one goods receipt', 'expect(mseg.length).toBe(1)', 'SAP S/4HANA – Steel'],
    ]),
  },
  { id: 'SC-006', name: 'Gate pass cannot be released without a tare weight', process: 'P1', stageId: 'P1-S1', type: 'Negative', requirement: 'R2', systems: ['Yard Management'], lastResult: 'Pass', steps: steps([['Leave the tare field empty', "fill('#tare', '')", 'Yard Management'], ['Try to release the vehicle', "click('[data-test=release]')", 'Yard Management'], ['Expect a blocking validation message', "expect(page.locator('.error')).toBeVisible()", 'Yard Management']]) },
  { id: 'SC-007', name: 'Invoice copy is produced for every posted invoice', process: 'P1', stageId: 'P1-S5', type: 'Positive', requirement: 'R3', systems: ['SAP S/4HANA – Steel', 'Lasernet'], lastResult: 'Pass', steps: steps([['Post an invoice', 'sap.run("MIRO")', 'SAP S/4HANA – Steel'], ['Wait for the output document', 'await lasernet.poll(belnr)', 'Lasernet'], ['Check the document reference', 'expect(doc.ref).toBe(belnr)', 'Lasernet']]) },
  { id: 'SC-008', name: 'Payment run only pays posted invoices', process: 'P1', stageId: 'P1-S5', type: 'Negative', requirement: 'R7', systems: ['SAP S/4HANA – Steel', 'Reval'], lastResult: 'Pass', steps: steps([['Park one invoice and post another', 'sap.park(a); sap.post(b)', 'SAP S/4HANA – Steel'], ['Run the hourly payment file', 'sap.run("F110")', 'SAP S/4HANA – Steel'], ['Expect only the posted invoice in Reval', 'expect(reval.payments).toContainOnly(b)', 'Reval']]) },
  { id: 'SC-009', name: 'Recycling load reaches the scrap yard', process: 'P2', stageId: 'P2-S1', type: 'Positive', requirement: 'R5', systems: ['Yard Management', 'Scrap Yard Operations'], lastResult: 'Fail', steps: steps([['Weigh a wagon at YD02', "fill('#gross', '58200')", 'Yard Management'], ['Send the receipt on IF-02', 'queue.publish("IF-02", payload)', 'Yard Management'], ['Expect a receipt in Scrap Yard Operations', 'expect(scrap.receipt).toBeDefined()', 'Scrap Yard Operations']]) },
  { id: 'SC-010', name: 'Sorted batches add up to the receipt', process: 'P2', stageId: 'P2-S2', type: 'Positive', requirement: 'R2', systems: ['Scrap Yard Operations'], lastResult: 'Pass', steps: steps([['Sort a receipt into three batches', 'scrap.sort(receipt, 3)', 'Scrap Yard Operations'], ['Sum the batch weights', 'sum(batches.weight_kg)', 'Scrap Yard Operations'], ['Compare against the receipt weight', 'expect(sum).toBe(receipt.weight_kg)', 'Scrap Yard Operations']]) },
  { id: 'SC-011', name: 'Chemistry result carries nickel, chromium and molybdenum', process: 'P2', stageId: 'P2-S3', type: 'Regression', requirement: 'R5', systems: ['Laboratory app', 'Scrap Yard Operations'], lastResult: 'Healed', steps: steps([['Release a sample in the laboratory app', 'lims.release(sample)', 'Laboratory app'], ['Send it on IF-14', 'queue.publish("IF-14", payload)', 'Laboratory app'], ['Expect all three elements to be present', 'expect(chem.mo_pct).not.toBeNull()', 'Scrap Yard Operations']]) },
  { id: 'SC-012', name: 'Stock is posted in kilograms', process: 'P2', stageId: 'P2-S4', type: 'Regression', requirement: 'R5', systems: ['Scrap Yard Operations', 'D365 F&O – Recycling'], lastResult: 'Fail', steps: steps([['Post a batch to D365 on IF-03', 'queue.publish("IF-03", payload)', 'Scrap Yard Operations'], ['Read the stock journal', "d365.get('/StockPostings')", 'D365 F&O – Recycling'], ['Expect the unit to be KG', "expect(posting.unit).toBe('KG')", 'D365 F&O – Recycling']]) },
  { id: 'SC-013', name: 'Scrap batch without chemistry cannot be consumed', process: 'P2', stageId: 'P2-S3', type: 'Negative', requirement: 'R2', systems: ['Scrap Yard Operations', 'Mill Execution System'], lastResult: 'Pass', steps: steps([['Create a batch with no chemistry', 'scrap.create(batch)', 'Scrap Yard Operations'], ['Try to add it to a charge plan', 'mes.plan.add(batch)', 'Mill Execution System'], ['Expect the plan to refuse it', 'expect(response.status).toBe(422)', 'Mill Execution System']]) },
  { id: 'SC-014', name: 'Mill confirmation arrives within 15 minutes', process: 'P4', stageId: 'P4-S3', type: 'Regression', requirement: 'R5', systems: ['Mill Execution System', 'SAP S/4HANA – Steel'], lastResult: 'Fail', steps: steps([['Finish a heat in the mill system', 'mes.finish(heat)', 'Mill Execution System'], ['Wait for the confirmation file', 'await sap.poll(heat, 15)', 'SAP S/4HANA – Steel'], ['Expect the delay to be under 15 minutes', 'expect(afru.delay_min).toBeLessThan(15)', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-015', name: 'Mill certificate is produced for every heat', process: 'P4', stageId: 'P4-S4', type: 'Positive', requirement: 'R3', systems: ['Mill Execution System', 'Lasernet'], lastResult: 'Pass', steps: steps([['Finish a heat', 'mes.finish(heat)', 'Mill Execution System'], ['Wait for the certificate', 'await lasernet.poll(heat)', 'Lasernet'], ['Check the heat reference', 'expect(doc.ref).toBe(heat)', 'Lasernet']]) },
  { id: 'SC-016', name: 'Purchase order release follows the release strategy', process: 'P3', stageId: 'P3-S2', type: 'Negative', requirement: 'R7', systems: ['SAP S/4HANA – Steel'], lastResult: 'Pass', steps: steps([['Sign in as a buyer without release rights', 'sap.login("buyer_a")', 'SAP S/4HANA – Steel'], ['Try to release a purchase order over the limit', 'sap.run("ME29N")', 'SAP S/4HANA – Steel'], ['Expect the release to be refused', 'expect(message).toContain("not authorised")', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-017', name: 'Goods receipt tolerance is respected', process: 'P3', stageId: 'P3-S3', type: 'Negative', requirement: 'R2', systems: ['SAP S/4HANA – Steel'], lastResult: 'Pass', steps: steps([['Receive 7 % more than ordered', 'sap.post(gr, qty * 1.07)', 'SAP S/4HANA – Steel'], ['Expect the receipt to be blocked', 'expect(response).toContain("tolerance")', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-018', name: 'Stock transfer between plants keeps the quantity', process: 'P3', stageId: 'P3-S3', type: 'Regression', requirement: 'R8', systems: ['SAP S/4HANA – Steel', 'SAP S/4HANA – Service Centre'], lastResult: 'Pass', steps: steps([['Create a stock transfer on IF-07', 'queue.publish("IF-07", payload)', 'SAP S/4HANA – Steel'], ['Read the receiving plant', 'sap_sc.get(material)', 'SAP S/4HANA – Service Centre'], ['Compare the quantities', 'expect(target.qty).toBe(source.qty)', 'SAP S/4HANA – Service Centre']]) },
  { id: 'SC-019', name: 'Customer order respects the credit limit', process: 'P5', stageId: 'P5-S1', type: 'Negative', requirement: 'R2', systems: ['SAP S/4HANA – Service Centre'], lastResult: 'Pass', steps: steps([['Enter an order above the credit limit', 'sap.run("VA01")', 'SAP S/4HANA – Service Centre'], ['Expect a credit block', 'expect(order.creditBlock).toBe(true)', 'SAP S/4HANA – Service Centre']]) },
  { id: 'SC-020', name: 'Delivery matches the order quantity', process: 'P5', stageId: 'P5-S3', type: 'Positive', requirement: 'R2', systems: ['SAP S/4HANA – Service Centre'], lastResult: 'Pass', steps: steps([['Create a delivery from the order', 'sap.run("VL01N")', 'SAP S/4HANA – Service Centre'], ['Compare quantities line by line', 'expect(delivery.items).toEqual(order.items)', 'SAP S/4HANA – Service Centre']]) },
  { id: 'SC-021', name: 'Billing document equals the delivery', process: 'P5', stageId: 'P5-S4', type: 'Regression', requirement: 'R8', systems: ['SAP S/4HANA – Service Centre', 'Lasernet'], lastResult: 'Pass', steps: steps([['Bill the delivery', 'sap.run("VF01")', 'SAP S/4HANA – Service Centre'], ['Compare the billing document to the delivery', 'expect(billing.total).toBe(delivery.total)', 'SAP S/4HANA – Service Centre']]) },
  { id: 'SC-022', name: 'No postings are accepted after the freeze', process: 'P6', stageId: 'P6-S1', type: 'Negative', requirement: 'R7', systems: ['SAP S/4HANA – Steel'], lastResult: 'Pass', steps: steps([['Set the posting period to closed', 'sap.run("OB52")', 'SAP S/4HANA – Steel'], ['Try to post a document', 'sap.run("FB01")', 'SAP S/4HANA – Steel'], ['Expect the posting to be refused', 'expect(message).toContain("period")', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-023', name: 'Interface backlog is zero at the cut-off', process: 'P6', stageId: 'P6-S2', type: 'Regression', requirement: 'R6', systems: ['All'], lastResult: 'Fail', steps: steps([['Read the queue depth for all 14 interfaces', 'queue.depth()', 'All'], ['Expect zero in flight at the cut-off', 'expect(depth).toBe(0)', 'All']]) },
  { id: 'SC-024', name: 'Stock ledger and physical stock agree', process: 'P6', stageId: 'P6-S3', type: 'Regression', requirement: 'R8', systems: ['D365 F&O – Recycling', 'SAP S/4HANA – Steel'], lastResult: 'Fail', steps: steps([['Read the D365 stock', "d365.get('/InventOnHand')", 'D365 F&O – Recycling'], ['Read the SAP ledger', 'sap.get("MBEW")', 'SAP S/4HANA – Steel'], ['Compare totals by material', 'expect(diff).toBeLessThan(tolerance)', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-025', name: 'Close run completes without errors', process: 'P6', stageId: 'P6-S4', type: 'Positive', requirement: 'R6', systems: ['SAP S/4HANA – Steel'], lastResult: 'Pass', steps: steps([['Start the close run', 'sap.run("CLOSE")', 'SAP S/4HANA – Steel'], ['Read the log', 'sap.log("CLOSE")', 'SAP S/4HANA – Steel'], ['Expect no red messages', 'expect(log.errors).toHaveLength(0)', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-026', name: 'Month-end pack is complete and signed', process: 'P6', stageId: 'P6-S5', type: 'Positive', requirement: 'R3', systems: ['Lasernet'], lastResult: 'Pass', steps: steps([['Generate the month-end pack', 'lasernet.render("pack")', 'Lasernet'], ['Check every section is present', 'expect(pack.sections).toHaveLength(9)', 'Lasernet']]) },
  { id: 'SC-027', name: 'Buyer cannot both create and approve a purchase order', process: 'P3', stageId: 'P3-S2', type: 'Negative', requirement: 'R7', systems: ['SAP S/4HANA – Steel'], lastResult: 'Fail', steps: steps([['Sign in as the user holding both roles', 'sap.login("u_buyer_approver")', 'SAP S/4HANA – Steel'], ['Create and then approve the same order', 'sap.run("ME21N"); sap.run("ME29N")', 'SAP S/4HANA – Steel'], ['Expect the second action to be refused', 'expect(allowed).toBe(false)', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-028', name: 'Vehicle master tare change does not affect open tickets', process: 'P1', stageId: 'P1-S1', type: 'Regression', requirement: 'R9', systems: ['Yard Management'], lastResult: 'Healed', steps: steps([['Change the registered tare on the vehicle master', 'yard.update(vehicle, { tare: 14200 })', 'Yard Management'], ['Re-read an open ticket', 'yard.get(ticket)', 'Yard Management'], ['Expect the weighed tare to be unchanged', 'expect(ticket.tare_kg).toBe(13560)', 'Yard Management']]) },
  { id: 'SC-029', name: 'Esker retry does not create a second invoice', process: 'P1', stageId: 'P1-S3', type: 'Negative', requirement: 'R5', systems: ['Esker', 'SAP S/4HANA – Steel'], lastResult: 'Pass', steps: steps([['Send the same capture twice', 'queue.publish("IF-06", p); queue.publish("IF-06", p)', 'Esker'], ['Expect one invoice document', 'expect(rbkp.length).toBe(1)', 'SAP S/4HANA – Steel']]) },
  { id: 'SC-030', name: 'Recycling stock posting is reversible', process: 'P2', stageId: 'P2-S4', type: 'Positive', requirement: 'R8', systems: ['D365 F&O – Recycling'], lastResult: 'Pass', steps: steps([['Post a batch to stock', 'd365.post(journal)', 'D365 F&O – Recycling'], ['Reverse the journal', 'd365.reverse(journal)', 'D365 F&O – Recycling'], ['Expect the on-hand quantity to return to its start', 'expect(onHand).toBe(before)', 'D365 F&O – Recycling']]) },
]

/* -------------------------------------------------------------------------- */
/* Runs, changes, healing, reconciliation, access                             */
/* -------------------------------------------------------------------------- */

export interface HistoricRun {
  id: string
  when: string
  trigger: string
  scenarios: number
  passed: number
  failed: number
  healed: number
  verdict: 'PASS' | 'CONDITIONAL' | 'FAIL'
  duration: string
  process: string
}

export const RUNS: HistoricRun[] = [
  { id: 'RUN-1042', when: '14 Oct 2026 05:40', trigger: 'Nightly regression', scenarios: 30, passed: 24, failed: 5, healed: 1, verdict: 'CONDITIONAL', duration: '18 min', process: 'All' },
  { id: 'RUN-1041', when: '13 Oct 2026 05:40', trigger: 'Nightly regression', scenarios: 30, passed: 26, failed: 3, healed: 1, verdict: 'CONDITIONAL', duration: '17 min', process: 'All' },
  { id: 'RUN-1040', when: '12 Oct 2026 14:05', trigger: 'Change CH-204 verification', scenarios: 12, passed: 11, failed: 1, healed: 0, verdict: 'CONDITIONAL', duration: '7 min', process: 'P1' },
  { id: 'RUN-1039', when: '12 Oct 2026 05:40', trigger: 'Nightly regression', scenarios: 30, passed: 28, failed: 2, healed: 0, verdict: 'CONDITIONAL', duration: '16 min', process: 'All' },
  { id: 'RUN-1038', when: '11 Oct 2026 09:12', trigger: 'Key user on demand', scenarios: 8, passed: 8, failed: 0, healed: 0, verdict: 'PASS', duration: '5 min', process: 'P2' },
  { id: 'RUN-1037', when: '10 Oct 2026 05:40', trigger: 'Nightly regression', scenarios: 30, passed: 22, failed: 7, healed: 1, verdict: 'FAIL', duration: '19 min', process: 'All' },
]

export interface ChangeItem {
  id: string
  title: string
  system: string
  type: string
  risk: number
  release: string
  whatChanged: string
  whatCouldGoWrong: string
  whatWeDo: string
  business: string
  affectedSystems: string[]
  downstreamSystems: string[]
  stages: string[]
  safeBeforeClose: boolean
}

export const CHANGES: ChangeItem[] = [
  {
    id: 'CH-204',
    title: 'Weighbridge interface sends quantity as a decimal',
    system: 'Yard Management',
    type: 'Interface change',
    risk: 86,
    release: 'R-2026.10',
    whatChanged: 'The weighbridge now sends the quantity as a decimal field instead of an integer, and the unit is no longer sent with every message.',
    whatCouldGoWrong: 'SAP can read 21.92 as kilograms instead of tonnes, so a truck is booked as 22 kg of scrap rather than 21 920 kg.',
    whatWeDo: 'Run SC-001, SC-004 and SC-005 on every build, and keep live check C1 running against the last 50 tickets.',
    business: 'For the business: a wrong weight here becomes a wrong supplier invoice and a wrong stock value at the close.',
    affectedSystems: ['yard', 'sap-steel'],
    downstreamSystems: ['esker', 'lasernet', 'reval'],
    stages: ['P1-S1', 'P1-S2', 'P1-S4'],
    safeBeforeClose: false,
  },
  {
    id: 'CH-205',
    title: 'Laboratory renames the molybdenum field',
    system: 'Laboratory app',
    type: 'Schema change',
    risk: 71,
    release: 'R-2026.10',
    whatChanged: 'mo_pct becomes molybdenum_pct in the laboratory export.',
    whatCouldGoWrong: 'Scrap Yard Operations stores an empty molybdenum value, so batches cannot be certified for 316L.',
    whatWeDo: 'Self-healing maps the new field name, and live check C5 proves the chemistry is complete.',
    business: 'For the business: uncertified batches cannot be charged into the mill, which stalls the melt plan.',
    affectedSystems: ['lab', 'scrap'],
    downstreamSystems: ['d365', 'mill'],
    stages: ['P2-S3', 'P2-S4'],
    safeBeforeClose: false,
  },
  {
    id: 'CH-206',
    title: 'D365 warehouse code RAW split into RAW1 and RAW2',
    system: 'D365 F&O – Recycling',
    type: 'Master data',
    risk: 54,
    release: 'R-2026.10',
    whatChanged: 'The raw material warehouse is split in two for the two yards.',
    whatCouldGoWrong: 'Stock postings land in the wrong warehouse and the yard stock report no longer reconciles.',
    whatWeDo: 'Reconciliation set RS-02 compares both warehouses against the scrap yard batches.',
    business: 'For the business: stock looks right in total but wrong per yard, which misleads the buying decision.',
    affectedSystems: ['d365'],
    downstreamSystems: ['sap-steel'],
    stages: ['P2-S4', 'P6-S3'],
    safeBeforeClose: true,
  },
  {
    id: 'CH-207',
    title: 'Esker upgrade changes the capture layout',
    system: 'Esker',
    type: 'Vendor upgrade',
    risk: 43,
    release: 'R-2026.11',
    whatChanged: 'The capture screen moves the purchase order field into a sub-panel.',
    whatCouldGoWrong: 'Scripts that fill the purchase order stop finding the field, and captures go out without a reference.',
    whatWeDo: 'Self-healing repaired the selector with 96 % confidence; SC-003 proves the negative case still blocks.',
    business: 'For the business: invoices park and the supplier is paid late.',
    affectedSystems: ['esker'],
    downstreamSystems: ['sap-steel', 'reval'],
    stages: ['P1-S3', 'P1-S4'],
    safeBeforeClose: true,
  },
  {
    id: 'CH-208',
    title: 'Payment run moves from hourly to every 30 minutes',
    system: 'SAP S/4HANA – Steel',
    type: 'Configuration',
    risk: 28,
    release: 'R-2026.11',
    whatChanged: 'The payment proposal runs twice as often.',
    whatCouldGoWrong: 'More files reach Reval, and a parked invoice could slip into a proposal.',
    whatWeDo: 'SC-008 runs against every build, and the load profile is re-measured at 2x.',
    business: 'For the business: suppliers are paid sooner, as long as parked invoices stay out.',
    affectedSystems: ['sap-steel', 'reval'],
    downstreamSystems: [],
    stages: ['P1-S5', 'P3-S5'],
    safeBeforeClose: true,
  },
  {
    id: 'CH-209',
    title: 'Mill export switches to the new file gateway',
    system: 'Mill Execution System',
    type: 'Infrastructure',
    risk: 62,
    release: 'R-2026.10',
    whatChanged: 'Confirmation files move to the new gateway with a different retry policy.',
    whatCouldGoWrong: 'Confirmations arrive late, so production looks behind in the ERP and the shift report is wrong.',
    whatWeDo: 'Live check C9 measures the delay on every heat, and SC-014 runs on every build.',
    business: 'For the business: the shift report understates output and the melt plan is rebuilt on bad numbers.',
    affectedSystems: ['mill', 'sap-steel'],
    downstreamSystems: ['lasernet'],
    stages: ['P4-S3', 'P4-S4'],
    safeBeforeClose: false,
  },
]

export interface HealingEvent {
  id: string
  scenario: string
  change: string
  before: string
  after: string
  confidence: number
  status: 'Pending' | 'Approved' | 'Rejected'
  when: string
}

export const HEALING: HealingEvent[] = [
  { id: 'HE-01', scenario: 'SC-011', change: 'CH-205', before: "chemistry.mo_pct", after: "chemistry.molybdenum_pct ?? chemistry.mo_pct", confidence: 96, status: 'Pending', when: '14 Oct 05:46' },
  { id: 'HE-02', scenario: 'SC-002', change: 'CH-207', before: "fill('#po-number', po)", after: "fill('[data-test=po-panel] #po-number', po)", confidence: 94, status: 'Pending', when: '14 Oct 05:47' },
  { id: 'HE-03', scenario: 'SC-001', change: 'CH-204', before: 'expect(payload.netWeightKg)', after: 'expect(payload.net_weight_kg ?? payload.netWeightKg)', confidence: 96, status: 'Approved', when: '13 Oct 05:48' },
  { id: 'HE-04', scenario: 'SC-012', change: 'CH-206', before: "warehouse === 'RAW'", after: "['RAW','RAW1','RAW2'].includes(warehouse)", confidence: 88, status: 'Pending', when: '13 Oct 05:49' },
  { id: 'HE-05', scenario: 'SC-020', change: 'CH-207', before: "click('#create-delivery')", after: "click('[data-test=create-delivery]')", confidence: 91, status: 'Approved', when: '12 Oct 05:44' },
  { id: 'HE-06', scenario: 'SC-015', change: 'CH-209', before: 'await lasernet.poll(heat, 5)', after: 'await lasernet.poll(heat, 12)', confidence: 83, status: 'Rejected', when: '12 Oct 05:45' },
  { id: 'HE-07', scenario: 'SC-024', change: 'CH-206', before: "groupBy('warehouse')", after: "groupBy('warehouseGroup')", confidence: 79, status: 'Pending', when: '11 Oct 05:42' },
]

export interface ReconGroup {
  reason: string
  rows: number
  explanation: string
}

export interface ReconFieldDiff {
  field: string
  source: string | number | null
  target: string | number | null
}

export interface ReconRef {
  system: string
  table: string
  note?: string
  route?: string
}

export interface ReconRow {
  key: string
  source: string
  target: string
  status: 'Match' | 'Differs' | 'Missing'
  /** Field by field, so the row can explain itself. */
  fields?: ReconFieldDiff[]
  /** Why the two sides disagree. */
  reason?: string
  /** What to do about it. */
  fix?: string
  /** A difference that is correct by design, not a defect. */
  expected?: boolean
  sourceRef?: ReconRef
  targetRef?: ReconRef
  /** Follow the business key through every system. */
  traceKey?: string
  link?: { label: string; route: string }
}

export interface ReconSet {
  id: string
  name: string
  kind: 'Migration' | 'Cross-system'
  source: string
  target: string
  sourceRows: number
  targetRows: number
  sourceTotal: string
  targetTotal: string
  matchPct: number
  groups: ReconGroup[]
  sample: ReconRow[]
  /** Cross-system sets read the live plant instead of a stored sample. */
  liveSource?: 'batches' | 'invoices'
}

export const RECON_SETS: ReconSet[] = [
  {
    id: 'RS-01',
    name: 'Open purchase orders migrated to S/4',
    kind: 'Migration',
    source: 'Legacy ERP extract',
    target: 'SAP S/4HANA – Steel',
    sourceRows: 4820,
    targetRows: 4812,
    sourceTotal: '€ 48 204 110',
    targetTotal: '€ 48 191 880',
    matchPct: 99.8,
    groups: [
      { reason: 'Closed in the source after the extract', rows: 6, explanation: 'These orders were completed between the extract and the load, so the target is correct.' },
      { reason: 'Rounding on the unit price', rows: 2, explanation: 'Two orders differ by less than one euro because the legacy price carried four decimals.' },
    ],
    sample: [
      {
        key: '4500012044',
        source: '€ 128 400',
        target: '€ 128 400',
        status: 'Match',
        fields: [
          { field: 'purchase order', source: '4500012044', target: '4500012044' },
          { field: 'vendor', source: 'VEND-1042', target: 'VEND-1042' },
          { field: 'material', source: 'SCRAP-STEEL-MIX', target: 'SCRAP-STEEL-MIX' },
          { field: 'open quantity', source: '64 200 kg', target: '64 200 kg' },
          { field: 'net value', source: '€ 128 400', target: '€ 128 400' },
          { field: 'currency', source: 'EUR', target: 'EUR' },
        ],
        sourceRef: { system: 'Legacy ERP', table: 'ZEKPO_20260930.csv', note: 'extract taken 30 Sep 2026 at 23:10' },
        targetRef: { system: 'SAP S/4HANA – Steel', table: 'sap.ekpo', note: 'loaded 01 Oct 2026' },
      },
      {
        key: '4500012051',
        source: '€ 96 120',
        target: '€ 96 119',
        status: 'Differs',
        expected: true,
        fields: [
          { field: 'purchase order', source: '4500012051', target: '4500012051' },
          { field: 'vendor', source: 'VEND-1043', target: 'VEND-1043' },
          { field: 'open quantity', source: '48 060 kg', target: '48 060 kg' },
          { field: 'unit price', source: '2 000.4167 EUR/t', target: '2 000.42 EUR/t' },
          { field: 'net value', source: '€ 96 120', target: '€ 96 119' },
        ],
        reason:
          'The legacy system held the unit price to four decimals; S/4 holds two. Rounding 2 000.4167 to 2 000.42 moves the net value by one euro.',
        fix: 'Accepted and documented under the rounding group. No correction is made, because the S/4 value is the one the supplier will be paid against.',
        sourceRef: { system: 'Legacy ERP', table: 'ZEKPO_20260930.csv', note: 'field NETWR, 4 decimals' },
        targetRef: { system: 'SAP S/4HANA – Steel', table: 'sap.ekpo', note: 'field NETWR, 2 decimals' },
      },
      {
        key: '4500012077',
        source: '€ 42 000',
        target: '—',
        status: 'Missing',
        expected: true,
        fields: [
          { field: 'purchase order', source: '4500012077', target: null },
          { field: 'vendor', source: 'VEND-1044', target: null },
          { field: 'status in source', source: 'Closed 02 Oct 2026', target: null },
          { field: 'net value', source: '€ 42 000', target: null },
        ],
        reason:
          'The order was completed in the legacy system on 2 October, two days after the extract was taken and before the load ran. It was correctly left out of the target.',
        fix: 'No action. The migration rule is to load open orders only, and this one was no longer open when it loaded.',
        sourceRef: { system: 'Legacy ERP', table: 'ZEKPO_20260930.csv', note: 'row present in the extract' },
        targetRef: { system: 'SAP S/4HANA – Steel', table: 'sap.ekpo', note: 'no row, by design' },
      },
      {
        key: '4500012080',
        source: '€ 311 500',
        target: '€ 311 500',
        status: 'Match',
        fields: [
          { field: 'purchase order', source: '4500012080', target: '4500012080' },
          { field: 'vendor', source: 'VEND-1045', target: 'VEND-1045' },
          { field: 'open quantity', source: '142 500 kg', target: '142 500 kg' },
          { field: 'net value', source: '€ 311 500', target: '€ 311 500' },
        ],
        sourceRef: { system: 'Legacy ERP', table: 'ZEKPO_20260930.csv' },
        targetRef: { system: 'SAP S/4HANA – Steel', table: 'sap.ekpo' },
      },
    ],
  },
  {
    id: 'RS-02',
    name: 'Scrap yard batches against D365 stock',
    kind: 'Cross-system',
    source: 'Scrap Yard Operations',
    target: 'D365 F&O – Recycling',
    sourceRows: 1284,
    targetRows: 1284,
    sourceTotal: '38 204 160 kg',
    targetTotal: '38 118 940 kg',
    matchPct: 97.4,
    groups: [
      { reason: 'Unit sent as TON', rows: 28, explanation: 'The quantity is right but the unit says TON, so the warehouse total is understated.' },
      { reason: 'Warehouse split RAW1 / RAW2', rows: 5, explanation: 'Postings landed in RAW while the new split expects RAW1 or RAW2.' },
    ],
    liveSource: 'batches',
    sample: [],
  },
  {
    id: 'RS-03',
    name: 'Vendor master migrated to S/4',
    kind: 'Migration',
    source: 'Legacy ERP extract',
    target: 'SAP S/4HANA – Steel',
    sourceRows: 912,
    targetRows: 912,
    sourceTotal: '912 vendors',
    targetTotal: '912 vendors',
    matchPct: 100,
    groups: [],
    sample: [
      {
        key: 'VEND-1042',
        source: 'Active',
        target: 'Active',
        status: 'Match',
        fields: [
          { field: 'vendor', source: 'VEND-1042', target: 'VEND-1042' },
          { field: 'status', source: 'Active', target: 'Active' },
          { field: 'payment terms', source: '30 days net', target: '30 days net' },
          { field: 'bank account', source: 'masked', target: 'masked' },
        ],
        sourceRef: { system: 'Legacy ERP', table: 'ZLFA1_20260930.csv' },
        targetRef: { system: 'SAP S/4HANA – Steel', table: 'sap.lfa1' },
      },
      {
        key: 'VEND-1043',
        source: 'Active',
        target: 'Active',
        status: 'Match',
        fields: [
          { field: 'vendor', source: 'VEND-1043', target: 'VEND-1043' },
          { field: 'status', source: 'Active', target: 'Active' },
          { field: 'payment terms', source: '45 days net', target: '45 days net' },
          { field: 'bank account', source: 'masked', target: 'masked' },
        ],
        sourceRef: { system: 'Legacy ERP', table: 'ZLFA1_20260930.csv' },
        targetRef: { system: 'SAP S/4HANA – Steel', table: 'sap.lfa1' },
      },
    ],
  },
  {
    id: 'RS-04',
    name: 'Open invoices against Reval payments',
    kind: 'Cross-system',
    source: 'SAP S/4HANA – Steel',
    target: 'Reval',
    sourceRows: 642,
    targetRows: 630,
    sourceTotal: '€ 7 480 200',
    targetTotal: '€ 7 402 650',
    matchPct: 98.1,
    groups: [
      { reason: 'Parked invoices not yet paid', rows: 12, explanation: 'Correct behaviour: parked invoices are excluded from the payment file.' },
    ],
    liveSource: 'invoices',
    sample: [],
  },
]

export interface SodRule {
  id: string
  name: string
  roleA: string
  roleB: string
  risk: 'High' | 'Medium' | 'Low'
  why: string
}

export const SOD_RULES: SodRule[] = [
  { id: 'SOD-01', name: 'Create and approve a purchase order', roleA: 'Buyer', roleB: 'PO Approver', risk: 'High', why: 'One person could order from a supplier of their choosing without a second pair of eyes.' },
  { id: 'SOD-02', name: 'Post a goods receipt and post the invoice', roleA: 'Gate operator', roleB: 'Accounts payable', risk: 'High', why: 'One person could confirm goods that never arrived and pay for them.' },
  { id: 'SOD-03', name: 'Maintain the vendor master and run payments', roleA: 'Vendor master', roleB: 'Treasury', risk: 'High', why: 'One person could change bank details and then pay to them.' },
  { id: 'SOD-04', name: 'Change the weighbridge tare and release a ticket', roleA: 'Yard admin', roleB: 'Gate operator', risk: 'Medium', why: 'One person could change a tare weight to influence the net weight booked.' },
  { id: 'SOD-05', name: 'Release a laboratory result and sort batches', roleA: 'Lab technician', roleB: 'Yard operator', risk: 'Medium', why: 'A grade could be declared without an independent analysis.' },
]

export interface SodConflict {
  user: string
  role: string
  rule: string
  status: 'Open' | 'Accepted' | 'Proven'
  proof?: string
}

export const SOD_CONFLICTS: SodConflict[] = [
  { user: 'Key User 04', role: 'Buyer + PO Approver', rule: 'SOD-01', status: 'Open' },
  { user: 'Key User 11', role: 'Gate operator + Accounts payable', rule: 'SOD-02', status: 'Proven', proof: 'F-014' },
  { user: 'Key User 07', role: 'Vendor master + Treasury', rule: 'SOD-03', status: 'Open' },
  { user: 'Key User 02', role: 'Yard admin + Gate operator', rule: 'SOD-04', status: 'Accepted' },
  { user: 'Key User 19', role: 'Lab technician + Yard operator', rule: 'SOD-05', status: 'Open' },
]

export interface DiscoverySession {
  id: string
  name: string
  role: string
  system: string
  steps: number
  minutes: number
  recorded: string
  site: string
  /** Who asked for the recording and why it was taken. */
  why: string
  /** What watching the work showed that the written procedure does not say. */
  found: string
  /** The workflow stages this recording is evidence for. */
  stageIds: string[]
}

export const DISCOVERY_SESSIONS: DiscoverySession[] = [
  {
    id: 'DS-01',
    name: 'Gate pass to release',
    role: 'Gate operator',
    system: 'Yard Management',
    steps: 24,
    minutes: 9,
    recorded: '09 Oct 2026',
    site: 'PL01',
    why: 'Asked for by the key user. The weighbridge creates every weight in the chain, so an error here reaches the supplier invoice and the month-end stock value.',
    found: 'The net weight is always read from the scale, never typed. But a vehicle can be re-weighed on request with no record of why.',
    stageIds: ['P1-S1'],
  },
  {
    id: 'DS-02',
    name: 'Invoice capture and send',
    role: 'Accounts payable',
    system: 'Esker',
    steps: 18,
    minutes: 7,
    recorded: '09 Oct 2026',
    site: 'PL01',
    why: 'Finance reported that too many invoices park. This recording was taken to see what capture actually does with the purchase order field.',
    found: 'When the scan is unclear the purchase order field is left empty and the invoice is sent anyway, which is exactly what parks it later.',
    stageIds: ['P1-S3'],
  },
  {
    id: 'DS-03',
    name: 'Three-way match and park handling',
    role: 'Accounts payable',
    system: 'SAP S/4HANA – Steel',
    steps: 31,
    minutes: 14,
    recorded: '10 Oct 2026',
    site: 'PL01',
    why: 'To measure what one parked invoice really costs, end to end, including the phone call to the yard.',
    found: 'Handling one park takes about 28 minutes and always pulls in a second person at the weighbridge. This loop is in no procedure.',
    stageIds: ['P1-S4'],
  },
  {
    id: 'DS-04',
    name: 'Sortation and batch labelling',
    role: 'Yard operator',
    system: 'Scrap Yard Operations',
    steps: 22,
    minutes: 11,
    recorded: '10 Oct 2026',
    site: 'YD02',
    why: 'Stock in D365 did not match the yard. The recording follows one receipt being turned into batches.',
    found: 'Batches are weighed one by one and the last takes the remainder, so the weights always add up in the yard, whatever D365 later shows.',
    stageIds: ['P2-S2'],
  },
  {
    id: 'DS-05',
    name: 'Sample release',
    role: 'Lab technician',
    system: 'Laboratory app',
    steps: 12,
    minutes: 5,
    recorded: '11 Oct 2026',
    site: 'YD02',
    why: 'Batches were being held before the mill. The recording follows one sample from the barcode to release.',
    found: 'A result can be released with molybdenum blank, and nothing on the screen stops it.',
    stageIds: ['P2-S3'],
  },
  {
    id: 'DS-06',
    name: 'Heat confirmation review',
    role: 'Production',
    system: 'Mill Execution System',
    steps: 16,
    minutes: 6,
    recorded: '11 Oct 2026',
    site: 'PL01',
    why: 'The shift report understated output. The recording shows how production checks that the ERP received a heat.',
    found: 'Operators open the ERP by hand to confirm, because the file is often late. That manual check is the real control.',
    stageIds: ['P4-S3'],
  },
]

export const TREND_30_DAYS = [
  62, 64, 63, 66, 68, 67, 70, 71, 69, 72, 74, 73, 75, 74, 76, 78, 77, 75, 73, 74,
  76, 78, 79, 77, 76, 78, 80, 79, 77, 79,
].map((v, i) => ({ day: `${i + 1}`, score: v }))
