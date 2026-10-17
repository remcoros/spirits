# Architecture and implementation decisions

## Ownership

This is an application/library repository under a directory that also contains StartOS projects. It is not a StartOS package and has no Start SDK dependency.

One npm-workspace repository contains two independently distributable TypeScript packages and two static HTML applications:

```text
@remcoros/spirits ──► @remcoros/spirits-qr
       │                │
       └────────┬───────┘
                │
       public page + development lab
```

The arrow from core to QR indicates a dependency flowing into QR: QR imports core. Core must not import QR, either application, browser UI helpers, or development fixture generation.

## Core package

`packages/core/src/address.ts` validates and encodes public BIP352 key pairs. `index.ts` owns trait selection and SVG composition. `artwork.ts` is generated, frozen-at-runtime catalogue data; the separately shipped JSON supports native ports.

The core requires no DOM, canvas, filesystem or network. SHA256 comes from `@noble/hashes`, Bech32m from `@scure/base`, and public point validation from `@noble/curves`. Exact versions are pinned. Each trait has an independent hash domain; no shared small PRNG state limits the selection space.

The optional `@remcoros/spirits/browser` entry point converts generated SVG to a PNG Blob using browser canvas. Raster conversion is kept out of the platform-neutral core. PNG bytes are not promised identical between different rasterisers.

## QR extension

`@remcoros/spirits-qr` imports core and a vendored, pinned MIT Project Nayuki encoder. Its high-level API accepts a public address, derives the corresponding Spirit and builds the QR from that same input. It does not accept unrelated user-supplied artwork in place of the derived Spirit.

Both decorated and plain QR output use standard complete-address text. The layout and evidence requirements are in [QR generation](qr.md).

## Applications

The public page (`apps/index.html`, `apps/site.ts`) accepts existing public addresses. A test-network example is available explicitly. The flow validates an address, creates the Spirit and QR, rasterises and decodes the final QR locally, then enables downloads. Changing the input immediately clears artwork, accessible labels and export readiness. Generation and per-export operation counters prevent older QR checks or PNG callbacks from downloading, changing status, or clearing a newer operation’s busy state. The known public example address carries a disposable-key warning even when pasted manually; other test-network addresses are not described as example keys. Public parser failures are translated into actionable recovery copy without changing the core error API. A named result link reveals output on demand, respecting reduced motion and leaving focus under user control. SVG titles describe the character’s visible traits; PNG and SVG guidance sits beside the exports.

The lab (`apps/lab/`) creates disposable public test fixtures, inspects existing public addresses, displays label families and unrelated characters, previews every catalogue entry, and exposes recipes and QR metadata. Its fixture module is development tooling, not wallet key-management functionality. A BIP352 label index cannot be recovered from a public address; real label creation requires the private scan key. Fixture generation and public inspection occupy separate labelled groups. Editing any fixture control or the inspected address clears dependent previews and exports; invalid labels cannot retain ready output. Decode callbacks own their serial and busy state. The character grid supports two pinned fixtures that survive batch changes, fixed label accents, grayscale viewing, and 110/64/32px comparisons. These are visual review tools, not proof of human-distinguishable or unique identities. Pins exist only in tab memory and contain public reproducible fixtures.

The browser pages share library APIs and small UI/export helpers. There is no second rendering algorithm in either page. Fonts and scripts are served locally. No user address is placed in a URL, persisted in local storage, or sent to an avatar/lookup service. No directory, short-name resolution, wallet scanning, payment-output derivation or transaction signing is included. Responsive checks cover normal 320/375/414/768px layouts and a 200% root-font simulation using actual functional element bounds, rather than concealing overflow. This simulation does not substitute for native browser zoom or physical-device acceptance.

## Distribution

Both HTML heads link the stylesheet directly, including the local font declarations. The browser discovers styling before application JavaScript executes; styles no longer depend on the development server's JavaScript injection. Font loading may still briefly use a styled fallback font because local fonts use `font-display: swap`.

TypeScript builds generate ESM and declaration files. esbuild also produces independent standalone ESM files with dependencies and artwork bundled. Applications using the npm packages can share dependencies; importing both standalone modules includes duplicate bundled core code by design.

The root is private. The two public packages share one version; the QR package depends on that exact core version. The first release is prepared as `0.1.0-beta.1`, using npm's `next` channel. These declarations do not imply that publication has happened.

`npm run build` stages tarballs, standalone modules, the portable catalogue, reference data and licence notices under `dist/release/`, then builds both static pages into `dist/site/`. Package-consumer checks compare current package/build fingerprints and output SHA256 metadata to reject stale or missing artifacts. The website does not contain those package snapshots or a source ZIP. Its developer links lead to GitHub and the [usage guide](usage.md), which explains the npm packages and tagged release assets. SVG and PNG downloads generated from a visitor's address remain available locally.

Pages deploys from `main`, so the live experimental generator can be ahead of the released libraries. Tagged releases build and validate a specific commit and distribute its assets through npm and GitHub Releases. Local build commands do not publish or deploy. See [releasing](releasing.md) and [hosting](hosting.md) for workflow and account configuration.

## Compatibility decisions

- TypeScript reference implementation first; the written algorithm, portable data and test vectors support later native-language ports.
- Experimental visual scheme `spirits-v0`; visual versions are distinct from npm package versions. v0 may evolve, with intentional fixture updates. Freeze the mapping and artwork before declaring v1 stable.
- Shared scan key fixes the same ghost, including its signature head feature and item. The advertised spend key participates only in the small label variation.
- Identical public keys render the same artwork across mainnet/test prefixes. The full address and network remain distinct in QR payloads and UI.
- Original code is MIT; original artwork is CC0. Preserve upstream notices and use local assets.
