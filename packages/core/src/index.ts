import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { artwork } from './artwork.js';
import { parseAddress } from './address.js';
// The exported catalogue is public data, but its order and values determine identity.
// Freeze it at runtime as well as in TypeScript so a consumer cannot alter later renders.
function freezeCatalogue(value: object): void {
  for (const child of Object.values(value))
    if (child && typeof child === 'object') freezeCatalogue(child);
  Object.freeze(value);
}
freezeCatalogue(artwork);
export { parseAddress, encodeAddress, SpiritAddressError } from './address.js';
export type { SilentPaymentAddress } from './address.js';
export { artwork };

export const SCHEME = 'spirits-v0' as const;
export const CHARACTER_GROUPS = Object.freeze([
  'body',
  'hem',
  'eyes',
  'mouth',
  'brows',
  'palette',
  'marking',
  'head',
  'item',
] as const);
export type CharacterGroup = (typeof CHARACTER_GROUPS)[number];
export type AssetGroup = keyof typeof artwork.groups;
export type Character = Record<CharacterGroup, string>;
export interface SpiritRecipe {
  readonly scheme: typeof SCHEME;
  readonly address: string;
  readonly network: 'mainnet' | 'testnet';
  readonly identity: string;
  readonly variationId: string;
  readonly character: Readonly<Character>;
  readonly variation: Readonly<{ badge: string; accent: string; pattern: number; glyph: number }>;
}
export interface RenderOptions {
  size?: number;
  background?: 'transparent' | 'paper';
  title?: string;
}
const hash = (domain: string, bytes: Uint8Array) => sha256(concatBytes(utf8ToBytes(domain), bytes));
const integer = (bytes: Uint8Array) => bytes[0] * 256 + bytes[1];
const select = (group: AssetGroup, bytes: Uint8Array, domain: string) => {
  const entries = artwork.groups[group];
  // All v0 counts are powers of two: this selection has no modulo bias.
  return entries[integer(hash(domain, bytes)) % entries.length].id;
};
export function deriveSpirit(address: string): SpiritRecipe {
  const parsed = parseAddress(address);
  const both = concatBytes(parsed.scanKey, parsed.spendKey);
  const character = Object.fromEntries(
    CHARACTER_GROUPS.map((group) => [
      group,
      select(group, parsed.scanKey, `SPirits/v0/character/${group}/`),
    ]),
  ) as Character;
  return {
    scheme: SCHEME,
    address: parsed.address,
    network: parsed.network,
    identity: bytesToHex(hash('SPirits/v0/identity/', parsed.scanKey)),
    variationId: bytesToHex(hash('SPirits/v0/variation/', both)),
    character,
    variation: {
      badge: select('badge', both, 'SPirits/v0/variation/badge/'),
      accent: select('accent', both, 'SPirits/v0/variation/accent/'),
      pattern: integer(hash('SPirits/v0/variation/pattern/', both)) % 16,
      glyph: integer(hash('SPirits/v0/variation/glyph/', both)),
    },
  };
}
function entry(
  group: AssetGroup,
  id: string,
): { id: string; name: string; svg?: string; [key: string]: unknown } {
  const found = artwork.groups[group].find((item) => item.id === id);
  if (!found) throw new Error(`Unknown ${group} asset: ${id}`);
  return found;
}
export const assetName = (group: AssetGroup, id: string) => entry(group, id).name;
export const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!,
  );
const safeSize = (size: number) => {
  if (!Number.isInteger(size) || size < 16 || size > 4096)
    throw new RangeError('Image size must be an integer from 16 to 4096.');
  return size;
};
type Palette = { ink: string; body: string; paper: string; shade: string; accent: string };
const paint = (svg: string, palette: Palette) =>
  svg.replace(/\{\{(ink|body|paper|shade|accent)\}\}/g, (_, key: keyof Palette) => palette[key]);

/** Renders only trusted catalogue assets. SVG output has no fonts, scripts, IDs or remote URLs. */
export function renderSpirit(recipe: SpiritRecipe, options: RenderOptions = {}): string {
  if (recipe.scheme !== SCHEME) throw new Error('Unsupported Spirit scheme.');
  const size = safeSize(options.size ?? 256),
    c = recipe.character;
  const p = entry('palette', c.palette) as unknown as Palette;
  const accent = entry('accent', recipe.variation.accent).color as string;
  if (
    !Number.isInteger(recipe.variation.glyph) ||
    recipe.variation.glyph < 0 ||
    recipe.variation.glyph > 65535 ||
    !Number.isInteger(recipe.variation.pattern) ||
    recipe.variation.pattern < 0 ||
    recipe.variation.pattern > 15
  )
    throw new Error('Invalid Spirit variation.');
  const outline = entry('body', c.body).svg! + ' ' + entry('hem', c.hem).svg! + ' Z';
  const body = `<path d="${outline}" transform="translate(53 61) scale(1.5 1.23)" fill="${p.body}" stroke="${p.ink}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const features = ['marking', 'brows', 'eyes', 'mouth', 'head', 'item']
    .map((g) => paint(entry(g as CharacterGroup, c[g as CharacterGroup]).svg!, p))
    .join('');
  const bandY = 154 + (recipe.variation.pattern % 4) * 2;
  const dash = ['', '7 4', '1 4', '5 3 1 3'][Math.floor(recipe.variation.pattern / 4)];
  const trim = `<path d="M 96 ${bandY} Q 90 ${bandY + 8} 98 ${bandY + 15}" fill="none" stroke="${accent}" stroke-width="3.5" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const badge = paint(entry('badge', recipe.variation.badge).svg!, { ...p, accent });
  let glyph = '';
  for (let bit = 0; bit < 16; bit++)
    if ((recipe.variation.glyph >>> bit) & 1)
      glyph += `<rect x="${-5 + (bit % 4) * 3}" y="${-5 + Math.floor(bit / 4) * 3}" width="2" height="2" fill="${p.ink}"/>`;
  const label = `<g transform="translate(77 179) scale(.82)" stroke="${p.ink}" stroke-width="2">${badge}<g stroke="none">${glyph}</g></g>`;
  const title = escapeXml(options.title ?? 'SPirit · experimental v0');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256" role="img"><title>${title}</title>${options.background === 'paper' ? `<rect width="256" height="256" rx="24" fill="${p.paper}"/>` : ''}<ellipse cx="128" cy="228" rx="65" ry="7" fill="${p.ink}" opacity=".09"/>${body}${features}${trim}${label}</svg>`;
}

export function createSpirit(address: string, options?: RenderOptions) {
  const recipe = deriveSpirit(address);
  return { recipe, svg: renderSpirit(recipe, options) };
}

/** Catalogue previews for the development lab and asset authors. */
export function renderAsset(group: AssetGroup, id: string, size = 128): string {
  safeSize(size);
  const item = entry(group, id),
    p = artwork.groups.palette[0];
  const transforms: Partial<Record<AssetGroup, string>> = {
    body: 'translate(48 45) scale(1.6)',
    hem: 'translate(48 -30) scale(1.6)',
    eyes: 'translate(-55 -70) scale(1.45)',
    mouth: 'translate(-140 -200) scale(2)',
    brows: 'translate(-70 -85) scale(1.5)',
    marking: 'translate(-130 -205) scale(2)',
    head: 'translate(-45 50) scale(1.35)',
    item: 'translate(-440 -410) scale(3.2)',
    badge: 'translate(128 128) scale(6)',
  };
  let svg = item.svg ?? '';
  if (group === 'body')
    svg = `<path d="${svg} L 0 100 Z" fill="${p.body}" stroke="${p.ink}" stroke-width="3"/>`;
  if (group === 'hem')
    svg = `<path d="M 100 100 ${svg} L 0 65 L 100 65 Z" fill="${p.body}" stroke="${p.ink}" stroke-width="3"/>`;
  if (group === 'palette')
    svg = `<rect x="35" y="35" width="186" height="186" rx="60" fill="${item.body}"/><circle cx="105" cy="105" r="15" fill="${item.ink}"/><circle cx="155" cy="105" r="15" fill="${item.ink}"/><path d="M 80 170 Q 128 215 180 160" fill="none" stroke="${item.accent}" stroke-width="12"/>`;
  if (group === 'accent') svg = `<circle cx="128" cy="128" r="75" fill="${item.color}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 256 256"><title>${escapeXml(item.name)}</title><g transform="${transforms[group] ?? ''}">${paint(svg, p)}</g></svg>`;
}

export function varietyBudget() {
  const counts = Object.fromEntries(CHARACTER_GROUPS.map((g) => [g, artwork.groups[g].length]));
  const rawCombinations = Object.values(counts).reduce((n, k) => n * BigInt(k), 1n);
  return {
    scheme: SCHEME,
    counts,
    rawCombinations: rawCombinations.toString(),
    bits: Math.log2(Number(rawCombinations)),
    note: 'Raw trait combinations; visual similarity and collisions remain possible.',
  };
}
