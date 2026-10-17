import { engine, expectedQualityResult, gradeWindow } from './engine'
import type { FaultId, SystemId } from './types'

export interface CheckRow {
  key: string
  cells: (string | number | null)[]
  why: string
}

export interface CheckDef {
  id: string
  title: string
  sentence: string
  process: 'P1' | 'P2' | 'P3' | 'P4'
  stage: string
  interfaceId: string
  systems: SystemId[]
  sql: string
  columns: string[]
  faults: FaultId[]
}

export interface CheckResult extends CheckDef {
  status: 'pass' | 'fail'
  compared: number
  rows: CheckRow[]
}

const fmt = (n: number) => n.toLocaleString('en-GB').replace(/,/g, ' ')

/** The simulated day a timestamp falls in. The clock starts 06:00 on 14 Oct 2026. */
const simDayOf = (minutes: number) => Math.floor(minutes / 1440)

export const CHECK_DEFS: CheckDef[] = [
  {
    id: 'C1',
    title: 'Weighbridge net weight equals the goods receipt quantity',
    sentence: 'What the weighbridge measured must be what SAP booked, within 20 kg.',
    process: 'P1',
    stage: 'Goods receipt',
    interfaceId: 'IF-01',
    systems: ['Yard Management', 'SAP Steel'],
    columns: ['Gate pass', 'Vehicle', 'Weighbridge net', 'SAP quantity', 'Unit', 'Difference'],
    faults: ['F1', 'F2'],
    sql: `select t.gate_pass, t.vehicle, t.net_kg, m.menge, m.meins,
       abs(t.net_kg - m.menge) as difference
from   yard.weighbridge_ticket t
join   sap.mseg m on m.xblnr = t.gate_pass
where  abs(t.net_kg - m.menge) > 20`,
  },
  {
    id: 'C2',
    title: 'Exactly one goods receipt per truck',
    sentence: 'One truck through the gate must create one goods receipt in SAP — never none, never two.',
    process: 'P1',
    stage: 'Goods receipt',
    interfaceId: 'IF-01',
    systems: ['Yard Management', 'SAP Steel'],
    columns: ['Gate pass', 'Vehicle', 'Goods receipts', 'Document numbers'],
    faults: ['F3'],
    sql: `select g.gate_pass, g.vehicle, count(m.mblnr) as receipts
from   yard.gate_pass g
left   join sap.mseg m on m.xblnr = g.gate_pass
where  g.process = 'P1'
group  by g.gate_pass, g.vehicle
having count(m.mblnr) <> 1`,
  },
  {
    id: 'C3',
    title: 'Every recycling load reached the scrap yard',
    sentence: 'A load weighed at the gate must exist as a receipt in Scrap Yard Operations.',
    process: 'P2',
    stage: 'Gate receipt',
    interfaceId: 'IF-02',
    systems: ['Yard Management', 'Scrap Yard'],
    columns: ['Gate pass', 'Vehicle', 'Site', 'Weighed', 'Receipt'],
    faults: ['F4'],
    sql: `select g.gate_pass, g.vehicle, g.site, t.net_kg, r.receipt
from   yard.gate_pass g
join   yard.weighbridge_ticket t on t.gate_pass = g.gate_pass
left   join scrap.receipt r on r.gate_pass = g.gate_pass
where  g.process = 'P2' and r.receipt is null`,
  },
  {
    id: 'C4',
    title: 'Batch weights add up to the receipt',
    sentence: 'Sorting must not create or lose material: the batches must sum to the load received.',
    process: 'P2',
    stage: 'Sortation',
    interfaceId: 'IF-02',
    systems: ['Scrap Yard'],
    columns: ['Receipt', 'Receipt weight', 'Batches', 'Sum of batches', 'Difference'],
    faults: [],
    sql: `select r.receipt, r.weight_kg, count(b.batch) as batches, sum(b.weight_kg) as sorted
from   scrap.receipt r
join   scrap.scrap_batch b on b.receipt = r.receipt
group  by r.receipt, r.weight_kg
having abs(r.weight_kg - sum(b.weight_kg)) > 1`,
  },
  {
    id: 'C5',
    title: 'Chemistry is complete for every batch',
    sentence: 'Every batch needs nickel, chromium and molybdenum before it can be certified.',
    process: 'P2',
    stage: 'Chemistry check',
    interfaceId: 'IF-14',
    systems: ['Laboratory', 'Scrap Yard'],
    columns: ['Batch', 'Grade', 'Ni %', 'Cr %', 'Mo %', 'Missing'],
    faults: ['F5'],
    sql: `select b.batch, b.grade, c.ni_pct, c.cr_pct, c.mo_pct
from   scrap.scrap_batch b
left   join scrap.chemistry c on c.batch = b.batch
where  c.batch is null or c.ni_pct is null or c.cr_pct is null or c.mo_pct is null`,
  },
  {
    id: 'C6',
    title: 'Stock in kilograms matches the tonnes received',
    sentence: 'The yard receives tonnes. D365 must hold the same material in kilograms: tonnes × 1 000.',
    process: 'P2',
    stage: 'Stock posting',
    interfaceId: 'IF-03',
    systems: ['Scrap Yard', 'D365'],
    columns: ['Batch', 'Received', 'Kilograms expected', 'Stock in D365', 'Journal'],
    faults: ['F6'],
    sql: `select b.batch, b.weight_kg, s.qty, s.unit, s.journal
from   scrap.scrap_batch b
left   join d365.stock_posting s on s.batch = b.batch
where  s.journal is null or s.unit <> 'KG' or abs(s.qty - b.weight_kg) > 1`,
  },
  {
    id: 'C6b',
    title: 'Issued kilograms never exceed stock',
    sentence: 'The melt shop cannot take out more kilograms than D365 shows in stock for that batch.',
    process: 'P2',
    stage: 'Stock posting',
    interfaceId: 'IF-03',
    systems: ['Scrap Yard', 'D365'],
    columns: ['Batch', 'Issued kg', 'Stock in D365', 'Unit', 'Over by'],
    faults: ['F6'],
    sql: `select i.batch, sum(i.qty_kg) as issued, s.qty, s.unit
from   d365.issue i
join   d365.stock_posting s on s.batch = i.batch
group  by i.batch, s.qty, s.unit
having sum(i.qty_kg) > s.qty + 1`,
  },
  {
    id: 'C7',
    title: 'Supplier invoices pass the three-way match',
    sentence: 'Purchase order, goods receipt and invoice must agree, otherwise the invoice is parked.',
    process: 'P1',
    stage: 'Invoice posting',
    interfaceId: 'IF-06',
    systems: ['Esker', 'SAP Steel'],
    columns: ['Invoice', 'Gate pass', 'Quantity kg', 'Amount', 'Status', 'Reason'],
    faults: ['F1', 'F2', 'F7'],
    sql: `select r.ext_invoice, r.gate_pass, r.qty_kg, r.amount_eur, r.status, r.reason
from   sap.rbkp r
where  r.status = 'Parked'`,
  },
  {
    id: 'C8',
    title: 'Every booking has its document in Lasernet',
    sentence: 'A posted invoice must produce an invoice copy, and a booked scrap purchase a self-billing document.',
    process: 'P1',
    stage: 'Document output',
    interfaceId: 'IF-09',
    systems: ['SAP Steel', 'Lasernet'],
    columns: ['Booking', 'Reference', 'What it needs', 'Output document'],
    faults: [],
    sql: `select r.ext_invoice, r.belnr, 'Invoice copy', d.doc
from   sap.rbkp r
left   join lasernet.output_document d on d.ref = r.belnr
where  r.status = 'Posted' and d.doc is null
union  all
select s.journal, s.batch, 'Self-billing document', d.doc
from   d365.stock_posting s
left   join lasernet.output_document d on d.ref = s.batch
where  d.doc is null`,
  },
  {
    id: 'C9',
    title: 'Mill confirmations arrive within 15 minutes',
    sentence: 'A finished heat must be confirmed in SAP within 15 minutes, or the shift report is wrong.',
    process: 'P4',
    stage: 'Confirmation',
    interfaceId: 'IF-04',
    systems: ['Mill', 'SAP Steel'],
    columns: ['Heat', 'Coils', 'Weight kg', 'Delay minutes', 'Confirmation'],
    faults: ['F8'],
    sql: `select h.heat, h.coils, h.weight_kg, a.delay_min, a.rueck
from   mill.heat h
left   join sap.afru a on a.heat = h.heat
where  a.rueck is null or a.delay_min > 15`,
  },
  {
    id: 'C10',
    title: 'Every vendor paid was screened against today’s sanctions list',
    sentence: 'No supplier invoice may be booked unless the vendor was screened against the list published that day.',
    process: 'P3',
    stage: 'Invoice posting',
    interfaceId: 'IF-16',
    systems: ['SAP Steel', 'Sanctions Service'],
    columns: ['Invoice', 'Vendor', 'List used', 'Screened', 'Problem'],
    faults: ['F9'],
    sql: `select r.belnr, s.vendor, s.list_date, s.screened
from   sap.rbkp r
left   join sanctions.sanctions_screen s on s.belnr = r.belnr
where  r.status = 'Posted'
and    (s.screen is null or s.list_day <> day(s.screened))`,
  },
  {
    id: 'C11',
    title: 'Every foreign-currency invoice used that day’s exchange rate',
    sentence: 'An invoice in a currency other than euro must be booked at the rate loaded for the day it was booked.',
    process: 'P3',
    stage: 'Invoice posting',
    interfaceId: 'IF-18',
    systems: ['FX Service', 'SAP Steel'],
    columns: ['Invoice', 'Currency', 'Rate used', 'Rate of the day', 'Booked'],
    faults: ['F10'],
    sql: `select r.belnr, r.currency, r.fx_rate_used, f.rate
from   sap.rbkp r
left   join fx.fx_rate f on f.pair = concat(r.currency, '/EUR') and f.day = day(r.posted)
where  r.currency <> 'EUR'
and    (f.rate is null or r.fx_rate_used <> f.rate)`,
  },
  {
    id: 'C12',
    title: 'Transfers arrive with the same weight',
    sentence: 'A batch moved between the two recycling yards must be booked in D365 with the weight it left with.',
    process: 'P2',
    stage: 'Yard transfer',
    interfaceId: 'IF-19',
    systems: ['Scrap Yard', 'D365'],
    columns: ['Transfer', 'Batch', 'From', 'To', 'Sent kg', 'Booked kg'],
    faults: ['F6'],
    sql: `select t.transfer, t.batch, t.from_site, t.to_site, t.weight_kg, t.received_kg
from   scrap.transfer t
where  t.received_kg is null or abs(t.received_kg - t.weight_kg) > 1`,
  },
  {
    id: 'C13',
    title: 'Every tested batch has a quality order with the right result',
    sentence: 'D365 must raise a quality order for every tested batch, and judge it against the window for its grade.',
    process: 'P2',
    stage: 'Stock posting',
    interfaceId: 'IF-03',
    systems: ['Scrap Yard', 'D365'],
    columns: ['Batch', 'Grade', 'Ni %', 'Cr %', 'Mo %', 'Quality order', 'Result'],
    faults: ['F5'],
    sql: `select c.batch, b.grade, c.ni_pct, c.cr_pct, c.mo_pct, q.order, q.result
from   scrap.chemistry c
join   scrap.scrap_batch b on b.batch = c.batch
left   join d365.quality_order q on q.batch = c.batch
where  q.order is null or q.result = 'Incomplete' or q.result <> expected(b.grade, c)`,
  },
]

/** "14:22" for a check row, without pulling the UI formatters into the engine. */
function fmtClock(minutes: number) {
  const d = new Date(new Date(2026, 9, 14, 6, 0, 0).getTime() + minutes * 60_000)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${d.getDate()} ${months[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Records younger than the settle time are still legitimately in flight. */
function settled<T>(rows: T[], at: (row: T) => number, settle: number): T[] {
  const cutoff = engine.now - settle
  return rows.filter((r) => at(r) <= cutoff)
}

export function runCheck(id: string): CheckResult {
  const def = CHECK_DEFS.find((c) => c.id === id)!
  const db = engine.db
  const rows: CheckRow[] = []
  let compared = 0

  switch (id) {
    case 'C1': {
      const byGatePass = new Map<string, typeof db.MSEG>()
      db.MSEG.forEach((m) => {
        const list = byGatePass.get(m.xblnr) ?? []
        list.push(m)
        byGatePass.set(m.xblnr, list)
      })
      const tickets = settled(
        db.weighbridge_ticket.filter((t) => t.gate_pass.startsWith('GP-PL')),
        (t) => t.weighed,
        10,
      )
      tickets.forEach((t) => {
        const grs = byGatePass.get(t.gate_pass)
        if (!grs?.length) return
        compared += 1
        const m = grs[0]
        const diff = Math.abs(t.net_kg - m.menge)
        if (diff <= 20) return
        let why = `SAP holds ${fmt(m.menge)} ${m.meins} but the weighbridge measured ${fmt(t.net_kg)} kg.`
        if (Math.abs(m.menge * 1000 - t.net_kg) <= 20) {
          why = `Unit mix-up: ${m.menge} was sent as KG but is really tonnes. SAP is short by ${fmt(Math.round(diff))} kg.`
        } else if (Math.abs(diff - Math.abs(t.tare_kg - t.registered_tare_kg)) <= 20) {
          why = `Stale tare: the message used the registered tare ${fmt(t.registered_tare_kg)} kg instead of the weighed tare ${fmt(t.tare_kg)} kg.`
        }
        rows.push({
          key: t.gate_pass,
          cells: [t.gate_pass, t.vehicle, t.net_kg, m.menge, m.meins, Math.round(diff)],
          why,
        })
      })
      break
    }

    case 'C2': {
      const counts = new Map<string, string[]>()
      db.MSEG.forEach((m) => {
        const list = counts.get(m.xblnr) ?? []
        list.push(m.mblnr)
        counts.set(m.xblnr, list)
      })
      const passes = settled(
        db.gate_pass.filter((g) => g.process === 'P1'),
        (g) => g.arrived,
        12,
      )
      passes.forEach((g) => {
        compared += 1
        const docs = counts.get(g.gate_pass) ?? []
        if (docs.length === 1) return
        rows.push({
          key: g.gate_pass,
          cells: [g.gate_pass, g.vehicle, docs.length, docs.join(', ') || null],
          why:
            docs.length === 0
              ? 'No goods receipt was created — the message never arrived.'
              : 'The gateway delivered the ticket twice, so the quantity is counted twice.',
        })
      })
      break
    }

    case 'C3': {
      const receipts = new Map(db.receipt.map((r) => [r.gate_pass, r]))
      const tickets = new Map(db.weighbridge_ticket.map((t) => [t.gate_pass, t]))
      const passes = settled(
        db.gate_pass.filter((g) => g.process === 'P2'),
        (g) => g.arrived,
        12,
      )
      passes.forEach((g) => {
        compared += 1
        const r = receipts.get(g.gate_pass)
        const ticket = tickets.get(g.gate_pass)
        if (r) return
        rows.push({
          key: g.gate_pass,
          cells: [
            g.gate_pass,
            g.vehicle,
            g.site,
            ticket ? `${ticket.net_kg} ${ticket.unit}` : null,
            null,
          ],
          why: 'The load was weighed at the gate but never reached Scrap Yard Operations.',
        })
      })
      break
    }

    case 'C4': {
      const byReceipt = new Map<string, number>()
      const countByReceipt = new Map<string, number>()
      db.scrap_batch.forEach((b) => {
        byReceipt.set(b.receipt, (byReceipt.get(b.receipt) ?? 0) + b.weight_kg)
        countByReceipt.set(b.receipt, (countByReceipt.get(b.receipt) ?? 0) + 1)
      })
      settled(db.receipt, (r) => r.received, 35).forEach((r) => {
        compared += 1
        const sum = byReceipt.get(r.receipt) ?? 0
        const diff = Math.abs(r.weight_kg - sum)
        if (diff <= 1) return
        rows.push({
          key: r.gate_pass,
          cells: [r.receipt, r.weight_kg, countByReceipt.get(r.receipt) ?? 0, sum, Math.round(diff)],
          why: `Sorting lost ${fmt(Math.round(diff))} kg against the weight received.`,
        })
      })
      break
    }

    case 'C5': {
      const chem = new Map(db.chemistry.map((c) => [c.batch, c]))
      const receiptKey = new Map(db.receipt.map((r) => [r.receipt, r.gate_pass]))
      settled(db.scrap_batch, (b) => b.created, 50).forEach((b) => {
        compared += 1
        const c = chem.get(b.batch)
        const missing: string[] = []
        if (!c) missing.push('the whole result')
        else {
          if (c.ni_pct === null) missing.push('Ni')
          if (c.cr_pct === null) missing.push('Cr')
          if (c.mo_pct === null) missing.push('Mo')
        }
        if (!missing.length) return
        rows.push({
          key: receiptKey.get(b.receipt) ?? b.batch,
          cells: [b.batch, b.grade, c?.ni_pct ?? null, c?.cr_pct ?? null, c?.mo_pct ?? null, missing.join(', ')],
          why:
            missing.join(', ') === 'Mo'
              ? 'The laboratory renamed the field, so molybdenum arrives empty and the grade cannot be certified.'
              : `Chemistry is missing ${missing.join(', ')}.`,
        })
      })
      break
    }

    case 'C6': {
      const stock = new Map(db.stock_posting.map((s) => [s.batch, s]))
      const receiptKey = new Map(db.receipt.map((r) => [r.receipt, r.gate_pass]))
      settled(db.scrap_batch, (b) => b.created, 25).forEach((b) => {
        compared += 1
        const s = stock.get(b.batch)
        if (s && s.unit === 'KG' && Math.abs(s.qty - b.weight_kg) <= 1) return
        const tonnes = Math.round(b.weight_kg / 10) / 100
        const notConverted = !!s && Math.abs(s.qty * 1000 - b.weight_kg) <= 20
        rows.push({
          key: receiptKey.get(b.receipt) ?? b.batch,
          cells: [
            b.batch,
            `${tonnes} t`,
            b.weight_kg,
            s ? `${s.qty} ${s.unit}` : null,
            s?.journal ?? null,
          ],
          why: !s
            ? 'Nothing was posted to D365 for this batch.'
            : notConverted
              ? `Received ${tonnes} t, stock shows ${s.qty} ${s.unit} — not converted (should be ${fmt(b.weight_kg)} KG).`
              : `D365 holds ${fmt(s.qty)} ${s.unit} against ${fmt(b.weight_kg)} kg received.`,
        })
      })
      break
    }

    case 'C6b': {
      const stock = new Map(db.stock_posting.map((s) => [s.batch, s]))
      const batches = new Map(db.scrap_batch.map((b) => [b.batch, b]))
      const receiptKey = new Map(db.receipt.map((r) => [r.receipt, r.gate_pass]))
      const issuedByBatch = new Map<string, number>()
      settled(db.issue, (i) => i.issued, 10).forEach((i) =>
        issuedByBatch.set(i.batch, (issuedByBatch.get(i.batch) ?? 0) + i.qty_kg),
      )
      issuedByBatch.forEach((issued, batch) => {
        const s = stock.get(batch)
        // a missing stock booking is C6's business, not this check's
        if (!s) return
        compared += 1
        if (issued <= s.qty + 1) return
        const b = batches.get(batch)
        const notConverted = !!b && Math.abs(s.qty * 1000 - b.weight_kg) <= 20
        rows.push({
          key: b ? (receiptKey.get(b.receipt) ?? batch) : batch,
          cells: [batch, issued, `${s.qty} ${s.unit}`, s.unit, Math.round(issued - s.qty)],
          why: notConverted
            ? `The melt shop issued ${fmt(issued)} kg but D365 only shows ${s.qty} ${s.unit}, because the tonnes were never converted.`
            : `The melt shop issued ${fmt(issued)} kg against ${fmt(s.qty)} ${s.unit} in stock.`,
        })
      })
      break
    }

    case 'C7': {
      settled(db.RBKP, (r) => r.posted, 5).forEach((r) => {
        compared += 1
        if (r.status === 'Posted') return
        rows.push({
          key: r.gate_pass,
          cells: [r.ext_invoice, r.gate_pass, r.qty_kg, Math.round(r.amount_eur), r.status, r.reason],
          why: `Parked by the three-way match: ${r.reason.toLowerCase()}.`,
        })
      })
      break
    }

    case 'C8': {
      const docs = new Map(db.output_document.map((d) => [d.ref, d]))
      settled(
        db.RBKP.filter((r) => r.status === 'Posted'),
        (r) => r.posted,
        12,
      ).forEach((r) => {
        compared += 1
        if (docs.has(r.belnr)) return
        rows.push({
          key: r.gate_pass,
          cells: [r.ext_invoice, r.belnr, 'Invoice copy', null],
          why: 'The invoice is posted but Lasernet never produced the copy.',
        })
      })
      settled(db.stock_posting, (sp) => sp.posted, 12).forEach((sp) => {
        compared += 1
        if (docs.has(sp.batch)) return
        rows.push({
          key: sp.batch,
          cells: [sp.journal, sp.batch, 'Self-billing document', null],
          why: 'D365 booked the scrap purchase but Lasernet never produced the self-billing document.',
        })
      })
      break
    }

    case 'C9': {
      const afru = new Map(db.AFRU.map((a) => [a.heat, a]))
      settled(db.heat, (h) => h.started, 55).forEach((h) => {
        compared += 1
        const a = afru.get(h.heat)
        if (a && a.delay_min <= 15) return
        rows.push({
          key: h.heat,
          cells: [h.heat, h.coils, h.weight_kg, a?.delay_min ?? null, a?.rueck ?? null],
          why: !a
            ? 'No confirmation has arrived in SAP at all.'
            : `The confirmation took ${a.delay_min} minutes, over the 15 minute limit.`,
        })
      })
      break
    }

    case 'C10': {
      const screens = new Map(db.sanctions_screen.map((x) => [x.belnr, x]))
      settled(
        db.RBKP.filter((r) => r.status === 'Posted'),
        (r) => r.posted,
        15,
      ).forEach((r) => {
        compared += 1
        const screen = screens.get(r.belnr)
        if (screen && screen.list_day === simDayOf(screen.screened)) return
        rows.push({
          key: r.gate_pass,
          cells: [
            r.belnr,
            screen?.vendor ?? null,
            screen?.list_date ?? null,
            screen ? fmtClock(screen.screened) : null,
            screen ? 'List out of date' : 'Never screened',
          ],
          why: screen
            ? `The vendor was screened against the list published ${screen.list_date}, not the list of the day the invoice was booked.`
            : 'The invoice was booked without any sanctions screening at all.',
        })
      })
      break
    }

    case 'C11': {
      settled(
        db.RBKP.filter((r) => r.currency !== 'EUR'),
        (r) => r.posted,
        20,
      ).forEach((r) => {
        compared += 1
        const pair = `${r.currency}/EUR`
        const day = simDayOf(r.posted)
        const forDay = db.fx_rate.filter((f) => f.pair === pair && f.day === day)
        const before = forDay.find((f) => f.loaded <= r.posted)
        // An invoice booked before the file of the day arrives legitimately uses
        // the rate of the day before, so only a day with no file at all is wrong.
        if (!before && forDay.length) return
        if (before && r.fx_rate_used === before.rate) return
        rows.push({
          key: r.gate_pass,
          cells: [r.belnr, r.currency, r.fx_rate_used, before?.rate ?? null, fmtClock(r.posted)],
          why: before
            ? `The invoice was booked at ${r.fx_rate_used}, but the rate loaded for that day was ${before.rate}.`
            : `No exchange rate was loaded for ${pair} on that day, so the invoice used the rate of the day before.`,
        })
      })
      break
    }

    case 'C12': {
      settled(db.transfer, (t) => t.sent, 15).forEach((t) => {
        compared += 1
        if (t.received_kg !== null && Math.abs(t.received_kg - t.weight_kg) <= 1) return
        rows.push({
          key: t.batch,
          cells: [t.transfer, t.batch, t.from_site, t.to_site, fmt(t.weight_kg), t.received_kg],
          why:
            t.received_kg === null
              ? `The transfer left ${t.from_site} but nothing was ever booked at ${t.to_site}.`
              : `${t.from_site} sent ${fmt(t.weight_kg)} kg, ${t.to_site} booked ${t.received_kg} KG — the tonnes were not converted.`,
        })
      })
      break
    }

    case 'C13': {
      const orders = new Map(db.quality_order.map((q) => [q.batch, q]))
      const grades = new Map(db.scrap_batch.map((b) => [b.batch, b.grade]))
      settled(db.chemistry, (c) => c.tested, 15).forEach((c) => {
        const grade = grades.get(c.batch)
        if (!grade) return
        compared += 1
        const order = orders.get(c.batch)
        const expected = expectedQualityResult(grade, c.ni_pct, c.cr_pct, c.mo_pct)
        if (order && expected !== 'Incomplete' && order.result === expected) return
        const w = gradeWindow(grade)
        rows.push({
          key: c.batch,
          cells: [c.batch, grade, c.ni_pct, c.cr_pct, c.mo_pct, order?.order ?? null, order?.result ?? null],
          why: !order
            ? 'The batch was tested but D365 never raised a quality order for it.'
            : expected === 'Incomplete'
              ? 'The chemistry is incomplete, so the quality order cannot say whether the batch meets its grade.'
              : `D365 recorded ${order.result}, but the measured values are ${expected} against the window for ${grade}` +
                (w ? ` (Ni ${w.ni[0].toFixed(2)}–${w.ni[1].toFixed(2)}).` : '.'),
        })
      })
      break
    }

    default:
      break
  }

  return { ...def, status: rows.length ? 'fail' : 'pass', compared, rows }
}

export function runAllChecks(): CheckResult[] {
  return CHECK_DEFS.map((d) => runCheck(d.id))
}

export function checkSummary(results: CheckResult[]) {
  const passing = results.filter((r) => r.status === 'pass').length
  const compared = results.reduce((s, r) => s + r.compared, 0)
  const disagree = results.reduce((s, r) => s + r.rows.length, 0)
  return { passing, total: results.length, compared, disagree }
}
