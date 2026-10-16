/** Simulated clock starts 06:00 on 14 Oct 2026; sim time is minutes from there. */
export const SIM_EPOCH = new Date(2026, 9, 14, 6, 0, 0)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function simDate(minutes: number): Date {
  return new Date(SIM_EPOCH.getTime() + minutes * 60_000)
}

/** "14 Oct 14:22" */
export function fmtSim(minutes: number): string {
  const d = simDate(minutes)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "14:22" */
export function fmtSimTime(minutes: number): string {
  const d = simDate(minutes)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

/** 38420 -> "38 420" */
export function num(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n
    .toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(/,/g, ' ')
}

export function kg(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  const digits = Math.abs(n) < 100 && !Number.isInteger(n) ? 2 : 0
  return `${num(n, digits)} kg`
}

export function eur(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `€ ${num(Math.round(n))}`
}

export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)} %`
}

export function minutes(n: number): string {
  if (n < 60) return `${Math.round(n)} min`
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${num(n)} ${n === 1 ? one : many}`
}
