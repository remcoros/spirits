# SPirit generation: v0 reference contract

The v0 scheme is experimental and may change. Package versions and visual-scheme versions are independent. A stable v1 requires frozen byte rules, catalogue ordering and SVG composition, with new test vectors.

## Input and validation

Accept a trimmed Bech32m BIP352 version-0 address with HRP `sp` (mainnet) or `tsp` (test networks). Reject mixed case before canonicalisation, invalid checksum/padding, more than 1023 characters, unsupported versions, payloads other than 66 bytes, uncompressed point prefixes, and invalid secp256k1 points. Canonical text is lowercase. A `tsp` address does not identify a specific test network.

The payload contains the compressed scan public key `S` followed by the compressed advertised spend public key `P`, each 33 bytes. Labelled addresses contain the tweaked spend public key. Rendering an existing address needs no private key. Creating BIP352 label families requires wallet key material and is outside the public core API.

## Byte-exact derivation

All domain strings below use UTF-8, including capitalisation, punctuation, and the final slash. `||` means raw byte concatenation. SHA256 means standard SHA-256. `u16(b)` is `b[0]*256+b[1]` (big-endian).

- Identity: lowercase hex of `SHA256("SPirits/v0/identity/" || S)`.
- Variation ID: lowercase hex of `SHA256("SPirits/v0/variation/" || S || P)`.
- For each character group `g`, select catalogue array index `u16(SHA256("SPirits/v0/character/" + g + "/" || S)) % count(g)`.
- Character groups in output order: `body`, `hem`, `eyes`, `mouth`, `brows`, `palette`, `marking`, `head`, `item`.
- Badge: index from `u16(SHA256("SPirits/v0/variation/badge/" || S || P)) % 16`.
- Accent: index from `u16(SHA256("SPirits/v0/variation/accent/" || S || P)) % 16`.
- Pattern: `u16(SHA256("SPirits/v0/variation/pattern/" || S || P)) % 16`.
- Glyph: `u16(SHA256("SPirits/v0/variation/glyph/" || S || P))`.

All catalogue counts are powers of two, so these selections are unbiased. Each trait has its own SHA256 domain; there is no shared 32-bit PRNG. Network prefixes do not change artwork for otherwise identical keys. The QR still encodes the complete address for the selected network.

The nine character groups have 32 × 16 × 64 × 32 × 16 × 32 × 64 × 32 × 64 = 70,368,744,177,664 raw combinations, or 46 bits. This counts trait combinations, not characters people can tell apart. Some variants transform the same original motif. Labels intentionally share core characters. Unrelated keys can also produce identical or similar-looking characters.

## Portable assets and rendering

`packages/core/assets/spirits-v0.json` is the complete ordered catalogue. The original vector artwork is CC0. Palette roles are `ink`, `paper`, `body`, `shade`, and `accent`; substitute `{{role}}` tokens before rendering. No font, external image, filter, SVG ID or network lookup is required.

Reference viewBox: `0 0 256 256`. Draw shadow, assembled body/hem path, marking, brows, eyes, mouth, head feature, signature item, label trim, and label badge in that order. The body and hem paths use a normalised body coordinate system, composed with `translate(53 61) scale(1.5 1.23)`. All remaining character assets are in the reference coordinate system. The small label badge is transformed with `translate(77 179) scale(.82)`. Label trim is a short left-side seam: its starting height is `154 + (pattern % 4) * 2`, and its dash style is selected by `floor(pattern / 4)` from solid, `7 4`, `1 4`, and `5 3 1 3`. All sixteen pattern values therefore produce distinct treatments. See `renderSpirit` for the exact seam path and 4×4 glyph construction. The glyph is a visual accent, not a cryptographic verification mechanism.

Output size and the optional paper background do not change the recipe. The reference implementation produces deterministic SVG strings and recipes. PNG pixels and bytes can vary between rasterisers. The public character-group tuple and artwork catalogue are frozen at runtime to prevent JavaScript consumers from changing later derivation.

`spec/test-vectors.json` records 12 known recipes and default-SVG SHA256 digests. Tests independently check every character, identity and label-variation SHA256 domain and big-endian selection with Node's crypto implementation.

## QR extension

The QR extension derives the Spirit from the same validated address it encodes. Its layout and validation contract is documented separately in [QR generation](qr.md).

## Interpretation

A matching character can indicate a shared scan key, but anyone can copy a public key. It does not prove wallet control or label legitimacy. Verify the full payment destination in the wallet. SPirits does not scan the chain, derive payment outputs, sign transactions, operate a directory or assign unique, reversible names.
