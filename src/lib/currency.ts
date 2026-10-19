import { useSyncExternalStore } from 'react'
import { num } from './format'

/**
 * Money is held in euro everywhere: the simulated plant, the tables, the
 * messages and the checks. Only the display converts, so switching currency
 * never changes a single stored value.
 */
export type CurrencyCode = 'EUR' | 'USD' | 'INR'

export interface Currency {
  code: CurrencyCode
  symbol: string
  name: string
  /** How many of this currency one euro buys. Fixed, and labelled as such. */
  rate: number
  /** Indian grouping puts the lakh and crore separators in: 12,34,567. */
  grouping: 'western' | 'indian'
}

/** One place for the rates. They are illustrative, not a market feed. */
export const CURRENCIES: Currency[] = [
  { code: 'EUR', symbol: '€', name: 'Euro', rate: 1, grouping: 'western' },
  { code: 'USD', symbol: '$', name: 'US dollar', rate: 1.09, grouping: 'western' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', rate: 97.5, grouping: 'indian' },
]

export const RATES_NOTE = 'Illustrative rates'

export function currencyByCode(code: CurrencyCode): Currency {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0]
}

/* -------------------------------------------------------------------------- */
/* The choice, remembered for the session                                     */
/* -------------------------------------------------------------------------- */

const KEY = 'j2w.currency'

function read(): CurrencyCode {
  try {
    const stored = window.sessionStorage.getItem(KEY)
    if (stored === 'EUR' || stored === 'USD' || stored === 'INR') return stored
  } catch {
    /* a private window, or storage switched off */
  }
  return 'EUR'
}

let code: CurrencyCode = typeof window === 'undefined' ? 'EUR' : read()
const listeners = new Set<() => void>()

export const currencyStore = {
  get: (): CurrencyCode => code,
  /** The same answer on the server, so a rendered page never flickers. */
  getServer: (): CurrencyCode => 'EUR',
  set(next: CurrencyCode) {
    if (next === code) return
    code = next
    try {
      window.sessionStorage.setItem(KEY, next)
    } catch {
      /* nothing to remember it with; the choice still holds for this page */
    }
    listeners.forEach((l) => l())
  },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

/** "12,34,567" for rupees, "1 234 567" for the rest, matching the app's style. */
function group(value: number, currency: Currency): string {
  if (currency.grouping !== 'indian') return num(value)
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)
}

/** An amount held in euro, shown in the chosen currency. */
export function formatMoney(amountEur: number | null | undefined, currency: Currency): string {
  if (amountEur === null || amountEur === undefined || Number.isNaN(amountEur)) return '—'
  const value = Math.round(amountEur * currency.rate)
  return currency.grouping === 'indian' ? `${currency.symbol}${group(value, currency)}` : `${currency.symbol} ${group(value, currency)}`
}

/**
 * Rewrites amounts that were already written as euro, such as the ones the
 * trace, the run steps and the migration sets carry. The stored text keeps its
 * euro value; only what is shown changes.
 */
export function convertMoneyText(text: string, currency: Currency): string {
  if (currency.code === 'EUR') return text
  return text.replace(/€\s*([0-9][0-9\s,]*)/g, (whole, digits: string) => {
    const amount = Number(digits.replace(/[\s,]/g, ''))
    return Number.isFinite(amount) ? formatMoney(amount, currency) : whole
  })
}

/* -------------------------------------------------------------------------- */
/* The hook every screen that shows money uses                                */
/* -------------------------------------------------------------------------- */

export function useCurrency(): Currency {
  const active = useSyncExternalStore(currencyStore.subscribe, currencyStore.get, currencyStore.getServer)
  return currencyByCode(active)
}

/**
 * `money` for an amount in euro, `text` for a string that already carries one.
 * Calling it subscribes the screen, so every amount follows the header.
 */
export function useMoney() {
  const currency = useCurrency()
  return {
    currency,
    money: (amountEur: number | null | undefined) => formatMoney(amountEur, currency),
    text: (value: string) => convertMoneyText(value, currency),
  }
}
