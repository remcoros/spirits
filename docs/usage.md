# Use SPirits in your app

SPirits renders deterministic ghost avatars from Bitcoin Silent Payment public addresses. The core includes all artwork and produces self-contained SVG. The separate QR extension embeds the matching character in a standard payment QR.

**The first beta is [`0.1.0-beta.1`](https://github.com/remcoros/spirits/releases/tag/v0.1.0-beta.1).** Artwork and mappings in the experimental `spirits-v0` visual scheme may change. The live website follows `main` and can contain changes that are not yet in an npm release. For reproducible integration, install a specific npm package version and use the matching GitHub tag for reference documentation and test vectors.

## Find packages and release notes

- [Core package: `@remcoros/spirits`](https://www.npmjs.com/package/@remcoros/spirits).
- [QR extension: `@remcoros/spirits-qr`](https://www.npmjs.com/package/@remcoros/spirits-qr).
- [GitHub Releases](https://github.com/remcoros/spirits/releases): change notes, npm installation links and versioned documentation. GitHub also provides its automatic source-code ZIP and tarball for each tag.
- [Source code](https://github.com/remcoros/spirits): implementation, documentation and development tools.

Public packages download from npm. Their tarballs contain the standalone modules, and the core tarball includes the portable artwork catalogue. GitHub Releases have no custom file attachments. Generated avatar and QR image downloads remain available in the website.

This guide corrects the distribution instructions in the immutable initial beta tag. Use this [current guide](https://github.com/remcoros/spirits/blob/main/docs/usage.md) for package access, and the [tagged reference](https://github.com/remcoros/spirits/tree/v0.1.0-beta.1) for that version's implementation, algorithm and test vectors.

## Install from npm

Beta releases use the `next` channel:

```sh
npm install @remcoros/spirits@next @remcoros/spirits-qr@next
```

To pin the first beta exactly:

```sh
npm install @remcoros/spirits@0.1.0-beta.1 @remcoros/spirits-qr@0.1.0-beta.1
```

The QR package depends on the same exact core version. Keep both versions together when upgrading. Install only the core if you do not need payment QRs.

The initial beta also owns `latest`, so an install without a version or channel currently selects that beta. Use an exact version when you need reproducible output.

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

## Extract standalone modules and artwork from npm

Use `npm pack` when you want a standalone ES module or the portable catalogue without installing the packages into an application. These commands download the exact first-beta tarballs and extract each complete package into a separate, newly created temporary directory:

```sh
spirits_extract_dir="$(mktemp -d)"
mkdir "$spirits_extract_dir/core" "$spirits_extract_dir/qr"

npm pack @remcoros/spirits@0.1.0-beta.1 --ignore-scripts --pack-destination "$spirits_extract_dir/core"
npm pack @remcoros/spirits-qr@0.1.0-beta.1 --ignore-scripts --pack-destination "$spirits_extract_dir/qr"

tar -xzf "$spirits_extract_dir/core/remcoros-spirits-0.1.0-beta.1.tgz" -C "$spirits_extract_dir/core"
tar -xzf "$spirits_extract_dir/qr/remcoros-spirits-qr-0.1.0-beta.1.tgz" -C "$spirits_extract_dir/qr"

printf 'Extracted packages: %s\n' "$spirits_extract_dir"
```

The paths below are relative to `$spirits_extract_dir`:

| File                                  | Purpose                                                              |
| ------------------------------------- | -------------------------------------------------------------------- |
| `core/package/dist/spirits-core.mjs`  | Standalone platform-neutral core, including dependencies and artwork |
| `qr/package/dist/spirits-qr.mjs`      | Standalone QR extension, including core and the QR encoder           |
| `core/package/assets/spirits-v0.json` | Portable, ordered artwork catalogue                                  |

Keep each extracted `package/` tree together when vendoring it. The core includes `README.md`, `LICENSE` and `ASSET-LICENSE`; QR includes `README.md`, `LICENSE` and `THIRD-PARTY.md`. Preserve the modules' bundled legal comments and the required licence notices when redistributing them. Original code is MIT and original artwork is CC0; dependencies retain their own licences.

For example, if you place the extracted core tree at `./vendor/spirits-core/` and the QR tree at `./vendor/spirits-qr/`, import their standalone files by local path:

```js
import { createSpirit } from './vendor/spirits-core/dist/spirits-core.mjs';
import { createSpiritQr } from './vendor/spirits-qr/dist/spirits-qr.mjs';

const spirit = createSpirit(address);
const qr = createSpiritQr(address);
```

Each module is self-contained; importing both includes two copies of the core code. Normal npm package imports allow a bundler to share dependencies and remove unused functions. The package export maps expose the documented package APIs, not `dist/` or `assets/` subpaths: the extracted files above are local files, not package subpath imports. Use `@remcoros/spirits/browser` for the optional PNG adapter.

For independent implementations, match the extracted catalogue to the same version's [algorithm notes](https://github.com/remcoros/spirits/blob/v0.1.0-beta.1/docs/algorithm.md) and [test vectors](https://github.com/remcoros/spirits/blob/v0.1.0-beta.1/spec/test-vectors.json). Those reference files remain in the tagged source tree. The downloaded `.tgz` files can also be installed directly with `npm install /path/to/package.tgz`; install matching core and QR tarballs together when using both.

## Address and appearance contracts

Inputs are trimmed, fully validated, and then canonicalised. Supported inputs are BIP352 version 0 `sp` and `tsp` public addresses. A `tsp` prefix does not distinguish signet from other test networks. URI wrappers and unsupported versions are rejected.

The scan public key fixes the nine core character traits, including signature accessories. Both public keys select a small label badge and trim variation. The same public keys produce the same character across supported network prefixes. Sizes and export formats do not reroll traits.

A Spirit is a recognition aid. Similar characters and collisions are possible; shared scan keys can be copied. Appearance does not prove ownership or verify a legitimate wallet label. Compare addresses in your wallet when making payments.

QRs contain the complete canonical address, use H error correction, retain structural markers and include a four-module quiet zone. Software decoding checks do not establish universal camera or print reliability. Test the final displayed or printed QR with the wallets and devices you intend to support.

See the [algorithm contract](algorithm.md), [QR behavior](qr.md), [validation limits](validation.md), and package API notes for [core](../packages/core/README.md) and [QR](../packages/qr/README.md).

## Licences

Original code is MIT. Original artwork and rendered visual output are CC0-1.0. Third-party components retain their own licences; see [the notices](../THIRD-PARTY.md).
