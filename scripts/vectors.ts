// Explicitly regenerate only when intentionally changing the experimental v0 mapping/art.
import { createSpirit } from '@remcoros/spirits';
import { fixtureAddress } from '../apps/shared/fixtures.js';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const vectors = [];
for (const seed of ['hello-spirit', 'vector-2'])
  for (const label of [1, 2, 42])
    for (const network of ['mainnet', 'testnet'] as const) {
      const address = fixtureAddress(seed, label, network),
        { recipe, svg } = createSpirit(address);
      vectors.push({
        fixtureSeed: seed,
        label,
        address,
        recipe,
        svgSha256: createHash('sha256').update(svg).digest('hex'),
      });
    }
await writeFile('spec/test-vectors.json', JSON.stringify(vectors, null, 2) + '\n');
