import type { TableName } from '@/sim/types'

/**
 * The business objects the landscape actually keeps, written down once: what
 * each one is, what one row of it means, where it comes from and what it is
 * connected to. "To confirm" marks the places where the mapping still needs a
 * key user to agree it.
 */
export type ObjStatus = 'Confirmed' | 'To confirm' | 'Proposed'

export type ObjBand = 'Yard & gate' | 'Purchasing & finance' | 'Recycling & quality' | 'Pegase'

export type FieldType = 'string' | 'number' | 'date' | 'enum'

export interface ObjProperty {
  name: string
  /** PK, FK or nothing. */
  key?: 'PK' | 'FK'
  /** One plain line: what this field means to the business. */
  means: string
  /** Where the value arrives from. */
  from: string
  type: FieldType
  status: ObjStatus
  /** The rule that fills this field in, when one does. */
  computedBy?: string
}

export interface ObjSource {
  system: string
  /** Where the value is first written, in our own terms. */
  layer: 'Source' | 'Derived' | 'Master data'
  /** The simulated table, when the object has one of its own. */
  table?: TableName
  /** What carries it between systems. */
  interfaceId?: string
  refresh: string
  /** The live checks that guard it. */
  checks: string[]
  status: ObjStatus
}

export interface BusinessObject {
  id: string
  name: string
  /** A short lucide icon name, resolved on the page. */
  icon: string
  band: ObjBand
  /** What one row means. */
  grain: string
  /** One plain sentence. */
  what: string
  technicalId: string
  primaryKey: string
  status: ObjStatus
  /** Where the centre of the card sits on the model overview, in per cent of the canvas. */
  pos: { x: number; y: number }
  /** What a person can do to it. */
  actions: string[]
  /** The rules that compute parts of it. */
  functions: string[]
  properties: ObjProperty[]
  source: ObjSource
}

export interface ObjLink {
  from: string
  to: string
  label: string
  /** Read as from → to. */
  cardinality: string
  /** Where the name chip sits along the line, 0–1. Defaults to the middle. */
  at?: number
}

const C = 'Confirmed' as const
const T = 'To confirm' as const
const P = 'Proposed' as const

export const BUSINESS_OBJECTS: BusinessObject[] = [
  {
    id: 'vehicle',
    name: 'Vehicle',
    icon: 'Truck',
    band: 'Yard & gate',
    grain: 'one per lorry, wagon or container',
    what: 'The transport that brings a load onto the site.',
    technicalId: 'yard.vehicle_master',
    primaryKey: 'vehicle',
    status: T,
    pos: { x: 36, y: 10.1 },
    actions: ['Register vehicle', 'Re-weigh empty'],
    functions: ['Tare drift against the last weighings'],
    properties: [
      { name: 'vehicle', key: 'PK', means: 'The registration or wagon number.', from: '← YardLink', type: 'string', status: C },
      { name: 'transport', means: 'Truck, wagon or container.', from: '← YardLink gate_pass.transport', type: 'enum', status: C },
      { name: 'registered_tare_kg', means: 'The empty weight held on the vehicle record.', from: '← YardLink weighbridge_ticket.registered_tare_kg', type: 'number', status: T },
    ],
    source: {
      system: 'YardLink',
      layer: 'Master data',
      refresh: 'maintained by the yard team',
      checks: ['C1'],
      status: T,
    },
  },
  {
    id: 'gate-pass',
    name: 'Gate pass',
    icon: 'Ticket',
    band: 'Yard & gate',
    grain: 'one per truck visit',
    what: 'The permission a transport needs before it may enter the site.',
    technicalId: 'yard.gate_pass',
    primaryKey: 'gate_pass',
    status: C,
    pos: { x: 34.4, y: 36.7 },
    actions: ['Create gate pass', 'Release vehicle'],
    functions: [],
    properties: [
      { name: 'gate_pass', key: 'PK', means: 'The number the whole visit is followed by.', from: '← YardLink', type: 'string', status: C },
      { name: 'site', means: 'Which plant or yard it arrived at.', from: '← YardLink', type: 'enum', status: C },
      { name: 'vehicle', key: 'FK', means: 'The transport that arrived.', from: '← Vehicle', type: 'string', status: C },
      { name: 'vendor', key: 'FK', means: 'Who the load is from.', from: '← Vendor', type: 'string', status: C },
      { name: 'po', key: 'FK', means: 'The purchase order it is delivered against.', from: '← Purchase order', type: 'string', status: C },
      { name: 'process', means: 'Steel delivery or recycling load.', from: '← YardLink', type: 'enum', status: C },
      { name: 'arrived', means: 'When it came through the gate.', from: '← YardLink', type: 'date', status: C },
    ],
    source: {
      system: 'YardLink',
      layer: 'Source',
      table: 'gate_pass',
      refresh: 'event-driven, on arrival',
      checks: ['C2', 'C3'],
      status: C,
    },
  },
  {
    id: 'weighbridge-ticket',
    name: 'Weighbridge ticket',
    icon: 'Scale',
    band: 'Yard & gate',
    grain: 'one per weighing',
    what: 'What the weighbridge measured, full and empty, and the load that is the difference.',
    technicalId: 'yard.weighbridge_ticket',
    primaryKey: 'ticket',
    status: C,
    pos: { x: 59.7, y: 42 },
    actions: ['Confirm full weight', 'Confirm empty weight'],
    functions: ['Load = full − empty'],
    properties: [
      { name: 'ticket', key: 'PK', means: 'The weighing number.', from: '← YardLink', type: 'string', status: C },
      { name: 'gate_pass', key: 'FK', means: 'The visit it belongs to.', from: '← Gate pass', type: 'string', status: C },
      { name: 'gross_kg', means: 'Weight of the transport full.', from: '← YardLink weighbridge_ticket.gross_kg', type: 'number', status: C },
      { name: 'tare_kg', means: 'Weight of the transport empty, as just weighed.', from: '← YardLink weighbridge_ticket.tare_kg', type: 'number', status: C },
      { name: 'net_kg', means: 'The load: full minus empty. Never typed by hand.', from: '← YardLink weighbridge_ticket.net_kg', type: 'number', status: C, computedBy: 'Load = full − empty' },
      { name: 'registered_tare_kg', means: 'The empty weight the vehicle record holds, for comparison.', from: '← Vehicle', type: 'number', status: T },
      { name: 'unit', means: 'Kilograms for steel, tonnes for recycling.', from: '← YardLink', type: 'enum', status: C },
      { name: 'weighed', means: 'When the weighing happened.', from: '← YardLink', type: 'date', status: C },
    ],
    source: {
      system: 'YardLink',
      layer: 'Source',
      table: 'weighbridge_ticket',
      interfaceId: 'IF-01',
      refresh: 'event-driven via IF-01',
      checks: ['C1', 'C3'],
      status: C,
    },
  },
  {
    id: 'vendor',
    name: 'Vendor',
    icon: 'Building2',
    band: 'Purchasing & finance',
    grain: 'one per supplier',
    what: 'The supplier a load is bought from and an invoice is paid to.',
    technicalId: 'sap.lfa1',
    primaryKey: 'vendor',
    status: T,
    pos: { x: 21, y: 8.1 },
    actions: ['Block for payment'],
    functions: ['VAT validation', 'Sanctions screening'],
    properties: [
      { name: 'vendor', key: 'PK', means: 'The supplier number.', from: '← SAP S/4HANA Stainless EKPO.vendor', type: 'string', status: C },
      { name: 'vat_number', means: 'Checked before an invoice may be booked.', from: '← IF-15', type: 'string', status: T, computedBy: 'VAT validation' },
      { name: 'screened_against', means: 'The sanctions list the supplier was last checked on.', from: '← IF-16', type: 'date', status: C, computedBy: 'Sanctions screening' },
    ],
    source: {
      system: 'SAP S/4HANA Stainless',
      layer: 'Master data',
      interfaceId: 'IF-15',
      refresh: 'checked on every invoice',
      checks: ['C10'],
      status: T,
    },
  },
  {
    id: 'purchase-order',
    name: 'Purchase order',
    icon: 'FileText',
    band: 'Purchasing & finance',
    grain: 'one per order line',
    what: 'What was agreed with the supplier: material, quantity and price.',
    technicalId: 'sap.ekpo',
    primaryKey: 'ebeln',
    status: C,
    pos: { x: 8.1, y: 37 },
    actions: ['Approve order', 'Close order'],
    functions: [],
    properties: [
      { name: 'ebeln', key: 'PK', means: 'The order number.', from: '← SAP S/4HANA Stainless', type: 'string', status: C },
      { name: 'vendor', key: 'FK', means: 'Who it was placed with.', from: '← Vendor', type: 'string', status: C },
      { name: 'material', key: 'FK', means: 'What was ordered.', from: '← Material', type: 'string', status: C },
      { name: 'price_eur_t', means: 'Agreed price per tonne, in euro.', from: '← SAP S/4HANA Stainless EKPO.price_eur_t', type: 'number', status: C },
      { name: 'open_qty_kg', means: 'How much of the order is still to be delivered.', from: '← SAP S/4HANA Stainless EKPO.open_qty_kg', type: 'number', status: T },
    ],
    source: {
      system: 'SAP S/4HANA Stainless',
      layer: 'Source',
      table: 'EKPO',
      refresh: 'on order creation and change',
      checks: ['C7'],
      status: C,
    },
  },
  {
    id: 'goods-receipt',
    name: 'Goods receipt',
    icon: 'PackageCheck',
    band: 'Purchasing & finance',
    grain: 'one per delivery booked',
    what: 'The delivery booked in SAP, which is what the invoice is later matched against.',
    technicalId: 'sap.mseg',
    primaryKey: 'mblnr',
    status: C,
    pos: { x: 8.1, y: 63.3 },
    actions: ['Book the delivery', 'Reverse the booking'],
    functions: ['Quantity from the weighbridge'],
    properties: [
      { name: 'mblnr', key: 'PK', means: 'The material document number.', from: '← SAP S/4HANA Stainless', type: 'string', status: C },
      { name: 'xblnr', key: 'FK', means: 'The gate pass it was booked for. This is the join across the whole journey.', from: '← Gate pass', type: 'string', status: C },
      { name: 'ebeln', key: 'FK', means: 'The order it was booked against.', from: '← Purchase order', type: 'string', status: C },
      { name: 'menge', means: 'The quantity booked. It must equal the weighbridge load.', from: '← IF-01', type: 'number', status: C, computedBy: 'Quantity from the weighbridge' },
      { name: 'meins', means: 'The unit the quantity is in.', from: '← IF-01', type: 'enum', status: C },
      { name: 'posted', means: 'When SAP booked it.', from: '← SAP S/4HANA Stainless', type: 'date', status: C },
    ],
    source: {
      system: 'SAP S/4HANA Stainless',
      layer: 'Derived',
      table: 'MSEG',
      interfaceId: 'IF-01',
      refresh: 'event-driven via IF-01',
      checks: ['C1', 'C2'],
      status: C,
    },
  },
  {
    id: 'supplier-invoice',
    name: 'Supplier invoice',
    icon: 'ReceiptText',
    band: 'Purchasing & finance',
    grain: 'one per invoice',
    what: 'What the supplier billed, matched against the order and the delivery before it is booked.',
    technicalId: 'sap.rbkp',
    primaryKey: 'belnr',
    status: C,
    pos: { x: 37.6, y: 69.5 },
    actions: ['Book invoice', 'Hold invoice', 'Release from hold'],
    functions: ['Invoice check', 'Convert at the day\'s rate'],
    properties: [
      { name: 'belnr', key: 'PK', means: 'The invoice document number in SAP.', from: '← SAP S/4HANA Stainless', type: 'string', status: C },
      { name: 'ext_invoice', means: "The supplier's own invoice number.", from: '← IF-06', type: 'string', status: C },
      { name: 'gate_pass', key: 'FK', means: 'The visit it is for.', from: '← Gate pass', type: 'string', status: C },
      { name: 'ebeln', key: 'FK', means: 'The order it is matched to.', from: '← Purchase order', type: 'string', status: C },
      { name: 'qty_kg', means: 'The quantity billed.', from: '← IF-06', type: 'number', status: C },
      { name: 'amount_eur', means: 'The amount billed, held in euro.', from: '← IF-06', type: 'number', status: C },
      { name: 'status', means: 'Booked, or on hold while something is resolved.', from: '← SAP S/4HANA Stainless', type: 'enum', status: C, computedBy: 'Invoice check' },
      { name: 'reason', means: 'Why it is on hold, when it is.', from: '← SAP S/4HANA Stainless', type: 'string', status: C },
      { name: 'currency', means: 'What the supplier billed in.', from: '← IF-06', type: 'enum', status: C },
      { name: 'fx_rate_used', means: "The rate it was booked at, for anything not in euro.", from: '← IF-18', type: 'number', status: T, computedBy: 'Convert at the day\'s rate' },
    ],
    source: {
      system: 'SAP S/4HANA Stainless',
      layer: 'Derived',
      table: 'RBKP',
      interfaceId: 'IF-06',
      refresh: 'event-driven via IF-06',
      checks: ['C7', 'C8', 'C10', 'C11'],
      status: C,
    },
  },
  {
    id: 'payment',
    name: 'Payment',
    icon: 'Banknote',
    band: 'Purchasing & finance',
    grain: 'one per invoice paid',
    what: 'The money leaving for a booked invoice, in the hourly payment run.',
    technicalId: 'reval.payment',
    primaryKey: 'pay',
    status: C,
    pos: { x: 15, y: 88 },
    actions: ['Run payment', 'Stop payment'],
    functions: ['Hourly payment run'],
    properties: [
      { name: 'pay', key: 'PK', means: 'The payment number.', from: '← Reval', type: 'string', status: C },
      { name: 'belnr', key: 'FK', means: 'The invoice being paid.', from: '← Supplier invoice', type: 'string', status: C },
      { name: 'vendor', key: 'FK', means: 'Who is being paid.', from: '← Vendor', type: 'string', status: C },
      { name: 'amount_eur', means: 'The amount paid, held in euro.', from: '← IF-11', type: 'number', status: C },
      { name: 'run_at', means: 'Which payment run it went out in.', from: '← IF-11', type: 'date', status: C },
    ],
    source: {
      system: 'Reval',
      layer: 'Derived',
      table: 'payment',
      interfaceId: 'IF-11',
      refresh: 'hourly payment run',
      checks: ['C10'],
      status: C,
    },
  },
  {
    id: 'output-document',
    name: 'Output document',
    icon: 'Printer',
    band: 'Purchasing & finance',
    grain: 'one per printed document',
    what: 'The copy that is rendered and archived: an invoice copy, a self-billing document or a Pegase certificate.',
    technicalId: 'lasernet.output_document',
    primaryKey: 'doc',
    status: C,
    pos: { x: 92.2, y: 60.8 },
    actions: ['Render again'],
    functions: [],
    properties: [
      { name: 'doc', key: 'PK', means: 'The document number.', from: '← Lasernet', type: 'string', status: C },
      { name: 'type', means: 'Which kind of document it is.', from: '← Lasernet', type: 'enum', status: C },
      { name: 'ref', key: 'FK', means: 'What it was produced for: an invoice, a batch or a heat.', from: '← IF-09, IF-10, IF-13', type: 'string', status: C },
      { name: 'created', means: 'When it was rendered.', from: '← Lasernet', type: 'date', status: C },
    ],
    source: {
      system: 'Lasernet',
      layer: 'Derived',
      table: 'output_document',
      interfaceId: 'IF-09',
      refresh: 'event-driven via IF-09, IF-10 and IF-13',
      checks: ['C8'],
      status: C,
    },
  },
  {
    id: 'scrap-receipt',
    name: 'Scrap receipt',
    icon: 'Inbox',
    band: 'Recycling & quality',
    grain: 'one per recycling load received',
    what: 'A recycling load booked into the scrap yard, converted from tonnes to kilograms.',
    technicalId: 'scrap.receipt',
    primaryKey: 'receipt',
    status: C,
    pos: { x: 49.9, y: 56.2 },
    actions: ['Book the load'],
    functions: ['Tonnes to kilograms'],
    properties: [
      { name: 'receipt', key: 'PK', means: 'The receipt number.', from: '← dOps Core', type: 'string', status: C },
      { name: 'gate_pass', key: 'FK', means: 'The visit it arrived on.', from: '← Gate pass', type: 'string', status: C },
      { name: 'vehicle', key: 'FK', means: 'What brought it.', from: '← Vehicle', type: 'string', status: C },
      { name: 'site', means: 'Which yard received it.', from: '← IF-02', type: 'enum', status: C },
      { name: 'weight_kg', means: 'The load in kilograms, after the tonnes are converted.', from: '← IF-02', type: 'number', status: C, computedBy: 'Tonnes to kilograms' },
      { name: 'received', means: 'When the yard booked it.', from: '← dOps Core', type: 'date', status: C },
    ],
    source: {
      system: 'dOps Core',
      layer: 'Derived',
      table: 'receipt',
      interfaceId: 'IF-02',
      refresh: 'event-driven via IF-02',
      checks: ['C3', 'C4'],
      status: C,
    },
  },
  {
    id: 'scrap-batch',
    name: 'Scrap batch',
    icon: 'Boxes',
    band: 'Recycling & quality',
    grain: 'one per sorted batch',
    what: 'A graded parcel of scrap sorted out of a receipt. The batch weights must add back up to the load.',
    technicalId: 'scrap.scrap_batch',
    primaryKey: 'batch',
    status: C,
    pos: { x: 75, y: 55.9 },
    actions: ['Sort into batches', 'Label batch'],
    functions: ['Batch weights add back to the load'],
    properties: [
      { name: 'batch', key: 'PK', means: 'The batch number.', from: '← dOps Core', type: 'string', status: C },
      { name: 'receipt', key: 'FK', means: 'The load it was sorted from.', from: '← Scrap receipt', type: 'string', status: C },
      { name: 'grade', key: 'FK', means: 'The grade it was sorted into.', from: '← Material', type: 'string', status: C },
      { name: 'weight_kg', means: 'The weight of this batch.', from: '← dOps Core', type: 'number', status: C },
      { name: 'created', means: 'When it was sorted.', from: '← dOps Core', type: 'date', status: C },
    ],
    source: {
      system: 'dOps Core',
      layer: 'Source',
      table: 'scrap_batch',
      refresh: 'event-driven, on sortation',
      checks: ['C4', 'C5', 'C6', 'C13'],
      status: C,
    },
  },
  {
    id: 'lab-sample',
    name: 'Lab sample',
    icon: 'FlaskConical',
    band: 'Recycling & quality',
    grain: 'one per batch tested',
    what: 'The measured chemistry of a batch: nickel, chromium and molybdenum.',
    technicalId: 'lims.lab_result',
    primaryKey: 'sample',
    status: C,
    pos: { x: 50, y: 90.5 },
    actions: ['Release result', 'Take another sample'],
    functions: [],
    properties: [
      { name: 'sample', key: 'PK', means: 'The sample number.', from: '← Laboratory app', type: 'string', status: C },
      { name: 'batch', key: 'FK', means: 'The batch it was taken from.', from: '← Scrap batch', type: 'string', status: C },
      { name: 'ni_pct', means: 'Nickel measured, as a percentage.', from: '← IF-14', type: 'number', status: C },
      { name: 'cr_pct', means: 'Chromium measured, as a percentage.', from: '← IF-14', type: 'number', status: C },
      { name: 'mo_pct', means: 'Molybdenum measured. Missing it means the grade cannot be certified.', from: '← IF-14', type: 'number', status: C },
      { name: 'status', means: 'Whether the result has been released.', from: '← Laboratory app', type: 'enum', status: C },
      { name: 'tested', means: 'When it was measured.', from: '← Laboratory app', type: 'date', status: C },
    ],
    source: {
      system: 'Laboratory app',
      layer: 'Source',
      table: 'lab_result',
      interfaceId: 'IF-14',
      refresh: 'event-driven via IF-14',
      checks: ['C5', 'C13'],
      status: C,
    },
  },
  {
    id: 'quality-order',
    name: 'Quality order',
    icon: 'BadgeCheck',
    band: 'Recycling & quality',
    grain: 'one per batch judged',
    what: 'D365 F&O OneCore judging a tested batch against the window for its grade: pass, fail, or not complete.',
    technicalId: 'd365.quality_order',
    primaryKey: 'order',
    status: P,
    pos: { x: 71, y: 89.3 },
    actions: ['Confirm result', 'Override result'],
    functions: ['Grade from the chemistry'],
    properties: [
      { name: 'order', key: 'PK', means: 'The quality order number.', from: '← D365 F&O OneCore', type: 'string', status: C },
      { name: 'batch', key: 'FK', means: 'The batch being judged.', from: '← Scrap batch', type: 'string', status: C },
      { name: 'grade', key: 'FK', means: 'The grade it is judged against.', from: '← Material', type: 'string', status: C },
      { name: 'ni_pct', means: 'Nickel as measured.', from: '← Lab sample', type: 'number', status: C },
      { name: 'cr_pct', means: 'Chromium as measured.', from: '← Lab sample', type: 'number', status: C },
      { name: 'mo_pct', means: 'Molybdenum as measured.', from: '← Lab sample', type: 'number', status: C },
      { name: 'result', means: 'Pass, Fail, or Incomplete when a value never arrived.', from: '← D365 F&O OneCore', type: 'enum', status: T, computedBy: 'Grade from the chemistry' },
      { name: 'created', means: 'When the order was raised.', from: '← D365 F&O OneCore', type: 'date', status: C },
    ],
    source: {
      system: 'D365 F&O OneCore',
      layer: 'Derived',
      table: 'quality_order',
      refresh: 'event-driven, after the chemistry arrives',
      checks: ['C13'],
      status: T,
    },
  },
  {
    id: 'stock-posting',
    name: 'Stock posting',
    icon: 'Warehouse',
    band: 'Recycling & quality',
    grain: 'one per batch booked to stock',
    what: 'The batch booked into D365 F&O OneCore stock, in kilograms. Tonnes received must become kilograms held.',
    technicalId: 'd365.stock_posting',
    primaryKey: 'journal',
    status: C,
    pos: { x: 31.9, y: 89.2 },
    actions: ['Post to stock', 'Issue to the melt shop'],
    functions: ['Tonnes × 1 000'],
    properties: [
      { name: 'journal', key: 'PK', means: 'The stock journal number.', from: '← D365 F&O OneCore', type: 'string', status: C },
      { name: 'batch', key: 'FK', means: 'The batch booked.', from: '← Scrap batch', type: 'string', status: C },
      { name: 'item', key: 'FK', means: 'The material it is held as.', from: '← Material', type: 'string', status: C },
      { name: 'qty', means: 'The quantity booked into stock.', from: '← IF-03', type: 'number', status: C, computedBy: 'Tonnes × 1 000' },
      { name: 'unit', means: 'The unit of that quantity. It must be KG.', from: '← IF-03', type: 'enum', status: C },
      { name: 'warehouse', means: 'Where it is held.', from: '← IF-03', type: 'string', status: C },
      { name: 'posted', means: 'When it was booked.', from: '← D365 F&O OneCore', type: 'date', status: C },
    ],
    source: {
      system: 'D365 F&O OneCore',
      layer: 'Derived',
      table: 'stock_posting',
      interfaceId: 'IF-03',
      refresh: 'event-driven via IF-03',
      checks: ['C6', 'C6b', 'C8'],
      status: C,
    },
  },
  {
    id: 'yard-transfer',
    name: 'Yard transfer',
    icon: 'ArrowLeftRight',
    band: 'Recycling & quality',
    grain: 'one per batch moved between yards',
    what: 'A batch moved from one recycling yard to the other. It must arrive with the weight it left with.',
    technicalId: 'scrap.transfer',
    primaryKey: 'transfer',
    status: P,
    pos: { x: 91.9, y: 89.3 },
    actions: ['Send the transfer', 'Book the arrival'],
    functions: [],
    properties: [
      { name: 'transfer', key: 'PK', means: 'The transfer number.', from: '← dOps Core', type: 'string', status: C },
      { name: 'batch', key: 'FK', means: 'The batch being moved.', from: '← Scrap batch', type: 'string', status: C },
      { name: 'from_site', means: 'The yard it left.', from: '← dOps Core', type: 'enum', status: C },
      { name: 'to_site', means: 'The yard it is going to.', from: '← dOps Core', type: 'enum', status: C },
      { name: 'weight_kg', means: 'The weight that left.', from: '← dOps Core', type: 'number', status: C },
      { name: 'received_kg', means: 'The weight booked on arrival. The tolerance between the two still needs agreeing.', from: '← IF-19', type: 'number', status: T },
      { name: 'sent', means: 'When it left.', from: '← dOps Core', type: 'date', status: C },
      { name: 'received', means: 'When it was booked at the other end.', from: '← IF-19', type: 'date', status: C },
    ],
    source: {
      system: 'dOps Core',
      layer: 'Source',
      table: 'transfer',
      interfaceId: 'IF-19',
      refresh: 'event-driven via IF-19',
      checks: ['C12'],
      status: T,
    },
  },
  {
    id: 'heat',
    name: 'Heat',
    icon: 'Flame',
    band: 'Pegase',
    grain: 'one per melt',
    what: 'One melt of steel in the mill, and the coils that come out of it.',
    technicalId: 'mill.heat',
    primaryKey: 'heat',
    status: C,
    pos: { x: 91.9, y: 10 },
    actions: ['Confirm heat'],
    functions: [],
    properties: [
      { name: 'heat', key: 'PK', means: 'The heat number.', from: '← Pegase', type: 'string', status: C },
      { name: 'coils', means: 'How many coils it produced.', from: '← Pegase', type: 'number', status: C },
      { name: 'weight_kg', means: 'How much it produced.', from: '← Pegase', type: 'number', status: C },
      { name: 'started', means: 'When the melt finished.', from: '← Pegase', type: 'date', status: C },
    ],
    source: {
      system: 'Pegase',
      layer: 'Source',
      table: 'heat',
      refresh: 'event-driven, per heat',
      checks: ['C9'],
      status: C,
    },
  },
  {
    id: 'production-confirmation',
    name: 'Production confirmation',
    icon: 'ClipboardCheck',
    band: 'Pegase',
    grain: 'one per heat confirmed',
    what: 'Pegase telling SAP what it produced. It has to arrive within fifteen minutes.',
    technicalId: 'sap.afru',
    primaryKey: 'rueck',
    status: C,
    pos: { x: 81.5, y: 38.1 },
    actions: ['Post the confirmation'],
    functions: ['Delay against the 15 minute rule'],
    properties: [
      { name: 'rueck', key: 'PK', means: 'The confirmation number.', from: '← SAP S/4HANA Stainless', type: 'string', status: C },
      { name: 'heat', key: 'FK', means: 'The melt it confirms.', from: '← Heat', type: 'string', status: C },
      { name: 'coils', means: 'Coils confirmed.', from: '← IF-04', type: 'number', status: C },
      { name: 'weight_kg', means: 'Weight confirmed.', from: '← IF-04', type: 'number', status: C },
      { name: 'delay_min', means: 'How long the file took to arrive.', from: '← IF-04', type: 'number', status: C, computedBy: 'Delay against the 15 minute rule' },
      { name: 'received', means: 'When SAP recorded it.', from: '← SAP S/4HANA Stainless', type: 'date', status: C },
    ],
    source: {
      system: 'SAP S/4HANA Stainless',
      layer: 'Derived',
      table: 'AFRU',
      interfaceId: 'IF-04',
      refresh: 'event-driven via IF-04',
      checks: ['C9'],
      status: C,
    },
  },
  {
    id: 'material',
    name: 'Material',
    icon: 'Layers',
    band: 'Recycling & quality',
    grain: 'one per grade',
    what: 'The grade a batch is sorted into and stock is held as, with the chemistry window it has to meet.',
    technicalId: 'd365.item',
    primaryKey: 'grade',
    status: T,
    pos: { x: 64.2, y: 10.2 },
    actions: ['Maintain the grade window'],
    functions: [],
    properties: [
      { name: 'grade', key: 'PK', means: 'The grade code.', from: '← dOps Core scrap_batch.grade', type: 'string', status: C },
      { name: 'ni_window', means: 'The nickel range this grade must sit in.', from: '← D365 F&O OneCore', type: 'number', status: T },
      { name: 'cr_window', means: 'The chromium range this grade must sit in.', from: '← D365 F&O OneCore', type: 'number', status: T },
      { name: 'mo_window', means: 'The molybdenum range this grade must sit in.', from: '← D365 F&O OneCore', type: 'number', status: T },
      { name: 'stock_unit', means: 'The unit stock is held in. It must be KG.', from: '← D365 F&O OneCore', type: 'enum', status: T },
    ],
    source: {
      system: 'D365 F&O OneCore',
      layer: 'Master data',
      refresh: 'maintained as master data',
      checks: ['C6', 'C13'],
      status: T,
    },
  },
]

export const OBJECT_LINKS: ObjLink[] = [
  { from: 'vehicle', to: 'gate-pass', label: 'arrives on', cardinality: '1 → *' },
  { from: 'gate-pass', to: 'weighbridge-ticket', label: 'weighed on', cardinality: '1 → 1' },
  { from: 'gate-pass', to: 'goods-receipt', label: 'booked against', cardinality: '1 → 1' },
  { from: 'gate-pass', to: 'scrap-receipt', label: 'received as', cardinality: '1 → 1' },
  { from: 'vendor', to: 'purchase-order', label: 'supplies on', cardinality: '1 → *' },
  { from: 'material', to: 'purchase-order', label: 'ordered as', cardinality: '1 → *', at: 0.63 },
  { from: 'purchase-order', to: 'goods-receipt', label: 'booked against', cardinality: '1 → *' },
  { from: 'goods-receipt', to: 'supplier-invoice', label: 'matched to', cardinality: '1 → 1' },
  { from: 'supplier-invoice', to: 'payment', label: 'paid by', cardinality: '1 → 1' },
  { from: 'supplier-invoice', to: 'output-document', label: 'printed as', cardinality: '1 → 1' },
  { from: 'vendor', to: 'payment', label: 'paid to', cardinality: '1 → *', at: 0.23 },
  { from: 'scrap-receipt', to: 'scrap-batch', label: 'sorted into', cardinality: '1 → *' },
  { from: 'scrap-batch', to: 'lab-sample', label: 'tested by', cardinality: '1 → 1' },
  { from: 'scrap-batch', to: 'quality-order', label: 'judged by', cardinality: '1 → 1' },
  { from: 'scrap-batch', to: 'stock-posting', label: 'stocked as', cardinality: '1 → 1' },
  { from: 'scrap-batch', to: 'yard-transfer', label: 'transferred as', cardinality: '1 → *' },
  { from: 'material', to: 'scrap-batch', label: 'graded as', cardinality: '1 → *', at: 0.56 },
  { from: 'stock-posting', to: 'output-document', label: 'printed as', cardinality: '1 → 1', at: 0.3 },
  { from: 'heat', to: 'production-confirmation', label: 'confirmed by', cardinality: '1 → 1' },
  { from: 'heat', to: 'output-document', label: 'printed as', cardinality: '1 → 1', at: 0.38 },
]

export const OBJECT_BANDS: ObjBand[] = ['Yard & gate', 'Purchasing & finance', 'Recycling & quality', 'Pegase']

export function objectById(id: string): BusinessObject | undefined {
  return BUSINESS_OBJECTS.find((o) => o.id === id)
}

/** Everything directly joined to this object, in either direction. */
export function neighboursOf(id: string): { link: ObjLink; other: BusinessObject; outgoing: boolean }[] {
  return OBJECT_LINKS.filter((l) => l.from === id || l.to === id)
    .map((link) => {
      const outgoing = link.from === id
      const other = objectById(outgoing ? link.to : link.from)
      return other ? { link, other, outgoing } : null
    })
    .filter(Boolean) as { link: ObjLink; other: BusinessObject; outgoing: boolean }[]
}
