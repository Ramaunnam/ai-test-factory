// SHOTS=1 saves every zoom window to out/focus/ for a look.
import { mkdirSync } from 'node:fs';
import { initTargeting, fit, VW, VH } from './focuslib.mjs';
import { T } from './targets.mjs';
import { APP } from './config.mjs';
import { launch } from './browser.mjs';
mkdirSync('out/focus', { recursive: true });
const b = await launch(1);
const ctx = await b.newContext({ viewport: { width: VW, height: VH } });
await ctx.addInitScript(initTargeting);
await ctx.addInitScript(css => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css + '::-webkit-scrollbar{width:0;height:0}'; document.head.appendChild(s); }), APP.hideCss);
const p = await ctx.newPage();
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0, n = 0;
async function check(name) {
  const { t, ...opts } = T[name] || {};
  if (!t) { console.log(`  UNDEFINED ${name}`); bad++; return; }
  let r = await p.evaluate(x => window.__rect(x), t);
  if (r && (r.y < 16 || r.y + r.h > VH - 16)) { await p.evaluate(x => window.__scroll(x.t, x.block, 480), { t, block: r.h > VH * 0.8 ? 'start' : 'center' }); await sleep(300); r = await p.evaluate(x => window.__rect(x), t); }
  if (!r) { console.log(`  MISS   ${name}`); bad++; return; }
  const f = fit(r, opts), size = `${Math.round(r.w)}x${Math.round(r.h)}`.padEnd(10);
  if (!f) { console.log(`  WIDE   ${name.padEnd(14)} ${size} cannot be framed, will stay wide (try padX: 8, clipW, or a smaller region)`); bad++; return; }
  const weak = f.z < 1.15;
  console.log(`  ${weak ? 'CHECK ' : 'ok    '} ${name.padEnd(14)} ${size} x${f.z.toFixed(2)}${weak ? '  barely a zoom' : ''}`);
  if (weak) bad++;
  if (process.env.SHOTS) await p.screenshot({ path: `out/focus/${String(++n).padStart(2, '0')}_${name}.png`, clip: { x: f.x, y: f.y, width: f.wW, height: f.wH } });
}
await p.goto(APP.base + '/', { waitUntil: 'networkidle' });
await p.waitForSelector(APP.ready);
await sleep(1000);
// ---- the story as fast Playwright calls, with check('targetName') wherever a target is used ----
await p.getByRole('link', { name: 'Testing Journey' }).click();
await sleep(900);
await check('journeySteps');
await check('requirements');
await p.getByRole('button', { name: /ADV-01/ }).click();
await sleep(600);
await p.getByRole('button', { name: /^1\s*\|?\s*Learn the process/ }).first().click();
await sleep(600);
await check('stepDetail');
await check('truckJourney');

await p.getByRole('button', { name: /Open this step in the app/ }).click();
await sleep(1100);
await check('discoveryIn');

await p.getByRole('link', { name: 'Test Studio' }).click();
await sleep(900);
await check('studioRule');

await p.getByRole('link', { name: 'Run Centre' }).click();
await sleep(800);
await p.getByRole('button', { name: 'Run the P1 demo now' }).click();
await sleep(4000);
await check('runStrip');
await sleep(13000);          // let the run reach its verdict
await check('runVerdict');

await p.getByRole('link', { name: /Live Data Flow/ }).click();
await sleep(800);
await p.getByRole('tab', { name: 'Live Checks' }).click();
await sleep(800);
await check('checksC1');
await p.getByText('How this works').first().click();
await sleep(900);
await check('drawer');
await p.keyboard.press('Escape');
await sleep(400);

await p.getByRole('link', { name: 'Interface Testing' }).click();
await sleep(1100);
await check('interfaceTbl');
await p.getByRole('link', { name: 'Command Centre' }).click();
await sleep(800);
await p.getByRole('tab', { name: 'Month-End Load' }).click();
await sleep(1000);
await p.getByRole('button', { name: '5x', exact: true }).click();
await sleep(500);
await p.getByRole('button', { name: 'Run load test' }).first().click();
await sleep(6000);          // the profile ramps up over the first seconds
await check('loadMetrics');
await check('loadBreaks');

await p.getByRole('link', { name: /Roles & SoD/ }).click();
await sleep(1100);
await check('sodMatrix');
await p.getByRole('link', { name: /Change & Regression/ }).click();
await sleep(900);
await p.getByRole('tab', { name: 'Migration Reconciliation' }).click();
await sleep(1000);
await check('reconList');

await p.getByRole('link', { name: 'Command Centre' }).click();
await sleep(800);
await p.getByRole('tab', { name: 'Release & Close' }).click();
await sleep(800);
await check('gateVerdict');
await check('exitCriteria');
console.log(`\n${bad} target(s) need attention`);
await b.close();
