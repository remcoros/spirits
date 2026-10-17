# Implementation notes

These documents describe the current SPirits implementation and the decisions behind it. Update the relevant note when changing its contract; keep session history and temporary findings in ignored `artifacts/` handoffs instead.

- [Usage](usage.md): npm packages, downloadable release assets, integration and browser exports.
- [Releasing](releasing.md): initial npm setup, trusted publishing and tagged releases.
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

The [root README](../README.md) is the quick start. [AGENTS.md](../AGENTS.md) is the operational entry point for coding agents.
