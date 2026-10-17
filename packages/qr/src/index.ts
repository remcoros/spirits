import { deriveSpirit, parseAddress, renderSpirit } from '@remcoros/spirits';
import { qrcodegen } from './vendor/qrcodegen.js';

export interface QrOptions {
  /** Integer pixels per QR module; exporting at whole modules avoids blurred edges. */
  scale?: number;
  /** Include the derived Spirit. Defaults to true. */
  spirit?: boolean;
}
export interface SpiritQr {
  svg: string;
  address: string;
  version: number;
  modules: number;
  width: number;
  quietZone: 4;
  errorCorrection: 'H';
  logoModules: number;
  /** Shape of the cleared artwork area; bounds use QR modules, excluding the quiet zone. */
  logoShape: 'circle' | null;
  logoBounds: { x: number; y: number; size: number } | null;
  alignmentCenters: readonly number[];
}

/** QR Model 2 alignment positions, including the version-32 special case. */
export function alignmentPositions(version: number): number[] {
  if (!Number.isInteger(version) || version < 1 || version > 40)
    throw new RangeError('Invalid QR version.');
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step =
    version === 32 ? 26 : Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const result = [6];
  for (let p = version * 4 + 10; result.length < count; p -= step) result.splice(1, 0, p);
  return result;
}

type Rectangle = { x: number; y: number; width: number; height: number };

/** Protected module footprints, including light separator/configuration modules. */
function structuralRegions(version: number): Rectangle[] {
  const positions = alignmentPositions(version),
    last = positions.length - 1,
    size = version * 4 + 17;
  const regions: Rectangle[] = [
    { x: 0, y: 0, width: 9, height: 9 },
    { x: size - 8, y: 0, width: 8, height: 9 },
    { x: 0, y: size - 8, width: 9, height: 8 },
    { x: 6, y: 0, width: 1, height: size },
    { x: 0, y: 6, width: size, height: 1 },
  ];
  if (version >= 7)
    regions.push(
      { x: size - 11, y: 0, width: 3, height: 6 },
      { x: 0, y: size - 11, width: 6, height: 3 },
    );
  for (let i = 0; i < positions.length; i++)
    for (let j = 0; j < positions.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      regions.push({ x: positions[i] - 2, y: positions[j] - 2, width: 5, height: 5 });
    }
  return regions;
}

/** Legacy square-plate clearance helper; side lengths are odd whole modules. */
export function canPlaceLogo(version: number, side: number): boolean {
  const regions = structuralRegions(version),
    size = version * 4 + 17,
    min = (size - side) / 2,
    max = min + side;
  if (!Number.isInteger(side) || side < 1 || (size - side) % 2 !== 0 || min < 0) return false;
  return regions.every(
    (r) => max <= r.x || min >= r.x + r.width || max <= r.y || min >= r.y + r.height,
  );
}

/** Tests a centred circle against complete structural module footprints, not their centres. */
export function canPlaceLogoCircle(version: number, diameter: number): boolean {
  const regions = structuralRegions(version),
    size = version * 4 + 17,
    center = size / 2,
    radius = diameter / 2;
  if (!Number.isFinite(diameter) || diameter <= 0 || diameter > size) return false;
  return regions.every((r) => {
    const dx = Math.max(r.x - center, 0, center - (r.x + r.width)),
      dy = Math.max(r.y - center, 0, center - (r.y + r.height));
    // Reject tangency as well, leaving reserved module edges untouched.
    return dx * dx + dy * dy > radius * radius;
  });
}

/** Standard QR payload is the canonical, complete SP address, never a redirect URL. */
export function createSpiritQr(address: string, options: QrOptions = {}): SpiritQr {
  const scale = options.scale ?? 8,
    withSpirit = options.spirit !== false;
  if (!Number.isInteger(scale) || scale < 2 || scale > 32)
    throw new RangeError('QR scale must be an integer from 2 to 32.');
  // Plain QRs still validate the full public address, without deriving or rendering unused art.
  const recipe = withSpirit ? deriveSpirit(address) : undefined,
    canonicalAddress = recipe?.address ?? parseAddress(address).address;
  const segment = qrcodegen.QrSegment.makeBytes(
    Array.from(new TextEncoder().encode(canonicalAddress)),
  );
  let qr: qrcodegen.QrCode | undefined,
    logoModules = 0;
  for (let version = 1; version <= 40; version++) {
    const modules = version * 4 + 17;
    // The cap is an intentionally decoder-tested geometry, not an ECC-area calculation.
    const diameter = Math.min(20.5, Math.round(modules * 0.28 * 2) / 2);
    if (withSpirit && (diameter < 13 || !canPlaceLogoCircle(version, diameter))) continue;
    try {
      qr = qrcodegen.QrCode.encodeSegments(
        [segment],
        qrcodegen.QrCode.Ecc.HIGH,
        version,
        version,
        -1,
        false,
      );
    } catch (error) {
      if (error instanceof RangeError) continue;
      throw error;
    }
    logoModules = withSpirit ? diameter : 0;
    break;
  }
  if (!qr) throw new Error('Could not find a QR layout with room for the Spirit.');
  const margin = 4,
    total = qr.size + margin * 2,
    width = total * scale;
  let data = '';
  for (let y = 0; y < qr.size; y++)
    for (let x = 0; x < qr.size; x++)
      if (qr.getModule(x, y)) data += `M${x + margin},${y + margin}h1v1h-1z`;
  const origin = (qr.size - logoModules) / 2;
  const logoBounds = withSpirit ? { x: origin, y: origin, size: logoModules } : null;
  let nested = '';
  if (recipe) {
    const center = total / 2,
      radius = logoModules / 2,
      avatarSize = logoModules - 2.5;
    const avatar = renderSpirit(recipe, {
      size: 256,
      title: 'SPirit for the encoded Silent Payment address',
    });
    nested =
      `<circle cx="${center}" cy="${center}" r="${radius}" fill="#fff"/>` +
      `<circle cx="${center}" cy="${center}" r="${radius - 0.6}" fill="#fff" stroke="#242b29" stroke-width="0.25"/>` +
      avatar
        .replace('<svg ', `<svg x="${center - avatarSize / 2}" y="${center - avatarSize / 2}" `)
        .replace('width="256" height="256"', `width="${avatarSize}" height="${avatarSize}"`)
        // Empty canvas is removed; all character, accessories and shadow remain visible.
        .replace('viewBox="0 0 256 256"', 'viewBox="24 12 208 232"');
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${total} ${total}" role="img"><title>${withSpirit ? 'Silent Payment QR with SPirit' : 'Silent Payment QR'}</title><rect width="${total}" height="${total}" fill="#fff"/><path d="${data}" fill="#000" shape-rendering="crispEdges"/>${nested}</svg>`;
  return {
    svg,
    address: canonicalAddress,
    version: qr.version,
    modules: qr.size,
    width,
    quietZone: 4,
    errorCorrection: 'H',
    logoModules,
    logoShape: withSpirit ? 'circle' : null,
    logoBounds,
    alignmentCenters: alignmentPositions(qr.version),
  };
}
