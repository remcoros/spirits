# Tagged npm releases and GitHub notes

The public generator follows `main`. npm packages come only from a reviewed `v` tag. Both packages share a version, and `@remcoros/spirits-qr` depends on that exact version of `@remcoros/spirits`. GitHub Releases contain notes, npm links and versioned docs, with no custom attachments. GitHub supplies the tagged source-code ZIP and tarball.

The first beta, [`0.1.0-beta.1`](https://github.com/remcoros/spirits/releases/tag/v0.1.0-beta.1), is on npm and has a GitHub release. A maintainer approved its npm stages manually. OIDC publishing still needs validation with a new release.

The immutable beta tag retains the original distribution instructions. Its release notes link to the [current usage guide](https://github.com/remcoros/spirits/blob/main/docs/usage.md) for npm downloads and the [tagged source](https://github.com/remcoros/spirits/tree/v0.1.0-beta.1) for the released implementation and reference data.

Version `0.1.0` is a normal package release; its `spirits-v0` artwork and mappings remain experimental.

## Checks and artifacts

`.github/workflows/release.yml` accepts a `vMAJOR.MINOR.PATCH` tag with optional SemVer prerelease identifiers. It rejects leading zeroes, build metadata, a dirty tree, a checkout different from the tag, a tag outside fetched `origin/main`, mismatched package/lockfile versions, and incorrect package repository/publication metadata.

The workflow uses GitHub-hosted Ubuntu, Node 24 and pinned npm 11.21.0. It installs exact dependencies with `npm ci`, runs formatting, TypeScript, unit/image tests, a full build, isolated tarball consumers, and browser checks against the built site. Playwright supplies Chromium through `SPIRITS_BROWSER`; the test does not assume a particular system Chrome path.

The workflow exports the tagged commit timestamp as `SOURCE_DATE_EPOCH`. `npm run build:assets` writes the npm tarballs, standalone modules, artwork, vectors, contract notes, licences and integrity manifest to `dist/release/`. `node scripts/release.mjs prepare TAG` checks their source fingerprint and creates `SHA256SUMS`.

The workflow retains the tested directory as an internal Actions artifact and passes it to the npm job without rebuilding or repacking. These files support consumer checks, bootstrap downloads and registry byte verification. They are not public GitHub Release attachments.

To prepare artifacts without publishing, run **Tagged release** manually with the existing tag and operation **prepare**. Only verification runs. Download its `release-TAG` Actions artifact.

Leave `NPM_PUBLISH_ENABLED` unset during bootstrap. Setting it to the exact string `true` enables publication on a `v*` tag push or manual **publish** operation. Ordinary `main` pushes do not publish npm packages. **finalize-bootstrap** checks already-published npm bytes without writing to npm, then publishes matching GitHub release notes.

## npm account and trusted publisher setup

Use the npm account that owns the `@remcoros` scope and enable 2FA. The ordinary release job uses OIDC and no npm token. Configure a GitHub trusted publisher separately for each package:

| Setting           | Value                                       |
| ----------------- | ------------------------------------------- |
| GitHub owner      | `remcoros`                                  |
| Repository        | `spirits`                                   |
| Workflow filename | `release.yml`                               |
| Environment       | `npm`                                       |
| Direct publishing | Enable **Allow npm publish**                |
| Distribution tags | Independently enable **Allow npm dist-tag** |

The workflow's `npm` environment name must match the trusted publisher exactly. Permit both `v*` tags and `main`. A manual dispatch can run automation from `main` while checking out the supplied release tag. Configure maintainer approvals on that environment. Stage-only permissions do not allow direct publication or channel changes.

npm 11.21.0 is pinned because OIDC dist-tag operations require that version or later. A new trusted publisher must complete its first publish within two days. Configure it just before the next release. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

Set each package's publishing access to require 2FA and disallow traditional tokens once trusted publishing works. `npm whoami` does not validate OIDC publication permissions. A fresh package has no npm package settings yet; use the first real release bootstrap below rather than publishing an empty placeholder or granting a long-lived CI token.

## First real release through staged publishing

Staging can create a package that does not exist. It reserves the real version without exposing it publicly, and a maintainer approves it later with 2FA. For a new package, npm automatically creates a public `0.0.0-stage` placeholder; the staged release's actual contents remain private until approval. Stage approval is interactive; an OIDC workflow cannot approve stages. See [npm staged publishing](https://docs.npmjs.com/staged-publishing/).

1. Leave `NPM_PUBLISH_ENABLED` unset or `false`. Commit the release metadata and workflow, push `main`, create the `v0.1.0-beta.1` tag at the reviewed commit, and push it. Verification prepares tested artifacts; npm and GitHub publication jobs stay disabled. Manual **prepare** also produces tested artifacts without publishing.
2. Download the verified Actions artifact into a clean directory. Check `sha256sum -c SHA256SUMS`. Keep the same tarballs for staging, registry verification and any retry.
3. Sign in interactively with npm 11.21.0 or later and stage those exact files under the first release's intended `next` channel:

   ```sh
   npm login --registry=https://registry.npmjs.org/
   npm stage publish ./remcoros-spirits-0.1.0-beta.1.tgz --access=public --tag=next --ignore-scripts
   npm stage publish ./remcoros-spirits-qr-0.1.0-beta.1.tgz --access=public --tag=next --ignore-scripts
   ```

4. Inspect each stage and approve core first, then QR, using the stage IDs npm returned. These are interactive commands; replace the capitalized identifiers with the actual IDs:

   ```sh
   npm stage view CORE_STAGE_ID --json
   npm stage approve CORE_STAGE_ID
   npm stage view QR_STAGE_ID --json
   npm stage approve QR_STAGE_ID
   ```

5. Run **Tagged release** again with the same tag and operation **finalize-bootstrap**. It verifies that both registry tarballs exactly match the tested bytes, that both `next` tags point to this version, and that an isolated registry consumer passes. Only after this npm job succeeds does the GitHub job publish the matching release notes. This operation needs no npm token, trusted publisher, or npm writes. Human approval of the two packages is sequential, so both channel tags must be verified before announcing the release.

Check `latest` after staging a new package. It can still point at the automatic placeholder after approval under `next`. For the initial SPirits beta, both `latest` tags were moved to `0.1.0-beta.1` so default installs receive the beta. Do not delete that tag or unpublish the placeholder as cleanup. Later prereleases update `next`; stable releases update `latest`.

When the next release is ready, configure both trusted publishers and set `NPM_PUBLISH_ENABLED=true`. Push its tag within the two-day first-publish window to publish automatically.

Rerunning the published bootstrap version skips npm publication. It neither tests OIDC publishing nor satisfies the first-publish requirement. Recreate an expired configuration when the next release is ready; do not publish a placeholder or extra version to test authentication.

If a version remains staged, finish approval or reject that stage before attempting a direct publish of the same version. Staged and published versions share the same version reservation. Rejecting, unpublishing, moving tags or changing package ownership is a separate recovery decision; the release helper does none of those operations.

## Routine publication and retry behavior

The helper preflights both registry versions before writing anything, then publishes the exact tested core tarball followed by QR. Each first appears under a version-specific temporary `release-...` dist-tag. It verifies registry SHA512 integrity and downloaded tarball bytes, then installs both exact versions with a fresh npm cache in a temporary consumer. The consumer checks package versions, installed integrity, a stored Spirit SVG vector and QR metadata.

After both packages and the consumer pass, the helper updates `next` for prereleases or `latest` for stable releases. It refuses to move a channel backward if either package points at a newer version. npm cannot update two package dist-tags atomically. A failure between updates can leave them different; retry the same tag to finish. Release workflows run in sequence so different versions cannot race channel updates.

A timed-out publish may have succeeded. Before retrying, the helper checks the registry. It skips a name/version only when metadata, SHA512 integrity and tarball bytes match. A conflicting version stops the release. If published bytes differ, investigate and choose a new version. Do not repack changed source, move the tag or reuse the version to force a retry through.

The final GitHub job requires successful npm publication or bootstrap verification. It creates or resumes the release for the existing tag and publishes notes with the changes, exact npm installation links and versioned docs. It does not download the Actions artifact, upload files or check GitHub asset digests.

Retries preserve published notes and manually edited draft text. Custom attachments stop the job for manual review; the helper never deletes historical files. Prereleases stay marked as prereleases and do not become GitHub's latest stable release. GitHub generates the source-code ZIP and tarball links from the tag. See the [release API](https://docs.github.com/en/rest/releases/releases) and [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

The GitHub job checks out release source and automation separately. Source stays at the signed release tag. The notes helper comes from the executing workflow's exact commit, `github.workflow_sha`. A manual dispatch from reviewed `main` can therefore fix automation for an older tag without changing its source or npm tarballs.

To correct old distribution guidance, edit the release notes to link the current usage guide alongside the tagged reference. Retries preserve those edits. Publication still requires the canonical repository and a clean tag reachable from fetched `origin/main`.

After a failure, inspect the job and registry/release state. Use **Re-run failed jobs** where possible to reuse the tested Actions artifact for npm checks. A failed notes job can retry without downloading it or writing to npm again.

A rerun uses its original workflow revision. After fixing automation, start a new manual dispatch from corrected `main` with the same tag and operation. Rerunning verification rebuilds the tagged source with its fixed timestamp. If Node/npm or build tools changed, compare checksums; a new toolchain can change the bytes.

## Consumer verification and release limits

After publication, test installation by exact version and by its intended channel:

```sh
npm install @remcoros/spirits@0.1.0 @remcoros/spirits-qr@0.1.0
npm install @remcoros/spirits@latest @remcoros/spirits-qr@latest
```

Use `latest` for stable releases. The [usage guide](usage.md#extract-standalone-modules-and-artwork-from-npm) shows how to download exact npm tarballs and extract the bundled standalone modules and core artwork catalogue while retaining their notices. Algorithm notes and reference vectors remain in the tagged source tree. Registry availability, GitHub release notes, Pages deployment, automated QR decoding, and physical camera/print acceptance are distinct evidence. Experimental artwork and software decoder success do not establish universal wallet-camera reliability.
