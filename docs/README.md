# Implementation notes

These notes describe how SPirits works and why. Update the relevant note when a contract changes. Keep session history and temporary findings in ignored `artifacts/` handoffs.

- [Usage](usage.md): npm packages, extracting standalone modules and artwork, integration and browser exports.
- [Releasing](releasing.md): initial npm setup, trusted publishing and tagged releases.
- [0.1.0 release notes](releases/0.1.0.md).
- [Hosting](hosting.md): GitHub Pages deployment and the custom domain.
- [Architecture](architecture.md): package boundaries, browser adapters, application flows and distribution.
- [SPirit generation algorithm](algorithm.md): accepted addresses, canonicalisation, domain strings, byte ordering and trait selection.
- [Artwork system](artwork.md): original assets, composition rules, label variations, variety budget and intentional updates.
- [QR generation](qr.md): standard payload, central artwork geometry, structural protection, export sizing and limitations.
- [Validation](validation.md): checks, evidence classes and the remaining real-device acceptance work.

Machine-readable reference data stays under `spec/`:

- [SPirits recipes and SVG hashes](../spec/test-vectors.json).
- [Official BIP352 address fixtures](../spec/bip352-addresses.json) and [provenance](../spec/bip352-source.json).
- [Portable artwork catalogue](../packages/core/assets/spirits-v0.json).

The [root README](../README.md) introduces SPirits and shows how to use it. Coding agents start with [AGENTS.md](../AGENTS.md).
