# Artwork and visual identity

## Character grammar

Spirits are expressive, recognisable ghosts with stable silhouettes, faces, colours, head features and signature accessories. Body and face geometry carry the identity at small sizes. Label variants preserve those features and alter a small badge, accent colour and trim treatment.

The current experimental v0 catalogue uses 32 primary body contours and eight tail constructions with two depth treatments. Rounded, angular, pear-shaped, cloudlike, leaning, notched and stepped shapes protect a shared face region. All 32 head slots contain different motifs: hats, ears, plants, headphones, celestial shapes and other head features. The 64 permanent-item slots contain 32 motifs with two poses each. Their larger silhouettes include carried books, umbrellas, balloons, cameras, shields and lanterns.

Sixteen eye motifs have four expression/spacing variants each, including closed, winking, inky, angular and glasses eyes. Eight mouth motifs have four variants each. Larger grins, frowns, gasps and open mouths help distinguish characters with the same eyes. Sixteen belly-marking designs each have four placements. Palette lightness differences keep patches, stripes, rings and other markings visible in grayscale. These choices aim to improve recognition at small sizes. Unrelated scan keys can still produce similar-looking characters.

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

Keep the face clear and lower-body features separate. Broad markings occupy the central belly, larger permanent items sit to its right, and the label badge sits to its left. Fit protruding objects inside the circular QR frame. Do not hide oversize art with clipping.

Label trim is a short side seam between the face and badge. Keep it off the belly and attached to the body. Its sixteen values combine four heights and four dash patterns. The badge and 4×4 glyph are small details; they may be hard to distinguish inside a small payment QR.

## Composition checks

Review full-size, 64px, 32px and embedded-QR output. Large shape differences should be the main recognition cues. Keep head features inside the viewBox, signature items clear of distinguishing body details, and label trims away from the face. Check colour-vision simulations and monochrome previews. Different pixels do not prove that people can tell characters apart.

When reviewing unrelated Spirits that look alike, look for two clear, memorable differences at 32px. At least one must remain clear without colour. Characters can share a body, colour and head feature if their faces, broad markings or recognisable accessories provide those differences. A pupil shift, brow thickness change or tiny rotated symbol is a weak cue.

This is a heuristic for sampled characters, not a measured recognition threshold or a guarantee for every pair. Label families intentionally share a character, so this rule does not apply to them.

The lab shows each source element and a grid of complete characters. Family rows demonstrate eight real BIP352 labels sharing the same core. The variety audit measures trait coverage and duplicate recipes. The visual audit fixes all label accents, compares exact 32px and 64px rasters, and selects close grayscale, colour and outline pairs for review. Its optional 50,000-character mode uses approximate candidate selection; it does not inspect every pair. See [validation](validation.md) for commands and evidence limits. Participant review remains necessary before treating the art-review goal as validated human recognition.

The v0 artwork can change when review exposes problems. The current contour, head, marking, shade and item changes preserve asset IDs, catalogue ordering, trait counts and SHA256 domains. Addresses therefore keep the same recipes and recipe count even when asset names and SVGs change. Review the images before regenerating reference SVG hashes. An unchanged recipe ID does not mean v0 artwork is frozen.

## Intentional v0 updates

1. Change the authoring source or rendering code.
2. Run `node scripts/artwork.mjs` when changing asset data.
3. Run `npm run build:lib`.
4. Review the lab, especially combinations and family resemblance.
5. Intentionally regenerate vectors with `npx tsx scripts/vectors.ts` only after reviewing the changes.
6. Run relevant type, image, QR and browser checks; update implementation notes where the contract changed.

Do not regenerate expected vectors merely to hide an unexplained failure. v1 should freeze the catalogue, selection algorithm and visual treatment; later incompatible changes need an explicit visual-scheme version.
