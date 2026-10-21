import { readFileSync, existsSync } from 'node:fs';
const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const tc = t => { const [h, m, rest] = t.split(':'); const [s, ms] = rest.split(','); return +h * 3600 + +m * 60 + +s + +ms / 1000; };

export function loadCues(srtPath) {
  if (!srtPath || !existsSync(srtPath)) return [];
  return readFileSync(srtPath, 'utf8').trim().split(/\n\s*\n/).map(block => {
    const lines = block.split('\n');
    const [a, b] = lines[1].split(' --> ');
    return { start: tc(a), end: tc(b), text: lines.slice(2).join(' ') };
  });
}

// Seconds into the scene at which `phrase` starts being spoken (linear by character inside its sentence), or null.
export function timeOf(cues, phrase) {
  const want = norm(phrase);
  for (const c of cues) {
    const hay = norm(c.text), i = hay.indexOf(want);
    if (i !== -1) return c.start + (i / Math.max(hay.length, 1)) * (c.end - c.start);
  }
  return null;
}
