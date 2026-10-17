# @spirits/qr

Experimental standard QR SVGs with the address's SPirit in the centre. Depends on `@spirits/core` at the same POC package version.

```ts
import { createSpiritQr } from '@spirits/qr';
const { svg, address, version, width, logoBounds } = createSpiritQr(spAddress);
const plain = createSpiritQr(spAddress, { spirit: false, scale: 8 });
```

The payload is the complete canonical v0 Silent Payment address, with no URL or redirect. The library derives the Spirit from that same validated input. Error correction H, four-module margins and integer module scaling are fixed. `scale` accepts integers 2–32. Decorated codes choose a version whose circular white badge avoids complete structural module footprints. The badge has a thin dark outline separated from the QR by a white gap. Tighter framing enlarges the full character and its permanent accessories without cropping them. Typical v0 output is version 14, 73 modules plus margins, 648px at scale 8; the larger artwork does not change those overall dimensions.

`logoShape` is `"circle"` for decorated output and `null` otherwise. `logoModules` is the cleared circle's diameter (currently 20.5 modules); `logoBounds` is its bounding square in QR-module coordinates before the quiet zone. These values can be fractional. `canPlaceLogoCircle(version, diameter)` checks the complete circular footprint; the existing `canPlaceLogo(version, side)` continues to check a square. Plain output skips unused Spirit derivation and rendering.

At a displayed QR width of roughly 250–310px, use the ghost for character recognition. Inspect a larger standalone Spirit to compare its fine label badge and glyph; resemblance does not prove ownership or label legitimacy.

The output is a standard QR with artwork obscuring data modules. Automated decoder tests and actual intended camera/print testing are required; a successful software decode is not a guarantee for all readers or print sizes. The library has no DOM dependency. Use `@spirits/core/browser` for optional browser PNG conversion.

Code: MIT. Original SPirit art: CC0. The pinned upstream Project Nayuki MIT encoder and adaptation are documented in `THIRD-PARTY.md`. This POC package has not been published to npm.
