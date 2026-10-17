import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import type { QRCode, Options } from 'jsqr';
import { createSpiritQr, canPlaceLogo, canPlaceLogoCircle, alignmentPositions } from '@spirits/qr';
import { artwork, deriveSpirit, renderSpirit } from '@spirits/core';
import { qrcodegen } from '../packages/qr/src/vendor/qrcodegen.js';
import { fixtureAddress } from '../apps/shared/fixtures.js';

const decode = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: Options,
) => QRCode | null;

// Capture actual protected cells from the pinned encoder, independently of our geometry helpers.
function protectedModules(version: number): [number, number][] {
  const cells = new Map<string, [number, number]>();
  const prototype = qrcodegen.QrCode.prototype as unknown as {
    setFunctionModule(x: number, y: number, dark: boolean): void;
  };
  const original = prototype.setFunctionModule;
  try {
    prototype.setFunctionModule = function (x, y, dark) {
      cells.set(`${x},${y}`, [x, y]);
      original.call(this, x, y, dark);
    };
    qrcodegen.QrCode.encodeSegments([], qrcodegen.QrCode.Ecc.HIGH, version, version, 0, false);
  } finally {
    prototype.setFunctionModule = original;
  }
  return [...cells.values()];
}

test('smallest data-fitting versions with central alignment markers are avoided', () => {
  assert.equal(canPlaceLogo(10, 13), false);
  assert.equal(canPlaceLogo(14, 15), true);
  assert.equal(canPlaceLogo(14, 21), false);
  assert.equal(canPlaceLogoCircle(14, 20.5), true);
  assert.equal(canPlaceLogoCircle(14, 21.5), false);
  assert.deepEqual(alignmentPositions(14), [6, 26, 46, 66]);
  assert.deepEqual(alignmentPositions(32), [6, 34, 60, 86, 112, 138]);
  const qr = createSpiritQr(fixtureAddress('qr'));
  assert.equal(qr.version, 14);
  assert.equal(qr.logoModules, 20.5);
  assert.equal(qr.logoShape, 'circle');
  assert.deepEqual(qr.logoBounds, { x: 26.25, y: 26.25, size: 20.5 });
  assert.equal(qr.quietZone, 4);
  assert.ok(canPlaceLogoCircle(qr.version, qr.logoModules));
  assert.equal(qr.width, 648);
  assert.match(qr.svg, /viewBox="24 12 208 232"/);
  assert.doesNotMatch(qr.svg, /clipPath/);
  const plain = createSpiritQr(fixtureAddress('qr'), { spirit: false });
  assert.equal(plain.version, 10);
  assert.equal(plain.logoBounds, null);
  assert.equal(plain.logoShape, null);
  assert.equal(plain.logoModules, 0);
  assert.doesNotMatch(plain.svg, /<circle|SPirit for/);
});

test('square and circular clearance match the encoder protected cells across all 40 versions', () => {
  for (let version = 1; version <= 40; version++) {
    const cells = protectedModules(version),
      size = version * 4 + 17,
      center = size / 2;
    for (let diameter = 0.5; diameter <= size + 0.5; diameter += 0.5) {
      const radius = diameter / 2;
      const clear =
        diameter <= size &&
        cells.every(([x, y]) => {
          const nearestX = Math.min(x + 1, Math.max(x, center)),
            nearestY = Math.min(y + 1, Math.max(y, center));
          return Math.hypot(nearestX - center, nearestY - center) > radius;
        });
      assert.equal(canPlaceLogoCircle(version, diameter), clear, `v${version},circle=${diameter}`);
    }
    for (let side = 1; side <= size; side += 2) {
      const min = center - side / 2,
        max = center + side / 2;
      const clear = cells.every(([x, y]) => x >= max || x + 1 <= min || y >= max || y + 1 <= min);
      assert.equal(canPlaceLogo(version, side), clear, `v${version},square=${side}`);
    }
  }
  assert.equal(canPlaceLogoCircle(14, 0), false);
  assert.equal(canPlaceLogoCircle(14, Number.NaN), false);
  assert.equal(canPlaceLogoCircle(14, Number.POSITIVE_INFINITY), false);
  assert.throws(() => canPlaceLogoCircle(41, 1), RangeError);
});

test('final composited QRs decode exactly at multiple sizes, networks, characters and labels', async () => {
  let count = 0;
  for (const network of ['mainnet', 'testnet'] as const)
    for (let seed = 0; seed < 8; seed++)
      for (const label of [1, 2, 42])
        for (const scale of [2, 3, 5, 8]) {
          const address = fixtureAddress(`qr-${seed}`, label, network),
            qr = createSpiritQr(address, { scale });
          const { data, info } = await sharp(Buffer.from(qr.svg))
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const decoded = decode(new Uint8ClampedArray(data), info.width, info.height, {
            inversionAttempts: 'dontInvert',
          });
          assert.equal(
            decoded?.data,
            address,
            `network=${network},seed=${seed},label=${label},scale=${scale}`,
          );
          count++;
        }
  assert.equal(count, 192);
});

test('final QR images survive display-size resampling and mild blur at 250 and 310 pixels', async () => {
  let count = 0;
  for (const network of ['mainnet', 'testnet'] as const)
    for (let seed = 0; seed < 8; seed++)
      for (const label of [1, 2, 42])
        for (const size of [250, 310]) {
          const address = fixtureAddress(`qr-display-${seed}`, label, network),
            qr = createSpiritQr(address);
          const { data, info } = await sharp(Buffer.from(qr.svg))
            .resize(size, size)
            .blur(0.3)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const decoded = decode(new Uint8ClampedArray(data), info.width, info.height, {
            inversionAttempts: 'dontInvert',
          });
          assert.equal(
            decoded?.data,
            address,
            `network=${network},seed=${seed},label=${label},size=${size}`,
          );
          count++;
        }
  assert.equal(count, 96);
});

test('tighter QR framing contains every catalogue shape and complete body/hem pairing', async () => {
  const base = deriveSpirit(fixtureAddress('qr-full-character'));
  const recipes = [];
  for (const body of artwork.groups.body)
    for (const hem of artwork.groups.hem)
      recipes.push({ ...base, character: { ...base.character, body: body.id, hem: hem.id } });
  for (const group of ['eyes', 'mouth', 'brows', 'marking', 'head', 'item'] as const)
    for (const asset of artwork.groups[group])
      recipes.push({ ...base, character: { ...base.character, [group]: asset.id } });
  for (const badge of artwork.groups.badge)
    recipes.push({ ...base, variation: { ...base.variation, badge: badge.id } });
  for (const recipe of recipes) {
    // Inspect the original canvas so the proposed tighter viewport cannot conceal clipped pixels.
    const svg = renderSpirit(recipe, { size: 512 });
    const { data, info } = await sharp(Buffer.from(svg))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let outside = false;
    for (let y = 0; y < info.height && !outside; y++)
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] === 0) continue;
        const artX = (x + 0.5) / 2,
          artY = (y + 0.5) / 2;
        // The 18-module square viewport uses xMidYMid meet for the 208x232 viewBox.
        const distance = Math.hypot(artX - 128, artY - 128) * (18 / 232);
        if (artX < 24 || artX > 232 || artY < 12 || artY > 244 || distance >= 9.525) {
          outside = true;
          break;
        }
      }
    assert.equal(
      outside,
      false,
      `full character exceeds circular frame: ${JSON.stringify(recipe.character)}`,
    );
  }
});
test('QR rejects invalid inputs and unreasonable render scales', () => {
  assert.throws(() => createSpiritQr('not-an-address'));
  assert.throws(() => createSpiritQr(fixtureAddress('scale'), { scale: 1.5 }));
});
