import { svgToPng } from '@spirits/core/browser';
import {
  assetName,
  deriveSpirit,
  renderSpirit,
  SpiritAddressError,
  type SpiritRecipe,
} from '@spirits/core';
import type { QRCode, Options } from 'jsqr';
export { svgToPng };

/** Describes the public artwork, never a claim about who controls an address. */
export function spiritDescription(recipe: SpiritRecipe): string {
  const c = recipe.character;
  return `${assetName('palette', c.palette)} SPirit. ${assetName('body', c.body)} body; ${assetName('eyes', c.eyes)} eyes; ${assetName('mouth', c.mouth)} mouth; ${assetName('head', c.head)} head feature; ${assetName('item', c.item)} signature accessory. Experimental v0.`;
}
export function describedSpirit(address: string, size = 256) {
  const recipe = deriveSpirit(address);
  return { recipe, svg: renderSpirit(recipe, { size, title: spiritDescription(recipe) }) };
}
export function addressRecovery(error: unknown, value: string): string {
  if (!(error instanceof SpiritAddressError))
    return 'The finished QR could not be checked in this browser. Try again, or use another browser.';
  if (!/^(?:t?sp)1/i.test(value.trim()))
    return 'Paste the complete Silent Payment address from your wallet. It begins with sp1 or tsp1.';
  switch (error.code) {
    case 'version':
      return 'This preview supports version 0 Silent Payment addresses. Ask your wallet for a supported address.';
    case 'network':
      return 'Use a Silent Payment address beginning with sp1 for Bitcoin mainnet or tsp1 for a test network.';
    case 'key':
      return 'This address contains invalid public keys. Copy a fresh address directly from your wallet.';
    case 'length':
      return 'This address looks incomplete. Copy the entire address again from your wallet.';
    default:
      return 'The address could not be validated. Copy the entire address again without changing its letters or case.';
  }
}

/** Only same-site build metadata is fetched; addresses never participate in these URLs. */
export async function loadDownloads(directory: string): Promise<void> {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[data-download]'));
  try {
    const base = new URL(directory, document.baseURI);
    const response = await fetch(new URL('manifest.json', base));
    if (!response.ok) throw new Error('Downloads unavailable');
    const manifest = await response.json();
    if (manifest.schemaVersion !== 1) throw new Error('Unsupported download manifest');
    const paths: Record<string, unknown> = {
      core: manifest.packages?.core?.file,
      qr: manifest.packages?.qr?.file,
      ...manifest.files,
    };
    for (const link of links) {
      const key = link.dataset.download!,
        path = paths[key];
      if (
        typeof path !== 'string' ||
        !/^[\w.-]+(?:\/[\w.-]+)*$/.test(path) ||
        path.split('/').includes('..')
      )
        throw new Error('Invalid download path');
      link.href = new URL(path, base).href;
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
      if (key === 'core' || key === 'qr') {
        const version = manifest.packages[key].version;
        if (typeof version !== 'string' || !/^[\w.+-]+$/.test(version))
          throw new Error('Invalid package version');
        link.textContent = `${link.dataset.label} · v${version} ↓`;
      }
    }
    const status = document.getElementById('downloads-status');
    if (status)
      status.textContent =
        'Local POC downloads. These package names are not published npm releases.';
  } catch {
    for (const link of links) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.tabIndex = -1;
    }
    const status = document.getElementById('downloads-status');
    if (status) status.textContent = 'Downloads are unavailable in this preview.';
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
