import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { bech32m } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import sharp from 'sharp';
import {
  deriveSpirit,
  createSpirit,
  parseAddress,
  encodeAddress,
  renderSpirit,
  artwork,
  CHARACTER_GROUPS,
  varietyBudget,
  SpiritAddressError,
} from '@remcoros/spirits';
import { fixtureAddress } from '../apps/shared/fixtures.js';

test('canonical encoding, network and valid public points', () => {
  for (const network of ['mainnet', 'testnet'] as const) {
    const address = fixtureAddress('canonical', 1, network),
      p = parseAddress(address);
    assert.equal(p.network, network);
    assert.equal(address.length, network === 'mainnet' ? 116 : 117);
    assert.equal(encodeAddress(p.scanKey, p.spendKey, network), address);
    assert.deepEqual(deriveSpirit(address), deriveSpirit(' \n' + address.toUpperCase() + ' '));
  }
});
test('invalid encodings and checksums never create an avatar', () => {
  const address = fixtureAddress('invalid');
  for (const s of [
    '',
    address.slice(0, -1) + (address.endsWith('q') ? 'p' : 'q'),
    'bitcoin:' + address,
    address.slice(0, 4).toUpperCase() + address.slice(4),
    'sp1' + address,
    'x'.repeat(2000),
  ])
    assert.throws(() => deriveSpirit(s), SpiritAddressError);
  const decoded = bech32m.decode(address as `${string}1${string}`, 1023);
  for (const [prefix, words] of [
    ['bad', decoded.words],
    ['tsp', [1, ...decoded.words.slice(1)]],
    ['tsp', [0, ...bech32m.toWords(new Uint8Array(65))]],
  ] as const)
    assert.throws(() => parseAddress(bech32m.encode(prefix, [...words], 1023)), SpiritAddressError);
  const invalid = new Uint8Array(66).fill(255);
  assert.throws(
    () => parseAddress(bech32m.encode('tsp', [0, ...bech32m.toWords(invalid)], 1023)),
    SpiritAddressError,
  );
});
test('real BIP352 label families retain every character trait and change accents', () => {
  const r = Array.from({ length: 32 }, (_, i) => deriveSpirit(fixtureAddress('family', i + 1)));
  for (const v of r) {
    assert.equal(v.identity, r[0].identity);
    assert.deepEqual(v.character, r[0].character);
  }
  assert.equal(new Set(r.map((v) => v.variationId)).size, 32);
  assert.ok(new Set(r.map((v) => JSON.stringify(v.variation))).size > 28);
  assert.notEqual(deriveSpirit(fixtureAddress('other')).identity, r[0].identity);
  assert.deepEqual(deriveSpirit(fixtureAddress('family', 1, 'mainnet')).character, r[0].character);
});
test('trait selection agrees with an independent Node SHA256 implementation', () => {
  const address = fixtureAddress('independent'),
    parsed = parseAddress(address),
    recipe = deriveSpirit(address);
  for (const group of CHARACTER_GROUPS) {
    const digest = createHash('sha256')
      .update(`SPirits/v0/character/${group}/`)
      .update(parsed.scanKey)
      .digest();
    assert.equal(
      recipe.character[group],
      artwork.groups[group][digest.readUInt16BE(0) % artwork.groups[group].length].id,
    );
  }
  const digest = (domain: string, keys: Uint8Array[]) => {
    const hash = createHash('sha256').update(domain);
    for (const key of keys) hash.update(key);
    return hash.digest();
  };
  const both = [parsed.scanKey, parsed.spendKey];
  assert.equal(recipe.identity, digest('SPirits/v0/identity/', [parsed.scanKey]).toString('hex'));
  assert.equal(recipe.variationId, digest('SPirits/v0/variation/', both).toString('hex'));
  for (const group of ['badge', 'accent'] as const)
    assert.equal(
      recipe.variation[group],
      artwork.groups[group][
        digest(`SPirits/v0/variation/${group}/`, both).readUInt16BE(0) %
          artwork.groups[group].length
      ].id,
    );
  assert.equal(
    recipe.variation.pattern,
    digest('SPirits/v0/variation/pattern/', both).readUInt16BE(0) % 16,
  );
  assert.equal(recipe.variation.glyph, digest('SPirits/v0/variation/glyph/', both).readUInt16BE(0));
});
test('JavaScript consumers cannot mutate the character-group contract', () => {
  const address = fixtureAddress('immutable-trait-order'),
    before = deriveSpirit(address);
  assert.ok(Object.isFrozen(CHARACTER_GROUPS));
  assert.throws(() => (CHARACTER_GROUPS as unknown as string[]).pop(), TypeError);
  assert.deepEqual(deriveSpirit(address), before);
  assert.equal(Object.keys(before.character).length, 9);
  assert.doesNotThrow(() => createSpirit(address));
});
test('all sixteen label trim patterns produce distinct final rasters', async () => {
  const recipe = deriveSpirit(fixtureAddress('trim-treatments'));
  const images = await Promise.all(
    Array.from({ length: 16 }, async (_, pattern) => {
      const svg = renderSpirit(
        { ...recipe, variation: { ...recipe.variation, pattern } },
        { size: 128 },
      );
      return createHash('sha256')
        .update(await sharp(Buffer.from(svg)).raw().toBuffer())
        .digest('hex');
    }),
  );
  assert.equal(new Set(images).size, 16);
});
test('v0 assets have distinct IDs and data, power-of-two counts, and a documented budget', () => {
  assert.ok(Object.isFrozen(artwork.groups.body));
  assert.ok(Object.isFrozen(artwork.groups.body[0]));
  for (const assets of Object.values(artwork.groups)) {
    assert.equal(new Set(assets.map((a) => a.id)).size, assets.length);
    assert.equal(
      new Set(
        assets.map((a) => {
          const { id, name, ...data } = a;
          return JSON.stringify(data);
        }),
      ).size,
      assets.length,
    );
    assert.equal(Math.log2(assets.length) % 1, 0);
  }
  assert.equal(varietyBudget().rawCombinations, '70368744177664');
  assert.equal(varietyBudget().bits, 46);
});
test('SVG is deterministic, self-contained, escaped and independent of rendering size', () => {
  const address = fixtureAddress('svg'),
    { recipe, svg } = createSpirit(address);
  assert.equal(svg, renderSpirit(recipe));
  assert.equal(svg, createSpirit(address.toUpperCase()).svg);
  assert.ok(!/<script|<foreignObject|<image|<use|href=|url\(|\{\{/.test(svg));
  assert.match(
    renderSpirit(recipe, { title: '<unsafe & "test">' }),
    /&lt;unsafe &amp; &quot;test&quot;&gt;/,
  );
  assert.throws(() => renderSpirit(recipe, { size: NaN }));
  assert.throws(() => renderSpirit(recipe, { size: 10000 }));
  assert.deepEqual(
    createSpirit(address, { size: 32 }).recipe,
    createSpirit(address, { size: 1024 }).recipe,
  );
});
test('committed portable SPirits vectors stay reproducible', async () => {
  const vectors = JSON.parse(
    await readFile(new URL('../spec/test-vectors.json', import.meta.url), 'utf8'),
  );
  for (const v of vectors) {
    assert.deepEqual(deriveSpirit(v.address), v.recipe);
    assert.equal(
      createHash('sha256').update(createSpirit(v.address).svg).digest('hex'),
      v.svgSha256,
    );
  }
});
test('official BIP352 addresses round-trip, including labelled public keys', async () => {
  const vectors = JSON.parse(
    await readFile(new URL('../spec/bip352-addresses.json', import.meta.url), 'utf8'),
  );
  assert.ok(vectors.length >= 12);
  for (const address of vectors) {
    const p = parseAddress(address);
    assert.equal(encodeAddress(p.scanKey, p.spendKey, p.network), address);
    assert.doesNotThrow(() => secp256k1.Point.fromBytes(p.scanKey).assertValidity());
  }
});
