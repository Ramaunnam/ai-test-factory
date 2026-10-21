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
await p.keyboard.press('Control+K');
await sleep(300);
await p.keyboard.type('faults on');
await sleep(300);
await p.keyboard.press('Enter');
await sleep(400);
await p.getByRole('link', { name: 'Command Centre' }).click();
await sleep(500);

await check('gauge');
await p.getByRole('button', { name: 'Send a truck' }).click();
await sleep(1200);
await check('sendTruck');

await p.getByText('Show the full calculation').click();
await sleep(400);
await check('scoreCalc');
await p.keyboard.press('Escape');
await sleep(400);
await check('whatNext');

await p.getByRole('link', { name: /Live Data Flow/ }).click();
await sleep(600);

await p.getByRole('tab', { name: 'Live Checks' }).click();
await sleep(500);
await check('checksC1');
await check('checksQuery');
await p.getByText('Show the query').first().click();

await check('raiseFinding');
await p.getByRole('button', { name: 'Raise finding' }).first().click();
await sleep(700);
await p.locator('.bg-surface', { hasText: 'Records affected' }).locator('button').first().click();
await sleep(800);

await p.getByRole('tab', { name: 'Live Checks' }).click();
await sleep(500);
await p.getByRole('button', { name: 'Fix the cause and replay' }).first().click();
await sleep(1200);
await check('fixCause');

await p.getByRole('link', { name: 'Run Centre' }).click();
await sleep(500);
await check('runDemo');
await p.getByRole('button', { name: 'Run the P1 demo now' }).click();
await sleep(800);

await p.getByRole('button', { name: /Key User/ }).click();
await sleep(300);
await p.getByRole('menuitem', { name: /Plant Head/ }).click();
await sleep(900);
await p.getByRole('button', { name: 'Simulate impact' }).click();
await sleep(1500);
await check('simulate');

await p.getByRole('button', { name: /Plant Head/ }).click();
await sleep(300);
await p.getByRole('menuitem', { name: 'Key User' }).click();
await sleep(500);
await p.getByRole('tab', { name: 'Release & Close' }).click();
await sleep(500);
await check('gateDecision');
console.log(`\n${bad} target(s) need attention`);
await b.close();
