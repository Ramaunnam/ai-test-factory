import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { BRAND } from './config.mjs';
import { launch } from './browser.mjs';
mkdirSync('out', { recursive: true });
const logo = existsSync(BRAND.logo)
  ? `<img class="logo" src="data:image/${BRAND.logo.endsWith('.svg') ? 'svg+xml' : 'png'};base64,${readFileSync(BRAND.logo).toString('base64')}">` : '';

// The title card matches the app's light theme (its state at the start of the take); the close
// card matches its dark theme (its state after the on-camera theme switch in story.mjs). Colours
// are the app's own --bg/--text tokens (src/index.css), so neither card flashes against the footage.
const THEME = {
  light: { bg: '#F4F7FA', text: '#0F1E2E', muted: '#5B6B7C', faint: '#8C99A8', rule: '#D7DEE6' },
  dark: { bg: '#0B1420', text: '#E7EDF5', muted: '#8C9BAC', faint: '#5B6B7C', rule: '#1F2E42' },
};
const shell = (body, t) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box} body{width:1920px;height:1080px;background:${t.bg};display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;color:${t.text}}
  .card{display:flex;flex-direction:column;align-items:center;text-align:center} .logo{width:340px;max-height:200px;object-fit:contain}
  .rule{width:96px;height:2px;background:${t.rule};margin:34px 0} .product{font-size:64px;font-weight:700;letter-spacing:-.03em}
  .strap{margin-top:20px;font-size:23px;color:${t.muted};max-width:900px} .by{margin:26px 0 22px;font-size:21px;color:${t.faint}}
</style><div class="card">${body}</div>`;
const title = shell(`${logo}<div class="rule"></div><div class="product">${BRAND.name}</div><div class="strap">${BRAND.strapline}</div>`, THEME.light);
const close = shell(`<div class="product">${BRAND.name}</div><div class="by">by</div>${logo}`, THEME.dark);
const b = await launch(1);
const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
for (const [name, html] of [['title', title], ['close', close]]) {
  await p.setContent(html);
  await p.waitForTimeout(300);
  await p.screenshot({ path: `out/card_${name}.png` });
  console.log(`  out/card_${name}.png`);
}
await b.close();
