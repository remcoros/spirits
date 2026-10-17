import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSimilar, type VisualSample } from '../scripts/similarity.js';

function rectangle(
  paper: number,
  colour: [number, number, number],
  grayValue: number,
): VisualSample {
  const rgb32 = new Uint8Array(32 * 32 * 3).fill(paper);
  const gray = new Uint8Array(32 * 32).fill(paper);
  for (let y = 7; y < 26; y++)
    for (let x = 8; x < 24; x++) {
      rgb32.set(colour, (y * 32 + x) * 3);
      gray[y * 32 + x] = grayValue;
    }
  return { rgb32, gray };
}

test('similarity compares foreground without rewarding matching unused paper', () => {
  const result = findSimilar([
    rectangle(255, [100, 100, 100], 100),
    rectangle(245, [100, 100, 100], 100),
  ]);
  assert.equal(result.search.exact, true);
  assert.equal(result.search.proposedPairs, 1);
  for (const candidates of Object.values(result.modes)) assert.equal(candidates[0].difference, 0);
});

test('colour and grayscale candidates retain independent evidence', () => {
  const result = findSimilar([
    rectangle(255, [100, 100, 100], 100),
    rectangle(255, [70, 100, 130], 100),
  ]);
  assert.equal(result.modes.grayscale[0].difference, 0);
  assert.equal(result.modes.outline[0].difference, 0);
  assert.ok(result.modes.colour[0].difference > 0);
});

test('large-pool candidate search is deterministic and retrieves an injected duplicate', () => {
  let state = 9187;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  const samples = Array.from({ length: 2050 }, () => {
    const sample = rectangle(255, [100, 100, 100], 100);
    for (let y = 7; y < 26; y++)
      for (let x = 8; x < 24; x++) {
        const p = y * 32 + x,
          value = 40 + (random() % 150);
        sample.gray[p] = value;
        sample.rgb32.fill(value, p * 3, p * 3 + 3);
      }
    return sample;
  });
  samples[2049] = samples[17];
  const result = findSimilar(samples);
  assert.equal(result.search.exact, false);
  assert.ok(result.search.proposedPairs < result.search.totalPossiblePairs);
  for (const mode of ['grayscale', 'colour'] as const) {
    assert.equal(result.modes[mode][0].difference, 0);
    assert.deepEqual([result.modes[mode][0].a, result.modes[mode][0].b], [2049, 17]);
  }
  assert.deepEqual(findSimilar(samples), result);
});
