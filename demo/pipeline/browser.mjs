import { chromium } from 'playwright-core';
// One launch for every script. A 2x recording needs the scale forced on the command line as well as in the
// context, otherwise the page lands in the top-left quarter of the frame.
export const launch = (scale = 2) => chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
  headless: true,
  args: ['--hide-scrollbars', `--force-device-scale-factor=${scale}`],
});
