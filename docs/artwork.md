# Artwork and visual identity

## Character grammar

Spirits are expressive, recognisable ghosts with stable silhouettes, faces, colours, head features and signature accessories. Body and face geometry carry the identity at small sizes. Label variants preserve those features and alter a small badge, accent colour and trim treatment.

The current experimental v0 catalogue uses sixteen primary body contours with two proportions each: rounded, angular, pear-shaped, cloudlike, leaning, scalloped and other large shapes. Sixteen eye motifs have four expression/spacing treatments each, including closed, winking, inky, angular and glasses eyes. Mouth size, head-feature proportions and accessory poses add visible differences without moving the common face region. These choices strengthen recognition in grayscale as well as colour; they do not guarantee that unrelated scan keys will look different.

The core catalogue has the following raw choices:

| Group          | Choices | Ownership        |
| -------------- | ------: | ---------------- |
| Body           |      32 | Scan key         |
| Hem/tail       |      16 | Scan key         |
| Eyes           |      64 | Scan key         |
| Mouth          |      32 | Scan key         |
| Brows          |      16 | Scan key         |
| Palette        |      32 | Scan key         |
| Body marking   |      64 | Scan key         |
| Head feature   |      32 | Scan key         |
| Signature item |      64 | Scan key         |
| Badge          |      16 | Both public keys |
| Accent palette |      16 | Both public keys |

There are 384 catalogue entries, including palettes. Core choices multiply to 70,368,744,177,664 raw recipes (46 bits). Some entries transform or reposition a shared motif; this is not a claim that every entry is a separately drawn motif or every combination is distinguishable by a person. A finite image system has collisions, and labels intentionally share characters.

## Source and generated data

`scripts/artwork.mjs` is the original vector-authoring source. It writes:

- `packages/core/assets/spirits-v0.json`: portable ordered catalogue.
- `packages/core/src/artwork.ts`: identical data as a TypeScript constant.

Do not edit those two generated files independently. The runtime catalogue is deeply frozen to protect the selection order from accidental consumer mutation. Asset IDs and array order are part of the visual-version contract.

Use palette placeholders (`{{ink}}`, `{{body}}`, `{{shade}}`, `{{accent}}`, `{{paper}}`) in fragments. Body and hem paths compose in a normalised coordinate system; the remaining fragments use the 256-unit reference viewBox. Keep fragments self-contained: no fonts, image URLs, external references, SVG IDs, scripts or filters.

Keep a clear face region and separate the lower-body features. Markings occupy the central belly, permanent items sit to its right, and the small label badge sits to its left. Label trim is a short side seam between face and badge, rather than another band across the belly or an unattached line below a shallow hem. Its sixteen values combine four heights with four distinct dash treatments. The badge and 4×4 glyph are secondary details; recognition of an individual label is not promised inside a small payment QR.

## Composition checks

Evaluate full-size, 64px, 32px and embedded-QR output. Large shape differences should contribute most to recognition. Ensure head features remain inside the viewBox, signature items do not hide distinguishing body details, and label trims leave facial features untouched. Assess colour-blind/monochrome visibility in visual review; pixel uniqueness does not prove perceptual separation.

The lab shows each source element and a grid of complete characters. Family rows demonstrate eight real BIP352 labels sharing the same core. The variety audit measures trait coverage and duplicate recipes. The visual audit fixes all label accents, then compares exact 32px and 64px rasters to avoid counting badge differences as different core characters.

Experimental v0 artwork intentionally changes as these checks expose weaknesses. The current stronger contour/face treatments and smaller label details retain all asset IDs, catalogue ordering, trait counts and SHA256 domains. Recipe assignments therefore remain identical while SVG artwork changes. Regenerate reference SVG hashes only after visual review; do not interpret unchanged recipe IDs as a promise of frozen v0 appearance.

## Intentional v0 updates

1. Change the authoring source or rendering code.
2. Run `node scripts/artwork.mjs` when changing asset data.
3. Run `npm run build:lib`.
4. Review the lab, especially combinations and family resemblance.
5. Intentionally regenerate vectors with `npx tsx scripts/vectors.ts` only after reviewing the changes.
6. Run relevant type, image, QR and browser checks; update implementation notes where the contract changed.

Do not regenerate expected vectors merely to hide an unexplained failure. v1 should freeze the catalogue, selection algorithm and visual treatment; later incompatible changes need an explicit visual-scheme version.
