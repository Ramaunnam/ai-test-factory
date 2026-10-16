import type { SystemId } from '@/sim/types'

export type Band = 'Shop floor' | 'Core ERP' | 'Finance and output'

export interface SystemMeta {
  id: string
  sim?: SystemId
  name: string
  short: string
  band: Band
  x: number
  y: number
  type: string
  owner: string
  method: string
  endpoint: string
  account: string
  responseMs: number
  sources: string[]
  lastSync: string
}

/** Map canvas is 1000 x 540. Cards are 176 x 74. */
export const SYSTEMS: SystemMeta[] = [
  {
    id: 'yard',
    sim: 'Yard Management',
    name: 'Yard Management',
    short: 'Yard',
    band: 'Shop floor',
    x: 40,
    y: 60,
    type: 'In-house web app',
    owner: 'Plant IT',
    method: 'REST',
    endpoint: 'https://yard.test.internal/api/v2',
    account: 'svc_yard_ro',
    responseMs: 82,
    sources: ['gate_pass', 'weighbridge_ticket'],
    lastSync: '2 min ago',
  },
  {
    id: 'mill',
    sim: 'Mill',
    name: 'Mill Execution System',
    short: 'Mill',
    band: 'Shop floor',
    x: 270,
    y: 60,
    type: 'MES',
    owner: 'Production',
    method: 'File drop',
    endpoint: 'sftp://mes.test.internal/out',
    account: 'svc_mes_ro',
    responseMs: 141,
    sources: ['heat'],
    lastSync: '6 min ago',
  },
  {
    id: 'scrap',
    sim: 'Scrap Yard',
    name: 'Scrap Yard Operations',
    short: 'Scrap Yard',
    band: 'Shop floor',
    x: 500,
    y: 60,
    type: 'In-house web app',
    owner: 'Recycling IT',
    method: 'REST',
    endpoint: 'https://scrap.test.internal/api',
    account: 'svc_scrap_ro',
    responseMs: 96,
    sources: ['receipt', 'scrap_batch', 'chemistry'],
    lastSync: '1 min ago',
  },
  {
    id: 'lab',
    sim: 'Laboratory',
    name: 'Laboratory app',
    short: 'Laboratory',
    band: 'Shop floor',
    x: 730,
    y: 60,
    type: 'LIMS',
    owner: 'Quality',
    method: 'REST',
    endpoint: 'https://lims.test.internal/v1',
    account: 'svc_lims_ro',
    responseMs: 118,
    sources: ['lab_result'],
    lastSync: '4 min ago',
  },
  {
    id: 'sap-steel',
    sim: 'SAP Steel',
    name: 'SAP S/4HANA – Steel',
    short: 'SAP Steel',
    band: 'Core ERP',
    x: 150,
    y: 240,
    type: 'ERP',
    owner: 'Group IT',
    method: 'OData + IDoc',
    endpoint: 'https://s4steel.test.internal/sap/opu/odata',
    account: 'svc_s4_ro',
    responseMs: 212,
    sources: ['EKPO', 'MSEG', 'RBKP', 'AFRU'],
    lastSync: 'just now',
  },
  {
    id: 'd365',
    sim: 'D365',
    name: 'D365 F&O – Recycling',
    short: 'D365',
    band: 'Core ERP',
    x: 420,
    y: 240,
    type: 'ERP',
    owner: 'Recycling IT',
    method: 'OData',
    endpoint: 'https://d365rec.test.dynamics.com/data',
    account: 'svc_d365_ro',
    responseMs: 268,
    sources: ['stock_posting'],
    lastSync: '3 min ago',
  },
  {
    id: 'sap-sc',
    name: 'SAP S/4HANA – Service Centre',
    short: 'SAP SC',
    band: 'Core ERP',
    x: 690,
    y: 240,
    type: 'ERP',
    owner: 'Group IT',
    method: 'OData + IDoc',
    endpoint: 'https://s4sc.test.internal/sap/opu/odata',
    account: 'svc_s4sc_ro',
    responseMs: 233,
    sources: ['EKPO', 'VBAK'],
    lastSync: '8 min ago',
  },
  {
    id: 'esker',
    sim: 'Esker',
    name: 'Esker',
    short: 'Esker',
    band: 'Finance and output',
    x: 90,
    y: 420,
    type: 'Invoice capture',
    owner: 'Finance IT',
    method: 'REST',
    endpoint: 'https://esker.test.cloud/api',
    account: 'svc_esker_ro',
    responseMs: 174,
    sources: ['captured_invoice'],
    lastSync: '5 min ago',
  },
  {
    id: 'lasernet',
    sim: 'Lasernet',
    name: 'Lasernet',
    short: 'Lasernet',
    band: 'Finance and output',
    x: 390,
    y: 420,
    type: 'Document output',
    owner: 'Group IT',
    method: 'File drop',
    endpoint: 'sftp://lasernet.test.internal/in',
    account: 'svc_lnet_ro',
    responseMs: 103,
    sources: ['output_document'],
    lastSync: '2 min ago',
  },
  {
    id: 'reval',
    sim: 'Reval',
    name: 'Reval',
    short: 'Reval',
    band: 'Finance and output',
    x: 690,
    y: 420,
    type: 'Treasury',
    owner: 'Treasury',
    method: 'SFTP',
    endpoint: 'sftp://reval.test.cloud/payments',
    account: 'svc_reval_ro',
    responseMs: 189,
    sources: ['payment'],
    lastSync: '12 min ago',
  },
]

export const BANDS: { id: Band; y: number; height: number }[] = [
  { id: 'Shop floor', y: 20, height: 160 },
  { id: 'Core ERP', y: 200, height: 160 },
  { id: 'Finance and output', y: 380, height: 150 },
]

export const CARD_W = 176
export const CARD_H = 74

export function systemBySim(sim: SystemId): SystemMeta {
  return SYSTEMS.find((s) => s.sim === sim) ?? SYSTEMS[0]
}

export function systemById(id: string): SystemMeta | undefined {
  return SYSTEMS.find((s) => s.id === id)
}

export interface InterfaceMeta {
  id: string
  name: string
  from: string
  to: string
  live: boolean
  method: string
  frequency: string
  process: string
  payload: string
}

export const INTERFACES: InterfaceMeta[] = [
  { id: 'IF-01', name: 'Weighbridge ticket', from: 'yard', to: 'sap-steel', live: true, method: 'REST', frequency: 'Per vehicle', process: 'P1', payload: 'gatePass, vehicle, grossKg, tareKg, quantity, unit' },
  { id: 'IF-02', name: 'Recycling receipt', from: 'yard', to: 'scrap', live: true, method: 'REST', frequency: 'Per vehicle', process: 'P2', payload: 'gatePass, vehicle, weightKg, site' },
  { id: 'IF-03', name: 'Stock posting', from: 'scrap', to: 'd365', live: true, method: 'OData', frequency: 'Per batch', process: 'P2', payload: 'batch, qty, unit, warehouse' },
  { id: 'IF-04', name: 'Production confirmation', from: 'mill', to: 'sap-steel', live: true, method: 'File drop', frequency: 'Per heat', process: 'P4', payload: 'heat, coils, weightKg, delayMin' },
  { id: 'IF-05', name: 'Delivery note', from: 'sap-steel', to: 'lasernet', live: false, method: 'IDoc', frequency: 'Per delivery', process: 'P4', payload: 'delivery, customer, items' },
  { id: 'IF-06', name: 'Captured invoice', from: 'esker', to: 'sap-steel', live: true, method: 'REST', frequency: 'Per invoice', process: 'P1', payload: 'externalInvoice, gatePass, purchaseOrder, quantityKg, amountEur' },
  { id: 'IF-07', name: 'Stock transfer', from: 'sap-steel', to: 'sap-sc', live: false, method: 'IDoc', frequency: 'Hourly', process: 'P3', payload: 'material, qty, plantFrom, plantTo' },
  { id: 'IF-08', name: 'Inventory sync', from: 'd365', to: 'sap-steel', live: false, method: 'OData', frequency: 'Nightly', process: 'P6', payload: 'item, warehouse, onHand' },
  { id: 'IF-09', name: 'Invoice copy', from: 'sap-steel', to: 'lasernet', live: true, method: 'File drop', frequency: 'Per invoice', process: 'P1', payload: 'belnr, externalInvoice, amountEur' },
  { id: 'IF-10', name: 'Mill certificate', from: 'mill', to: 'lasernet', live: true, method: 'File drop', frequency: 'Per heat', process: 'P4', payload: 'heat, coils' },
  { id: 'IF-11', name: 'Payment file', from: 'sap-steel', to: 'reval', live: true, method: 'SFTP', frequency: 'Hourly', process: 'P3', payload: 'invoices, count' },
  { id: 'IF-12', name: 'Charge plan', from: 'yard', to: 'mill', live: false, method: 'REST', frequency: 'Per shift', process: 'P4', payload: 'shift, grades, tonnage' },
  { id: 'IF-13', name: 'Recycling documents', from: 'd365', to: 'lasernet', live: false, method: 'File drop', frequency: 'Per posting', process: 'P2', payload: 'journal, batch, document' },
  { id: 'IF-14', name: 'Chemistry result', from: 'lab', to: 'scrap', live: true, method: 'REST', frequency: 'Per sample', process: 'P2', payload: 'sample, batch, ni_pct, cr_pct, mo_pct' },
]

export function interfaceById(id: string) {
  return INTERFACES.find((i) => i.id === id)
}
