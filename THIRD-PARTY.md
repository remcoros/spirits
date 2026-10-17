# Third-party notices

Original source code is MIT; original artwork is CC0. Third-party components
retain their licences. Installed dependencies include complete notices.

- @scure/base, @noble/curves, @noble/hashes: MIT, Paul Miller.
- Project Nayuki QR Code generator: MIT, Project Nayuki; complete notice in
  packages/qr/src/vendor/qrcodegen.ts. See packages/qr/THIRD-PARTY.md for the pin.
- jsQR: Apache-2.0, Cosmo Wolfe; used for browser and test decoding.
- Manrope and Space Grotesk font packages: SIL Open Font License 1.1.
- BIP352 address fixtures: BSD-2-Clause; see spec/bip352-source.json.

The standalone bundles inside the npm tarballs preserve upstream legal comments.
npm installs retain notices in their dependency packages. When extracting or
vendoring standalone modules, keep those comments and the package licence files:
the core includes LICENSE and ASSET-LICENSE; QR includes LICENSE and THIRD-PARTY.md
with the pinned encoder's complete notice. Each package also includes its README.
The internal build staging directory includes this file and complete dependency
licence texts for release checks. The built static site retains its complete
notices under third-party/, linked from both page footers.
