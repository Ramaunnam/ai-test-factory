import { readFileSync } from 'node:fs';
import { scenes } from './scenes.mjs';
import { loadCues, timeOf } from './cues.mjs';
const src = readFileSync(new URL('./story.mjs', import.meta.url), 'utf8');
let bad = 0;
for (const s of scenes) {
  const i = src.indexOf(`'${s.id}'`);
  if (i === -1) continue;
  const next = scenes[scenes.indexOf(s) + 1], j = next ? src.indexOf(`'${next.id}'`) : src.length;
  const block = src.slice(i, j > i ? j : src.length);
  const refs = [...block.matchAll(/await at\((?:'([^']+)'|"([^"]+)")\)/g)].map(m => m[1] || m[2]);
  const cues = loadCues(`audio/${s.id}.srt`);
  for (const r of refs) {
    const t = timeOf(cues, r);
    console.log(`${t === null ? '  MISSING  ' : '  ok ' + t.toFixed(1).padStart(5) + 's '} ${s.id}  "${r}"`);
    if (t === null) bad++;
  }
}
console.log(bad ? `\n${bad} phrase(s) are never spoken` : '\nevery phrase is spoken');
process.exit(bad ? 1 : 0);
