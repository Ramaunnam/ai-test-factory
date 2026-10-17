import { engine, expectedQualityResult } from './engine'
import type { Message, SystemId, TableName } from './types'

export interface TraceField {
  label: string
  value: string | number | null
  flagged?: boolean
  note?: string
}

export interface TraceRecord {
  system: SystemId
  table: TableName
  title: string
  at: number
  fields: TraceField[]
  flagged: boolean
}

export interface TraceResult {
  query: string
  key: string
  found: boolean
  verdict: string
  tone: 'danger' | 'success' | 'warning'
  records: TraceRecord[]
  messages: Message[]
}

const fmt = (n: number) => n.toLocaleString('en-GB').replace(/,/g, ' ')

/** Resolve whatever the user typed into a gate pass or a heat. */
function resolveKey(raw: string): string | null {
  const db = engine.db
  const q = raw.trim().toUpperCase()
  if (!q) return null

  if (q.startsWith('GP-')) return db.gate_pass.find((g) => g.gate_pass === q)?.gate_pass ?? null
  if (q.startsWith('HT-')) return db.heat.find((h) => h.heat === q)?.heat ?? null

  if (q.startsWith('VH-') || q.startsWith('WGN-') || q.startsWith('CNU-')) {
    const visits = db.gate_pass.filter((g) => g.vehicle === q)
    if (!visits.length) return null
    return visits.reduce((a, b) => (a.arrived >= b.arrived ? a : b)).gate_pass
  }
  if (q.startsWith('BT-')) {
    const batch = db.scrap_batch.find((b) => b.batch === q)
    if (!batch) return null
    return db.receipt.find((r) => r.receipt === batch.receipt)?.gate_pass ?? null
  }
  if (q.startsWith('RC-')) return db.receipt.find((r) => r.receipt === q)?.gate_pass ?? null
  if (q.startsWith('INV-')) return db.RBKP.find((r) => r.ext_invoice === q)?.gate_pass ?? null
  if (q.startsWith('LAB-')) {
    const chem = db.chemistry.find((c) => c.sample === q)
    const batch = chem && db.scrap_batch.find((b) => b.batch === chem.batch)
    return batch ? (db.receipt.find((r) => r.receipt === batch.receipt)?.gate_pass ?? null) : null
  }
  // last resort: an SAP document number
  const byDoc = db.RBKP.find((r) => r.belnr === q)
  if (byDoc) return byDoc.gate_pass
  const byMseg = db.MSEG.find((m) => m.mblnr === q)
  if (byMseg) return byMseg.xblnr
  return null
}

export function trace(raw: string): TraceResult {
  const db = engine.db
  const key = resolveKey(raw)
  if (!key) {
    return {
      query: raw,
      key: '',
      found: false,
      verdict: 'Nothing found for that reference in the last 24 hours.',
      tone: 'warning',
      records: [],
      messages: [],
    }
  }

  const records: TraceRecord[] = []
  const problems: string[] = []

  if (key.startsWith('HT-')) {
    const heat = db.heat.find((h) => h.heat === key)!
    const afru = db.AFRU.find((a) => a.heat === key)
    const cert = db.output_document.find((d) => d.ref === key)
    records.push({
      system: 'Mill',
      table: 'heat',
      title: `Heat ${heat.heat}`,
      at: heat.started,
      flagged: false,
      fields: [
        { label: 'Heat', value: heat.heat },
        { label: 'Coils', value: heat.coils },
        { label: 'Weight', value: `${fmt(heat.weight_kg)} kg` },
      ],
    })
    if (afru) {
      const late = afru.delay_min > 15
      if (late) problems.push(`the mill confirmation took ${afru.delay_min} minutes`)
      records.push({
        system: 'SAP Steel',
        table: 'AFRU',
        title: `Production confirmation ${afru.rueck}`,
        at: afru.received,
        flagged: late,
        fields: [
          { label: 'Confirmation', value: afru.rueck },
          { label: 'Coils', value: afru.coils },
          { label: 'Weight', value: `${fmt(afru.weight_kg)} kg` },
          {
            label: 'Delay',
            value: `${afru.delay_min} min`,
            flagged: late,
            note: late ? 'Over the 15 minute limit' : undefined,
          },
        ],
      })
    } else {
      problems.push('no confirmation has reached SAP')
    }
    if (cert) {
      records.push({
        system: 'Lasernet',
        table: 'output_document',
        title: `Mill certificate ${cert.doc}`,
        at: cert.created,
        flagged: false,
        fields: [
          { label: 'Document', value: cert.doc },
          { label: 'Type', value: cert.type },
          { label: 'Reference', value: cert.ref },
        ],
      })
    }
  } else {
    const gp = db.gate_pass.find((g) => g.gate_pass === key)!
    const ticket = db.weighbridge_ticket.find((t) => t.gate_pass === key)

    records.push({
      system: 'Yard Management',
      table: 'gate_pass',
      title: `Gate pass ${gp.gate_pass}`,
      at: gp.arrived,
      flagged: false,
      fields: [
        { label: 'Gate pass', value: gp.gate_pass },
        { label: 'Site', value: gp.site },
        { label: 'Vehicle', value: gp.vehicle },
        { label: 'Transport', value: gp.transport },
        { label: 'Vendor', value: gp.vendor },
        { label: 'Purchase order', value: gp.po || '—' },
      ],
    })

    if (ticket) {
      const staleTare = Math.abs(ticket.tare_kg - ticket.registered_tare_kg) > 20
      records.push({
        system: 'Yard Management',
        table: 'weighbridge_ticket',
        title: `Weighbridge ticket ${ticket.ticket}`,
        at: ticket.weighed,
        flagged: false,
        fields: [
          { label: 'Gross', value: `${fmt(ticket.gross_kg)} ${ticket.unit}` },
          { label: 'Tare (weighed)', value: `${fmt(ticket.tare_kg)} ${ticket.unit}` },
          {
            label: 'Tare (vehicle master)',
            value: `${fmt(ticket.registered_tare_kg)} ${ticket.unit}`,
            flagged: staleTare && gp.process === 'P1',
          },
          { label: 'Net', value: `${fmt(ticket.net_kg)} ${ticket.unit}` },
        ],
      })
    }

    // P1 chain ----------------------------------------------------------
    const grs = db.MSEG.filter((m) => m.xblnr === key)
    grs.forEach((m, i) => {
      const wrong = ticket ? Math.abs(ticket.net_kg - m.menge) > 20 : false
      if (wrong && i === 0) {
        problems.push(
          Math.abs(m.menge * 1000 - (ticket?.net_kg ?? 0)) <= 20
            ? `SAP booked ${m.menge} ${m.meins} instead of ${fmt(ticket!.net_kg)} kg`
            : `SAP booked ${fmt(m.menge)} ${m.meins} against ${fmt(ticket!.net_kg)} kg weighed`,
        )
      }
      if (i > 0) problems.push('the goods receipt exists twice')
      records.push({
        system: 'SAP Steel',
        table: 'MSEG',
        title: `Goods receipt ${m.mblnr}${i > 0 ? ' (duplicate)' : ''}`,
        at: m.posted,
        flagged: wrong || i > 0,
        fields: [
          { label: 'Document', value: m.mblnr },
          { label: 'Reference', value: m.xblnr },
          { label: 'Purchase order', value: m.ebeln },
          { label: 'Quantity', value: `${fmt(m.menge)} ${m.meins}`, flagged: wrong },
        ],
      })
    })

    const captured = db.captured_invoice.filter((c) => c.gate_pass === key)
    captured.forEach((c) => {
      const noPo = !c.po
      if (noPo) problems.push('the captured invoice has no purchase order')
      records.push({
        system: 'Esker',
        table: 'captured_invoice',
        title: `Captured invoice ${c.ext_invoice}`,
        at: c.captured,
        flagged: noPo,
        fields: [
          { label: 'Document', value: c.doc },
          { label: 'External invoice', value: c.ext_invoice },
          { label: 'Purchase order', value: c.po || 'missing', flagged: noPo },
          { label: 'Quantity', value: `${fmt(c.qty_kg)} kg` },
          { label: 'Amount', value: `€ ${fmt(Math.round(c.amount_eur))}` },
        ],
      })
    })

    db.RBKP.filter((r) => r.gate_pass === key).forEach((r) => {
      const parked = r.status === 'Parked'
      if (parked) problems.push(`the invoice is parked (${r.reason.toLowerCase()})`)
      records.push({
        system: 'SAP Steel',
        table: 'RBKP',
        title: `Invoice ${r.belnr}`,
        at: r.posted,
        flagged: parked,
        fields: [
          { label: 'Document', value: r.belnr },
          { label: 'External invoice', value: r.ext_invoice },
          { label: 'Quantity', value: `${fmt(r.qty_kg)} kg` },
          { label: 'Amount', value: `€ ${fmt(Math.round(r.amount_eur))}` },
          { label: 'Currency', value: r.currency },
          { label: 'Status', value: r.status, flagged: parked },
          { label: 'Reason', value: r.reason || '—', flagged: parked },
        ],
      })
      const vat = db.vat_check.find((v) => v.belnr === r.belnr)
      if (vat) {
        records.push({
          system: 'VAT Service',
          table: 'vat_check',
          title: `VAT check ${vat.check}`,
          at: vat.checked,
          flagged: !vat.valid,
          fields: [
            { label: 'Vendor', value: vat.vendor },
            { label: 'VAT number', value: vat.vat_number },
            { label: 'Valid', value: vat.valid ? 'yes' : 'no', flagged: !vat.valid },
          ],
        })
      }

      const screen = db.sanctions_screen.find((x) => x.belnr === r.belnr)
      if (screen) {
        const staleList = screen.list_day !== Math.floor(screen.screened / 1440)
        if (staleList) problems.push('the vendor was screened against an out-of-date sanctions list')
        records.push({
          system: 'Sanctions Service',
          table: 'sanctions_screen',
          title: `Sanctions screening ${screen.screen}`,
          at: screen.screened,
          flagged: staleList,
          fields: [
            { label: 'Vendor', value: screen.vendor },
            {
              label: 'List used',
              value: screen.list_date,
              flagged: staleList,
              note: staleList ? 'the list of the day before, not the list of the day' : undefined,
            },
            { label: 'On the list', value: screen.hit ? 'yes' : 'no', flagged: screen.hit },
          ],
        })
      }

      if (r.currency !== 'EUR') {
        const pair = `${r.currency}/EUR`
        const day = Math.floor(r.posted / 1440)
        const rateRow = db.fx_rate.find((f) => f.pair === pair && f.day === day && f.loaded <= r.posted)
        const wrongRate = !rateRow && !db.fx_rate.some((f) => f.pair === pair && f.day === day)
        if (wrongRate) problems.push(`no exchange rate was loaded for ${pair} that day`)
        records.push({
          system: 'FX Service',
          table: 'fx_rate',
          title: `Exchange rate ${pair}`,
          at: rateRow ? rateRow.loaded : r.posted,
          flagged: wrongRate,
          fields: [
            { label: 'Currency', value: r.currency },
            { label: 'Rate used', value: r.fx_rate_used ?? 'none', flagged: wrongRate },
            { label: 'Rate of the day', value: rateRow ? rateRow.rate : 'not loaded', flagged: wrongRate },
          ],
        })
      }

      const doc = db.output_document.find((d) => d.ref === r.belnr)
      if (doc) {
        records.push({
          system: 'Lasernet',
          table: 'output_document',
          title: `Output document ${doc.doc}`,
          at: doc.created,
          flagged: false,
          fields: [
            { label: 'Document', value: doc.doc },
            { label: 'Type', value: doc.type },
            { label: 'Reference', value: doc.ref },
          ],
        })
      }
      const pay = db.payment.find((p) => p.belnr === r.belnr)
      if (pay) {
        records.push({
          system: 'Reval',
          table: 'payment',
          title: `Payment ${pay.pay}`,
          at: pay.run_at,
          flagged: false,
          fields: [
            { label: 'Payment', value: pay.pay },
            { label: 'Invoice', value: pay.belnr },
            { label: 'Vendor', value: pay.vendor },
            { label: 'Amount', value: `€ ${fmt(Math.round(pay.amount_eur))}` },
          ],
        })

        const ack = [...db.bank_ack].reverse().find((a) => a.acked >= pay.run_at)
        if (ack) {
          records.push({
            system: 'eBanking',
            table: 'bank_ack',
            title: `Bank acknowledgement ${ack.ack}`,
            at: ack.acked,
            flagged: false,
            fields: [
              { label: 'Payment run', value: ack.pay_run },
              { label: 'Invoices', value: ack.invoices },
              { label: 'Amount', value: `€ ${fmt(Math.round(ack.amount_eur))}` },
              { label: 'Status', value: ack.status },
            ],
          })
        }
      }
    })

    // P2 chain ----------------------------------------------------------
    const receipt = db.receipt.find((r) => r.gate_pass === key)
    if (gp.process === 'P2' && !receipt) {
      problems.push('the receipt never reached Scrap Yard Operations')
    }
    if (receipt) {
      records.push({
        system: 'Scrap Yard',
        table: 'receipt',
        title: `Receipt ${receipt.receipt}`,
        at: receipt.received,
        flagged: false,
        fields: [
          { label: 'Receipt', value: receipt.receipt },
          { label: 'Vehicle', value: receipt.vehicle },
          { label: 'Site', value: receipt.site },
          { label: 'Weight', value: `${fmt(receipt.weight_kg)} kg` },
        ],
      })
      db.scrap_batch
        .filter((b) => b.receipt === receipt.receipt)
        .forEach((b) => {
          records.push({
            system: 'Scrap Yard',
            table: 'scrap_batch',
            title: `Batch ${b.batch}`,
            at: b.created,
            flagged: false,
            fields: [
              { label: 'Batch', value: b.batch },
              { label: 'Grade', value: b.grade },
              { label: 'Weight', value: `${fmt(b.weight_kg)} kg` },
            ],
          })
          const chem = db.chemistry.find((c) => c.batch === b.batch)
          if (chem) {
            const noMo = chem.mo_pct === null
            if (noMo) problems.push(`chemistry for ${b.batch} has no molybdenum`)
            records.push({
              system: 'Scrap Yard',
              table: 'chemistry',
              title: `Chemistry ${chem.sample}`,
              at: chem.tested,
              flagged: noMo,
              fields: [
                { label: 'Sample', value: chem.sample },
                { label: 'Ni %', value: chem.ni_pct },
                { label: 'Cr %', value: chem.cr_pct },
                { label: 'Mo %', value: chem.mo_pct ?? 'empty', flagged: noMo },
              ],
            })
          }
          const order = db.quality_order.find((q) => q.batch === b.batch)
          if (order) {
            const incomplete = order.result === 'Incomplete'
            const expected = expectedQualityResult(b.grade, order.ni_pct, order.cr_pct, order.mo_pct)
            const wrong = !incomplete && order.result !== expected
            if (incomplete) problems.push(`the quality order for ${b.batch} could not be completed`)
            if (wrong) problems.push(`the quality order for ${b.batch} says ${order.result} but the values say ${expected}`)
            records.push({
              system: 'D365',
              table: 'quality_order',
              title: `Quality order ${order.order}`,
              at: order.created,
              flagged: incomplete || wrong,
              fields: [
                { label: 'Order', value: order.order },
                { label: 'Batch', value: order.batch },
                { label: 'Grade', value: order.grade },
                { label: 'Result', value: order.result, flagged: incomplete || wrong },
                {
                  label: 'Expected',
                  value: expected,
                  note: incomplete ? 'the chemistry never arrived complete' : undefined,
                },
              ],
            })
          }

          db.transfer
            .filter((tr) => tr.batch === b.batch)
            .forEach((tr) => {
              const short = tr.received_kg !== null && Math.abs(tr.received_kg - tr.weight_kg) > 1
              const stuck = tr.received_kg === null
              if (short) {
                problems.push(
                  `${tr.to_site} booked ${tr.received_kg} ${tr.unit} for ${b.batch} instead of ${fmt(tr.weight_kg)} kg`,
                )
              }
              records.push({
                system: 'D365',
                table: 'transfer',
                title: `Transfer ${tr.transfer}`,
                at: tr.sent,
                flagged: short,
                fields: [
                  { label: 'Transfer', value: tr.transfer },
                  { label: 'From', value: tr.from_site },
                  { label: 'To', value: tr.to_site },
                  { label: 'Sent', value: `${fmt(tr.weight_kg)} kg` },
                  {
                    label: 'Booked on arrival',
                    value: stuck ? 'still moving' : `${fmt(tr.received_kg as number)} ${tr.unit}`,
                    flagged: short,
                  },
                ],
              })
            })

          const selfBilling = db.output_document.find((d) => d.ref === b.batch)
          if (selfBilling) {
            records.push({
              system: 'Lasernet',
              table: 'output_document',
              title: `Output document ${selfBilling.doc}`,
              at: selfBilling.created,
              flagged: false,
              fields: [
                { label: 'Document', value: selfBilling.doc },
                { label: 'Type', value: selfBilling.type },
                { label: 'Reference', value: selfBilling.ref },
              ],
            })
          }

          const stock = db.stock_posting.find((s) => s.batch === b.batch)
          if (stock) {
            const notConverted = Math.abs(stock.qty * 1000 - b.weight_kg) <= 20
            if (notConverted) {
              problems.push(
                `D365 holds ${stock.qty} ${stock.unit} for ${b.batch} instead of ${fmt(b.weight_kg)} kg`,
              )
            }
            records.push({
              system: 'D365',
              table: 'stock_posting',
              title: `Stock posting ${stock.journal}`,
              at: stock.posted,
              flagged: notConverted,
              fields: [
                { label: 'Journal', value: stock.journal },
                { label: 'Batch', value: stock.batch },
                { label: 'Quantity', value: `${fmt(stock.qty)} ${stock.unit}`, flagged: notConverted },
                { label: 'Expected', value: `${fmt(b.weight_kg)} KG` },
                { label: 'Warehouse', value: stock.warehouse },
              ],
            })
          }
          db.issue
            .filter((i) => i.batch === b.batch)
            .forEach((iss) => {
              const over = !!stock && iss.qty_kg > stock.qty + 1
              records.push({
                system: 'D365',
                table: 'issue',
                title: `Issued to the melt shop ${iss.issue}`,
                at: iss.issued,
                flagged: over,
                fields: [
                  { label: 'Issue', value: iss.issue },
                  { label: 'Batch', value: iss.batch },
                  { label: 'Issued', value: `${fmt(iss.qty_kg)} ${iss.unit}`, flagged: over },
                  {
                    label: 'Stock at the time',
                    value: stock ? `${fmt(stock.qty)} ${stock.unit}` : 'nothing booked',
                    flagged: over,
                  },
                ],
              })
            })
        })
    }
  }

  records.sort((a, b) => a.at - b.at)
  const messages = engine.messages.filter((m) => m.key === key).sort((a, b) => a.sentAt - b.sentAt)

  let verdict = 'Every system agrees on this one.'
  let tone: TraceResult['tone'] = 'success'
  if (problems.length) {
    verdict = `${capitalise(problems[0])}${problems.length > 1 ? `, and ${problems.length - 1} more ${problems.length === 2 ? 'problem' : 'problems'}` : ''}.`
    tone = 'danger'
  }

  return { query: raw, key, found: true, verdict, tone, records, messages }
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Keys worth offering as chips: a few broken ones, a few clean ones. */
export function traceSuggestions(failingKeys: string[], limit = 8) {
  const db = engine.db
  const failing = Array.from(new Set(failingKeys)).slice(0, limit / 2)
  const clean = db.gate_pass
    .filter((g) => !failing.includes(g.gate_pass))
    .slice(-20)
    .reverse()
    .slice(0, limit - failing.length)
    .map((g) => g.gate_pass)
  return { failing, clean }
}
