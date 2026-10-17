// Offline candidate selection only. These image distances are not recognition scores.
export interface VisualSample {
  rgb32: Uint8Array;
  gray: Uint8Array;
}
export interface VisualPair {
  a: number;
  b: number;
  difference: number;
}
export type SimilarityMode = 'grayscale' | 'colour' | 'outline';
export const similarityModes: SimilarityMode[] = ['grayscale', 'colour', 'outline'];

// Fixed subject crop, excluding most unused canvas without resizing away proportions.
// Blocks retain face, head, tail and item positions. Outline is foreground coverage,
// not a body-only silhouette: permanent accessories remain part of the character.
function descriptor(sample: VisualSample): Uint8Array {
  const result = new Uint8Array(192);
  const paper = sample.rgb32.slice(0, 3);
  for (let by = 0; by < 8; by++)
    for (let bx = 0; bx < 8; bx++) {
      let gray = 0,
        foreground = 0,
        colour = 0,
        count = 0;
      const x0 = 3 + Math.floor((bx * 26) / 8),
        x1 = 3 + Math.floor(((bx + 1) * 26) / 8);
      const y0 = 1 + Math.floor((by * 30) / 8),
        y1 = 1 + Math.floor(((by + 1) * 30) / 8);
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const p = y * 32 + x;
          gray += sample.gray[p];
          const r = sample.rgb32[p * 3],
            g = sample.rgb32[p * 3 + 1],
            b = sample.rgb32[p * 3 + 2];
          foreground +=
            Math.max(Math.abs(r - paper[0]), Math.abs(g - paper[1]), Math.abs(b - paper[2])) > 20
              ? 255
              : 0;
          // Red/blue opponent channel adds colour information independently of luminance.
          colour += (r - b + 255) / 2;
          count++;
        }
      const p = by * 8 + bx;
      result[p] = Math.round(gray / count);
      result[64 + p] = Math.round(colour / count);
      result[128 + p] = Math.round(foreground / count);
    }
  return result;
}

function keep(list: VisualPair[], pair: VisualPair, limit: number) {
  if (list.length === limit && pair.difference >= list[list.length - 1].difference) return;
  list.push(pair);
  list.sort((x, y) => x.difference - y.difference || x.a - y.a || x.b - y.b);
  if (list.length > limit) list.length = limit;
}

// Fine comparison measures the union of the two foregrounds, rather than counting
// matching empty paper as evidence of similarity. Fixed label details remain equal.
function distances(a: VisualSample, b: VisualSample): Record<SimilarityMode, number> {
  let grayscale = 0,
    colour = 0,
    outline = 0,
    count = 0;
  for (let y = 1; y < 31; y++)
    for (let x = 3; x < 29; x++) {
      const p = y * 32 + x,
        rgb = p * 3;
      const fa =
        Math.max(
          Math.abs(a.rgb32[rgb] - a.rgb32[0]),
          Math.abs(a.rgb32[rgb + 1] - a.rgb32[1]),
          Math.abs(a.rgb32[rgb + 2] - a.rgb32[2]),
        ) > 12;
      const fb =
        Math.max(
          Math.abs(b.rgb32[rgb] - b.rgb32[0]),
          Math.abs(b.rgb32[rgb + 1] - b.rgb32[1]),
          Math.abs(b.rgb32[rgb + 2] - b.rgb32[2]),
        ) > 12;
      if (!fa && !fb) continue;
      outline += fa === fb ? 0 : 255;
      grayscale += Math.abs(a.gray[p] - b.gray[p]);
      for (let c = 0; c < 3; c++) colour += Math.abs(a.rgb32[rgb + c] - b.rgb32[rgb + c]) / 3;
      count++;
    }
  const divisor = Math.max(1, count) * 255;
  return { grayscale: grayscale / divisor, colour: colour / divisor, outline: outline / divisor };
}

export function findSimilar(samples: VisualSample[]) {
  const shortlists: Record<SimilarityMode, VisualPair[]> = {
    grayscale: [],
    colour: [],
    outline: [],
  };
  let proposedPairs = 0;
  const exact = samples.length <= 2048;
  if (exact) {
    for (let a = 0; a < samples.length; a++)
      for (let b = 0; b < a; b++) {
        proposedPairs++;
        const scores = distances(samples[a], samples[b]);
        for (const mode of similarityModes)
          keep(shortlists[mode], { a, b, difference: scores[mode] }, 24);
      }
  } else {
    const features = samples.map(descriptor);
    const means = new Float64Array(192);
    for (const feature of features)
      for (let i = 0; i < 192; i++) means[i] += feature[i] / features.length;
    // Six deterministic sparse projection tables; neighbours in each sorted hash
    // propose pairs. A bounded window keeps a 50,000-image audit tractable.
    let state = 0x53504952;
    const random = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state >>> 0;
    };
    const visited = new Set<number>();
    const coarse: Record<SimilarityMode, VisualPair[]> = { grayscale: [], colour: [], outline: [] };
    for (let table = 0; table < 6; table++) {
      const offset = Math.floor(table / 2) * 64;
      const projections = Array.from({ length: 16 }, () =>
        Array.from({ length: 12 }, () => ({
          p: offset + (random() % 64),
          sign: random() % 2 ? 1 : -1,
        })),
      );
      const order = features
        .map((feature, index) => {
          let hash = 0;
          for (let bit = 0; bit < projections.length; bit++) {
            let sum = 0;
            for (const { p, sign } of projections[bit]) sum += (feature[p] - means[p]) * sign;
            if (sum > 0) hash |= 1 << bit;
          }
          return { hash, index };
        })
        .sort((a, b) => a.hash - b.hash || a.index - b.index);
      for (let i = 0; i < order.length; i++)
        for (let j = i + 1; j < Math.min(order.length, i + 9); j++) {
          const a = Math.max(order[i].index, order[j].index),
            b = Math.min(order[i].index, order[j].index),
            key = a * samples.length + b;
          if (visited.has(key)) continue;
          visited.add(key);
          proposedPairs++;
          let gray = 0,
            colour = 0,
            outline = 0;
          for (let k = 0; k < 64; k++) {
            gray += Math.abs(features[a][k] - features[b][k]);
            colour += Math.abs(features[a][64 + k] - features[b][64 + k]);
            outline += Math.abs(features[a][128 + k] - features[b][128 + k]);
          }
          keep(coarse.grayscale, { a, b, difference: gray + outline / 2 }, 256);
          keep(coarse.colour, { a, b, difference: gray + colour + outline / 2 }, 256);
          keep(coarse.outline, { a, b, difference: outline }, 256);
        }
    }
    const candidates = new Map<number, VisualPair>();
    for (const list of Object.values(coarse))
      for (const pair of list) candidates.set(pair.a * samples.length + pair.b, pair);
    for (const { a, b } of candidates.values()) {
      const scores = distances(samples[a], samples[b]);
      for (const mode of similarityModes)
        keep(shortlists[mode], { a, b, difference: scores[mode] }, 24);
    }
  }
  return {
    modes: shortlists,
    search: {
      exact,
      proposedPairs,
      totalPossiblePairs: (samples.length * (samples.length - 1)) / 2,
      method: exact
        ? 'Exhaustive foreground-union pixel comparison.'
        : 'Approximate: six deterministic 16-bit projection tables, sorted windows of eight, 256 coarse candidates per mode, then foreground-union pixel comparison. May miss close pairs.',
      limitation:
        'Candidate selection for visual review; distances are not calibrated to human recognition and provide no pass threshold.',
    },
  };
}
