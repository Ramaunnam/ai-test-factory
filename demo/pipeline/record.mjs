//   node pipeline/record.mjs                      the master take (leave the machine idle while it runs)
//   REHEARSE=1 node pipeline/record.mjs           the same take, same timing, no video, with a trace of every beat
//   REHEARSE=1 SHOTS=1 node pipeline/record.mjs   ...and a PNG of every zoom window in out/rehearsal/
//   ONLY=02_intro,03_next REHEARSE=1 ...          only those scenes (for fixing one beat)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { scenes } from './scenes.mjs';
import { loadCues, timeOf } from './cues.mjs';
import { initTargeting, fit, VW, VH, clamp } from './focuslib.mjs';
import { T } from './targets.mjs';
import makeActs from './story.mjs';
import { APP, BRAND } from './config.mjs';
import { launch } from './browser.mjs';

const REHEARSE = !!process.env.REHEARSE, SHOTS = !!process.env.SHOTS, TRACE = REHEARSE || !!process.env.TRACE;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SCALE = REHEARSE ? 1 : 2;       // recorded at 2x, mastered to 1080p
const TAIL = 0.25;                    // silence after the last word of a scene
const GLIDE = 380;                    // ms for a pointer move
const durations = JSON.parse(readFileSync('audio/durations.json', 'utf8'));
const OUT = REHEARSE ? 'out/rehearsal' : 'out/master';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let T0 = 0, narrStart = 0;
const now = () => (Date.now() - T0) / 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const late = [];
const warn = m => console.log(`   ! ${m}`);
const trace = m => { if (TRACE) console.log(`      ${(now() - narrStart).toFixed(1).padStart(5)}s  ${m}`); };

const browser = await launch(SCALE);
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH }, deviceScaleFactor: SCALE,
  ...(REHEARSE ? {} : { recordVideo: { dir: OUT, size: { width: VW * SCALE, height: VH * SCALE } } }),
});
await ctx.addInitScript(initTargeting);
await ctx.addInitScript(hideCss => {
  // a real arrow pointer with a click ripple, no scrollbars, and nothing that would cover a zoomed region
  const draw = () => {
    if (document.getElementById('__cur')) return;
    const css = document.createElement('style');
    css.textContent = hideCss + `
      #__cur{position:fixed;z-index:2147483647;pointer-events:none;left:-99px;top:-99px;width:24px;height:35px;
        transform-origin:2px 2px;transition:transform .1s ease-out;filter:drop-shadow(0 2px 4px rgba(15,23,42,.45))}
      #__cur.__dn{transform:scale(.85)}
      .__rip{position:fixed;z-index:2147483646;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;pointer-events:none;
        border:2px solid rgba(20,143,126,.95);animation:__r .55s cubic-bezier(.2,.7,.3,1) forwards}
      @keyframes __r{to{transform:scale(3.4);opacity:0}}
      ::-webkit-scrollbar{width:0;height:0}`;
    document.head.appendChild(css);
    const d = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    d.id = '__cur'; d.setAttribute('viewBox', '0 0 26 38');
    d.innerHTML = '<path d="M1.6 1.6 L1.6 27.6 L8.3 21.4 L12.7 31 L16.7 29.2 L12.4 19.9 L21.1 19.5 Z" fill="#fff" stroke="#0f172a" stroke-width="2.1" stroke-linejoin="round"/>';
    document.body.appendChild(d);
    addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => {
      d.classList.add('__dn');
      const r = document.createElement('div'); r.className = '__rip';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r); setTimeout(() => r.remove(), 650);
    }, true);
    addEventListener('mouseup', () => d.classList.remove('__dn'), true);
  };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', draw) : draw();
}, APP.hideCss);

const page = await ctx.newPage();
page.setDefaultTimeout(12000);
page.on('pageerror', e => warn(`page error: ${e.message.split('\n')[0]}`));

/* ---------------------------------------------------------------- helpers (also handed to story.mjs) */
const measure = t => page.evaluate(x => window.__rect(x), t);
const scrollTo = async (t, block = 'center') => { await page.evaluate(x => window.__scroll(x.t, x.block, 480), { t, block }); await sleep(60); };

let mouse = { x: VW * 0.62, y: VH * 0.55 };
const ease = k => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
async function glide(x, y, ms = GLIDE) {          // a hand-like pointer move, timed by the clock, not by step count
  const from = { ...mouse }, t0 = Date.now();
  for (;;) {
    const k = Math.min(1, (Date.now() - t0) / ms), e = ease(k);
    await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
    if (k >= 1) break;
    await sleep(8);
  }
  mouse = { x, y };
}
async function point(t, label, ms) {                 // glide the pointer to the middle of a target (A/S/SX/U)
  const r = await measure(t);
  if (!r) { warn(`nothing to point at: ${label}`); return null; }
  await glide(clamp(r.x + r.w / 2, 10, VW - 10), clamp(r.y + r.h / 2, 10, VH - 10), ms);
  return r;
}
async function pointLoc(loc, label, ms) {            // ...or to a Playwright locator
  try {
    const b = await loc.first().boundingBox({ timeout: 4000 });
    if (!b) throw new Error('no box');
    await glide(clamp(b.x + b.width / 2, 10, VW - 10), clamp(b.y + b.height / 2, 10, VH - 10), ms);
  } catch { warn(`nothing to point at: ${label}`); }
}
// Click a locator like a person: scroll it in if it is off-screen or covered, glide, re-aim if the page moved, then press.
async function clickLoc(loc, label, { ms = GLIDE } = {}) {
  const t0 = Date.now();
  let b = null;
  try {
    const first = loc.first();
    await first.waitFor({ state: 'visible', timeout: 9000 });
    const probe = () => first.evaluate(el => {
      const r = el.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { x: r.x, y: r.y, width: r.width, height: r.height, ok: !!top && (el === top || el.contains(top)) };
    });
    b = await probe();
    const inView = () => b.y >= 6 && b.y + b.height <= VH - 6;
    for (let i = 0; i < 3 && !b.ok && inView(); i++) { await sleep(130); b = await probe(); }   // a popup may still be animating in
    if (!b.ok || !inView()) {                    // still covered, or off-screen: scroll it in
      unzoom();
      await first.evaluate(el => window.__scrollEl(el, 'center', 480));
      await sleep(60);
      b = await probe();
      trace(`scrolled ${label} into view`);
    }
    await glide(clamp(b.x + b.width / 2, 10, VW - 10), clamp(b.y + b.height / 2, 10, VH - 10), ms);
    const b2 = await probe();                    // the page may have moved while the pointer travelled: aim again
    if (Math.abs(b2.x - b.x) > 2 || Math.abs(b2.y - b.y) > 2) { b = b2; await glide(clamp(b.x + b.width / 2, 10, VW - 10), clamp(b.y + b.height / 2, 10, VH - 10), 140); }
  } catch (e) { warn(`nothing to click: ${label} (${e.message.split('\n')[0]})`); return false; }
  await sleep(60);
  await page.mouse.down(); await sleep(50); await page.mouse.up();
  trace(`click ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return true;
}
async function typeInto(loc, text, label) { if (await clickLoc(loc, label)) await page.keyboard.type(text, { delay: 55 }); }
// After a click that matters (an approval, a save): the expected thing must appear, or the take has silently derailed.
async function expectSeen(loc, label, ms = 3500) {
  const ok = await loc.first().waitFor({ state: 'attached', timeout: ms }).then(() => true, () => false);
  if (!ok) warn(`"${label}" did not happen`);
  return ok;
}

let openZoom = null, sceneZooms = [], curScene = '', shotN = 0;
function unzoom() { if (openZoom) { openZoom.t1 = now(); sceneZooms.push(openZoom); openZoom = null; } }
// Zoom onto a named region (targets.mjs): scroll it in, measure it, pick the zoom that contains it, note the window.
async function focus(name) {
  const spec = T[name];
  if (!spec) { warn(`unknown target: ${name}`); return; }
  const { t, ...opts } = spec;
  let r = null, f = null;
  for (let attempt = 0; attempt < 4 && !f; attempt++) {
    r = await measure(t);
    if (r && (r.y < 16 || r.y + r.h > VH - 16)) { unzoom(); await scrollTo(t, r.h > VH * 0.8 ? 'start' : 'center'); r = await measure(t); }
    f = r ? fit(r, opts) : null;
    if (!f) await sleep(250);                    // under load the page may still be rendering or scrolling
  }
  if (!r) { warn(`no region: ${name}`); return; }
  if (!f) { warn(`cannot frame ${name} (${Math.round(r.w)}x${Math.round(r.h)}), staying wide`); return; }
  unzoom();
  openZoom = { t0: now(), cx: f.cx, cy: f.cy, z: f.z };
  trace(`focus ${name} x${f.z.toFixed(2)}`);
  if (SHOTS) await page.screenshot({ path: `${OUT}/${curScene}_${String(++shotN).padStart(2, '0')}_${name}.png`, clip: { x: f.x, y: f.y, width: f.wW, height: f.wH } });
}

// A white cover for the title and closing scenes: the assembler replaces them with the card stills.
const cover = (instant = false) => page.evaluate(([name, instant]) => {
  const cur = document.getElementById('__cur'); if (cur) cur.style.display = 'none';
  const o = document.createElement('div'); o.id = '__cover';
  o.style.cssText = `position:fixed;inset:0;z-index:2147483000;background:#fff;display:flex;align-items:center;justify-content:center;font:700 44px system-ui,sans-serif;color:#0f172a;transition:opacity .6s;opacity:${instant ? 1 : 0}`;
  o.textContent = name; document.body.appendChild(o);
  if (!instant) requestAnimationFrame(() => { o.style.opacity = '1'; });
}, [BRAND.name, instant]);
const uncover = () => page.evaluate(() => {
  const o = document.getElementById('__cover'); if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 700); }
  const cur = document.getElementById('__cur'); if (cur) cur.style.display = '';
});

const acts = makeActs({ page, focus, unzoom, point, pointLoc, clickLoc, typeInto, expectSeen, scrollTo, glide, measure, sleep, trace, warn });

/* ---------------------------------------------------------------- drive */
await page.goto(APP.base + '/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector(APP.ready);
await page.waitForTimeout(1500);
await cover(true);
await page.waitForTimeout(500);
// A magenta flash marks the start of the take, so scene times can be mapped onto the recording.
// Held for 900ms and repainted every 90ms: a short static flash is missed entirely by Chrome's
// screencast when the page is otherwise still, which leaves the master with no marker at all.
// It lands inside the title scene, whose footage the assembler replaces with the card still anyway.
await page.evaluate(() => {
  const f = document.createElement('div');
  f.style.cssText = 'position:fixed;inset:0;z-index:2147483600;background:#ff00ff';
  document.body.appendChild(f);
  let on = true;
  const id = setInterval(() => { on = !on; f.style.background = on ? '#ff00ff' : '#f000f0'; }, 90);
  setTimeout(() => { clearInterval(id); f.remove(); }, 900);
});
T0 = Date.now();
await sleep(300);
if (ONLY && !ONLY.includes(scenes[0].id)) await uncover();

const timeline = { scenes: [] };
for (const [i, s] of scenes.entries()) {
  if (ONLY && !ONLY.includes(s.id)) continue;
  const d = durations[s.id] || { dur: 4 };
  const cues = loadCues(d.srt);
  const lead = s.silent ? 0 : (s.lead ?? 0.3);          // silence before the first word, while the page navigates
  const tail = s.silent ? 0 : (s.tail ?? TAIL);
  const sceneStart = now();
  sceneZooms = []; curScene = s.id; shotN = 0;
  // speech ends at the last cue; the mp3 carries a little trailing silence we do not need to wait through
  const narrDur = s.silent ? s.silent : Math.min(d.dur, (cues.length ? cues[cues.length - 1].end : d.dur) + 0.25);
  narrStart = sceneStart + lead;
  const ns = narrStart;
  console.log(`\n> ${s.id}  ${narrDur.toFixed(1)}s narration (+${lead}s lead)  @${sceneStart.toFixed(1)}s`);

  // at('phrase') waits until the phrase is being spoken; at(2.5) until 2.5 s into the narration
  const at = async ref => {
    const t = typeof ref === 'number' ? ref : timeOf(cues, ref);
    if (t === null) { warn(`phrase never spoken: "${ref}"`); return; }
    const wait = (ns + t) - now();
    if (wait > 0) await sleep(wait * 1000);
    else if (wait < -0.6) { warn(`cue "${ref}" late by ${(-wait).toFixed(1)}s`); late.push({ scene: s.id, ref, by: -wait }); }
    trace(`-- "${ref}" (cue ${t.toFixed(1)}s)`);
  };

  if (s.card && i > 0) await cover();
  try { if (acts[s.id]) await acts[s.id]({ at }); }
  catch (e) { warn(`scene ${s.id}: ${e.message.split('\n')[0]}`); }

  const rest = (ns + narrDur + tail) - now();
  if (rest > 0) await sleep(rest * 1000);
  else if (rest < -0.3) console.log(`     scene ran ${(-rest).toFixed(1)}s past its narration`);
  unzoom();
  if (s.card && i === 0) { await uncover(); await sleep(600); }

  timeline.scenes.push({ id: s.id, start: +sceneStart.toFixed(3), end: +now().toFixed(3), audio: d.mp3 || null, audioOffset: +(ns - sceneStart).toFixed(3), zooms: sceneZooms });
}

await sleep(400);
await ctx.close();                                       // this is what saves the video
await browser.close();
writeFileSync(REHEARSE ? 'out/rehearsal.json' : 'out/timeline.json', JSON.stringify(timeline, null, 1));
const total = timeline.scenes.reduce((a, s) => a + (s.end - s.start), 0);
console.log(`\nDONE ${REHEARSE ? 'rehearsed' : 'recorded'} ${timeline.scenes.length} scenes, ${total.toFixed(1)}s of video`);
if (late.length) { console.log(`\n${late.length} cue(s) late:`); for (const l of late) console.log(`   ${l.scene}  "${l.ref}"  by ${l.by.toFixed(1)}s`); }
