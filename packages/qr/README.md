# @remcoros/spirits-qr

This package renders standard QR SVGs with the address's SPirit in the centre. It supports Node 24 and modern browsers and depends on the same version of `@remcoros/spirits`. The v0 artwork is experimental.

```ts
import { createSpiritQr } from '@remcoros/spirits-qr';
const { svg, address, version, width, logoBounds } = createSpiritQr(spAddress);
const plain = createSpiritQr(spAddress, { spirit: false, scale: 8 });
```

The QR contains the complete canonical v0 Silent Payment address, with no URL or redirect. The library derives the Spirit from that same validated address. Error correction H, four-module margins and integer module scaling are fixed. `scale` accepts integers from 2 to 32.

Decorated codes use a version whose structural markers fit outside the circular white badge. A white gap separates the badge's thin dark outline from the QR data. The frame shows the full character and its accessories without cropping. Typical v0 output is version 14, with 73 modules plus margins and a width of 648px at scale 8.

`logoShape` is `"circle"` for decorated output and `null` otherwise. `logoModules` is the cleared circle's diameter, currently 20.5 modules. `logoBounds` is its bounding square in QR-module coordinates before the quiet zone. These values can be fractional.

`canPlaceLogoCircle(version, diameter)` checks the full circle. `canPlaceLogo(version, side)` checks a square. Plain output skips Spirit derivation and rendering.

At a displayed QR width of 250 to 310px, use the ghost to recognise the character. View a larger standalone Spirit to compare its label badge and glyph. Resemblance does not prove ownership or label legitimacy.

The artwork covers some QR data modules. Check the displayed QR with your intended wallet; software decoding does not guarantee every reader can scan it. Print reliability is unvalidated in 0.1.

The library has no DOM dependency. Use `@remcoros/spirits/browser` for browser PNG conversion.

The code is MIT; original SPirit art is CC0. `THIRD-PARTY.md` records the pinned Project Nayuki MIT encoder and local changes.
