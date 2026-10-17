import { engine } from '@/sim/engine'
import { SYSTEM_TABLES, type TableName } from '@/sim/types'
import { INTERFACES, SYSTEMS } from '@/data'

/** Which column holds the timestamp on each table. */
const TIME_FIELD: Record<TableName, string | null> = {
  gate_pass: 'arrived',
  weighbridge_ticket: 'weighed',
  EKPO: null,
  MSEG: 'posted',
  RBKP: 'posted',
  AFRU: 'received',
  captured_invoice: 'captured',
  output_document: 'created',
  receipt: 'received',
  scrap_batch: 'created',
  chemistry: 'tested',
  lab_result: 'tested',
  stock_posting: 'posted',
  issue: 'issued',
  heat: 'started',
  payment: 'run_at',
}

/** Human label for every table, used wherever provenance is shown. */
export const TABLE_LABEL: Record<TableName, string> = {
  gate_pass: 'yard.gate_pass',
  weighbridge_ticket: 'yard.weighbridge_ticket',
  EKPO: 'sap.ekpo',
  MSEG: 'sap.mseg',
  RBKP: 'sap.rbkp',
  AFRU: 'sap.afru',
  captured_invoice: 'esker.captured_invoice',
  output_document: 'lasernet.output_document',
  receipt: 'scrap.receipt',
  scrap_batch: 'scrap.scrap_batch',
  chemistry: 'scrap.chemistry',
  lab_result: 'lims.lab_result',
  stock_posting: 'd365.stock_posting',
  issue: 'd365.issue',
  heat: 'mill.heat',
  payment: 'reval.payment',
}

export function systemOfTable(table: TableName): string | undefined {
  const entry = (Object.entries(SYSTEM_TABLES) as [string, TableName[]][]).find(([, tables]) =>
    tables.includes(table),
  )
  if (!entry) return undefined
  return SYSTEMS.find((s) => s.sim === entry[0])?.id
}

export function tableRoute(table: TableName): string {
  const system = systemOfTable(table)
  return system ? `/flow/data?system=${system}&table=${table}` : '/flow/data'
}

export function tableCount(table: TableName): number {
  return engine.db[table].length
}

export function countSince(table: TableName, minutes: number): number {
  const field = TIME_FIELD[table]
  if (!field) return engine.db[table].length
  const cutoff = engine.now - minutes
  return (engine.db[table] as unknown as Record<string, number>[]).filter((r) => (r[field] ?? 0) >= cutoff).length
}

export function sampleRows(table: TableName, n = 5): Record<string, unknown>[] {
  return (engine.db[table] as unknown as Record<string, unknown>[]).slice(-n).reverse()
}

/** Records held per system, and how many of them arrived in the last hour. */
export function systemActivity(minutes = 60) {
  return SYSTEMS.map((s) => {
    const tables = s.sim ? SYSTEM_TABLES[s.sim] : []
    const total = tables.reduce((sum, t) => sum + tableCount(t), 0)
    const recent = tables.reduce((sum, t) => sum + countSince(t, minutes), 0)
    return { id: s.id, name: s.name, short: s.short, band: s.band, tables, total, recent, live: !!s.sim }
  })
}

export function interfaceTraffic(minutes = 60) {
  return INTERFACES.filter((i) => i.live)
    .map((i) => {
      const msgs = engine.messages.filter((m) => m.interfaceId === i.id && m.sentAt >= engine.now - minutes)
      return {
        id: i.id,
        name: i.name,
        from: SYSTEMS.find((s) => s.id === i.from)?.short ?? i.from,
        to: SYSTEMS.find((s) => s.id === i.to)?.short ?? i.to,
        count: msgs.length,
        damaged: msgs.filter((m) => m.fault || m.status === 'lost' || m.status === 'duplicate').length,
      }
    })
    .sort((a, b) => b.count - a.count)
}

/** The one-line state of the plant, for the Command Centre. */
export function plantPulse(minutes = 60) {
  const since = engine.now - minutes
  const msgs = engine.messages
  const allTables = Object.keys(TIME_FIELD) as TableName[]
  return {
    now: engine.now,
    running: engine.running,
    speed: engine.speed,
    vehicles: engine.counters.vehicles,
    vehiclesLastHour: countSince('gate_pass', minutes),
    records: allTables.reduce((s, t) => s + tableCount(t), 0),
    recordsLastHour: allTables.reduce((s, t) => s + countSince(t, minutes), 0),
    inFlight: msgs.filter((m) => m.status === 'in flight' && m.arriveAt > engine.now).length,
    delivered: msgs.filter((m) => m.status === 'delivered' && m.arriveAt >= since).length,
    damaged: msgs.filter((m) => m.sentAt >= since && (m.fault || m.status === 'lost' || m.status === 'duplicate')).length,
  }
}

/** Which live tables belong to each workflow, so a process can show real volume. */
export const PROCESS_TABLES: Record<string, TableName[]> = {
  P1: ['gate_pass', 'weighbridge_ticket', 'MSEG', 'captured_invoice', 'RBKP', 'output_document', 'payment'],
  P2: ['receipt', 'scrap_batch', 'chemistry', 'lab_result', 'stock_posting', 'issue'],
  P3: ['EKPO', 'MSEG', 'RBKP', 'payment'],
  P4: ['heat', 'AFRU', 'output_document'],
  P5: [],
  P6: [],
}

export function processActivity(processId: string, minutes = 60) {
  const tables = PROCESS_TABLES[processId] ?? []
  return {
    tables,
    simulated: tables.length > 0,
    total: tables.reduce((s, t) => s + tableCount(t), 0),
    recent: tables.reduce((s, t) => s + countSince(t, minutes), 0),
  }
}
