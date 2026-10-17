import { deriveSpirit, varietyBudget, artwork, CHARACTER_GROUPS } from '@spirits/core';
import { fixtureAddress } from '../apps/shared/fixtures.js';
const count = Number(process.argv[2] ?? 10000);
if (!Number.isInteger(count) || count < 1 || count > 100000)
  throw new Error('Use a sample size from 1 to 100000.');
const seen = new Set<string>(),
  frequencies = Object.fromEntries(CHARACTER_GROUPS.map((g) => [g, new Map<string, number>()]));
for (let i = 0; i < count; i++) {
  const recipe = deriveSpirit(fixtureAddress(`variety-${i}`));
  seen.add(JSON.stringify(recipe.character));
  for (const g of CHARACTER_GROUPS)
    frequencies[g].set(recipe.character[g], (frequencies[g].get(recipe.character[g]) ?? 0) + 1);
}
console.log(
  JSON.stringify(
    {
      ...varietyBudget(),
      sampleSize: count,
      distinctCharacterRecipes: seen.size,
      duplicateRecipes: count - seen.size,
      coverage: Object.fromEntries(
        CHARACTER_GROUPS.map((g) => [
          g,
          {
            used: frequencies[g].size,
            total: artwork.groups[g].length,
            min: Math.min(...frequencies[g].values()),
            max: Math.max(...frequencies[g].values()),
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
