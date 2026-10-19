# SPirits — agent guide

## Project and scope

SPirits is a TypeScript library and static-site POC for deterministic ghost avatars derived from Bitcoin Silent Payment addresses. A separate QR extension renders the corresponding Spirit in the centre of a standard payment QR.

This directory is a standalone application/library project. Although its parent is `startos-projects`, it is **not a StartOS service package**. Use this repository's npm workflow; no Start SDK, S9PK build, server install or unrelated workspace synchronization is required.

The working name and character direction are settled: **SPirits**, expressive ghosts with distinctive silhouettes, faces, palettes, markings, head features and permanent signature accessories. Labels change a small badge/trim variation. Reopen those decisions only if the user asks or concrete evidence exposes a problem.

## Start a new session

1. Read this guide and [README.md](README.md) for the public product introduction and setup.
2. Check `git status --short --branch`; preserve existing work.
3. Find the newest `artifacts/*-session-handoff.md` when continuing previous work. Artifacts are intentionally ignored, so use `rg --files --hidden --no-ignore artifacts -g '*-session-handoff.md'` or an explicit file listing. Treat a handoff as historical evidence; verify live processes and current code before relying on it.
4. Read [docs/README.md](docs/README.md), then only the implementation notes relevant to the task.

`docs/` is the canonical home for architecture, algorithm and implementation notes. `spec/` contains machine-readable vectors and provenance. Session logs and temporary findings belong in `artifacts/`.

## Repository map

| Location                               | Responsibility                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/core/src/address.ts`         | Bech32m/BIP352 public-address validation and public-key encoding              |
| `packages/core/src/index.ts`           | Versioned trait derivation, SVG rendering and catalogue inspection            |
| `packages/core/src/browser.ts`         | Optional browser-only SVG-to-PNG adapter                                      |
| `packages/core/assets/spirits-v0.json` | Portable ordered artwork catalogue                                            |
| `packages/core/src/artwork.ts`         | Generated TypeScript copy of the catalogue                                    |
| `scripts/artwork.mjs`                  | Original vector-art authoring source                                          |
| `scripts/readme-banner.ts`             | README banner from the existing logo and real library-rendered SPirits        |
| `packages/qr/src/index.ts`             | QR layout, structural clearance and Spirit composition                        |
| `packages/qr/src/vendor/`              | Pinned upstream MIT QR encoder; provenance in package THIRD-PARTY.md          |
| `apps/index.html`, `apps/site.ts`      | Public marketing/generator page                                               |
| `apps/lab/`                            | Address inspector, public fixtures, label families, grids and asset catalogue |
| `apps/shared/`                         | UI helpers and disposable public test-fixture generation                      |
| `docs/`                                | Canonical implementation notes                                                |
| `spec/`                                | Portable recipes/SVG hashes and official address fixtures                     |
| `tests/`, `scripts/*check*`            | Library/image, browser and external-consumer validation                       |

## Contracts to preserve

- The core is platform-neutral: no DOM, canvas, filesystem, network or application imports. Browser rasterisation stays in the browser entry point. QR depends on core; core never depends on QR or either application.
- Validate the complete address before rendering: checksum, case, supported network/version, padding, payload length and both curve points. The POC supports BIP352 v0 `sp` and `tsp`; `tsp` does not identify a specific test chain. Canonicalisation follows validation.
- The scan public key fixes all nine core character traits, including permanent accessories. Both public keys determine only the label accent. Network prefixes alone do not change a character. Sizes and export formats do not reroll it.
- Derivation domains, byte encoding, ordering and asset IDs matter. Follow [the algorithm contract](docs/algorithm.md). Use independent SHA256 domains per trait, not a reduced 32-bit seed/PRNG.
- Visual scheme `spirits-v0` is experimental and separate from npm versions. Mapping/art changes require an intentional review and corresponding vectors. Never silently claim v0 appearance is permanent.
- A Spirit is a recognition aid, not proof of ownership or a globally unique fingerprint. Shared scan keys can be copied. Do not claim that a family resemblance verifies a legitimate wallet label.
- Real BIP352 label creation needs private scan material. Public-address rendering does not. The lab's deterministic fixture keys are publicly reproducible and must never be presented as receiving-wallet keys. Do not move fixture generation into the public core API.
- The public page accepts public addresses and processes them locally. Preserve local fonts/assets and the absence of analytics, remote avatar/lookup services, private-key import and address transmission or URL persistence.
- Keep one implementation of derivation/rendering in the libraries. Both pages consume those APIs. Changing input must immediately invalidate old exports; pending asynchronous decodes cannot restore stale results.
- QR payloads are complete canonical addresses. Preserve structural markers, H error correction, four-module quiet zones, integer scaling and tested central-plate geometry. Decode the **final composed image**, not merely the unmodified matrix.
- Code is MIT; original artwork is CC0. Preserve dependency notices, vendored provenance and licence headers in distributable bundles.

## Artwork changes

Read [artwork.md](docs/artwork.md). Edit the authoring source, not generated catalogue copies. The catalogue is deeply frozen at runtime to protect deterministic selection from mutation.

```sh
node scripts/artwork.mjs
npm run build:lib
# Review the rendered differences before intentionally updating vectors:
npx tsx scripts/vectors.ts
```

The 70-trillion raw recipe count includes geometric/motif variants and is not a proof of human-distinguishable identities. Review the lab at small sizes and in QR output. Fix label accents while assessing core-character duplicates; otherwise differing badges can hide repeated core art.

## Development and checks

Requires Node 24 and npm. Install exact dependencies with `npm ci`; keep `package-lock.json` in sync. Use installed source/types and upstream primary documentation when dependency APIs matter.

Use [validation.md](docs/validation.md) to choose checks and interpret their evidence; [package.json](package.json) defines the commands. Run `npm run build` before package-consumer or built-site browser checks.

Rebuild libraries after editing their source; the dev app consumes built workspace exports. Restart the owned Vite server if the dependency optimizer is stale. Development uses strict port 5187, built preview 4187, browser checks 5287. Inspect ownership before stopping processes. `SPIRITS_BROWSER` overrides the browser test's default `/usr/bin/google-chrome`.

Build outputs stay in ignored `dist/release/` and `dist/site/`. Before changing distribution, read [architecture.md](docs/architecture.md#distribution) and [releasing.md](docs/releasing.md). Public packages download from npm; GitHub Releases contain notes and links without custom attachments. Keep the website's GitHub/usage links and generated SVG/PNG exports; do not restore the former PoC source ZIP or package-download tree.

Run checks appropriate to the change; see [validation.md](docs/validation.md). A software decode, visual screenshot, package-consumer test and real wallet-camera/print scan are different evidence. Chrome's native barcode detector may be unavailable; report the skip accurately. Screen scans require separate validation; print reliability is unvalidated in 0.1.

## Documentation and Git

README is the human-facing GitHub introduction: lead with what SPirits does, link prominently to `https://spirits.boo/`, then provide concise usage, integration and local setup. Use the existing brand and real library-rendered artwork. Keep copy concrete and link to `docs/` for detailed contracts, validation and release procedures. This guide owns agent workflow and navigation.

Public copy should help the reader understand or complete their current task. Keep fixture provenance, implementation details and validation reports in technical docs. Include a caveat only where it changes a reader's decision or next action, and use their language. Prefer omitting unnecessary copy to rewriting it as another warning.

Update the relevant `docs/` contract when behaviour changes and keep README examples accurate. For README artwork changes, rebuild libraries and run `npx tsx scripts/readme-banner.ts`; the banner uses public disposable fixtures and lives in `docs/assets/`, separate from the deployed site's `public/` assets. Review its rendered output at GitHub reading widths.

Put temporary screenshots/reports and timestamped `artifacts/{datetime}-session-handoff.md` files in the ignored artifact directory. A handoff should record actual validation, pending work, live process ownership and Git state.

Keep `artifacts/`, `node_modules/`, package build outputs and `dist/` out of Git. Preserve unrelated user changes. A request to initialize a repository is not a request to commit, push, publish npm packages, deploy the site or create releases. Follow the user's authorization for those steps; do not invent remotes or claim publication or deployment beyond observed evidence.
