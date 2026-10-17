// Original SPirits code. SPDX-License-Identifier: MIT
// Run explicitly after editing public/favicon.svg; generated images are committed.
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const directory = new URL('../public/', import.meta.url);
const source = await readFile(new URL('favicon.svg', directory));
const png = (size) => sharp(source, { density: 576 }).resize(size, size).png().toBuffer();

for (const [file, size] of [
  ['favicon-16x16.png', 16],
  ['favicon-32x32.png', 32],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
]) {
  let image = png(size);
  if (file === 'icon-maskable-512.png')
    image = sharp(await png(size - 64))
      .extend({ top: 32, right: 32, bottom: 32, left: 32, background: '#192b23' })
      .png()
      .toBuffer();
  // Platforms supply their own corner masks; give them opaque square canvases.
  // The ghost stays within the central maskable safe circle (40% radius).
  if (file === 'apple-touch-icon.png' || file === 'icon-maskable-512.png')
    image = sharp(await image)
      .flatten({ background: '#192b23' })
      .png()
      .toBuffer();
  await writeFile(new URL(file, directory), await image);
}

// Uncompressed 32-bit DIB frames also support older ICO readers without PNG support.
const frames = [];
for (const size of [16, 32, 48]) {
  const rgba = await sharp(await png(size))
    .ensureAlpha()
    .raw()
    .toBuffer();
  const maskStride = Math.ceil(size / 32) * 4;
  const bitmap = Buffer.alloc(40 + size * size * 4 + maskStride * size);
  bitmap.writeUInt32LE(40, 0);
  bitmap.writeInt32LE(size, 4);
  bitmap.writeInt32LE(size * 2, 8);
  bitmap.writeUInt16LE(1, 12);
  bitmap.writeUInt16LE(32, 14);
  bitmap.writeUInt32LE(bitmap.length - 40, 20);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const pixel = (y * size + x) * 4;
      const target = 40 + ((size - 1 - y) * size + x) * 4;
      bitmap[target] = rgba[pixel + 2];
      bitmap[target + 1] = rgba[pixel + 1];
      bitmap[target + 2] = rgba[pixel];
      bitmap[target + 3] = rgba[pixel + 3];
      if (rgba[pixel + 3] === 0)
        bitmap[40 + size * size * 4 + (size - 1 - y) * maskStride + (x >> 3)] |= 0x80 >> (x % 8);
    }
  }
  frames.push({ size, bitmap });
}
const directoryBytes = Buffer.alloc(6 + frames.length * 16);
directoryBytes.writeUInt16LE(1, 2);
directoryBytes.writeUInt16LE(frames.length, 4);
let offset = directoryBytes.length;
for (const [index, { size, bitmap }] of frames.entries()) {
  const entry = 6 + index * 16;
  directoryBytes[entry] = size;
  directoryBytes[entry + 1] = size;
  directoryBytes.writeUInt16LE(1, entry + 4);
  directoryBytes.writeUInt16LE(32, entry + 6);
  directoryBytes.writeUInt32LE(bitmap.length, entry + 8);
  directoryBytes.writeUInt32LE(offset, entry + 12);
  offset += bitmap.length;
}
await writeFile(
  new URL('favicon.ico', directory),
  Buffer.concat([directoryBytes, ...frames.map(({ bitmap }) => bitmap)]),
);
console.log('Generated favicon ICO, PNG fallbacks, Apple touch icon and manifest icons.');
