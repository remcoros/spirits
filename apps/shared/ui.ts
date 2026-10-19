import { svgToPng } from '@remcoros/spirits/browser';
import {
  assetName,
  deriveSpirit,
  renderSpirit,
  SpiritAddressError,
  type SpiritRecipe,
} from '@remcoros/spirits';
import type { QRCode, Options } from 'jsqr';
export { svgToPng };

/** Describes the public artwork, never a claim about who controls an address. */
export function spiritDescription(recipe: SpiritRecipe): string {
  const c = recipe.character;
  return `${assetName('palette', c.palette)} SPirit. ${assetName('body', c.body)} body; ${assetName('eyes', c.eyes)} eyes; ${assetName('mouth', c.mouth)} mouth; ${assetName('head', c.head)} head feature; ${assetName('item', c.item)} signature accessory.`;
}
export function describedSpirit(address: string, size = 256) {
  const recipe = deriveSpirit(address);
  return { recipe, svg: renderSpirit(recipe, { size, title: spiritDescription(recipe) }) };
}
export function addressRecovery(error: unknown, value: string): string {
  if (!(error instanceof SpiritAddressError))
    return 'The QR check failed. Try again or use another browser.';
  if (!/^(?:t?sp)1/i.test(value.trim()))
    return 'Paste the complete Silent Payment address from your wallet. It begins with sp1 or tsp1.';
  switch (error.code) {
    case 'version':
      return 'This preview supports version 0 Silent Payment addresses. Ask your wallet for a supported address.';
    case 'network':
      return 'Use a Silent Payment address beginning with sp1 for Bitcoin mainnet or tsp1 for a test network.';
    case 'key':
      return 'This address is invalid. Copy a new address from your wallet.';
    case 'length':
      return 'This address looks incomplete. Copy the entire address again from your wallet.';
    default:
      return 'This address is invalid. Copy it again from your wallet without changing its letters or case.';
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function verifyQr(svg: string, address: string): Promise<boolean> {
  const png = await svgToPng(svg),
    image = await createImageBitmap(png);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas unavailable');
    c.drawImage(image, 0, 0);
    const rgba = c.getImageData(0, 0, image.width, image.height);
    const module = await import('jsqr');
    const decode = module.default as unknown as (
      data: Uint8ClampedArray,
      width: number,
      height: number,
      options?: Options,
    ) => QRCode | null;
    return decode(rgba.data, image.width, image.height)?.data === address;
  } finally {
    image.close();
  }
}
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing UI element ${id}`);
  return el as T;
};
