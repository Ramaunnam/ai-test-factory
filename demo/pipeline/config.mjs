export const APP = {
  base: process.env.DEMO_BASE || 'http://localhost:4173',  // production build (vite preview), never the dev server
  vw: 1600, vh: 900,        // the viewport; recorded at 2x (3200x1800) and mastered to 1080p
  scope: '#main-scroll',    // the app's own content-column id (AppShell.tsx), excludes the sidebar/header
  card: '.bg-surface',      // the Card component's base class (components/ui/index.tsx) -- no semantic card class exists
  hideCss: '.fixed.bottom-5.right-5{display:none!important}',   // the toast stack, which would cover a zoomed corner
  ready: '#main-scroll',
};
export const VOICE = process.env.DEMO_VOICE || 'en-US-AvaMultilingualNeural';   // `edge-tts --list-voices` for others
export const RATE = process.env.DEMO_RATE || '+8%';
// Spelled for the ear: the voice is given the right-hand side, the written script keeps the left.
export const SAY = {
  'JoulesToWatts': 'Jewels to Watts',
  'SAP': 'S A P',
};
export const BRAND = {
  name: 'J2W AI Test Factory',
  strapline: 'One number for whether to trust the release',
  company: 'JoulesToWatts',
  logo: 'assets/j2w_logo.png',
};
// Plain black: the app itself goes from light theme to dark mid-take (story.mjs), so there is no
// single app-canvas colour to match at both the title (light) and close (dark) card edges -- black
// is the neutral, theme-agnostic choice standard in video for exactly this case.
export const FADE = '#000000';
