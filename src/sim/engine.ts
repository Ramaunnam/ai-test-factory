import { Rng } from './rng'
import type {
  Db,
  EventLine,
  FaultId,
  Message,
  SystemId,
  TableName,
} from './types'

/* -------------------------------------------------------------------------- */
/* Faults                                                                     */
/* -------------------------------------------------------------------------- */

export interface FaultDef {
  id: FaultId
  label: string
  where: string
  breaks: string
  rate: number
}

export const FAULTS: FaultDef[] = [
  {
    id: 'F1',
    label: 'Kilogram / tonne mix-up',
    where: 'IF-01 Yard Management to SAP Steel',
    breaks: 'The net weight is divided by 1000 but still labelled KG, so SAP books 21.92 KG instead of 21 920 kg.',
    rate: 0.08,
  },
  {
    id: 'F2',
    label: 'Stale tare weight',
    where: 'IF-01 Yard Management to SAP Steel',
    breaks: 'The message uses the registered tare from the vehicle master instead of the tare just weighed.',
    rate: 0.07,
  },
  {
    id: 'F3',
    label: 'Gateway retry duplicate',
    where: 'IF-01 Yard Management to SAP Steel',
    breaks: 'The same ticket is delivered twice, so SAP holds two goods receipts for one truck.',
    rate: 0.05,
  },
  {
    id: 'F4',
    label: 'Lost message',
    where: 'IF-02 Yard Management to Scrap Yard',
    breaks: 'The recycling receipt never arrives, so the load exists in the yard but nowhere else.',
    rate: 0.06,
  },
  {
    id: 'F5',
    label: 'Molybdenum field renamed',
    where: 'IF-14 Laboratory to Scrap Yard',
    breaks: 'mo_pct arrives empty, so the chemistry record is incomplete and the grade cannot be certified.',
    rate: 0.2,
  },
  {
    id: 'F6',
    label: 'Tonnes not converted to kilograms',
    where: 'IF-03 Scrap Yard to D365',
    breaks:
      'Received in tonnes at the yard, issued in kilograms in stock. The × 1000 step is skipped, so stock is 1 000 times wrong.',
    rate: 0.07,
  },
  {
    id: 'F7',
    label: 'No purchase order on capture',
    where: 'IF-06 Esker to SAP Steel',
    breaks: 'The captured invoice carries no PO reference, so the three-way match parks it.',
    rate: 0.06,
  },
  {
    id: 'F8',
    label: 'Late mill file',
    where: 'IF-04 Mill to SAP Steel',
    breaks: 'The production confirmation takes 25 to 45 minutes instead of 3 to 10.',
    rate: 0.25,
  },
  {
    id: 'F9',
    label: 'Sanctions list not refreshed',
    where: 'IF-16 SAP Steel to the sanctions screening service',
    breaks: 'The vendor is screened against yesterday’s list, so a name added today is not seen before the invoice is booked.',
    rate: 0.03,
  },
  {
    id: 'F10',
    label: 'Exchange rate missing',
    where: 'IF-18 exchange-rate service to SAP Steel',
    breaks: 'No rate file arrives for the day, so foreign-currency invoices are booked at yesterday’s rate.',
    rate: 0.1,
  },
]

/* -------------------------------------------------------------------------- */
/* Engine                                                                     */
/* -------------------------------------------------------------------------- */

interface ScheduledEvent {
  at: number
  run: () => void
}

const SITES_STEEL = ['PL01', 'PL03'] as const
const SITES_YARD = ['YD02', 'YD05'] as const
const GRADES = ['SCR-304-BALE', 'SCR-316L-SOLID', 'SCR-430-TURN', 'SCR-321-SHRED'] as const
const NOMINAL: Record<string, { ni: number; cr: number; mo: number }> = {
  'SCR-304-BALE': { ni: 8.1, cr: 18.2, mo: 0.4 },
  'SCR-316L-SOLID': { ni: 10.3, cr: 16.8, mo: 2.1 },
  'SCR-430-TURN': { ni: 0.4, cr: 16.4, mo: 0.1 },
  'SCR-321-SHRED': { ni: 9.2, cr: 17.6, mo: 0.3 },
}
const VENDORS = ['VEND-1042', 'VEND-1043', 'VEND-1044', 'VEND-1045'] as const
const VAT_NUMBERS: Record<string, string> = {
  'VEND-1042': 'GB 418 7721 03',
  'VEND-1043': 'DE 274 118 902',
  'VEND-1044': 'NL 8201 44 771 B01',
  'VEND-1045': 'PL 527 2714 880',
}
/** A few suppliers invoice in something other than euro. */
const FX_PAIRS = ['USD/EUR', 'GBP/EUR'] as const
const FX_BASE: Record<string, number> = { 'USD/EUR': 0.918, 'GBP/EUR': 1.167 }
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** The simulated clock starts 06:00 on 14 Oct 2026, same as the rest of the app. */
const SIM_EPOCH_MS = new Date(2026, 9, 14, 6, 0, 0).getTime()

function simDayOf(minutes: number) {
  return Math.floor(minutes / 1440)
}

function simDateLabel(minutes: number) {
  const d = new Date(SIM_EPOCH_MS + minutes * 60_000)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

const RETAIN_MINUTES = 24 * 60
const MAX_EVENTS = 400
const MAX_MESSAGES = 600

function emptyDb(): Db {
  return {
    gate_pass: [],
    weighbridge_ticket: [],
    EKPO: [],
    MSEG: [],
    RBKP: [],
    AFRU: [],
    captured_invoice: [],
    output_document: [],
    receipt: [],
    scrap_batch: [],
    chemistry: [],
    lab_result: [],
    stock_posting: [],
    issue: [],
    heat: [],
    payment: [],
    vat_check: [],
    sanctions_screen: [],
    bank_ack: [],
    fx_rate: [],
  }
}

class SimEngine {
  db: Db = emptyDb()
  messages: Message[] = []
  events: EventLine[] = []
  now = 0
  running = false
  speed: 1 | 4 | 10 | 30 = 4
  seed = 20261014
  faults: Record<FaultId, boolean> = {
    F1: true,
    F2: true,
    F3: true,
    F4: true,
    F5: true,
    F6: true,
    F7: true,
    F8: true,
    F9: true,
    F10: true,
  }
  hits: Record<FaultId, number> = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0, F7: 0, F8: 0, F9: 0, F10: 0 }
  counters = { vehicles: 0, messages: 0 }

  private rng = new Rng(this.seed)
  private queue: ScheduledEvent[] = []
  private seq = 1
  private eventSeq = 1
  private timer: number | null = null
  private version = 0
  private listeners = new Set<() => void>()

  /* ------------------------------ plumbing ------------------------------ */

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getVersion = () => this.version

  private notify() {
    this.version += 1
    this.listeners.forEach((l) => l())
  }

  private id(prefix: string, width = 4) {
    const n = this.seq++
    return `${prefix}${String(n).padStart(width, '0')}`
  }

  private at(delay: number, run: () => void) {
    const ev = { at: this.now + delay, run }
    // keep roughly sorted; the queue is small
    let i = this.queue.length - 1
    this.queue.push(ev)
    while (i >= 0 && this.queue[i].at > ev.at) {
      this.queue[i + 1] = this.queue[i]
      this.queue[i] = ev
      i -= 1
    }
  }

  private log(text: string, key: string, tone: EventLine['tone'] = 'neutral') {
    this.events.push({ id: this.eventSeq++, at: this.now, text, key, tone })
    if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS)
  }

  private fault(id: FaultId): boolean {
    const def = FAULTS.find((f) => f.id === id)!
    if (!this.faults[id]) return false
    const hit = this.rng.chance(def.rate)
    if (hit) this.hits[id] += 1
    return hit
  }

  private send(opts: {
    interfaceId: string
    from: SystemId
    to: SystemId
    key: string
    summary: string
    payload: Record<string, unknown>
    travel: number
    lost?: boolean
    duplicate?: boolean
    fault?: FaultId
    effect?: () => void
  }) {
    const msg: Message = {
      id: this.id('MSG-', 6),
      interfaceId: opts.interfaceId,
      from: opts.from,
      to: opts.to,
      key: opts.key,
      summary: opts.summary,
      payload: opts.payload,
      sentAt: this.now,
      arriveAt: this.now + opts.travel,
      status: 'in flight',
      fault: opts.fault,
    }
    this.messages.push(msg)
    this.counters.messages += 1
    if (this.messages.length > MAX_MESSAGES) this.messages.splice(0, this.messages.length - MAX_MESSAGES)

    this.at(opts.travel, () => {
      if (opts.lost) {
        msg.status = 'lost'
        this.log(`${opts.interfaceId} message for ${opts.key} was never delivered`, opts.key, 'danger')
        return
      }
      msg.status = opts.duplicate ? 'duplicate' : 'delivered'
      opts.effect?.()
    })
    return msg
  }

  /* -------------------------------- flows ------------------------------- */

  /** P1: steel truck, gate to invoice. */
  truckNow = () => {
    const site = this.rng.pick(SITES_STEEL)
    const vehicle = `VH-${this.rng.int(1000, 9999)}`
    const vendor = this.rng.pick(VENDORS)
    const po = this.ensurePo(vendor)
    const gate_pass = `GP-${site}-2026-${String(this.rng.int(1000, 9999))}`
    const gross = this.rng.step(30000, 44000, 20)
    const tare = this.rng.step(12000, 16500, 20)
    const net = gross - tare
    const drift = this.rng.step(860, 1240, 20) * (this.rng.chance(0.5) ? 1 : -1)
    const registered = tare + drift

    this.counters.vehicles += 1
    this.db.gate_pass.push({
      gate_pass,
      site,
      vehicle,
      transport: 'Truck',
      vendor,
      po: po.ebeln,
      process: 'P1',
      arrived: this.now,
    })
    this.db.weighbridge_ticket.push({
      ticket: this.id('WB-', 5),
      gate_pass,
      vehicle,
      gross_kg: gross,
      tare_kg: tare,
      net_kg: net,
      registered_tare_kg: registered,
      unit: 'kg',
      weighed: this.now,
    })
    this.log(
      `${vehicle} weighed at ${site}: gross ${fmt(gross)} kg, tare ${fmt(tare)} kg, net ${fmt(net)} kg`,
      gate_pass,
    )

    // IF-01 ------------------------------------------------------------
    const kgTonne = this.fault('F1')
    const staleTare = !kgTonne && this.fault('F2')
    const duplicate = this.fault('F3')
    let qty = net
    let fault: FaultId | undefined
    if (kgTonne) {
      qty = Math.round((net / 1000) * 100) / 100
      fault = 'F1'
    } else if (staleTare) {
      qty = gross - registered
      fault = 'F2'
    }

    const travel = this.rng.int(2, 6)
    const payload = {
      interface: 'IF-01',
      gatePass: gate_pass,
      vehicle,
      grossKg: gross,
      tareKg: staleTare ? registered : tare,
      quantity: qty,
      unit: 'KG',
      purchaseOrder: po.ebeln,
    }
    this.send({
      interfaceId: 'IF-01',
      from: 'Yard Management',
      to: 'SAP Steel',
      key: gate_pass,
      summary: `Weighbridge ticket ${vehicle} · ${fmt(qty)} KG`,
      payload,
      travel,
      fault,
      effect: () => {
        this.db.MSEG.push({
          mblnr: this.id('50', 8),
          xblnr: gate_pass,
          ebeln: po.ebeln,
          menge: qty,
          meins: 'KG',
          posted: this.now,
        })
        this.log(
          `SAP booked goods receipt for ${gate_pass}: ${fmt(qty)} KG`,
          gate_pass,
          fault ? 'danger' : 'neutral',
        )
      },
    })

    if (duplicate) {
      this.at(this.rng.int(1, 3), () => {
        this.send({
          interfaceId: 'IF-01',
          from: 'Yard Management',
          to: 'SAP Steel',
          key: gate_pass,
          summary: `Gateway retry of ticket ${vehicle}`,
          payload: { ...payload, retry: true },
          travel: this.rng.int(1, 3),
          duplicate: true,
          fault: 'F3',
          effect: () => {
            this.db.MSEG.push({
              mblnr: this.id('50', 8),
              xblnr: gate_pass,
              ebeln: po.ebeln,
              menge: qty,
              meins: 'KG',
              posted: this.now,
            })
            this.log(`Gateway retry created a second goods receipt for ${gate_pass}`, gate_pass, 'danger')
          },
        })
      })
    }

    // Supplier invoice --------------------------------------------------
    this.at(this.rng.int(35, 110), () => {
      const noPo = this.fault('F7')
      const ext = `INV-${this.rng.int(100000, 999999)}`
      const amount = Math.round((net / 1000) * po.price_eur_t)
      this.db.captured_invoice.push({
        doc: this.id('ESK-', 5),
        ext_invoice: ext,
        gate_pass,
        po: noPo ? '' : po.ebeln,
        qty_kg: net,
        amount_eur: amount,
        captured: this.now,
      })
      this.log(`Esker captured supplier invoice ${ext} for ${gate_pass}`, gate_pass)

      this.send({
        interfaceId: 'IF-06',
        from: 'Esker',
        to: 'SAP Steel',
        key: gate_pass,
        summary: `Captured invoice ${ext} · ${fmt(net)} kg`,
        payload: {
          interface: 'IF-06',
          externalInvoice: ext,
          gatePass: gate_pass,
          purchaseOrder: noPo ? null : po.ebeln,
          quantityKg: net,
          amountEur: amount,
        },
        travel: this.rng.int(3, 8),
        fault: noPo ? 'F7' : undefined,
        effect: () => this.threeWayMatch(gate_pass, ext, noPo ? '' : po.ebeln, net, amount, po.vendor),
      })
    })
  }

  private threeWayMatch(gate_pass: string, ext: string, ebeln: string, qty: number, amount: number, vendor: string) {
    const grs = this.db.MSEG.filter((m) => m.xblnr === gate_pass)
    let status: 'Posted' | 'Parked' = 'Posted'
    let reason = ''

    if (!ebeln) {
      status = 'Parked'
      reason = 'No purchase order reference'
    } else if (!grs.length) {
      status = 'Parked'
      reason = 'Goods receipt not found'
    } else {
      const booked = grs[0].menge
      const diff = Math.abs(booked - qty)
      if (diff / qty > 0.01) {
        status = 'Parked'
        reason = `Quantity differs by ${fmt(Math.round(diff))} kg`
      }
    }

    const belnr = this.id('51', 8)

    // Most suppliers invoice in euro. The rest are booked at the rate of the day.
    const currency = this.rng.chance(0.25) ? (this.rng.chance(0.5) ? 'USD' : 'GBP') : 'EUR'
    const pair = `${currency}/EUR`
    const rateRow = currency === 'EUR' ? undefined : [...this.db.fx_rate].reverse().find((f) => f.pair === pair)

    this.db.RBKP.push({
      belnr,
      ext_invoice: ext,
      gate_pass,
      ebeln,
      qty_kg: qty,
      amount_eur: amount,
      status,
      reason,
      currency,
      fx_rate_used: rateRow ? rateRow.rate : null,
      posted: this.now,
    })

    this.complianceChecks(belnr, vendor, gate_pass)
    this.log(
      status === 'Posted'
        ? `Invoice ${ext} posted against ${gate_pass}`
        : `Invoice ${ext} parked: ${reason}`,
      gate_pass,
      status === 'Posted' ? 'success' : 'danger',
    )

    if (status === 'Posted') {
      this.send({
        interfaceId: 'IF-09',
        from: 'SAP Steel',
        to: 'Lasernet',
        key: gate_pass,
        summary: `Invoice copy for ${ext}`,
        payload: { interface: 'IF-09', belnr, externalInvoice: ext, amountEur: amount },
        travel: this.rng.int(2, 5),
        effect: () => {
          this.db.output_document.push({
            doc: this.id('LN-', 5),
            type: 'Invoice copy',
            ref: belnr,
            created: this.now,
          })
        },
      })
    }
  }

  /** P2: recycling load, scrap to stock. */
  wagonNow = () => {
    const site = this.rng.pick(SITES_YARD)
    const transport = this.rng.pick(['Wagon', 'Truck', 'Container'] as const)
    const vehicle =
      transport === 'Wagon'
        ? `WGN-${this.rng.int(10000, 99999)}`
        : transport === 'Container'
          ? `CNU-${this.rng.int(1000000, 9999999)}`
          : `VH-${this.rng.int(1000, 9999)}`
    const gate_pass = `GP-${site}-2026-${String(this.rng.int(1000, 9999))}`
    // the recycling yard records in tonnes
    const gross = round2(this.rng.step(26000, 68000, 20) / 1000)
    const tare = round2(this.rng.step(9000, 22000, 20) / 1000)
    const net = round2(gross - tare)
    const netKg = Math.round(net * 1000)

    this.counters.vehicles += 1
    this.db.gate_pass.push({
      gate_pass,
      site,
      vehicle,
      transport,
      vendor: this.rng.pick(VENDORS),
      po: '',
      process: 'P2',
      arrived: this.now,
    })
    this.db.weighbridge_ticket.push({
      ticket: this.id('WB-', 5),
      gate_pass,
      vehicle,
      gross_kg: gross,
      tare_kg: tare,
      net_kg: net,
      registered_tare_kg: tare,
      unit: 't',
      weighed: this.now,
    })
    this.log(`${vehicle} arrived at ${site} with ${net} t of scrap`, gate_pass)

    const lost = this.fault('F4')
    this.send({
      interfaceId: 'IF-02',
      from: 'Yard Management',
      to: 'Scrap Yard',
      key: gate_pass,
      summary: `Recycling receipt ${vehicle} · ${net} t`,
      payload: { interface: 'IF-02', gatePass: gate_pass, vehicle, weight: net, unit: 't', site },
      travel: this.rng.int(2, 6),
      lost,
      fault: lost ? 'F4' : undefined,
      effect: () => {
        const receipt = this.id('RC-', 5)
        // Scrap Yard Operations converts the tonnes to kilograms
        this.db.receipt.push({
          receipt,
          gate_pass,
          vehicle,
          site,
          weight_kg: netKg,
          received: this.now,
        })
        this.at(this.rng.int(8, 25), () => this.sortation(receipt, netKg, gate_pass))
      },
    })
  }

  private sortation(receipt: string, weight: number, key: string) {
    const count = this.rng.int(1, 3)
    let left = weight
    for (let i = 0; i < count; i += 1) {
      const last = i === count - 1
      const share = last ? left : this.rng.step(left * 0.3, left * 0.6, 20)
      left -= share
      const grade = this.rng.pick(GRADES)
      const batch = this.id('BT-', 5)
      this.db.scrap_batch.push({ batch, receipt, grade, weight_kg: share, created: this.now })
      this.log(`Receipt ${receipt} sorted into ${batch} (${grade}, ${fmt(share)} kg)`, key)

      // IF-14 chemistry
      this.at(this.rng.int(10, 30), () => {
        const nominal = NOMINAL[grade]
        const sample = this.id('LAB-', 5)
        const noMo = this.fault('F5')
        this.db.lab_result.push({ sample, batch, grade, status: 'Released', tested: this.now })
        this.send({
          interfaceId: 'IF-14',
          from: 'Laboratory',
          to: 'Scrap Yard',
          key,
          summary: `Chemistry for ${batch}`,
          payload: {
            interface: 'IF-14',
            sample,
            batch,
            ni_pct: round2(nominal.ni + this.rng.float() * 0.6 - 0.3),
            cr_pct: round2(nominal.cr + this.rng.float() * 0.8 - 0.4),
            ...(noMo ? { molybdenum_pct: null } : { mo_pct: round2(nominal.mo + this.rng.float() * 0.2 - 0.1) }),
          },
          travel: this.rng.int(2, 6),
          fault: noMo ? 'F5' : undefined,
          effect: () => {
            this.db.chemistry.push({
              sample,
              batch,
              ni_pct: round2(nominal.ni + this.rng.float() * 0.6 - 0.3),
              cr_pct: round2(nominal.cr + this.rng.float() * 0.8 - 0.4),
              mo_pct: noMo ? null : round2(nominal.mo + this.rng.float() * 0.2 - 0.1),
              tested: this.now,
            })
            if (noMo) this.log(`Chemistry for ${batch} arrived without molybdenum`, key, 'danger')
          },
        })
      })

      // IF-03 stock posting
      this.at(this.rng.int(5, 15), () => {
        const notConverted = this.fault('F6')
        const qty = notConverted ? round2(share / 1000) : share
        this.send({
          interfaceId: 'IF-03',
          from: 'Scrap Yard',
          to: 'D365',
          key,
          summary: `Stock posting ${batch} · ${fmt(qty)} KG`,
          payload: { interface: 'IF-03', batch, qty, unit: 'KG', warehouse: 'RAW' },
          travel: this.rng.int(2, 5),
          fault: notConverted ? 'F6' : undefined,
          effect: () => {
            this.db.stock_posting.push({
              journal: this.id('JR-', 5),
              batch,
              item: grade,
              qty,
              unit: 'KG',
              warehouse: 'RAW',
              posted: this.now,
            })
            if (notConverted) {
              this.log(
                `D365 booked ${batch} as ${qty} KG instead of ${fmt(share)} KG — tonnes were not converted`,
                key,
                'danger',
              )
            }
          },
        })

        // the melt shop takes part or all of the batch, always in kilograms
        this.at(this.rng.int(20, 60), () => {
          const issued = Math.min(share, this.rng.step(share * 0.4, share, 20))
          this.db.issue.push({
            issue: this.id('IS-', 5),
            batch,
            qty_kg: issued,
            unit: 'KG',
            issued: this.now,
          })
          this.log(`Melt shop issued ${fmt(issued)} kg from ${batch}`, key)
        })
      })
    }
  }

  /** P4: mill heat. */
  private heatNow() {
    const heat = `HT-26-${this.rng.int(10000, 99999)}`
    const coils = this.rng.int(2, 4)
    const weight = this.rng.step(18000, 32000, 20)
    this.db.heat.push({ heat, coils, weight_kg: weight, started: this.now })
    this.log(`Mill finished heat ${heat} with ${coils} coils (${fmt(weight)} kg)`, heat)

    const late = this.fault('F8')
    const travel = late ? this.rng.int(25, 45) : this.rng.int(3, 10)
    this.send({
      interfaceId: 'IF-04',
      from: 'Mill',
      to: 'SAP Steel',
      key: heat,
      summary: `Production confirmation ${heat}`,
      payload: { interface: 'IF-04', heat, coils, weightKg: weight, delayMin: travel },
      travel,
      fault: late ? 'F8' : undefined,
      effect: () => {
        this.db.AFRU.push({
          rueck: this.id('AF-', 6),
          heat,
          coils,
          weight_kg: weight,
          delay_min: travel,
          received: this.now,
        })
        if (late) this.log(`Confirmation for ${heat} arrived ${travel} minutes late`, heat, 'danger')
      },
    })

    this.send({
      interfaceId: 'IF-10',
      from: 'Mill',
      to: 'Lasernet',
      key: heat,
      summary: `Mill certificate ${heat}`,
      payload: { interface: 'IF-10', heat, coils },
      travel: this.rng.int(2, 6),
      effect: () => {
        this.db.output_document.push({
          doc: this.id('LN-', 5),
          type: 'Mill certificate',
          ref: heat,
          created: this.now,
        })
      },
    })
  }

  /**
   * Before SAP books a supplier invoice it asks two outside services: is the VAT
   * number still valid, and is this vendor on today's sanctions list.
   */
  private complianceChecks(belnr: string, vendor: string, gate_pass: string) {
    const vat = VAT_NUMBERS[vendor] ?? 'GB 000 0000 00'
    this.send({
      interfaceId: 'IF-15',
      from: 'SAP Steel',
      to: 'VAT Service',
      key: gate_pass,
      summary: `VAT check for ${vendor}`,
      payload: { interface: 'IF-15', belnr, vendor, vatNumber: vat },
      travel: this.rng.int(1, 3),
      effect: () => {
        this.db.vat_check.push({
          check: this.id('VAT-', 5),
          belnr,
          vendor,
          vat_number: vat,
          valid: true,
          checked: this.now,
        })
      },
    })

    const stale = this.fault('F9')
    const today = simDayOf(this.now)
    const listDay = stale ? Math.max(0, today - 1) : today
    const listDate = simDateLabel(listDay * 1440)
    this.send({
      interfaceId: 'IF-16',
      from: 'SAP Steel',
      to: 'Sanctions Service',
      key: gate_pass,
      summary: `Sanctions screening for ${vendor}`,
      payload: { interface: 'IF-16', belnr, vendor, listDate },
      travel: this.rng.int(1, 3),
      fault: stale ? 'F9' : undefined,
      effect: () => {
        this.db.sanctions_screen.push({
          screen: this.id('SCR-', 5),
          belnr,
          vendor,
          list_day: listDay,
          list_date: listDate,
          hit: false,
          screened: this.now,
        })
        if (stale) {
          this.log(
            `${vendor} was screened against the sanctions list of ${listDate}, not the list of today`,
            gate_pass,
            'danger',
          )
        }
      },
    })
  }

  /** The exchange-rate file, loaded once a day at 06:00. */
  private loadRates() {
    const day = simDayOf(this.now)
    const date = simDateLabel(this.now)
    if (this.fault('F10')) {
      this.log(`No exchange-rate file arrived for ${date}; the rates of the day before stay in place`, 'fx-rates', 'danger')
    } else {
      FX_PAIRS.forEach((pair) => {
        const rate = Math.round(FX_BASE[pair] * (1 + this.rng.int(-120, 120) / 10000) * 10000) / 10000
        this.send({
          interfaceId: 'IF-18',
          from: 'FX Service',
          to: 'SAP Steel',
          key: 'fx-rates',
          summary: `${pair} ${rate} for ${date}`,
          payload: { interface: 'IF-18', pair, rate, date },
          travel: this.rng.int(1, 3),
          effect: () => {
            this.db.fx_rate.push({ day, date, pair, rate, loaded: this.now })
            if (this.db.fx_rate.length > 24) this.db.fx_rate.splice(0, this.db.fx_rate.length - 24)
          },
        })
      })
    }
    this.at(1440, () => this.loadRates())
  }

  /** Hourly payment run. */
  private paymentRun() {
    const paid = new Set(this.db.payment.map((p) => p.belnr))
    const due = this.db.RBKP.filter((r) => r.status === 'Posted' && !paid.has(r.belnr))
    if (due.length) {
      const run = this.id('PR-', 5)
      const total = due.reduce((n, d) => n + d.amount_eur, 0)
      this.send({
        interfaceId: 'IF-11',
        from: 'SAP Steel',
        to: 'Reval',
        key: 'payment-run',
        summary: `Payment file · ${due.length} invoices`,
        payload: { interface: 'IF-11', payRun: run, invoices: due.map((d) => d.belnr), count: due.length },
        travel: this.rng.int(2, 6),
        effect: () => {
          due.forEach((d) =>
            this.db.payment.push({
              pay: this.id('PY-', 5),
              belnr: d.belnr,
              vendor: this.db.EKPO.find((e) => e.ebeln === d.ebeln)?.vendor ?? 'VEND-1042',
              amount_eur: d.amount_eur,
              run_at: this.now,
            }),
          )
          this.log(`Payment run sent ${due.length} invoices to Reval`, 'payment-run', 'success')
        },
      })

      this.send({
        interfaceId: 'IF-17',
        from: 'SAP Steel',
        to: 'eBanking',
        key: 'payment-run',
        summary: `Payment instruction ${run} · ${due.length} invoices`,
        payload: { interface: 'IF-17', payRun: run, count: due.length, amountEur: total },
        travel: this.rng.int(3, 9),
        effect: () => {
          this.db.bank_ack.push({
            ack: this.id('ACK-', 5),
            pay_run: run,
            invoices: due.length,
            amount_eur: total,
            status: 'Acknowledged',
            acked: this.now,
          })
          this.log(`The bank acknowledged payment run ${run}`, 'payment-run', 'success')
        },
      })
    }
    this.at(60, () => this.paymentRun())
  }

  private ensurePo(vendor: string) {
    const existing = this.db.EKPO.find((p) => p.vendor === vendor)
    if (existing) return existing
    const po = {
      ebeln: `45${this.rng.int(10000000, 99999999)}`,
      vendor,
      material: 'SCRAP-STEEL-MIX',
      price_eur_t: this.rng.int(1850, 2300),
      open_qty_kg: this.rng.step(400000, 900000, 1000),
    }
    this.db.EKPO.push(po)
    return po
  }

  /* ------------------------------ scheduling ---------------------------- */

  private scheduleTrucks() {
    this.truckNow()
    this.at(this.rng.int(4, 9), () => this.scheduleTrucks())
  }

  private scheduleWagons() {
    this.wagonNow()
    this.at(this.rng.int(7, 13), () => this.scheduleWagons())
  }

  private scheduleHeats() {
    this.heatNow()
    this.at(this.rng.int(40, 60), () => this.scheduleHeats())
  }

  private prune() {
    const cutoff = this.now - RETAIN_MINUTES
    if (cutoff <= 0) return
    const keep = <T>(arr: T[], at: (row: T) => number) => arr.filter((r) => at(r) >= cutoff)
    this.db.gate_pass = keep(this.db.gate_pass, (r) => r.arrived)
    this.db.weighbridge_ticket = keep(this.db.weighbridge_ticket, (r) => r.weighed)
    this.db.MSEG = keep(this.db.MSEG, (r) => r.posted)
    this.db.RBKP = keep(this.db.RBKP, (r) => r.posted)
    this.db.AFRU = keep(this.db.AFRU, (r) => r.received)
    this.db.captured_invoice = keep(this.db.captured_invoice, (r) => r.captured)
    this.db.output_document = keep(this.db.output_document, (r) => r.created)
    this.db.receipt = keep(this.db.receipt, (r) => r.received)
    this.db.scrap_batch = keep(this.db.scrap_batch, (r) => r.created)
    this.db.chemistry = keep(this.db.chemistry, (r) => r.tested)
    this.db.lab_result = keep(this.db.lab_result, (r) => r.tested)
    this.db.stock_posting = keep(this.db.stock_posting, (r) => r.posted)
    this.db.issue = keep(this.db.issue, (r) => r.issued)
    this.db.heat = keep(this.db.heat, (r) => r.started)
    this.db.payment = keep(this.db.payment, (r) => r.run_at)
    this.db.vat_check = keep(this.db.vat_check, (r) => r.checked)
    this.db.sanctions_screen = keep(this.db.sanctions_screen, (r) => r.screened)
    this.db.bank_ack = keep(this.db.bank_ack, (r) => r.acked)
    // The rate of the day is still needed by invoices booked just before midnight,
    // so fx_rate is capped by row count instead of being pruned by age.
    this.messages = this.messages.filter((m) => m.arriveAt >= cutoff)
  }

  private advance(minutes: number) {
    const target = this.now + minutes
    let guard = 0
    while (this.queue.length && this.queue[0].at <= target && guard < 20000) {
      const ev = this.queue.shift()!
      this.now = ev.at
      ev.run()
      guard += 1
    }
    this.now = target
    this.prune()
  }

  /* --------------------------------- API -------------------------------- */

  reset = (seed = this.seed, warmupHours = 8) => {
    this.stop()
    this.seed = seed
    this.rng = new Rng(seed)
    this.db = emptyDb()
    this.messages = []
    this.events = []
    this.queue = []
    this.now = 0
    this.seq = 1
    this.eventSeq = 1
    this.counters = { vehicles: 0, messages: 0 }
    this.hits = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0, F7: 0, F8: 0, F9: 0, F10: 0 }

    this.at(0, () => this.loadRates())
    this.at(1, () => this.scheduleTrucks())
    this.at(3, () => this.scheduleWagons())
    this.at(12, () => this.scheduleHeats())
    this.at(60, () => this.paymentRun())
    this.advance(warmupHours * 60)
    this.notify()
  }

  start = () => {
    if (this.running) return
    this.running = true
    this.timer = window.setInterval(() => {
      this.advance(this.speed * 0.2)
      this.notify()
    }, 200)
    this.notify()
  }

  stop = () => {
    this.running = false
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    this.notify()
  }

  toggle = () => (this.running ? this.stop() : this.start())

  setSpeed = (s: 1 | 4 | 10 | 30) => {
    this.speed = s
    this.notify()
  }

  fastForward = (minutes: number) => {
    this.advance(minutes)
    this.notify()
  }

  addTruck = () => {
    this.truckNow()
    this.notify()
  }

  addWagon = () => {
    this.wagonNow()
    this.notify()
  }

  setFault = (id: FaultId, on: boolean) => {
    this.faults[id] = on
    this.notify()
  }

  setAllFaults = (on: boolean) => {
    FAULTS.forEach((f) => {
      this.faults[f.id] = on
    })
    this.notify()
  }

  /** Turn the named faults off and replay the plant from a clean start. */
  fixAndReplay = (ids: FaultId[]) => {
    ids.forEach((id) => {
      this.faults[id] = false
    })
    const wasRunning = this.running
    this.reset(this.seed + 1, 8)
    if (wasRunning) this.start()
  }

  inFlight = () => this.messages.filter((m) => m.status === 'in flight' && m.arriveAt > this.now)

  recordCount = () =>
    (Object.keys(this.db) as TableName[]).reduce((sum, t) => sum + this.db[t].length, 0)

  tableOf = (name: TableName) => this.db[name] as unknown as Record<string, unknown>[]
}

function fmt(n: number) {
  return n.toLocaleString('en-GB').replace(/,/g, ' ')
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export const engine = new SimEngine()
engine.reset(20261014, 8)
