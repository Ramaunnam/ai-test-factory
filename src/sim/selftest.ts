/**
 * Proves the engine invariant outside the browser:
 *   all faults on  → most checks fail with a sensible cause
 *   all faults off → every check passes
 *
 * Run with:  npm run selftest
 */
import { engine } from './engine'
import { runAllChecks } from './checks'
import { trace } from './trace'

function report(label: string) {
  const results = runAllChecks()
  const passing = results.filter((r) => r.status === 'pass').length
  const compared = results.reduce((s, r) => s + r.compared, 0)
  const disagree = results.reduce((s, r) => s + r.rows.length, 0)
  console.log(`\n${label}`)
  console.log(`  ${passing} of ${results.length} checks pass · ${compared} records compared · ${disagree} disagree`)
  results.forEach((r) => {
    const mark = r.status === 'pass' ? 'pass' : 'FAIL'
    console.log(`  ${r.id}  ${mark.padEnd(4)}  ${String(r.rows.length).padStart(3)} bad / ${String(r.compared).padStart(4)}  ${r.title}`)
    if (r.rows.length) console.log(`        why: ${r.rows[0].why}`)
  })
  return { passing, total: results.length, results }
}

engine.setAllFaults(true)
engine.reset(20261014, 8)
const withFaults = report('ALL FAULTS ON')

const firstBad = withFaults.results.find((r) => r.rows.length)?.rows[0].key
if (firstBad) {
  const t = trace(firstBad)
  console.log(`\n  trace(${firstBad}) → ${t.records.length} records, ${t.messages.length} messages`)
  console.log(`  verdict: ${t.verdict}`)
}

engine.setAllFaults(false)
engine.reset(20261015, 8)
const clean = report('ALL FAULTS OFF')

if (clean.passing !== clean.total) {
  console.error(`\nFAILED: expected all ${clean.total} checks to pass with the faults off.`)
  process.exit(1)
}
if (withFaults.passing > 6) {
  console.error('\nFAILED: expected most checks to fail with every fault on.')
  process.exit(1)
}
console.log('\nOK: faults off → every check passes; faults on → the data really breaks.\n')
