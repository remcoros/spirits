# QR generation and central Spirit layout

## Payload and exports

`createSpiritQr(address, options)` validates through core and encodes the full canonical lowercase SP address as standard QR byte-mode text. It does not use redirects, a custom QR format, a short name or an address directory. A QR reader can extract the text; paying still requires a wallet with Silent Payments support.

The function returns SVG plus address, QR version, module count, pixel width, error-correction level, quiet-zone width, alignment positions and artwork bounds. `logoShape` is `"circle"` for decorated output and `null` for plain output. `logoModules` is the cleared circle's diameter; `logoBounds` is its bounding square in symbol-module coordinates, excluding the quiet zone. These measurements may be fractional. `spirit:false` validates and encodes the address without deriving or rendering unused artwork. `scale` is an integer 2–32 pixels per module (default 8). Integer scaling avoids introducing blurred module edges in the exported raster. Browser PNG conversion is available from the core browser adapter.

## Structural geometry

Always use error correction H and four clear modules around every side. Search increasing versions for a centred circular white plate around 28% of the symbol width, rounded to half-modules, at least 13 modules and capped at the tested 20.5-module diameter. The complete circle must clear all reserved module footprints: finders and their light separators, timing, format and version information, the fixed dark module, and alignment patterns. Checking distances to marker centres alone would leave their outer modules vulnerable.

For a lowercase v0 mainnet address (116 bytes), the smallest data-fitting H symbol is version 10. Its central alignment marker occupies the requested artwork area. Versions 11–13 also have a central marker. Version 14 has 73×73 modules and alignment centres `[6,26,46,66]`. The nearest alignment footprint ends at module coordinate 29 on both axes; its nearest point is `sqrt(7.5² + 7.5²) ≈ 10.607` modules from the centre `(36.5,36.5)`. A circle of radius 10.25 therefore leaves about 0.357 modules clear. Its bounding square would overlap those markers, so square clearance is deliberately not used for circular output. This is the current decorated default for both supported prefixes. The plain QR uses version 10. The exported `canPlaceLogoCircle` helper checks circle clearance; `canPlaceLogo` retains its original square-plate meaning. Both helpers support all 40 versions, including the version-32 alignment-spacing exception.

Clear the entire circular plate to white before inserting the Spirit. Its thin, fixed dark outline has radius 9.65 modules and stroke width 0.25, leaving a 0.475-module white gap between its outside edge and surrounding QR data. The border never uses the label accent. The full Spirit, including head features, hem, permanent signature accessory and shadow, sits in an 18-module viewport with the tighter `24 12 208 232` viewBox and default centred aspect-ratio preservation. Only unused outer canvas is removed; there is no circular clip hiding protruding artwork. Catalogue containment tests cover every body/hem pairing and every other feature against the border's inner edge. Keep those tests green when changing art.

The overall QR remains 81×81 modules including the quiet zone, or 648px at default scale 8. At a displayed width around 250–310px, the larger character supports recognising the ghost/key; inspect the Spirit separately at a larger size to compare fine label badges and glyphs. This is a recognition aid, not proof of ownership or label legitimacy.

## Error correction and evidence

The avatar deliberately obscures encoded data modules. Structural clearance is necessary but does not analytically guarantee successful decoding. Error correction is budgeted per codeword/block, not as an equivalent percentage of image area. Do not increase artwork size merely because H is often described as “30% recovery.”

The image tests rasterise the final composed SVG and decode it with jsQR across characters, labels, both prefixes and integer scales 2/3/5/8. They also resample final output to 250px and 310px and apply mild blur before decoding. The structural tests compare both geometry helpers with the protected cells recorded from the pinned encoder for every QR version. The browser application separately rasterises and decodes its final export before enabling downloads. The browser suite checks downloaded PNGs and uses Chrome's native barcode detector when the environment exposes it; an unavailable native decoder must be reported as skipped.

Neither these checks nor a successful developer-machine scan proves universal wallet-camera compatibility. Before public release, scan actual screen and printed exports using the intended wallets, at realistic sizes, angles and lighting. Record those results separately from software-decoder proof.

## Encoder provenance

The QR encoder is a pinned MIT Project Nayuki source snapshot, retained at `packages/qr/src/vendor/qrcodegen.ts`. `packages/qr/THIRD-PARTY.md` records the upstream commit and original source digest. Local changes only export the merged TypeScript namespaces and mark the licence header for preservation in bundles. Update that provenance when replacing upstream code.
