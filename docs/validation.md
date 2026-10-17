# Validation workflow and evidence

Run checks appropriate to the changed behaviour. Tests must assess the final output or public contract, rather than copy implementation details. Do not turn an automated image decode into a claim about physical wallet-camera testing.

| Command                          | Evidence                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`                  | Library builds and strict application/test TypeScript checks                                                                                                                                     |
| `npm test`                       | Canonical addresses, invalid inputs, official BIP352 address fixtures, real label-family invariants, independent SHA256 selection, catalogue validity, SVG snapshots and final-image QR decoding |
| `npm run build`                  | Distributable packages, source/download artifacts and both static pages build                                                                                                                    |
| `npm run test:packages`          | Tarballs install offline into a separate temporary Node/TypeScript project; packaged and standalone SVGs match a committed vector                                                                |
| `npm run test:browser`           | Built pages at 320/375/414/768/1280px, browser exports, invalid input, stale-export invalidation, catalogue/family behaviour and local network use                                               |
| `npm run audit:variety -- 10000` | Sampling coverage and duplicate trait recipes; no proof of global uniqueness                                                                                                                     |
| `npm run audit:visual`           | Exact raster duplicates in 1,024 core characters at 32px and 64px, fixed-label colour/grayscale/colour-vision comparison sheets and exploratory close pixel-match candidates                     |
| `npm run format:check`           | Source formatting without rewriting files                                                                                                                                                        |

Run `npm run build` before package/browser checks. The browser script creates and owns a temporary Vite preview server on port 5287 and closes it afterwards. Chrome defaults to `/usr/bin/google-chrome`; override with `SPIRITS_BROWSER`. If that port belongs to an existing process, resolve ownership or use a separate explicit port rather than killing an unknown process.

Reports and screenshots are in ignored `artifacts/`. Their presence is not proof that they describe the current code: inspect timestamps and session handoffs, or rerun the relevant command. The native Chrome barcode decoder is optional and availability is explicitly reported. jsQR remains independent of the Nayuki encoder even when native decoding is unavailable.

The application itself also decodes finished QR exports. Keep operation ownership and immediate output invalidation: changing an address while a decode or PNG conversion is pending must not expose or download the previous input as the new result. Apply ownership to final cleanup and status writes as well as successful results. Invalid fixture controls must invalidate previous lab output before attempting generation.

The browser suite exercises ordinary responsive widths and enlarged text. Check the bounds of visible child controls in addition to root `scrollWidth`: horizontal clipping can conceal overflowing children. A 200% root-font simulation is useful resize-text evidence, but must be reported separately from native browser zoom and physical-device testing. Test output naming, preview accessibility, known example provenance, invalid fixture generation and overlapping asynchronous operations as public behaviours.

Distribution checks cover the emitted download tree rather than just repository links. Archive tests must exclude private/ignored markers and symlink targets while retaining the reviewed source list. Package consumers use the current manifest and source fingerprint so an old tarball cannot satisfy a check after a source or version change.

The visual audit emits `artifacts/visual-vision-sheet.png` and `artifacts/visual-nearest-pairs.png`. Every sample has the same label accents. Grayscale uses linear luminance; protanopia, deuteranopia and tritanopia previews use the full-severity matrices from [Machado, Oliveira and Fernandes (2009)](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html), applied in linear sRGB. These simulations and background-sensitive pixel distances help select pairs for review; they do not prove human recognition, reproduce every person's vision, or provide a pass threshold for identity. Inspect at actual 32px/64px sizes and in the final composed QR.

Before a stable public release, review broader human recognition/perceptual similarity, colour-blind/monochrome appearance, real wallet cameras and print sizes. Freeze the v1 art/mapping contract only after that review. No publication, deployment or physical-device result is implied by a local build.
