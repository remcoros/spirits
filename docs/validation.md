# Validation workflow and evidence

Choose checks for the changed behaviour. Test the final output or public contract. Automated image decoding and wallet-camera testing prove different things; report them separately.

| Command                          | Evidence                                                                                                                                                                                           |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                  | Library builds and strict application/test TypeScript checks                                                                                                                                       |
| `npm test`                       | Canonical addresses, invalid inputs, official BIP352 address fixtures, real label-family invariants, independent SHA256 selection, catalogue validity, SVG snapshots and final-image QR decoding   |
| `npm run build`                  | Package verification artifacts and both static pages build                                                                                                                                         |
| `npm run test:packages`          | Local tarballs install into a separate temporary Node/TypeScript project with a fresh npm cache; registry dependencies resolve independently and packaged/standalone SVGs match a committed vector |
| `npm run test:browser`           | Built pages at 320/375/414/768/1280px, browser exports, invalid input, stale-export invalidation, catalogue/family behaviour and local network use                                                 |
| `npm run audit:variety -- 10000` | Sampling coverage and duplicate trait recipes; no proof of global uniqueness                                                                                                                       |
| `npm run audit:visual`           | Exact raster duplicates in 1,024 core characters at 32px and 64px, fixed-label colour/grayscale/colour-vision comparison sheets and exploratory grayscale/colour/outline candidates                |
| `npm run format:check`           | Source formatting without rewriting files                                                                                                                                                          |

Run `npm run build` before package/browser checks. The browser script creates and owns a temporary Vite preview server on port 5287 and closes it afterwards. Chrome defaults to `/usr/bin/google-chrome`; override with `SPIRITS_BROWSER`. If that port belongs to an existing process, resolve ownership or use a separate explicit port rather than killing an unknown process.

Reports and screenshots are in ignored `artifacts/`. Check their timestamps and session handoffs before relying on them, or rerun the relevant command. Report whether Chrome's optional native barcode decoder was available. jsQR is independent of the Nayuki encoder even without native decoding.

The public page generates automatically. Avatar exports do not wait for the background QR check; QR display and exports do.

Changing an address must immediately invalidate old output. A pending decode or PNG conversion must not display or download the previous address as the new result. Only the current operation may update results, status or busy state. Invalid fixture controls must clear previous lab output before generation starts.

QR image checks include public fixtures covering every body, head feature, body marking and permanent item in final compositions at integer scales 2 and 3. Separate containment checks cover every body/hem pairing and each remaining feature against the circular frame. This checks the actual larger artwork without clipping it to make a test pass.

The browser suite tests responsive widths and enlarged text. Measure visible child controls as well as root `scrollWidth`; clipping can hide overflowing children. Report the 200% root-font simulation separately from native browser zoom and physical-device testing.

Check filenames, preview accessibility, example labels, invalid test-address generation and overlapping asynchronous operations through their visible behaviour.

Package-consumer checks compare the staged artifacts with the current manifest and source/build fingerprints. An old tarball must fail after a source or version change. The release workflow retains the tested files and `SHA256SUMS` in an internal Actions artifact for npm byte verification and manual bootstrap downloads.

Public packages download from npm. GitHub release notes link to npm and versioned docs without custom attachments. GitHub's tagged source-code archives are separate from package staging. Browser checks cover the website's GitHub/usage links and required notices. Separate checks cover generated avatar and QR exports.

The package-consumer check installs local tarballs in an independent project with an empty npm cache. It needs registry access for third-party dependencies. A root `npm ci` can cache tarballs without the metadata needed by a separate install. Keep this check independent of the developer's cache and allow registry access.

The visual audit writes `artifacts/visual-vision-sheet.png`, `artifacts/visual-nearest-pairs.png` and a JSON report. All samples use the same label accents. Grayscale uses linear luminance. Protanopia, deuteranopia and tritanopia previews use the full-severity matrices from [Machado, Oliveira and Fernandes (2009)](https://www.inf.ufrgs.br/~oliveira/pubs_files/CVD_Simulation/CVD_Simulation.html), applied in linear sRGB.

These simulations do not reproduce every person's vision. The colour-vision sheets support review; they do not run additional exhaustive nearest-pair searches.

Candidate selection compares the union of foreground pixels in a fixed 32px subject crop. Grayscale compares luminance, colour compares RGB, and outline compares foreground coverage including accessories. Matching unused paper does not improve a score. These distances have no human-recognition calibration or pass threshold.

For a larger sample, run `npm run audit:visual -- 50000 artifacts/my-review`. The first optional argument sets the sample count, from 2 to 50,000. The second sets an output directory to preserve earlier artifacts.

At up to 2,048 samples, the audit compares every pair's pixels. Larger samples use six deterministic projection tables over coarse grayscale, colour-opponent and foreground-coverage blocks. Sorted neighbour windows and bounded candidate lists select pairs for fine comparison. This approximate search can miss close pairs.

The report records the method, proposed-pair count, total possible pairs, separate mode rankings and exact raster duplicates. A large sample does not prove visual uniqueness.

Review close pairs at actual 32px and 64px without relying on label accents, then inspect the composed QRs. Use the [two-memorable-differences heuristic](artwork.md#composition-checks). Participant tests should include delayed recognition among similar distractors. Image scores, exact pixel differences and expert inspection do not measure a human confusion rate.

Version 0.1 retains experimental artwork and unmeasured recognition goals. Review the final candidate visually and check screen use separately from software decoding; print reliability is unvalidated. A future v1 visual freeze needs its own acceptance review. Local checks do not imply publication, deployment or physical-device results.
