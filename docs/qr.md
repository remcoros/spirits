# QR generation and central Spirit layout

## Payload and exports

`createSpiritQr(address, options)` validates through core and encodes the full canonical lowercase SP address as standard QR byte-mode text. It does not use redirects, a custom QR format, a short name or an address directory. A QR reader can extract the text; paying still requires a wallet with Silent Payments support.

The function returns SVG, the address, QR version, module count, pixel width, error-correction level, quiet-zone width, alignment positions and artwork bounds.

`logoShape` is `"circle"` for decorated output and `null` for plain output. `logoModules` is the cleared circle's diameter. `logoBounds` is its bounding square in symbol-module coordinates, excluding the quiet zone. These measurements can be fractional. `spirit:false` validates and encodes the address without deriving or rendering artwork.

`scale` sets the pixels per module. It accepts integers from 2 to 32 and defaults to 8. Integer scaling keeps raster module edges sharp. Use the core browser adapter for PNG conversion.

## Structural geometry

Always use error correction H and four clear modules around every side. Search increasing versions for a centred circular white plate around 28% of the symbol width, rounded to half-modules, at least 13 modules and capped at the tested 20.5-module diameter. The complete circle must clear all reserved module footprints: finders and their light separators, timing, format and version information, the fixed dark module, and alignment patterns. Checking distances to marker centres alone would leave their outer modules vulnerable.

For a lowercase v0 mainnet address of 116 bytes, the smallest H symbol that fits the data is version 10. Its central alignment marker overlaps the artwork area. Versions 11 to 13 also have a central marker. Decorated output therefore defaults to version 14 for both supported prefixes; plain output uses version 10.

Version 14 has 73×73 modules and alignment centres `[6,26,46,66]`. The nearest alignment footprint ends at module coordinate 29 on both axes. Its nearest point is `sqrt(7.5² + 7.5²) ≈ 10.607` modules from the centre `(36.5,36.5)`. A circle of radius 10.25 leaves about 0.357 modules clear. Its bounding square would overlap those markers, so circular output uses a circle-clearance check.

`canPlaceLogoCircle` checks a circle; `canPlaceLogo` checks a square. Both support all 40 versions, including the version-32 alignment-spacing exception.

Clear the circular plate to white before inserting the Spirit. Its dark outline has radius 9.65 modules and stroke width 0.25. A 0.475-module white gap separates its outside edge from the QR data. The border never uses the label accent.

The full Spirit, including head features, hem, signature accessory and shadow, sits in an 18-module viewport. It uses viewBox `24 12 208 232` and default centred aspect-ratio preservation. This removes unused outer canvas without clipping protruding artwork. Containment tests check every body/hem pairing and each other feature against the border's inner edge. These tests must pass after artwork changes.

The QR is 81×81 modules including the quiet zone, or 648px at default scale 8. At a displayed width of 250 to 310px, use the ghost to recognise the character. View the Spirit separately at a larger size to compare label badges and glyphs. Appearance does not prove ownership or label legitimacy.

## Error correction and evidence

The avatar covers some encoded data modules. Keeping structural markers clear does not guarantee decoding. Error correction works on codewords and blocks, not image area. H's "30% recovery" figure is not an allowance for artwork size.

Image tests rasterise the composed SVG and decode it with jsQR across characters, labels, both prefixes and integer scales 2/3/5/8. They also decode output resampled to 250px and 310px with mild blur. Structural tests compare both geometry helpers with the pinned encoder's protected cells for every QR version.

The browser app rasterises and decodes the final QR before enabling its downloads. The browser suite checks downloaded PNGs and uses Chrome's native barcode detector when available. Report an unavailable native decoder as skipped.

Software decoding does not establish universal wallet-camera compatibility. Check screen use with the intended reader and displayed size. Print reliability is unvalidated in 0.1.

## Encoder provenance

The QR encoder is a pinned MIT Project Nayuki source snapshot, retained at `packages/qr/src/vendor/qrcodegen.ts`. `packages/qr/THIRD-PARTY.md` records the upstream commit and original source digest. Local changes only export the merged TypeScript namespaces and mark the licence header for preservation in bundles. Update that provenance when replacing upstream code.
