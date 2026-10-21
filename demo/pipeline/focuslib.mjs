import { APP } from './config.mjs';
export const VW = APP.vw, VH = APP.vh;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// level: -1 the matched element itself, 0 its nearest `closest` (a card), n climbs n more cards; up: extra parent climbs.
const base = { level: 0, up: 0, nth: 0, scope: APP.scope, closest: APP.card };
export const A = (re, o = {}) => ({ ...base, ...o, src: re.source, flags: re.flags.replace('g', ''), sel: null });
export const S = (sel, o = {}) => ({ ...base, level: -1, scope: null, ...o, src: '', flags: '', sel });
export const SX = (sel, re, o = {}) => ({ ...base, level: -1, scope: null, ...o, src: re.source, flags: re.flags.replace('g', ''), sel });
export const U = (...specs) => ({ union: specs });

// Injected into every page: window.__rect(target) measures, window.__scroll(target, block, ms) scrolls.
export function initTargeting() {
  const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  window.__find = s => {
    const root = (s.scope && document.querySelector(s.scope)) || document;
    let el;
    if (s.sel) {
      let list = [...root.querySelectorAll(s.sel)].filter(visible);
      if (s.src) { const rx = new RegExp(s.src, s.flags); list = list.filter(e => rx.test((e.textContent || '').trim())); }
      el = list[s.nth || 0];
    } else {
      const rx = new RegExp(s.src, s.flags), hit = e => rx.test(e.textContent || '');
      // the deepest element that still holds the text (text split across spans or beside an icon has no matching leaf)
      el = [...root.querySelectorAll('*')].filter(e => visible(e) && hit(e) && ![...e.children].some(hit))[s.nth || 0];
    }
    if (!el) return null;
    let node = el;
    if (s.level >= 0) {
      node = el.closest(s.closest) || el;
      for (let i = 0; i < s.level; i++) { const nxt = node.parentElement && node.parentElement.closest(s.closest); if (nxt) node = nxt; else break; }
    }
    for (let i = 0; i < (s.up || 0); i++) if (node.parentElement) node = node.parentElement;
    return node;
  };
  const box = s => { const el = window.__find(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  window.__rect = t => {
    if (!t.union) return box(t);
    const rs = t.union.map(box).filter(Boolean);
    if (!rs.length) return null;
    const x = Math.min(...rs.map(r => r.x)), y = Math.min(...rs.map(r => r.y));
    return { x, y, w: Math.max(...rs.map(r => r.x + r.w)) - x, h: Math.max(...rs.map(r => r.y + r.h)) - y };
  };
  // Bring an element to the middle (or top) of its scroll container in a fixed time, eased, however far it is:
  // the browser's own smooth scroll takes over a second on a long page, and a click aimed during it misses.
  window.__scrollEl = (el, block = 'center', ms = 480) => new Promise(resolve => {
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      const o = getComputedStyle(sc).overflowY;
      if ((o === 'auto' || o === 'scroll') && sc.scrollHeight > sc.clientHeight + 2) break;
      sc = sc.parentElement;
    }
    if (!sc || sc === document.body) sc = document.scrollingElement;
    const r = el.getBoundingClientRect();
    const c = sc === document.scrollingElement ? { top: 0, height: innerHeight } : sc.getBoundingClientRect();
    const want = block === 'start' ? r.top - c.top - 24 : r.top - c.top - (c.height - r.height) / 2;
    const from = sc.scrollTop, to = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, from + want));
    if (Math.abs(to - from) < 2) return resolve(true);
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      sc.scrollTop = from + (to - from) * (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      k < 1 ? requestAnimationFrame(step) : resolve(true);
    };
    requestAnimationFrame(step);
  });
  window.__scroll = (t, block, ms) => { const el = window.__find(t.union ? t.union[0] : t); return el ? window.__scrollEl(el, block, ms) : Promise.resolve(false); };
}

// The largest zoom (steps down from `max`) whose crop window fully contains the region; null if none, so the caller stays wide.
// clipW / clipH frame just the left / top part of a region that is wider or taller than the shot needs.
export function fit(r, { max = 1.75, padX = 80, padY = 64, min = 1.1, clipW, clipH } = {}) {
  if (clipW && r.w > clipW) r = { ...r, w: clipW };
  if (clipH && r.h > clipH) r = { ...r, h: clipH };
  let z = clamp(Math.min(VW / (r.w + 2 * padX), VH / (r.h + 2 * padY)), 1, max);
  for (; z >= min; z -= 0.04) {
    const wW = VW / z, wH = VH / z;
    const x = clamp(r.x + r.w / 2 - wW / 2, 0, VW - wW), y = clamp(r.y + r.h / 2 - wH / 2, 0, VH - wH);
    if (r.x >= x - 2 && r.x + r.w <= x + wW + 2 && r.y >= y - 2 && r.y + r.h <= y + wH + 2)
      return { z: +z.toFixed(3), cx: (x + wW / 2) / VW, cy: (y + wH / 2) / VH, wW, wH, x, y };
  }
  return null;
}
