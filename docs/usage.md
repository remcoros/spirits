# Use SPirits in your app

SPirits renders deterministic ghost avatars from Bitcoin Silent Payment public addresses. The core includes all artwork and produces self-contained SVG. The separate QR extension embeds the matching character in a standard payment QR.

Use Node 24 or a modern browser. The `spirits-v0` artwork and mappings are experimental in `0.1.0`. Pin the package version and use its matching GitHub tag to reproduce output. The live website follows `main`.

## Find packages and release notes

- [Core package: `@remcoros/spirits`](https://www.npmjs.com/package/@remcoros/spirits).
- [QR extension: `@remcoros/spirits-qr`](https://www.npmjs.com/package/@remcoros/spirits-qr).
- [GitHub Releases](https://github.com/remcoros/spirits/releases): change notes, npm installation links and versioned documentation. GitHub also provides its automatic source-code ZIP and tarball for each tag.
- [Source code](https://github.com/remcoros/spirits): implementation, documentation and development tools.

Download packages from npm. Each tarball contains its standalone module; core also includes the portable artwork catalogue. GitHub Releases have no custom attachments. Use the website to download generated avatars and QR images.

## Install from npm

Install the latest release:

```sh
npm install @remcoros/spirits @remcoros/spirits-qr
```

To pin version `0.1.0`:

```sh
npm install @remcoros/spirits@0.1.0 @remcoros/spirits-qr@0.1.0
```

The QR package depends on the same exact core version. Keep both versions together when upgrading. Install only the core if you do not need payment QRs.

Prereleases use the `next` channel. Normal releases use `latest`.

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

The core and QR extension work in Node and modern browsers without a DOM, canvas, filesystem or network dependency. Rendering uses only the public address, with no private key or address lookup.

## Browser PNG export

The optional browser entry point converts a generated SVG into a PNG Blob using canvas:

```ts
import { createSpirit } from '@remcoros/spirits';
import { svgToPng } from '@remcoros/spirits/browser';

const { svg } = createSpirit(address, { size: 512 });
const pngBlob = await svgToPng(svg);
```

This adapter needs browser APIs. Different rasterisers can produce different PNG bytes for the same character.

## Extract standalone modules and artwork from npm

Use `npm pack` to get standalone ES modules or the portable catalogue without installing the packages in an app. These commands download the `0.1.0` tarballs and extract each package into its own new temporary directory:

```sh
spirits_extract_dir="$(mktemp -d)"
mkdir "$spirits_extract_dir/core" "$spirits_extract_dir/qr"

npm pack @remcoros/spirits@0.1.0 --ignore-scripts --pack-destination "$spirits_extract_dir/core"
npm pack @remcoros/spirits-qr@0.1.0 --ignore-scripts --pack-destination "$spirits_extract_dir/qr"

tar -xzf "$spirits_extract_dir/core/remcoros-spirits-0.1.0.tgz" -C "$spirits_extract_dir/core"
tar -xzf "$spirits_extract_dir/qr/remcoros-spirits-qr-0.1.0.tgz" -C "$spirits_extract_dir/qr"

printf 'Extracted packages: %s\n' "$spirits_extract_dir"
```

The paths below are relative to `$spirits_extract_dir`:

| File                                  | Purpose                                                              |
| ------------------------------------- | -------------------------------------------------------------------- |
| `core/package/dist/spirits-core.mjs`  | Standalone platform-neutral core, including dependencies and artwork |
| `qr/package/dist/spirits-qr.mjs`      | Standalone QR extension, including core and the QR encoder           |
| `core/package/assets/spirits-v0.json` | Portable, ordered artwork catalogue                                  |

Keep each extracted `package/` tree together when copying it into your project. Core includes `README.md`, `LICENSE` and `ASSET-LICENSE`. QR includes `README.md`, `LICENSE` and `THIRD-PARTY.md`. Retain the bundled legal comments and licence notices when redistributing these files. Original code is MIT and original artwork is CC0; dependencies retain their own licences.

For example, if you place the extracted core tree at `./vendor/spirits-core/` and the QR tree at `./vendor/spirits-qr/`, import their standalone files by local path:

```js
import { createSpirit } from './vendor/spirits-core/dist/spirits-core.mjs';
import { createSpiritQr } from './vendor/spirits-qr/dist/spirits-qr.mjs';

const spirit = createSpirit(address);
const qr = createSpiritQr(address);
```

Each module is self-contained, so importing both includes two copies of core. With normal npm imports, a bundler can share dependencies and remove unused functions.

The package export maps expose the documented APIs, not `dist/` or `assets/` subpaths. Import extracted files by local path, as above. Use `@remcoros/spirits/browser` for the PNG adapter.

For an independent implementation, use the extracted catalogue with the same version's [algorithm notes](https://github.com/remcoros/spirits/blob/v0.1.0/docs/algorithm.md) and [test vectors](https://github.com/remcoros/spirits/blob/v0.1.0/spec/test-vectors.json). Those files are in the tagged source tree.

You can also install a downloaded tarball with `npm install /path/to/package.tgz`. Install matching core and QR tarballs together when using both.

## Open the generator with an address

Append a complete address directly after `#` to prefill the public generator: `https://spirits.boo/#sp1…` or `https://spirits.boo/#tsp1…`. Replace the abbreviated address with a complete one; no parameter name is needed.

The page fills the input, removes the address fragment from the current URL and validates it locally. A valid address generates a SPirit and starts its QR check. The SPirit appears first. An invalid address shows an input error.

Address links also work in an open tab. Section links such as `#about` stay unchanged. Editing the input never writes the address into the URL.

The browser excludes fragments from requests to the host. Browser history, bookmarks or the service used to share a link can retain the original address. Clearing the current URL does not remove those copies. Query strings cannot prefill an address.

## Address and appearance contracts

The parser trims inputs, validates them, then canonicalises them. It accepts BIP352 version 0 `sp` and `tsp` public addresses. A `tsp` prefix does not distinguish signet from other test networks. The parser rejects URI wrappers and unsupported versions.

The scan public key fixes the nine core character traits, including signature accessories. Both public keys select a small label badge and trim variation. The same public keys produce the same character across supported network prefixes. Sizes and export formats do not reroll traits.

A Spirit is a recognition aid. Similar characters and collisions are possible; shared scan keys can be copied. Appearance does not prove ownership or verify a legitimate wallet label. Compare addresses in your wallet when making payments.

QRs contain the complete canonical address, use H error correction, retain structural markers and include a four-module quiet zone. Software decoding checks do not establish universal camera or print reliability. Test the final displayed or printed QR with the wallets and devices you intend to support.

See the [algorithm contract](algorithm.md), [QR behavior](qr.md), [validation limits](validation.md), and package API notes for [core](../packages/core/README.md) and [QR](../packages/qr/README.md).

## Licences

Original code is MIT. Original artwork and rendered visual output are CC0-1.0. Third-party components retain their own licences; see [the notices](../THIRD-PARTY.md).
