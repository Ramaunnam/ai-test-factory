import { engine } from '@/sim/engine'
import { INTERFACES } from '@/data'

export interface InterfaceStat {
  id: string
  name: string
  sent: number
  intact: number
  mismatched: number
  missing: number
  duplicated: number
  clean: boolean
}

/**
 * Agreement on the interfaces, at two levels: how many interfaces are entirely
 * clean, and how many individual messages arrived intact. The score uses the
 * message level, because one damaged message should not condemn an interface
 * that carried two hundred good ones.
 */
export function interfaceStats() {
  const live = INTERFACES.filter((i) => i.live)
  const rows: InterfaceStat[] = live.map((i) => {
    const msgs = engine.messages.filter((m) => m.interfaceId === i.id)
    const missing = msgs.filter((m) => m.status === 'lost').length
    const duplicated = msgs.filter((m) => m.status === 'duplicate').length
    const mismatched = msgs.filter((m) => m.fault && m.status !== 'lost' && m.status !== 'duplicate').length
    return {
      id: i.id,
      name: i.name,
      sent: msgs.length,
      intact: msgs.length - missing - duplicated - mismatched,
      mismatched,
      missing,
      duplicated,
      clean: !missing && !duplicated && !mismatched,
    }
  })

  const messagesTotal = rows.reduce((s, r) => s + r.sent, 0)
  const messagesMatched = rows.reduce((s, r) => s + r.intact, 0)

  return {
    rows,
    matched: rows.filter((r) => r.clean).length,
    measured: rows.length,
    notMeasured: INTERFACES.length - rows.length,
    total: INTERFACES.length,
    messagesMatched,
    messagesTotal,
    messagePct: messagesTotal ? Math.round((messagesMatched / messagesTotal) * 1000) / 10 : 100,
  }
}
