// Original README composition and SPirit artwork: CC0-1.0. Generator code: MIT.
// Rebuild libraries first, then run: npx tsx scripts/readme-banner.ts
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createSpirit } from '@remcoros/spirits';
import { fixtureAddress } from '../apps/shared/fixtures.js';

const font = await readFile(
  'node_modules/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2',
);
const logo = await readFile('public/favicon.svg', 'utf8');
const characters = ['hello-spirit', 'parade-3', 'parade-4', 'parade-5'].map(
  (seed) => createSpirit(fixtureAddress(seed), { size: 290 }).svg,
);
const positions = [
  [535, 140],
  [780, 42],
  [1025, 148],
  [1270, 58],
];
const browser = await chromium.launch({
  executablePath: process.env.SPIRITS_BROWSER || '/usr/bin/google-chrome',
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 480 } });
  await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>
@font-face { font-family: 'Space Grotesk'; font-weight: 700; src: url(data:font/woff2;base64,${font.toString('base64')}) format('woff2'); }
* { box-sizing: border-box; }
body { margin: 0; background: #f8f6ed; color: #192b23; font-family: 'Space Grotesk', sans-serif; }
main { position: relative; width: 1600px; height: 480px; overflow: hidden; }
.brand { position: absolute; top: 78px; left: 64px; display: flex; align-items: center; gap: 26px; }
.brand svg { width: 104px; height: 104px; }
h1 { margin: 0; font-size: 104px; line-height: 1; letter-spacing: -0.03em; font-weight: 700; }
p { position: absolute; top: 248px; left: 64px; margin: 0; font-size: 37px; line-height: 1.35; letter-spacing: -0.02em; }
.spirit { position: absolute; width: 290px; height: 290px; }
</style></head><body><main>
<div class="brand">${logo}<h1>SPirits</h1></div>
<p>A familiar face for<br>a very long address.</p>
${characters.map((svg, i) => `<div class="spirit" style="left:${positions[i][0]}px;top:${positions[i][1]}px">${svg}</div>`).join('')}
</main></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await mkdir('docs/assets', { recursive: true });
  await page.screenshot({ path: 'docs/assets/readme-banner.png' });
} finally {
  await browser.close();
}
