# SPirits

Experimental deterministic ghost avatars for Bitcoin Silent Payments. TypeScript first, self-contained SVG artwork, and standard payment QRs with the corresponding Spirit in the centre.

**v0 is experimental: artwork and mappings may change before v1.** A Spirit is a recognition aid; it is not proof of wallet ownership or a unique address fingerprint.

## Run locally

Requires Node 22.12+ and npm.

```sh
npm ci
npm run build:lib
npm run dev
```

Open `http://127.0.0.1:5187/` for the public generator and `/lab/` for the development workshop. Library builds are required before the first dev run; rebuild the libraries after changing their TypeScript. Restarting Vite may be needed after a library rebuild.

```sh
npm run check          # library and application types
npm test               # address, recipe, assets, and final QR image checks
npm run build          # libraries, package verification artifacts, and both static pages
npm run preview        # built pages on http://127.0.0.1:4187/
npm run test:browser   # built site: responsive UI, exports, lab and independent browser decoder
npm run test:packages  # tarballs installed into a separate Node/TypeScript consumer
npm run audit:variety -- 10000
npm run audit:visual    # sample 1024 core characters at 32px and 64px, with fixed label accents
npm run audit:visual -- 50000 artifacts/my-review # larger pool, approximate close-pair search
npm run format:check   # check source formatting without changing files
```

The browser check uses `/usr/bin/google-chrome` by default; set `SPIRITS_BROWSER` for another Chrome/Chromium path. It starts its own preview server on a separate port and closes it on completion. Screenshots and reports go in ignored `artifacts/`.

## Packages

- `packages/core`: validate v0 addresses, derive a portable trait recipe, render SVG, and bundle all original assets. `@remcoros/spirits/browser` adds browser-only PNG conversion.
- `packages/qr`: depends on core and a pinned, vendored MIT QR encoder from Project Nayuki; outputs standard QR SVG and layout metadata.
- `apps/index.html`: public generator. All processing happens locally; fonts and scripts are self-hosted. No analytics, address lookup, user accounts or remote avatar service.
- `apps/lab/index.html`: address inspector, reproducible test-address families, 48-character grids, 32/64/110px previews, catalogue, recipe inspection, and rendered QR decoding.
- `docs`: architecture, byte-level algorithm, artwork, QR generation and validation notes. Start at [the documentation index](docs/README.md).
- `spec`: machine-readable test vectors and their provenance for independent implementations.

The development lab creates **public, disposable fixture keys**. Never receive real funds to generated addresses. The public generator accepts existing public addresses; its example uses `tsp` test-network fixtures.

## Integrate

Start with the [usage guide](docs/usage.md) for npm installation, extracting standalone modules from npm tarballs, browser PNG conversion, and integration contracts. The first beta, [`0.1.0-beta.1`](https://github.com/remcoros/spirits/releases/tag/v0.1.0-beta.1), is published on npm's `next` channel. The live generator is at [spirits.boo](https://spirits.boo/).

```sh
npm install @remcoros/spirits@next @remcoros/spirits-qr@next
```

```ts
import { createSpirit, deriveSpirit, renderSpirit, parseAddress } from '@remcoros/spirits';
import { createSpiritQr } from '@remcoros/spirits-qr';

const { svg, recipe } = createSpirit(address, { size: 512 });
const sameImage = renderSpirit(recipe, { size: 512 });
const qr = createSpiritQr(address); // SVG, complete address, version and layout
const plainQr = createSpiritQr(address, { spirit: false });
```

The core has no DOM, canvas, network or filesystem dependency and works in Node and modern browsers. The npm tarballs include standalone `spirits-core.mjs` and `spirits-qr.mjs` files with dependencies and artwork bundled; the [usage guide](docs/usage.md#extract-standalone-modules-and-artwork-from-npm) shows how to extract them and retain their notices. ESM package imports allow applications to share dependencies and tree-shake unused functions.

```ts
// Optional browser-only raster conversion:
import { svgToPng } from '@remcoros/spirits/browser';
const pngBlob = await svgToPng(svg);
```

Inputs are trimmed and validated before lowercasing. Mainnet `sp` and test-network `tsp` v0 addresses are supported, with checksum, payload-length and curve-point checks. URI wrappers, unsupported address versions and invalid inputs are rejected. A `tsp` prefix does not distinguish signet from other test networks.

The scan key selects all nine core character traits. The advertised spend key participates in selecting the small badge and trim variation. Network prefixes do not change artwork for the same keys. See [the algorithm contract](docs/algorithm.md), [the catalogue](packages/core/assets/spirits-v0.json) and [test vectors](spec/test-vectors.json).

The catalogue has 384 entries including palettes and label accents. It includes 32 primary body contours, eight tail constructions, 32 head motifs, 32 permanent-item motifs and 16 broad marking designs, alongside expression and pose variants. Its core trait space has about 70 trillion raw combinations. That does not mean 70 trillion human-distinguishable characters; exact or perceptual collisions remain possible. Several variants are transformations of a shared motif. The lab supports keeping characters for comparison with fixed label accents and grayscale previews. `npm run audit:visual` also produces fixed-label comparison sheets with grayscale and simulated colour-vision differences, plus close grayscale, colour and outline candidates. Its larger-pool search is approximate. Those are review tools, not measured human recognition rates. See [the artwork review goal](docs/artwork.md#composition-checks) before freezing a visual scheme.

## QR behaviour and validation limits

QRs contain the entire address, not a redirect. The extension selects error correction H, four-module margins, integer pixel scaling and a circular white badge clear of structural markers. A thin dark outline and tighter framing make the full ghost and its permanent accessories easier to see without changing the overall QR dimensions. Default decorated codes use version 14; plain ones use version 10. Small codes target character recognition; inspect the label's badge and glyph at a larger size. Bigger symbols still need sufficient screen or print size.

Tests rasterise and decode final decorated SVGs across characters, labels, networks and sizes. The public page performs an additional browser-side jsQR check. The browser suite also uses Chrome's independent native barcode decoder when available. These checks do not establish universal wallet-camera or printed-code reliability. Physical camera/print validation remains a separate acceptance step.

## Build and distribution

`npm run build` stages package verification artifacts under `dist/release/` and both static pages under `dist/site/`. `npm run build:assets` builds the libraries and stages the same verification files. The manifest records package names, versions, source fingerprints and output hashes for package-consumer and release checks. The release workflow retains this directory as an internal Actions artifact so npm publication uses the exact tested tarballs.

Public package downloads come from npm. GitHub Releases provide change notes, npm links and versioned documentation, with no custom file attachments. GitHub's automatic source-code ZIP and tarball links remain available for each tag. The website links to GitHub and the usage guide, and visitors can still download their generated SVG and PNG images. Local build commands do not deploy or publish anything.

The GitHub workflows validate changes, deploy Pages from `main`, and publish npm packages followed by GitHub release notes from semantic-version `v` tags. Read [release setup](docs/releasing.md) for npm authentication, initial package creation and tagging; read [hosting setup](docs/hosting.md) for GitHub Pages and the `spirits.boo` custom domain.

The asset authoring tool is `scripts/artwork.mjs`; generated assets are committed inputs, not regenerated during ordinary builds. To intentionally change experimental artwork, run the authoring tool, rebuild libraries, then `npx tsx scripts/vectors.ts`, review the visual differences and run checks. Do not regenerate vectors merely to make an unexpected test failure pass.

## Licences

Original code: MIT, see `LICENSE`. Original artwork: CC0-1.0, see `ASSET-LICENSE` (including generated visual output). Upstream libraries retain their own licences. The QR encoder source, pinned provenance and full notice are in `packages/qr/THIRD-PARTY.md` and its source header. Standalone modules preserve bundled legal comments; retain the licence files and notices when extracting or redistributing them. Font files use SIL OFL-1.1; the built site includes complete third-party notices. Extracted public BIP352 fixture addresses originate from the BSD-2-Clause BIP test vectors, recorded in `spec/bip352-source.json`.
