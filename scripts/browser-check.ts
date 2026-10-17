import { chromium, type Page } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import type { QRCode } from 'jsqr';
import { artwork } from '@spirits/core';
import { fixtureAddress } from '../apps/shared/fixtures.js';
// Browser-native canvas callbacks are held to reproduce real asynchronous races.
// This changes only the test page, without test-only paths in application code.
type RasterGate = {
  pending: ((fail?: boolean) => void)[];
  completed: number;
  restore: () => void;
};
async function holdRasters(page: Page) {
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob,
      close = ImageBitmap.prototype.close;
    const gate: RasterGate = {
      pending: [],
      completed: 0,
      restore() {
        HTMLCanvasElement.prototype.toBlob = original;
        ImageBitmap.prototype.close = close;
      },
    };
    (window as unknown as { rasterGate: RasterGate }).rasterGate = gate;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      original.call(
        this,
        (blob) => gate.pending.push((fail) => callback(fail ? null : blob)),
        type,
        quality,
      );
    };
    ImageBitmap.prototype.close = function () {
      gate.completed++;
      close.call(this);
    };
  });
}
async function rasterCount(page: Page, count: number) {
  await page.waitForFunction(
    (n) => (window as unknown as { rasterGate: RasterGate }).rasterGate.pending.length === n,
    count,
  );
}
async function releaseRaster(page: Page, index: number, fail = false) {
  await page.evaluate(
    ({ index, fail }) =>
      (window as unknown as { rasterGate: RasterGate }).rasterGate.pending[index](fail),
    { index, fail },
  );
}
async function flushFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}
async function assertReflow(page: Page, label: string) {
  const problems = await page.evaluate(() => {
    const selectors =
      'a, button, input, textarea, select, summary, h1, h2, h3, .lead, .hint, .network-tag, .output-status';
    return Array.from(document.querySelectorAll<HTMLElement>(selectors)).flatMap((el) => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return [];
      return box.left < -0.5 || box.right > innerWidth + 0.5
        ? [{ element: el.id || el.textContent?.slice(0, 55), left: box.left, right: box.right }]
        : [];
    });
  });
  assert.deepEqual(problems, [], `${label}: functional content must remain inside the viewport`);
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${label}: page overflow`,
  );
  assert.ok(
    await page.evaluate(
      () =>
        !['hidden', 'clip'].includes(getComputedStyle(document.documentElement).overflowX) &&
        !['hidden', 'clip'].includes(getComputedStyle(document.body).overflowX),
    ),
    `${label}: overflow must not be concealed`,
  );
}
const port = 5287,
  base = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--strictPort',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
);
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += String(d)));
server.stderr.on('data', (d) => (serverLog += String(d)));
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
await mkdir('artifacts', { recursive: true });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(`Preview server exited: ${serverLog}`);
    try {
      ready = (await fetch(base)).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, 'Built preview server must be reachable');
  browser = await chromium.launch({
    executablePath: process.env.SPIRITS_BROWSER ?? '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => requests.push(r.url()));
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#preview svg').waitFor();
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await assertReflow(page, `Public page at ${width}`);
    await page.screenshot({ path: `artifacts/site-${width}.png`, fullPage: true });
  }
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await assertReflow(page, `Public enlarged root font at ${width}`);
  }
  await page.screenshot({ path: 'artifacts/site-enlarged-text.png', fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('font-size');
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('#address').fill('not-an-address');
  await page.locator('#create').click();
  await page.waitForFunction(() => Boolean(document.querySelector('#address-error')?.textContent));
  assert.equal(await page.locator('#download-svg').isDisabled(), true);
  assert.ok(
    (await page.locator('#address-error').textContent())?.includes(
      'complete Silent Payment address',
    ),
  );
  assert.ok(!(await page.locator('#address-error').textContent())?.includes('Bech32m'));
  await page.locator('#example').click();
  await page.waitForFunction(() =>
    document.querySelector('#output-status')?.textContent?.includes('decoded successfully'),
  );
  assert.ok((await page.locator('#preview-detail').textContent())?.includes('Public example keys'));
  assert.equal(await page.locator('#result-link').isVisible(), true);
  const focused = await page.evaluate(() => document.activeElement?.id);
  assert.equal(focused, 'example', 'Generation must not steal keyboard focus');
  await page.locator('#result-link').click();
  assert.ok(
    (await page.locator('#output-panel').boundingBox())!.y >= -1,
    'Explicit reveal brings the result into view',
  );
  assert.ok(
    (await page.locator('#preview svg title').textContent())?.includes('signature accessory'),
  );
  const address = await page.locator('#address').inputValue();
  assert.equal(address, fixtureAddress('hello-spirit'));
  await page.locator('#mode-qr').click();
  let pending = page.waitForEvent('download');
  await page.locator('#download-png').click();
  let dl = await pending;
  await dl.saveAs('artifacts/browser-qr.png');
  const raster = await sharp('artifacts/browser-qr.png')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const decode = jsQR as unknown as (
    data: Uint8ClampedArray,
    w: number,
    h: number,
  ) => QRCode | null;
  assert.equal(
    decode(new Uint8ClampedArray(raster.data), raster.info.width, raster.info.height)?.data,
    address,
  );
  pending = page.waitForEvent('download');
  await page.locator('#download-svg').click();
  dl = await pending;
  await dl.saveAs('artifacts/browser-qr.svg');
  await page.locator('#mode-spirit').click();
  pending = page.waitForEvent('download');
  await page.locator('#download-png').click();
  dl = await pending;
  await dl.saveAs('artifacts/browser-spirit.png');
  await page.screenshot({ path: 'artifacts/site-generated.png', fullPage: true });
  // Chrome native detector uses an independent decoding implementation if supported.
  const native = await page.evaluate(async () => {
    const Native = (
      globalThis as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (image: HTMLImageElement) => Promise<{ rawValue: string }[]>;
        };
      }
    ).BarcodeDetector;
    if (!Native) return { available: false };
    const preview = document.querySelector('#preview')!;
    // Native check is supplied a QR SVG taken from a retained download URL below instead.
    return { available: true };
  });
  let nativeDecoded: boolean | null = null;
  if (native.available) {
    await page.locator('#mode-qr').click();
    nativeDecoded = await page.evaluate(async (expected) => {
      const Native = (
        globalThis as unknown as {
          BarcodeDetector: new (options: { formats: string[] }) => {
            detect: (image: HTMLImageElement) => Promise<{ rawValue: string }[]>;
          };
        }
      ).BarcodeDetector;
      const svg = document.querySelector('#preview svg')!.outerHTML;
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try {
        const image = new Image();
        await new Promise<void>((r, j) => {
          image.onload = () => r();
          image.onerror = () => j(new Error('SVG failed'));
          image.src = url;
        });
        return (await new Native({ formats: ['qr_code'] }).detect(image)).some(
          (r) => r.rawValue === expected,
        );
      } finally {
        URL.revokeObjectURL(url);
      }
    }, address);
    assert.equal(nativeDecoded, true);
  }
  // Editing the input must invalidate old exports immediately.
  await page.locator('#address').fill(fixtureAddress('new-address'));
  assert.equal(await page.locator('#download-svg').isDisabled(), true);
  assert.equal(await page.locator('#preview svg').count(), 0);
  assert.equal(
    await page.locator('#preview').getAttribute('aria-label'),
    'No SPirit generated for the current input',
  );
  await page.locator('#create').click();
  await page.waitForFunction(() =>
    document.querySelector('#output-status')?.textContent?.includes('decoded successfully'),
  );
  assert.equal(await page.locator('#address').inputValue(), fixtureAddress('new-address'));
  assert.ok(
    !(await page.locator('#preview-detail').textContent())?.includes('example keys'),
    'User-provided tsp is not labeled as public fixture keys',
  );
  await page.locator('#address').fill(fixtureAddress('hello-spirit'));
  await page.locator('#create').click();
  await page.waitForFunction(() =>
    document.querySelector('#output-status')?.textContent?.includes('decoded successfully'),
  );
  assert.ok(
    (await page.locator('#preview-detail').textContent())?.includes('Public example keys'),
    'Manually pasted known fixture keeps its public-key warning',
  );
  const manifest = await (await fetch(`${base}/downloads/manifest.json`)).json();
  assert.equal(manifest.schemaVersion, 1);
  await page.waitForFunction(() =>
    Boolean(document.querySelector('a[data-download=core]')?.getAttribute('href')),
  );
  assert.ok(
    (await page.locator('a[data-download=core]').getAttribute('href'))?.endsWith(
      manifest.packages.core.file,
    ),
  );
  assert.ok(
    (await page.locator('a[data-download=qr]').getAttribute('href'))?.endsWith(
      manifest.packages.qr.file,
    ),
  );
  for (const filename of [
    manifest.packages.core.file,
    manifest.packages.qr.file,
    ...Object.values(manifest.files),
  ] as string[]) {
    const response = await fetch(`${base}/downloads/${filename}`);
    assert.equal(response.status, 200, filename);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.ok(bytes.length > 100, filename);
    if (filename.endsWith('.tgz'))
      assert.deepEqual(Array.from(bytes.slice(0, 2)), [31, 139], filename);
    if (filename.endsWith('.zip'))
      assert.deepEqual(Array.from(bytes.slice(0, 2)), [80, 75], filename);
  }
  await page.goto(base + '/lab/');
  await page.locator('#characters .contact-cell').first().waitFor();
  assert.equal(await page.locator('#characters .contact-cell').count(), 48);
  assert.equal(await page.locator('#family .contact-cell').count(), 8);
  const first = JSON.parse((await page.locator('#recipe').textContent()) ?? '{}');
  await page.locator('#label').fill('2');
  await page.locator('#generate').click();
  const second = JSON.parse((await page.locator('#recipe').textContent()) ?? '{}');
  assert.deepEqual(first.character, second.character);
  assert.equal(first.identity, second.identity);
  assert.notEqual(first.variationId, second.variationId);
  await page.locator('#check-qr').click();
  await page.waitForFunction(() =>
    document.querySelector('#lab-status')?.textContent?.startsWith('PASS'),
  );
  for (const [group, assets] of Object.entries(artwork.groups)) {
    await page.locator('#asset-group').selectOption(group);
    assert.equal(await page.locator('#assets .contact-cell').count(), assets.length);
  }
  await page.locator('[data-pin="0"]').click();
  await page.locator('[data-pin="1"]').click();
  assert.equal(await page.locator('#comparison .comparison-character').count(), 2);
  const comparison = await page.locator('#comparison').innerHTML();
  await page.locator('#refresh-grid').click();
  assert.equal(
    await page.locator('#comparison').innerHTML(),
    comparison,
    'Pinned pair survives a new batch',
  );
  await page.locator('#grayscale').check();
  assert.equal(
    await page.locator('#comparison').evaluate((el) => el.classList.contains('grayscale')),
    true,
  );
  await page.locator('#fixed-label').uncheck();
  assert.notEqual(
    await page.locator('#comparison').innerHTML(),
    comparison,
    'Comparison can restore actual label accents',
  );
  await page.locator('#fixed-label').check();
  await page.locator('#asset-group').selectOption('head');
  await page.locator('#preview-size').selectOption('32');
  assert.ok((await page.locator('#family svg').first().boundingBox())!.width <= 33);
  await page.locator('#preview-size').selectOption('110');
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await assertReflow(page, `Lab at ${width}`);
  }
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });
    await assertReflow(page, `Lab enlarged root font at ${width}`);
  }
  await page.screenshot({ path: 'artifacts/lab-enlarged-text.png', fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.removeProperty('font-size');
  });
  await page.screenshot({ path: 'artifacts/lab.png', fullPage: true });
  await page.locator('#audit').click();
  await page.waitForFunction(() =>
    document.querySelector('#audit-result')?.textContent?.includes('distinct character recipes'),
  );
  const audit = await page.locator('#audit-result').textContent();
  await page.locator('#inspect-address').fill('invalid');
  await page.locator('#inspect').click();
  assert.ok(await page.locator('#lab-error').textContent());
  assert.equal(await page.locator('#save-qr').isDisabled(), true);
  const race = await browser.newPage({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
  });
  race.on('pageerror', (e) => errors.push(e.message));
  race.on('request', (r) => requests.push(r.url()));
  await race.goto(base);
  await race.locator('#example').click();
  await race.waitForFunction(() =>
    document.querySelector('#output-status')?.textContent?.includes('decoded successfully'),
  );
  await holdRasters(race);
  await race.locator('#example').click();
  await rasterCount(race, 1);
  await race.locator('#address').fill(fixtureAddress('newer-generation'));
  await race.locator('#create').click();
  await rasterCount(race, 2);
  await releaseRaster(race, 0);
  await race.waitForFunction(
    () => (window as unknown as { rasterGate: RasterGate }).rasterGate.completed === 1,
  );
  assert.equal(
    await race.locator('#create').getAttribute('aria-busy'),
    'true',
    'Old generation cannot clear a newer busy state',
  );
  assert.equal(await race.locator('#preview svg').count(), 0);
  assert.equal(await race.locator('#download-svg').isDisabled(), true);
  await releaseRaster(race, 1);
  await race.waitForFunction(() =>
    document.querySelector('#output-status')?.textContent?.includes('decoded successfully'),
  );
  await race.evaluate(() => (window as unknown as { rasterGate: RasterGate }).rasterGate.restore());
  let raceDownloads = 0;
  race.on('download', () => raceDownloads++);
  for (const failOld of [false, true]) {
    await holdRasters(race);
    await race.locator('#download-png').click();
    await rasterCount(race, 1);
    await race.locator('#address').fill(fixtureAddress(`new-png-${failOld}`));
    await race.locator('#create').click();
    await rasterCount(race, 2);
    await releaseRaster(race, 1);
    await race.waitForFunction(() =>
      document.querySelector('#output-status')?.textContent?.includes('decoded successfully'),
    );
    await race.locator('#download-png').click();
    await rasterCount(race, 3);
    const before = raceDownloads;
    await releaseRaster(race, 0, failOld);
    await flushFrames(race);
    assert.equal(raceDownloads, before, 'A stale PNG must never download');
    assert.equal(
      await race.locator('#download-png').getAttribute('aria-busy'),
      'true',
      'Stale PNG cleanup cannot clear a newer export',
    );
    assert.equal(await race.locator('#download-png').isDisabled(), true);
    assert.ok(
      (await race.locator('#output-status').textContent())?.includes('decoded successfully'),
      'Stale success/failure cannot replace current status',
    );
    const nextDownload = race.waitForEvent('download');
    await releaseRaster(race, 2);
    await nextDownload;
    await race.evaluate(() =>
      (window as unknown as { rasterGate: RasterGate }).rasterGate.restore(),
    );
  }
  await race.goto(base + '/lab/');
  await race.locator('#check-qr').click();
  await race.waitForFunction(() =>
    document.querySelector('#lab-status')?.textContent?.startsWith('PASS'),
  );
  await holdRasters(race);
  await race.locator('#check-qr').click();
  await rasterCount(race, 1);
  await race.locator('#label').fill('0');
  assert.equal(await race.locator('#save-qr').isDisabled(), true);
  assert.equal(await race.locator('#lab-spirit svg').count(), 0);
  assert.equal(await race.locator('#lab-qr svg').count(), 0);
  await race.locator('#generate').click();
  assert.ok((await race.locator('#lab-error').textContent())?.includes('whole label'));
  assert.equal(await race.locator('#recipe').textContent(), '');
  assert.equal(await race.locator('#family svg').count(), 0);
  assert.ok(!(await race.locator('#lab-status').textContent())?.includes('SVGs ready'));
  await race.locator('#label').fill('2');
  await race.locator('#generate').click();
  await race.locator('#check-qr').click();
  await rasterCount(race, 2);
  await releaseRaster(race, 0);
  await race.waitForFunction(
    () => (window as unknown as { rasterGate: RasterGate }).rasterGate.completed === 1,
  );
  assert.equal(
    await race.locator('#check-qr').getAttribute('aria-busy'),
    'true',
    'Old decode cannot clear a newer busy state',
  );
  assert.equal(await race.locator('#check-qr').isDisabled(), true);
  assert.equal(
    await race.locator('#lab-status').textContent(),
    'Decoding the final rendered image…',
  );
  await releaseRaster(race, 1);
  await race.waitForFunction(() =>
    document.querySelector('#lab-status')?.textContent?.startsWith('PASS'),
  );
  assert.equal(await race.locator('#check-qr').getAttribute('aria-busy'), null);
  await race.evaluate(() => (window as unknown as { rasterGate: RasterGate }).rasterGate.restore());
  await race.close();
  assert.deepEqual(errors, [], 'No browser exceptions');
  assert.ok(
    !requests.some((url) => url.includes(address)),
    'No public address in network requests',
  );
  assert.ok(
    requests.every(
      (url) => url.startsWith(base) || url.startsWith('blob:') || url.startsWith('data:'),
    ),
    'No remote assets or services',
  );
  const report = {
    publicWidths: [320, 375, 414, 768, 1280],
    labWidths: [320, 375, 414, 768, 1280],
    pngDecode: true,
    nativeBarcodeDetectorAvailable: native.available,
    nativeDecoded,
    downloads: true,
    invalidInput: true,
    staleExportInvalidation: true,
    delayedPngOwnership: true,
    overlappingDecodeOwnership: true,
    invalidFixtureInvalidation: true,
    enlargedRootFontWidths: [320, 375, 414, 768],
    actualFunctionalBoundsChecked: true,
    pinnedComparison: true,
    labelFamily: true,
    catalogueEntries: Object.values(artwork.groups).reduce((n, a) => n + a.length, 0),
    audit,
    consoleErrors: errors,
    remoteRequests: 0,
  };
  await writeFile('artifacts/browser-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
