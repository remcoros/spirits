# Architecture and implementation decisions

## Ownership

This is an application/library repository under a directory that also contains StartOS projects. It is not a StartOS package and has no Start SDK dependency.

The npm workspace contains two TypeScript packages and two static HTML applications. Each package can be distributed separately.

```text
@remcoros/spirits ──► @remcoros/spirits-qr
       │                │
       └────────┬───────┘
                │
       public page + development lab
```

QR imports core. Core must not import QR, either application, browser UI helpers or development fixtures.

## Core package

`packages/core/src/address.ts` validates and encodes public BIP352 key pairs. `index.ts` selects traits and renders SVG. `artwork.ts` contains generated catalogue data, frozen at runtime. The package also ships a JSON catalogue for native ports.

The core requires no DOM, canvas, filesystem or network. It uses `@noble/hashes` for SHA256, `@scure/base` for Bech32m and `@noble/curves` to validate public points. Dependency versions are pinned. Each trait has its own hash domain, so a shared small PRNG state does not limit the number of recipes.

The optional `@remcoros/spirits/browser` entry point converts generated SVG to a PNG Blob using browser canvas. The core does not include raster conversion. Different rasterisers can produce different PNG bytes.

## QR extension

`@remcoros/spirits-qr` imports core and a vendored, pinned MIT Project Nayuki encoder. It accepts a public address, derives its Spirit and builds the QR from the same input. Callers cannot replace the derived Spirit with unrelated artwork.

Both decorated and plain QR output use standard complete-address text. The layout and evidence requirements are in [QR generation](qr.md).

## Applications

### Public generator

The public page uses `apps/index.html` and `apps/site.ts`. A valid address generates a Spirit and enables avatar downloads immediately. QR display and downloads wait for a local decode of the composed image. If that check fails, the avatar remains available and the user can retry the QR.

The page cycles through ten test-network examples. Known examples stay labelled and direct users to a wallet address for payments. Errors appear after invalid pastes or completed input, not during incomplete typing.

Changing the input immediately invalidates old output. Operation counters prevent stale QR checks or PNG callbacks from restoring it. The page preserves the user's preview mode, input text and focus. A result link scrolls an offscreen preview into view. SVG titles describe the character's visible traits.

### Development lab

The lab at `apps/lab/` generates public test addresses, inspects wallet addresses and displays label families, character grids, catalogue entries, recipes and QR metadata. Its fixture module is development tooling, not wallet key management. Creating real BIP352 labels requires the private scan key. A public address does not reveal its label index.

Test-address generation and address inspection have separate controls. Editing either clears its previews and exports. Invalid labels cannot leave ready output behind. Each decode callback owns its operation counter and busy state.

The character grid supports two pins, fixed label accents, grayscale and comparisons at 110, 64 and 32px. Pins survive batch changes but stay in tab memory and contain only reproducible test fixtures. These tools support visual review; they do not prove that people can distinguish every character.

### Shared browser behaviour

Both pages use the libraries and shared UI/export helpers. Neither page has a second rendering algorithm. Fonts and scripts are local. Addresses are not saved in local storage or sent to an avatar or lookup service. The pages provide no directory, short-name lookup, wallet scanning, payment-output derivation or transaction signing.

The public page accepts raw `#sp1…` or `#tsp1…` fragments on load and fragment changes. It clears an address fragment with `history.replaceState` before validation, then uses the normal generation flow. Section fragments stay untouched. Typing or pasting never writes the address into the URL.

Responsive checks cover 320, 375, 414 and 768px layouts and a 200% root-font simulation. They measure control bounds to catch clipped overflow. This simulation is separate from native browser zoom and physical-device testing.

## Distribution

Both HTML heads link the stylesheet, including local font declarations, so styling loads before application JavaScript runs. Styles do not depend on JavaScript injection by the dev server. Local fonts use `font-display: swap`, so a styled fallback can appear briefly while they load.

TypeScript builds generate ESM and declaration files. esbuild also produces independent standalone ESM files with dependencies and artwork bundled. Applications using the npm packages can share dependencies; importing both standalone modules includes duplicate bundled core code by design.

The root package is private. Both public packages share a version, and QR depends on that exact core version. Stable releases use npm's `latest` channel; prereleases use `next`. Node 24 is the supported runtime. The website follows `main` and can differ from the published packages.

`npm run build` stages tarballs, standalone modules, the portable catalogue, reference data and licence notices in `dist/release/`. It then builds both pages into `dist/site/`. Package-consumer checks compare source/build fingerprints and output SHA256 hashes to reject stale or missing artifacts. The release workflow keeps the tested staging directory as an internal Actions artifact. The npm job publishes or verifies those exact package bytes.

Public packages download from npm. Each tarball includes its standalone module; core also includes the portable catalogue. The [usage guide](usage.md) explains how to extract the package trees and retain their licences and notices. The modules and catalogue are local files after extraction, not exported npm subpaths.

The website links to GitHub and the usage guide. Visitors can download their generated SVGs and PNGs locally. Pages deploys from `main`, so the live generator can be ahead of released libraries.

Tagged releases build and validate a specific commit, publish its npm packages, then publish GitHub notes with npm links and versioned docs. GitHub Releases have no custom attachments. GitHub supplies the tagged source-code archives. The notes job requires verified npm packages but does not need the internal build artifact. Local builds do not publish or deploy. See [releasing](releasing.md) and [hosting](hosting.md) for setup.

## Compatibility decisions

- TypeScript reference implementation first; the written algorithm, portable data and test vectors support later native-language ports.
- Experimental visual scheme `spirits-v0`; visual versions are distinct from npm package versions. v0 may evolve, with intentional fixture updates. Freeze the mapping and artwork before declaring v1 stable.
- Shared scan key fixes the same ghost, including its signature head feature and item. The advertised spend key participates only in the small label variation.
- Identical public keys render the same artwork across mainnet/test prefixes. The full address and network remain distinct in QR payloads and UI.
- Original code is MIT; original artwork is CC0. Preserve upstream notices and use local assets.
