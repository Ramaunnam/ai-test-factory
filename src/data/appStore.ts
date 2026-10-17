import { useSyncExternalStore } from 'react'
import { HEALING, SCENARIOS, SYSTEMS, type Scenario } from './index'
import { SEED_RECORDINGS, type Recording, type RecordingStatus } from './recordings'

export interface Finding {
  id: string
  title: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  status: 'Open' | 'In progress' | 'Closed'
  process: string
  stage: string
  system: string
  interfaceId?: string
  check?: string
  raised: string
  raisedBy: string
  detail: string
  evidence: string[]
  affectedKeys: string[]
}

export interface ApprovalItem {
  id: string
  kind: 'Scenario' | 'Self-healing' | 'Test data' | 'Release'
  title: string
  detail: string
  requested: string
  status: 'Pending' | 'Approved' | 'Rejected'
  comment?: string
  route: string
}

export interface Connection {
  id: string
  name: string
  type: string
  method: string
  endpoint: string
  account: string
  status: 'Connected' | 'Pending' | 'Degraded'
  responseMs: number
  lastSync: string
  sources: string[]
}

export interface RunRecord {
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
  live?: boolean
}

interface State {
  findings: Finding[]
  recordings: Recording[]
  recordedScenarios: Scenario[]
  approvals: ApprovalItem[]
  connections: Connection[]
  scenarioStatus: Record<string, 'Approved' | 'Pending approval' | 'Rejected'>
  healingStatus: Record<string, 'Pending' | 'Approved' | 'Rejected'>
  runs: RunRecord[]
  evidencePacks: { id: string; runId: string; created: string; hash: string; signedBy: string; items: number; locked: boolean }[]
}

const SEED_FINDINGS: Finding[] = [
  {
    id: 'F-001',
    title: 'Three trucks booked with the wrong weight in SAP',
    severity: 'Critical',
    status: 'Open',
    process: 'P1',
    stage: 'Goods receipt',
    system: 'SAP S/4HANA – Steel',
    interfaceId: 'IF-01',
    check: 'C1',
    raised: '14 Oct 2026 05:52',
    raisedBy: 'Execution agent',
    detail:
      'The weighbridge net weight and the SAP goods receipt quantity disagree by more than 20 kg. Two of the three are a kilogram / tonne mix-up, where 21.92 was sent as KG instead of 21 920 kg.',
    evidence: ['Run RUN-1042 step 5', 'Live check C1', 'Payload of message on IF-01'],
    affectedKeys: [],
  },
  { id: 'F-002', title: 'Duplicate goods receipt created by a gateway retry', severity: 'High', status: 'Open', process: 'P1', stage: 'Goods receipt', system: 'SAP S/4HANA – Steel', interfaceId: 'IF-01', check: 'C2', raised: '14 Oct 2026 05:52', raisedBy: 'Interface Watch agent', detail: 'The gateway retried a delivery that had already succeeded, so SAP holds two goods receipts for one truck and the stock is counted twice.', evidence: ['Live check C2', 'Message log IF-01'], affectedKeys: [] },
  { id: 'F-003', title: 'Recycling receipts never reach the scrap yard', severity: 'High', status: 'Open', process: 'P2', stage: 'Gate receipt', system: 'Scrap Yard Operations', interfaceId: 'IF-02', check: 'C3', raised: '14 Oct 2026 05:53', raisedBy: 'Interface Watch agent', detail: 'A share of IF-02 messages is lost. The load is weighed at the gate but never exists in Scrap Yard Operations.', evidence: ['Live check C3'], affectedKeys: [] },
  { id: 'F-004', title: 'Molybdenum missing from chemistry results', severity: 'High', status: 'Open', process: 'P2', stage: 'Chemistry check', system: 'Scrap Yard Operations', interfaceId: 'IF-14', check: 'C5', raised: '14 Oct 2026 05:53', raisedBy: 'Interface Watch agent', detail: 'The laboratory renamed mo_pct to molybdenum_pct. The receiving system stores an empty value, so batches cannot be certified.', evidence: ['Live check C5', 'Change CH-205'], affectedKeys: [] },
  { id: 'F-005', title: 'Stock posted to D365 with unit TON', severity: 'Medium', status: 'Open', process: 'P2', stage: 'Stock posting', system: 'D365 F&O – Recycling', interfaceId: 'IF-03', check: 'C6', raised: '14 Oct 2026 05:54', raisedBy: 'Reconciliation agent', detail: 'The quantity is in kilograms but the unit field says TON, so the warehouse total is understated by three orders of magnitude.', evidence: ['Live check C6', 'Reconciliation set RS-02'], affectedKeys: [] },
  { id: 'F-006', title: 'Supplier invoices parked without a purchase order', severity: 'Medium', status: 'Open', process: 'P1', stage: 'Invoice posting', system: 'SAP S/4HANA – Steel', interfaceId: 'IF-06', check: 'C7', raised: '14 Oct 2026 05:54', raisedBy: 'Execution agent', detail: 'Esker captures occasionally carry no purchase order reference, so the three-way match parks the invoice and the supplier is paid late.', evidence: ['Live check C7'], affectedKeys: [] },
  { id: 'F-007', title: 'Mill confirmations arrive late', severity: 'Medium', status: 'Open', process: 'P4', stage: 'Confirmation', system: 'SAP S/4HANA – Steel', interfaceId: 'IF-04', check: 'C9', raised: '14 Oct 2026 05:55', raisedBy: 'Interface Watch agent', detail: 'Confirmations take 25 to 45 minutes against a 15 minute target, so the shift report understates output.', evidence: ['Live check C9', 'Change CH-209'], affectedKeys: [] },
  { id: 'F-008', title: 'Interface backlog is not zero at the cut-off', severity: 'High', status: 'Open', process: 'P6', stage: 'Interface drain', system: 'All', raised: '13 Oct 2026 22:10', raisedBy: 'Load agent', detail: 'At the 5x month-end profile, two invoices remain in flight when the posting period closes.', evidence: ['Month-End Load run at 5x'], affectedKeys: [] },
  { id: 'F-009', title: 'Buyer can create and approve the same purchase order', severity: 'Critical', status: 'Open', process: 'P3', stage: 'Purchase order', system: 'SAP S/4HANA – Steel', raised: '12 Oct 2026 11:04', raisedBy: 'Access agent', detail: 'Key User 04 holds both the Buyer and the PO Approver role, and the forbidden action completed successfully when proven.', evidence: ['SoD rule SOD-01', 'Proof run on 12 Oct'], affectedKeys: [] },
  { id: 'F-010', title: 'Stock ledger and physical stock differ by 85 t', severity: 'High', status: 'In progress', process: 'P6', stage: 'Reconciliation', system: 'D365 F&O – Recycling', raised: '12 Oct 2026 08:30', raisedBy: 'Reconciliation agent', detail: 'The difference is explained by 28 postings with unit TON and 5 postings in the old RAW warehouse.', evidence: ['Reconciliation set RS-02'], affectedKeys: [] },
  { id: 'F-011', title: 'Esker capture layout change breaks the purchase order field', severity: 'Medium', status: 'Closed', process: 'P1', stage: 'Invoice capture', system: 'Esker', raised: '11 Oct 2026 14:22', raisedBy: 'Self-Healing agent', detail: 'The selector was repaired automatically with 96 % confidence and approved by the key user.', evidence: ['Healing event HE-02'], affectedKeys: [] },
  { id: 'F-012', title: 'Credit block not applied on one customer group', severity: 'Medium', status: 'Open', process: 'P5', stage: 'Order entry', system: 'SAP S/4HANA – Service Centre', raised: '11 Oct 2026 09:40', raisedBy: 'Execution agent', detail: 'Orders for customer group 40 are accepted above the credit limit.', evidence: ['Run RUN-1038 step 3'], affectedKeys: [] },
  { id: 'F-013', title: 'Delivery note missing for two dispatches', severity: 'Low', status: 'Closed', process: 'P4', stage: 'Dispatch', system: 'Lasernet', raised: '10 Oct 2026 16:05', raisedBy: 'Evidence agent', detail: 'Two dispatches produced no delivery note because the output queue was paused during maintenance.', evidence: ['Run RUN-1037'], affectedKeys: [] },
  { id: 'F-014', title: 'Goods receipt and invoice posting by the same user', severity: 'Critical', status: 'Open', process: 'P3', stage: 'Invoice', system: 'SAP S/4HANA – Steel', raised: '10 Oct 2026 10:12', raisedBy: 'Access agent', detail: 'Key User 11 posted both the goods receipt and the invoice for the same purchase order. The proof run shows the action was allowed.', evidence: ['SoD rule SOD-02', 'Proof run on 10 Oct'], affectedKeys: [] },
  { id: 'F-015', title: 'Month-end pack missing the reconciliation section', severity: 'Low', status: 'Closed', process: 'P6', stage: 'Reporting', system: 'Lasernet', raised: '09 Oct 2026 18:00', raisedBy: 'Evidence agent', detail: 'The reconciliation section was not included in the September pack and has since been added to the template.', evidence: ['Evidence pack EP-0903'], affectedKeys: [] },
  { id: 'F-016', title: 'Open purchase orders differ by 8 rows after migration', severity: 'Low', status: 'In progress', process: 'P6', stage: 'Reconciliation', system: 'SAP S/4HANA – Steel', raised: '09 Oct 2026 12:30', raisedBy: 'Reconciliation agent', detail: 'Six orders closed after the extract and two differ by rounding. Both groups are explained and accepted.', evidence: ['Reconciliation set RS-01'], affectedKeys: [] },
]

const SEED_APPROVALS: ApprovalItem[] = [
  { id: 'AP-01', kind: 'Scenario', title: 'SC-031 Negative: weighbridge sends an empty unit', detail: 'Generated by the Scenario Writer agent from live check C1.', requested: '14 Oct 2026 06:02', status: 'Pending', route: '/studio' },
  { id: 'AP-02', kind: 'Self-healing', title: 'HE-01 chemistry.molybdenum_pct mapping', detail: 'Self-healing repaired SC-011 with 96 % confidence.', requested: '14 Oct 2026 05:46', status: 'Pending', route: '/self-healing' },
  { id: 'AP-03', kind: 'Self-healing', title: 'HE-02 Esker purchase order selector', detail: 'Self-healing repaired SC-002 with 94 % confidence.', requested: '14 Oct 2026 05:47', status: 'Pending', route: '/self-healing' },
  { id: 'AP-04', kind: 'Test data', title: '40 linked scrap batches with chemistry', detail: 'Generated for the P2 regression pack. No real personal data.', requested: '13 Oct 2026 16:20', status: 'Pending', route: '/test-data' },
  { id: 'AP-05', kind: 'Release', title: 'Release R-2026.10 gate decision', detail: 'Two changes are marked not safe before the close.', requested: '13 Oct 2026 09:00', status: 'Pending', route: '/release' },
]

function seedConnections(): Connection[] {
  return SYSTEMS.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    method: s.method,
    endpoint: s.endpoint,
    account: s.account,
    status: s.responseMs > 250 ? 'Degraded' : 'Connected',
    responseMs: s.responseMs,
    lastSync: s.lastSync,
    sources: s.sources,
  }))
}

class AppStore {
  state: State = {
    findings: SEED_FINDINGS,
    recordings: SEED_RECORDINGS,
    recordedScenarios: [],
    approvals: SEED_APPROVALS,
    connections: seedConnections(),
    scenarioStatus: Object.fromEntries(SCENARIOS.map((s) => [s.id, 'Approved' as const])),
    healingStatus: Object.fromEntries(HEALING.map((h) => [h.id, h.status])),
    runs: [],
    evidencePacks: [
      { id: 'EP-1042', runId: 'RUN-1042', created: '14 Oct 2026 05:58', hash: 'a71f·9c20·4db8·11ef', signedBy: 'Key User', items: 30, locked: true },
      { id: 'EP-1041', runId: 'RUN-1041', created: '13 Oct 2026 05:57', hash: 'c42a·77b1·9f03·22ad', signedBy: 'Key User', items: 30, locked: true },
      { id: 'EP-1038', runId: 'RUN-1038', created: '11 Oct 2026 09:17', hash: '18de·3a44·b7c9·51f0', signedBy: 'QA Lead', items: 8, locked: true },
    ],
  }

  private listeners = new Set<() => void>()
  private version = 0

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getVersion = () => this.version

  private commit(mutate: (s: State) => void) {
    mutate(this.state)
    this.version += 1
    this.listeners.forEach((l) => l())
  }

  nextFindingId() {
    const n = this.state.findings.length + 1
    return `F-${String(n).padStart(3, '0')}`
  }

  addFinding(input: Omit<Finding, 'id'>) {
    const id = this.nextFindingId()
    this.commit((s) => {
      s.findings = [{ ...input, id }, ...s.findings]
    })
    return id
  }

  setFindingStatus(id: string, status: Finding['status']) {
    this.commit((s) => {
      s.findings = s.findings.map((f) => (f.id === id ? { ...f, status } : f))
    })
  }

  decideApproval(id: string, status: 'Approved' | 'Rejected', comment?: string) {
    this.commit((s) => {
      s.approvals = s.approvals.map((a) => (a.id === id ? { ...a, status, comment } : a))
    })
  }

  addApproval(item: Omit<ApprovalItem, 'id' | 'status'>) {
    const id = `AP-${String(this.state.approvals.length + 1).padStart(2, '0')}`
    this.commit((s) => {
      s.approvals = [{ ...item, id, status: 'Pending' }, ...s.approvals]
    })
    return id
  }

  addRecording(recording: Recording) {
    this.commit((s) => {
      s.recordings = [recording, ...s.recordings]
    })
  }

  setRecordingStatus(id: string, status: RecordingStatus, scenarioId?: string) {
    this.commit((s) => {
      s.recordings = s.recordings.map((r) => (r.id === id ? { ...r, status, scenarioId: scenarioId ?? r.scenarioId } : r))
    })
  }

  /** A scenario the AI wrote from a recording, so it shows up in Scenarios. */
  addRecordedScenario(scenario: Scenario) {
    if (this.state.recordedScenarios.some((s) => s.id === scenario.id)) return
    this.commit((s) => {
      s.recordedScenarios = [scenario, ...s.recordedScenarios]
      s.scenarioStatus = { ...s.scenarioStatus, [scenario.id]: 'Pending approval' }
    })
  }

  setScenarioStatus(id: string, status: 'Approved' | 'Pending approval' | 'Rejected') {
    this.commit((s) => {
      s.scenarioStatus = { ...s.scenarioStatus, [id]: status }
    })
  }

  setHealingStatus(id: string, status: 'Pending' | 'Approved' | 'Rejected') {
    this.commit((s) => {
      s.healingStatus = { ...s.healingStatus, [id]: status }
    })
  }

  addRun(run: RunRecord) {
    this.commit((s) => {
      s.runs = [run, ...s.runs]
    })
  }

  addEvidencePack(runId: string, items: number) {
    const id = `EP-${runId.replace('RUN-', '')}`
    if (this.state.evidencePacks.some((p) => p.id === id)) return id
    const hash = Array.from({ length: 4 }, (_, i) =>
      ((runId.length * 7919 + i * 104729 + items * 31) % 65536).toString(16).padStart(4, '0'),
    ).join('·')
    this.commit((s) => {
      s.evidencePacks = [
        { id, runId, created: new Date().toLocaleString('en-GB'), hash, signedBy: 'Key User', items, locked: true },
        ...s.evidencePacks,
      ]
    })
    return id
  }

  addConnection(input: Omit<Connection, 'status' | 'responseMs' | 'lastSync' | 'sources'>) {
    this.commit((s) => {
      s.connections = [
        ...s.connections,
        { ...input, status: 'Pending', responseMs: 0, lastSync: 'never', sources: [] },
      ]
    })
  }

  setConnectionStatus(id: string, status: Connection['status'], responseMs?: number) {
    this.commit((s) => {
      s.connections = s.connections.map((c) =>
        c.id === id ? { ...c, status, responseMs: responseMs ?? c.responseMs, lastSync: 'just now' } : c,
      )
    })
  }
}

export const store = new AppStore()

export function useStore(): State {
  useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion)
  return store.state
}
