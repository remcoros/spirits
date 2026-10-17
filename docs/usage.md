# Use SPirits in your app

SPirits renders deterministic ghost avatars from Bitcoin Silent Payment public addresses. The core includes all artwork and produces self-contained SVG. The separate QR extension embeds the matching character in a standard payment QR.

**The first planned release is `0.1.0-beta.1`.** Artwork and mappings in the experimental `spirits-v0` visual scheme may change. The live website follows `main` and can contain changes that are not yet in an npm release. For reproducible integration, use a specific package version or assets from a specific GitHub tag.

## Find packages and release assets

- [Core package: `@remcoros/spirits`](https://www.npmjs.com/package/@remcoros/spirits).
- [QR extension: `@remcoros/spirits-qr`](https://www.npmjs.com/package/@remcoros/spirits-qr).
- [GitHub Releases](https://github.com/remcoros/spirits/releases): downloadable package tarballs, standalone JavaScript modules, artwork catalogue, test vectors, licence notices and checksums.
- [Source code](https://github.com/remcoros/spirits): implementation, documentation and development tools.

Package pages and release assets become available after the first publication. Until then, use the [local checkout instructions](../README.md#run-locally). The website does not distribute the former PoC source ZIP or local package snapshots.

## Install from npm

Beta releases use the `next` channel:

```sh
npm install @remcoros/spirits@next @remcoros/spirits-qr@next
```

To pin the first beta exactly after it is published:

```sh
npm install @remcoros/spirits@0.1.0-beta.1 @remcoros/spirits-qr@0.1.0-beta.1
```

The QR package depends on the same exact core version. Keep both versions together when upgrading. Install only the core if you do not need payment QRs.

```ts
import { createSpirit, deriveSpirit, renderSpirit, parseAddress } from '@remcoros/spirits';
import { createSpiritQr } from '@remcoros/spirits-qr';

// A complete public Silent Payment address from a wallet.
const address = 'sp1q…'; // Replace this placeholder with the full address.

const { svg, recipe } = createSpirit(address, { size: 512 });
const sameImage = renderSpirit(recipe, { size: 512 });
const qr = createSpiritQr(address);
const plainQr = createSpiritQr(address, { spirit: false });
```

`svg` and `qr.svg` are SVG strings. `recipe` describes the character and its label accents. `deriveSpirit` returns that recipe without rendering; `parseAddress` validates the address and returns canonical public data. Invalid inputs throw `SpiritAddressError` with an error code.

The core and QR extension work in Node and modern browsers without a DOM, canvas, filesystem or network dependency. Rendering a public address requires no private key and makes no address lookup.

## Browser PNG export

The optional browser entry point converts a generated SVG into a PNG Blob using canvas:

```ts
import { createSpirit } from '@remcoros/spirits';
import { svgToPng } from '@remcoros/spirits/browser';

const { svg } = createSpirit(address, { size: 512 });
const pngBlob = await svgToPng(svg);
```

This adapter requires browser APIs. PNG bytes can differ between rasterisers even when the character is the same.

## Use downloadable assets

Choose a tag on [GitHub Releases](https://github.com/remcoros/spirits/releases), including the beta releases. The release assets and npm packages come from the same tested build.

- **Package tarballs (`.tgz`)** can be installed with `npm install ./downloaded-package.tgz`. Install the core and QR tarballs from the same release together when using both.
- **`spirits-core.mjs` and `spirits-qr.mjs`** are standalone ES modules with dependencies and artwork bundled. Download them into your app and import them by local path. Each is self-contained; importing both includes two copies of the core code. The npm packages allow a bundler to share dependencies and remove unused functions.
- **`spirits-v0.json`**, the algorithm notes and test vectors support inspecting the catalogue and building independent implementations. Match them to the release whose appearance you need to reproduce.
- **Licence notices and checksums** accompany the downloadable assets. Keep the required notices when redistributing modules or fonts.

For example, after downloading the standalone modules into your application:

```js
import { createSpirit } from './spirits-core.mjs';
import { createSpiritQr } from './spirits-qr.mjs';

const spirit = createSpirit(address);
const qr = createSpiritQr(address);
```

The standalone core module exports the platform-neutral API. Use the npm browser entry point for the optional PNG adapter.

## Address and appearance contracts

Inputs are trimmed, fully validated, and then canonicalised. Supported inputs are BIP352 version 0 `sp` and `tsp` public addresses. A `tsp` prefix does not distinguish signet from other test networks. URI wrappers and unsupported versions are rejected.

The scan public key fixes the nine core character traits, including signature accessories. Both public keys select a small label badge and trim variation. The same public keys produce the same character across supported network prefixes. Sizes and export formats do not reroll traits.

A Spirit is a recognition aid. Similar characters and collisions are possible; shared scan keys can be copied. Appearance does not prove ownership or verify a legitimate wallet label. Compare addresses in your wallet when making payments.

QRs contain the complete canonical address, use H error correction, retain structural markers and include a four-module quiet zone. Software decoding checks do not establish universal camera or print reliability. Test the final displayed or printed QR with the wallets and devices you intend to support.

See the [algorithm contract](algorithm.md), [QR behavior](qr.md), [validation limits](validation.md), and package API notes for [core](../packages/core/README.md) and [QR](../packages/qr/README.md).

## Licences

Original code is MIT. Original artwork and rendered visual output are CC0-1.0. Third-party components retain their own licences; see [the notices](../THIRD-PARTY.md).
