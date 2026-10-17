export type SystemId =
  | 'Yard Management'
  | 'SAP Steel'
  | 'Esker'
  | 'Lasernet'
  | 'Scrap Yard'
  | 'Laboratory'
  | 'D365'
  | 'Mill'
  | 'Reval'
  | 'VAT Service'
  | 'Sanctions Service'
  | 'eBanking'
  | 'FX Service'

export type FaultId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8' | 'F9' | 'F10'

export type MessageStatus = 'in flight' | 'delivered' | 'lost' | 'duplicate'

export interface Message {
  id: string
  interfaceId: string
  from: SystemId
  to: SystemId
  key: string
  summary: string
  payload: Record<string, unknown>
  sentAt: number
  arriveAt: number
  status: MessageStatus
  fault?: FaultId
}

export interface EventLine {
  id: number
  at: number
  text: string
  key: string
  tone: 'neutral' | 'danger' | 'success' | 'warning'
}

/* ------------------------------- records -------------------------------- */

export interface GatePass {
  gate_pass: string
  site: string
  vehicle: string
  transport: 'Truck' | 'Wagon' | 'Container'
  vendor: string
  po: string
  process: 'P1' | 'P2'
  arrived: number
}

export interface WeighbridgeTicket {
  ticket: string
  gate_pass: string
  vehicle: string
  /** The weights are held in `unit`: kilograms for steel, tonnes for recycling. */
  gross_kg: number
  tare_kg: number
  net_kg: number
  registered_tare_kg: number
  unit: 'kg' | 't'
  weighed: number
}

export interface Ekpo {
  ebeln: string
  vendor: string
  material: string
  price_eur_t: number
  open_qty_kg: number
}

export interface Mseg {
  mblnr: string
  xblnr: string
  ebeln: string
  menge: number
  meins: string
  posted: number
}

export interface Rbkp {
  belnr: string
  ext_invoice: string
  gate_pass: string
  ebeln: string
  qty_kg: number
  amount_eur: number
  status: 'Posted' | 'Parked'
  reason: string
  /** Most suppliers invoice in euro; a few do not. */
  currency: string
  /** The rate the booking actually used, or null for a euro invoice. */
  fx_rate_used: number | null
  posted: number
}

export interface Afru {
  rueck: string
  heat: string
  coils: number
  weight_kg: number
  delay_min: number
  received: number
}

export interface CapturedInvoice {
  doc: string
  ext_invoice: string
  gate_pass: string
  po: string
  qty_kg: number
  amount_eur: number
  captured: number
}

export interface OutputDocument {
  doc: string
  type: string
  ref: string
  created: number
}

export interface Receipt {
  receipt: string
  gate_pass: string
  vehicle: string
  site: string
  weight_kg: number
  received: number
}

export interface ScrapBatch {
  batch: string
  receipt: string
  grade: string
  weight_kg: number
  created: number
}

export interface Chemistry {
  sample: string
  batch: string
  ni_pct: number | null
  cr_pct: number | null
  mo_pct: number | null
  tested: number
}

export interface LabResult {
  sample: string
  batch: string
  grade: string
  status: string
  tested: number
}

export interface StockPosting {
  journal: string
  batch: string
  item: string
  qty: number
  unit: string
  warehouse: string
  posted: number
}

/** D365 raises one quality order per tested batch, against the grade window. */
export interface QualityOrder {
  order: string
  batch: string
  grade: string
  ni_pct: number | null
  cr_pct: number | null
  mo_pct: number | null
  result: 'Pass' | 'Fail' | 'Incomplete'
  created: number
}

/** A batch moved between the two recycling yards. */
export interface Transfer {
  transfer: string
  batch: string
  from_site: string
  to_site: string
  weight_kg: number
  /** What D365 actually booked on arrival, or null while it is still moving. */
  received_kg: number | null
  unit: string
  sent: number
  received: number | null
}

export interface Heat {
  heat: string
  coils: number
  weight_kg: number
  started: number
}

export interface Issue {
  issue: string
  batch: string
  qty_kg: number
  unit: string
  issued: number
}

export interface Payment {
  pay: string
  belnr: string
  vendor: string
  amount_eur: number
  run_at: number
}

/** SAP asks the VAT validation service before it books a supplier invoice. */
export interface VatCheck {
  check: string
  belnr: string
  vendor: string
  vat_number: string
  valid: boolean
  checked: number
}

/** And screens the vendor against the sanctions list of the day. */
export interface SanctionsScreen {
  screen: string
  belnr: string
  vendor: string
  /** The day the list it used was published, as a sim day index. */
  list_day: number
  list_date: string
  hit: boolean
  screened: number
}

/** The acknowledgement the bank sends back for each payment run. */
export interface BankAck {
  ack: string
  pay_run: string
  invoices: number
  amount_eur: number
  status: string
  acked: number
}

/** One rate per currency pair per day, loaded at 06:00. */
export interface FxRate {
  day: number
  date: string
  pair: string
  rate: number
  loaded: number
}

export interface Db {
  gate_pass: GatePass[]
  weighbridge_ticket: WeighbridgeTicket[]
  EKPO: Ekpo[]
  MSEG: Mseg[]
  RBKP: Rbkp[]
  AFRU: Afru[]
  captured_invoice: CapturedInvoice[]
  output_document: OutputDocument[]
  receipt: Receipt[]
  scrap_batch: ScrapBatch[]
  chemistry: Chemistry[]
  lab_result: LabResult[]
  stock_posting: StockPosting[]
  issue: Issue[]
  quality_order: QualityOrder[]
  transfer: Transfer[]
  heat: Heat[]
  payment: Payment[]
  vat_check: VatCheck[]
  sanctions_screen: SanctionsScreen[]
  bank_ack: BankAck[]
  fx_rate: FxRate[]
}

export type TableName = keyof Db

export const SYSTEM_TABLES: Record<SystemId, TableName[]> = {
  'Yard Management': ['gate_pass', 'weighbridge_ticket'],
  'SAP Steel': ['EKPO', 'MSEG', 'RBKP', 'AFRU'],
  Esker: ['captured_invoice'],
  Lasernet: ['output_document'],
  'Scrap Yard': ['receipt', 'scrap_batch', 'chemistry', 'transfer'],
  Laboratory: ['lab_result'],
  D365: ['stock_posting', 'issue', 'quality_order'],
  Mill: ['heat'],
  Reval: ['payment'],
  'VAT Service': ['vat_check'],
  'Sanctions Service': ['sanctions_screen'],
  eBanking: ['bank_ack'],
  'FX Service': ['fx_rate'],
}

export const SYSTEM_ORDER: SystemId[] = [
  'Yard Management',
  'Mill',
  'Scrap Yard',
  'Laboratory',
  'SAP Steel',
  'D365',
  'Esker',
  'Lasernet',
  'Reval',
  'VAT Service',
  'Sanctions Service',
  'eBanking',
  'FX Service',
]
