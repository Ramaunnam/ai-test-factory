// One mp3 and one sentence-level SRT per scene, plus audio/durations.json. FORCE=1 speaks every scene again.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { scenes } from './scenes.mjs';
import { VOICE, RATE, SAY } from './config.mjs';
const run = promisify(execFile);

const local = ['.venv/bin/edge-tts', '.venv/Scripts/edge-tts.exe'].map(p => fileURLToPath(new URL('../' + p, import.meta.url))).find(existsSync);
const EDGE = process.env.EDGE_TTS || local || 'edge-tts';
const speak = t => Object.entries(SAY).reduce((s, [from, to]) => s.split(from).join(to), t);

mkdirSync('audio', { recursive: true });
const out = {};
for (const s of scenes) {
  if (!s.text) { out[s.id] = { dur: s.silent }; continue; }
  const mp3 = `audio/${s.id}.mp3`, srt = `audio/${s.id}.srt`;
  if (!existsSync(mp3) || process.env.FORCE)
    await run(EDGE, ['--voice', VOICE, '--rate', RATE, '--text', speak(s.text), '--write-media', mp3, '--write-subtitles', srt]);
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp3]);
  out[s.id] = { dur: +(+stdout.trim()).toFixed(3), srt, mp3 };
  console.log(`${s.id.padEnd(16)} ${out[s.id].dur.toFixed(1).padStart(5)}s  ${s.text.trim().split(/\s+/).length} words`);
}
const total = Object.values(out).reduce((a, b) => a + b.dur, 0);
console.log(`\nTOTAL NARRATION ${total.toFixed(1)}s (${(total / 60).toFixed(2)} min)`);
writeFileSync('audio/durations.json', JSON.stringify(out, null, 1));
