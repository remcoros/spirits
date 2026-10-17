# Artwork and visual identity

## Character grammar

Spirits are expressive, recognisable ghosts with stable silhouettes, faces, colours, head features and signature accessories. Body and face geometry carry the identity at small sizes. Label variants preserve those features and alter a small badge, accent colour and trim treatment.

The current experimental v0 catalogue uses 32 primary body contours and eight tail constructions with two depth treatments. Rounded, angular, pear-shaped, cloudlike, leaning, notched and stepped shapes protect a shared face region. All 32 head slots contain different motifs: hats, ears, plants, headphones, celestial shapes and other head features. The 64 permanent-item slots contain 32 motifs with two poses each. Their larger silhouettes include carried books, umbrellas, balloons, cameras, shields and lanterns.

Sixteen eye motifs retain four expression/spacing treatments each, including closed, winking, inky, angular and glasses eyes. Eight broader mouth motifs retain four treatments; larger grins, frowns, gasps and open mouths help distinguish characters sharing the same eyes. Sixteen broader belly-marking designs have four placement treatments each. Palette shade roles use stronger lightness differences so patches, stripes, rings and other markings contribute in grayscale. These choices aim to strengthen small-size recognition; they do not guarantee that unrelated scan keys look different.

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

Keep a clear face region and separate the lower-body features. Broad markings occupy the central belly, larger permanent items sit to its right, and the small label badge sits to its left. Preserve the common circular QR frame when adding protruding objects; never conceal an oversize asset with clipping. Label trim is a short side seam between face and badge, rather than another band across the belly or an unattached line below a shallow hem. Its sixteen values combine four heights with four distinct dash treatments. The badge and 4×4 glyph are secondary details; recognition of an individual label is not promised inside a small payment QR.

## Composition checks

Evaluate full-size, 64px, 32px and embedded-QR output. Large shape differences should contribute most to recognition. Ensure head features remain inside the viewBox, signature items do not hide distinguishing body details, and label trims leave facial features untouched. Assess colour-blind/monochrome visibility in visual review; pixel uniqueness does not prove perceptual separation.

The art-review goal for unrelated close-looking Spirits is **two clear, memorable differences at 32px, including at least one that remains clear without colour**. Sharing body, colour and head feature is acceptable when face, broad markings or a readable permanent item carry those differences. A pupil shift, brow thickness change or tiny rotated symbol is a weak identity cue. This is a review heuristic for sampled characters, not a guarantee for every possible pair or a measured recognition threshold. Label families intentionally preserve the same character and are outside this unrelated-character rule.

The lab shows each source element and a grid of complete characters. Family rows demonstrate eight real BIP352 labels sharing the same core. The variety audit measures trait coverage and duplicate recipes. The visual audit fixes all label accents, compares exact 32px and 64px rasters, and selects close grayscale, colour and outline pairs for review. Its optional 50,000-character mode uses approximate candidate selection; it does not inspect every pair. See [validation](validation.md) for commands and evidence limits. Participant review remains necessary before treating the art-review goal as validated human recognition.

Experimental v0 artwork intentionally changes as these checks expose weaknesses. The current contour, head, marking, shade and item pass retains all asset IDs, catalogue ordering, trait counts and SHA256 domains. Recipe assignments therefore remain identical while asset names and SVG artwork change. The raw recipe budget is unchanged. Regenerate reference SVG hashes only after visual review; do not interpret unchanged recipe IDs as a promise of frozen v0 appearance.

## Intentional v0 updates

1. Change the authoring source or rendering code.
2. Run `node scripts/artwork.mjs` when changing asset data.
3. Run `npm run build:lib`.
4. Review the lab, especially combinations and family resemblance.
5. Intentionally regenerate vectors with `npx tsx scripts/vectors.ts` only after reviewing the changes.
6. Run relevant type, image, QR and browser checks; update implementation notes where the contract changed.

Do not regenerate expected vectors merely to hide an unexplained failure. v1 should freeze the catalogue, selection algorithm and visual treatment; later incompatible changes need an explicit visual-scheme version.
