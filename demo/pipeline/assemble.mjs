import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { scenes } from './scenes.mjs';
import { FADE } from './config.mjs';
const run = promisify(execFile);
const sh = (args, o = {}) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], { maxBuffer: 1 << 28, ...o });

const OUT_W = 1920, OUT_H = 1080, FPS = 25;
const RAMP = 0.75;          // seconds of ease at each end of a zoom
const FLASH_SKIP = 0.32;    // drop the calibration frame from the first scene
const DISSOLVE = 0.55;      // fade at each card edge
const FINAL = 'out/demo_1080p.mp4';
const CARDS = Object.fromEntries(scenes.filter(s => s.card).map(s => [s.id, s.card]));

const master = 'out/master/' + readdirSync('out/master').find(f => f.endsWith('.webm'));
const timeline = JSON.parse(readFileSync('out/timeline.json', 'utf8'));

// Find the magenta calibration flash so scene times map onto the recorded video.
async function findFlash() {
  const { stdout } = await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', master, '-t', '90', '-vf', 'scale=8:8,format=rgb24', '-f', 'rawvideo', '-'], { encoding: 'buffer', maxBuffer: 1 << 28 });
  const per = 8 * 8 * 3;
  for (let f = 0; f * per + per <= stdout.length; f++) {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 64; i++) { const o = f * per + i * 3; r += stdout[o]; g += stdout[o + 1]; b += stdout[o + 2]; }
    r /= 64; g /= 64; b /= 64;
    if (r > 170 && b > 170 && g < 120) return f / FPS;
  }
  return null;
}
const flash = await findFlash();
if (flash === null) throw new Error('calibration flash not found in the master recording');

// Zoom windows -> one eased crop expression. Each window has a smoothstep weight (in over RAMP, out over RAMP), and the
// zoom factor and centre are blended by those weights, so consecutive zooms pass through the wide shot between them.
const ss = x => `(pow(clip(${x},0,1),2)*(3-2*clip(${x},0,1)))`;
function vfilter(zooms) {
  const base = 'setpts=PTS-STARTPTS';
  const usable = zooms.filter(z => z.t1 - z.t0 > 0.9);
  if (!usable.length) return `${base},scale=${OUT_W}:${OUT_H}:flags=bicubic`;
  const w = usable.map(z => {
    const r = Math.min(RAMP, (z.t1 - z.t0) / 2.2).toFixed(3);
    return `min(${ss(`(t-${z.t0.toFixed(3)})/${r}`)},${ss(`(${z.t1.toFixed(3)}-t)/${r}`)})`;
  });
  const mix = (b0, get) => b0 + usable.map((z, i) => `+(${get(z).toFixed(4)})*(${w[i]})`).join('');
  const Z = mix('1', z => z.z - 1), CX = mix('0.5', z => z.cx - 0.5), CY = mix('0.5', z => z.cy - 0.5);
  // crop's in_w resolves against the pre-scale size, so derive the scaled size from the same expression scale uses
  const SW = `(trunc(${OUT_W}*(${Z})/2)*2)`, SH = `(trunc(${OUT_H}*(${Z})/2)*2)`;
  return `${base},scale=w='${SW}':h='${SH}':eval=frame:flags=bicubic,` +
         `crop=${OUT_W}:${OUT_H}:x='max(0\\,min(${SW}-${OUT_W}\\,(${CX})*${SW}-${OUT_W / 2}))':y='max(0\\,min(${SH}-${OUT_H}\\,(${CY})*${SH}-${OUT_H / 2}))'`;
}

rmSync('scenes', { recursive: true, force: true });
mkdirSync('scenes', { recursive: true });
const parts = [];
for (const [i, s] of timeline.scenes.entries()) {
  const skip = i === 0 ? FLASH_SKIP : 0;
  const vStart = flash + s.start + skip;
  const dur = +(s.end - s.start - skip).toFixed(3);
  const rel = s.zooms.map(z => ({ ...z, t0: z.t0 - s.start - skip, t1: z.t1 - s.start - skip })).filter(z => z.t1 > 0.2 && z.t0 < dur);
  const file = `scenes/${s.id}.mp4`;
  const card = CARDS[s.id] && existsSync(CARDS[s.id]) ? CARDS[s.id] : null;
  const prevIsCard = i > 0 && CARDS[timeline.scenes[i - 1].id], nextIsCard = i < timeline.scenes.length - 1 && CARDS[timeline.scenes[i + 1].id];
  const args = card ? ['-y', '-loop', '1', '-t', dur.toFixed(3), '-i', card] : ['-y', '-ss', vStart.toFixed(3), '-t', dur.toFixed(3), '-i', master];
  const edge = [];   // a dissolve where a card meets the recording, so the splice reads as a transition
  if (card || prevIsCard) edge.push(`fade=t=in:st=0:d=${DISSOLVE}:color=${FADE}`);
  if (card || nextIsCard) edge.push(`fade=t=out:st=${Math.max(0, dur - DISSOLVE).toFixed(2)}:d=${DISSOLVE}:color=${FADE}`);
  const edgeF = edge.length ? ',' + edge.join(',') : '';
  const fc = [card ? `[0:v]scale=${OUT_W}:${OUT_H},fps=${FPS}${edgeF},format=yuv420p[v]` : `[0:v]${vfilter(rel)}${edgeF}[v]`];
  if (s.audio && existsSync(s.audio)) {
    args.push('-i', s.audio);
    const off = Math.round((s.audioOffset || 0) * 1000);   // the silent lead-in while the page navigates
    fc.push(`[1:a]adelay=${off}|${off},apad=whole_dur=${dur},atrim=0:${dur},asetpts=N/SR/TB,afade=t=in:st=0:d=0.12[a]`);
  } else {
    args.push('-f', 'lavfi', '-t', dur.toFixed(3), '-i', 'anullsrc=r=48000:cl=stereo');
    fc.push(`[1:a]atrim=0:${dur},asetpts=N/SR/TB[a]`);
  }
  args.push('-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', file);
  await sh(args);
  parts.push(file);
  console.log(`  ${s.id.padEnd(16)} ${dur.toFixed(1)}s  ${rel.filter(z => z.t1 - z.t0 > 0.9).length} zoom(s)`);
}

writeFileSync('scenes/list.txt', parts.map(p => `file '${p.split('/').pop()}'`).join('\n'));
await sh(['-y', '-f', 'concat', '-safe', '0', '-i', 'scenes/list.txt', '-c', 'copy', 'out/joined.mp4']);
const { stdout: d } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', 'out/joined.mp4']);
const total = +d.trim();
await sh(['-y', '-i', 'out/joined.mp4',
  '-vf', `fade=t=in:st=0:d=0.7:color=${FADE},fade=t=out:st=${(total - 1.4).toFixed(2)}:d=1.4:color=${FADE}`,
  '-af', `loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2`,   // speech mastered to -16 LUFS
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', FINAL]);
console.log(`\nDONE ${FINAL}  ${Math.floor(total / 60)}m ${Math.round(total % 60)}s  (${total.toFixed(1)}s)`);
