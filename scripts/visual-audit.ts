import { createSpirit, renderSpirit, type SpiritRecipe } from '@remcoros/spirits';
import { fixtureAddress } from '../apps/shared/fixtures.js';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const count = 1024,
  seen = new Map<number, Set<string>>([
    [32, new Set()],
    [64, new Set()],
  ]);
const samples: { recipe: SpiritRecipe; rgb32: Buffer; rgb64: Buffer; gray: Uint8Array }[] =
  new Array(count);
// Full-severity matrices from Machado, Oliveira and Fernandes (2009), applied in linear sRGB.
// https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html
const matrices = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritanopia: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
} as const;
type Vision = 'colour' | 'grayscale' | keyof typeof matrices;
const linear = (byte: number) => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const encoded = (value: number) => {
  const bounded = Math.max(0, Math.min(1, value));
  return Math.round(
    255 * (bounded <= 0.0031308 ? bounded * 12.92 : 1.055 * bounded ** (1 / 2.4) - 0.055),
  );
};
function simulate(rgb: Buffer, vision: Vision): Buffer {
  if (vision === 'colour') return rgb;
  const output = Buffer.alloc(rgb.length);
  for (let i = 0; i < rgb.length; i += 3) {
    const r = linear(rgb[i]),
      g = linear(rgb[i + 1]),
      b = linear(rgb[i + 2]);
    if (vision === 'grayscale') {
      output.fill(encoded(0.2126 * r + 0.7152 * g + 0.0722 * b), i, i + 3);
    } else {
      const m = matrices[vision];
      output[i] = encoded(m[0] * r + m[1] * g + m[2] * b);
      output[i + 1] = encoded(m[3] * r + m[4] * g + m[5] * b);
      output[i + 2] = encoded(m[6] * r + m[7] * g + m[8] * b);
    }
  }
  return output;
}
// Fix all label accents so the badge cannot conceal a duplicated core character.
const fixed = createSpirit(fixtureAddress('visual-audit-fixed-accent')).recipe.variation;
for (let start = 0; start < count; start += 16) {
  await Promise.all(
    Array.from({ length: Math.min(16, count - start) }, async (_, i) => {
      const recipe = {
        ...createSpirit(fixtureAddress(`visual-audit-${start + i}`)).recipe,
        variation: fixed,
      };
      const pixelsBySize = new Map<number, Buffer>();
      for (const size of [32, 64]) {
        const svg = renderSpirit(recipe, { size, background: 'paper' });
        const pixels = await sharp(Buffer.from(svg))
          .flatten({ background: '#fffdf7' })
          .removeAlpha()
          .raw()
          .toBuffer();
        seen.get(size)!.add(createHash('sha256').update(pixels).digest('hex'));
        pixelsBySize.set(size, pixels);
      }
      const rgb32 = pixelsBySize.get(32)!;
      samples[start + i] = {
        recipe,
        rgb32,
        rgb64: pixelsBySize.get(64)!,
        gray: Uint8Array.from(simulate(rgb32, 'grayscale').filter((_, p) => p % 3 === 0)),
      };
    }),
  );
}
// Rank candidates for visual review; this background-sensitive metric is not a recognition test.
const nearest: { a: number; b: number; meanPixelDifference: number }[] = [];
for (let a = 0; a < count; a++) {
  for (let b = 0; b < a; b++) {
    let difference = 0;
    for (let p = 0; p < samples[a].gray.length; p++)
      difference += Math.abs(samples[a].gray[p] - samples[b].gray[p]);
    const meanPixelDifference = difference / (samples[a].gray.length * 255);
    if (
      nearest.length < 12 ||
      meanPixelDifference < nearest[nearest.length - 1].meanPixelDifference
    ) {
      nearest.push({ a, b, meanPixelDifference });
      nearest.sort((x, y) => x.meanPixelDifference - y.meanPixelDifference);
      nearest.length = Math.min(12, nearest.length);
    }
  }
}
await mkdir('artifacts', { recursive: true });
const text = (x: number, y: number, value: string, size = 14) =>
  `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="#242b29">${value}</text>`;
async function imageAt(index: number, x: number, y: number, size: 32 | 64, vision: Vision) {
  const sample = samples[index];
  const png = await sharp(simulate(size === 32 ? sample.rgb32 : sample.rgb64, vision), {
    raw: { width: size, height: size, channels: 3 },
  })
    .png()
    .toBuffer();
  return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="data:image/png;base64,${png.toString('base64')}"/>`;
}
// Include close candidates and a spread of other fixtures in the colour-vision comparison.
const selected = [
  ...new Set([
    ...nearest.slice(0, 3).flatMap(({ a, b }) => [a, b]),
    ...Array.from({ length: 12 }, (_, i) => i),
  ]),
].slice(0, 12);
const visions: Vision[] = ['colour', 'grayscale', 'protanopia', 'deuteranopia', 'tritanopia'];
let sheet =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="760"><rect width="1280" height="760" fill="#f8f6ed"/>';
sheet += text(
  20,
  28,
  'SPirits · fixed label accents · 64px and 32px · simulation for visual review',
  19,
);
for (let row = 0; row < visions.length; row++) {
  const y = 52 + row * 140;
  sheet += text(12, y + 22, visions[row], 12);
  for (let col = 0; col < selected.length; col++) {
    const x = 142 + col * 94;
    sheet += await imageAt(selected[col], x, y, 64, visions[row]);
    sheet += await imageAt(selected[col], x + 16, y + 70, 32, visions[row]);
    sheet += text(x + 12, y + 122, String(selected[col]), 12);
  }
}
sheet += '</svg>';
await sharp(Buffer.from(sheet)).png().toFile('artifacts/visual-vision-sheet.png');
let pairs =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="680"><rect width="1000" height="680" fill="#f8f6ed"/>';
pairs += text(
  20,
  28,
  'Nearest grayscale pixel candidates · 1,024 fixtures · fixed label accents',
  19,
);
for (let i = 0; i < nearest.length; i++) {
  const { a, b } = nearest[i],
    x = 20 + (i % 4) * 246,
    y = 48 + Math.floor(i / 4) * 208;
  pairs += await imageAt(a, x, y, 64, 'colour');
  pairs += await imageAt(b, x + 76, y, 64, 'colour');
  pairs += await imageAt(a, x, y + 74, 32, 'grayscale');
  pairs += await imageAt(b, x + 42, y + 74, 32, 'grayscale');
  pairs += text(x, y + 137, `${a} / ${b} · compare at real size`, 12);
}
pairs += '</svg>';
await sharp(Buffer.from(pairs)).png().toFile('artifacts/visual-nearest-pairs.png');
const report = {
  sampleSize: count,
  labelAccentsFixed: true,
  rasteriser: 'sharp',
  results: Object.fromEntries(
    [...seen].map(([size, hashes]) => [
      size,
      { distinctRasters: hashes.size, exactDuplicates: count - hashes.size },
    ]),
  ),
  nearestCandidates: nearest.map(({ a, b, meanPixelDifference }) => ({
    a,
    b,
    meanPixelDifference,
    characterA: samples[a].recipe.character,
    characterB: samples[b].recipe.character,
  })),
  comparisonSheets: ['artifacts/visual-vision-sheet.png', 'artifacts/visual-nearest-pairs.png'],
  visionSimulation: {
    source: 'https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html',
    method: 'Machado et al. 2009, severity 1.0, linear sRGB; grayscale uses linear luminance.',
    modes: visions,
  },
  limitation:
    'Exact pixel uniqueness, exploratory pixel distances and simulated colour vision do not establish human recognition rates or global uniqueness.',
};
await writeFile('artifacts/visual-audit.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
