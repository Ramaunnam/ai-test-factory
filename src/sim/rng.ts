/** Deterministic PRNG so every replay of the plant is identical. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class Rng {
  private next: () => number
  constructor(seed: number) {
    this.next = mulberry32(seed)
  }
  float() {
    return this.next()
  }
  /** inclusive integer range */
  int(min: number, max: number) {
    return min + Math.floor(this.next() * (max - min + 1))
  }
  /** rounded to a step, e.g. weights to the nearest 20 kg */
  step(min: number, max: number, step: number) {
    const raw = min + this.next() * (max - min)
    return Math.round(raw / step) * step
  }
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }
  /** true with the given probability (0..1) */
  chance(p: number) {
    return this.next() < p
  }
}
