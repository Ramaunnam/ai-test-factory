// usage: node extract.mjs DEMO_VIDEO_PIPELINE.md
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const F = '`'.repeat(3);
const md = readFileSync(process.argv[2], 'utf8');
const re = new RegExp(F + '(?:js|python)\\n(?:\\/\\/|#) file: (\\S+)\\n([\\s\\S]*?)\\n' + F, 'g');
for (const m of md.matchAll(re)) {
  mkdirSync(dirname(m[1]), { recursive: true });
  writeFileSync(m[1], m[2] + '\n');
  console.log('wrote', m[1]);
}
