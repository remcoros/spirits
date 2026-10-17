# Tagged package and artifact releases

The public generator follows `main`. npm packages and GitHub release assets come only from a reviewed `v` tag. Both packages use one version: `@remcoros/spirits` and `@remcoros/spirits-qr`, with QR depending on that exact core version. The first beta, [`0.1.0-beta.1`](https://github.com/remcoros/spirits/releases/tag/v0.1.0-beta.1), is published on npm and GitHub. It was bootstrapped through manually approved npm stages; OIDC publishing must still be validated by a subsequent genuine release.

## Checks and artifacts

`.github/workflows/release.yml` accepts a `vMAJOR.MINOR.PATCH` tag with optional SemVer prerelease identifiers. It rejects leading zeroes, build metadata, a dirty tree, a checkout different from the tag, a tag outside fetched `origin/main`, mismatched package/lockfile versions, and incorrect package repository/publication metadata.

The workflow uses GitHub-hosted Ubuntu, Node 24 and pinned npm 11.21.0. It installs exact dependencies with `npm ci`, runs formatting, TypeScript, unit/image tests, a full build, isolated tarball consumers, and browser checks against the built site. Playwright supplies Chromium through `SPIRITS_BROWSER`; the test does not assume a particular system Chrome path.

The tagged commit timestamp is exported as `SOURCE_DATE_EPOCH`. `npm run build:assets` produces `dist/release/`, containing the exact npm tarballs, standalone modules, artwork, vectors, contract notes, licences and an integrity manifest. `node scripts/release.mjs prepare TAG` checks those artifacts against their source fingerprint and creates `SHA256SUMS`. The workflow transfers this tested directory to later jobs without rebuilding or repacking.

To prepare artifacts without publishing, run **Tagged release** manually with the existing tag and operation **prepare**. Only the verification job runs; download its `release-TAG` Actions artifact. The repository Actions variable `NPM_PUBLISH_ENABLED` defaults to disabled when absent: leave it unset during bootstrap. Once it is set to the exact string `true`, a `v*` tag push or manual operation **publish** runs the complete publication flow. Ordinary `main` pushes do not publish npm packages. The separate **finalize-bootstrap** operation verifies already-published npm bytes without writing to npm, then publishes their matching GitHub release.

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

The workflow's `npm` environment name must match the trusted publisher exactly. Permit both `v*` tags and `main` for manual dispatch: dispatch may run the workflow from `main` while its checkout is the supplied release tag. Apply any maintainer approval policy there. Existing stage-only permissions do not authorize direct publication or channel changes. npm 11.21.0 is pinned because OIDC dist-tag operations need that npm 11 version or later. New trusted publisher configurations must complete their first successful publish within two days; create them immediately before a genuine upcoming release. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

Set each package's publishing access to require 2FA and disallow traditional tokens once trusted publishing works. `npm whoami` does not validate OIDC publication permissions. A fresh package has no npm package settings yet; use the first real release bootstrap below rather than publishing an empty placeholder or granting a long-lived CI token.

## First real release through staged publishing

Staging can create a package that does not exist. It reserves the real version without exposing it publicly, and a maintainer approves it later with 2FA. For a new package, npm automatically creates a public `0.0.0-stage` placeholder; the staged release's actual contents remain private until approval. Stage approval is interactive; an OIDC workflow cannot approve stages. See [npm staged publishing](https://docs.npmjs.com/staged-publishing/).

1. Leave `NPM_PUBLISH_ENABLED` unset or `false`. Commit the release metadata and workflow, push `main`, create the real `v0.1.0-beta.1` tag at the reviewed commit, and push that tag. Its verification job prepares tested artifacts and the npm/GitHub publication jobs are skipped cleanly. The manual **prepare** operation also provides tested artifacts without attempting publication.
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

5. Run **Tagged release** again with the same tag and operation **finalize-bootstrap**. It verifies that both registry tarballs exactly match the tested bytes, that both `next` tags point to this version, and that an isolated registry consumer passes. It then creates the matching GitHub release. This operation needs no npm token, trusted publisher, or npm writes. Human approval of the two packages is sequential, so both channel tags must be verified before announcing the release.

Check `latest` after new-package staging too: it can still point at the automatic placeholder after approval under `next`. For the initial SPirits beta, both `latest` tags were moved to the approved `0.1.0-beta.1`, so default installs receive the actual beta. Do not delete that tag or unpublish the placeholder as a release cleanup step. Subsequent prereleases promote `next`; stable releases promote `latest`.

Before the next genuine version is ready, configure both trusted publishers as above and set `NPM_PUBLISH_ENABLED=true`. Its tag push then publishes automatically. Do this within the configuration's two-day first-publish window. Merely rerunning the already-published bootstrap version skips npm publication and does **not** prove that OIDC publishing works or satisfy that first-publish requirement; recreate an expired configuration when the next real release is ready. Do not invent a placeholder or extra version just to validate authentication.

If a version remains staged, finish approval or reject that stage before attempting a direct publish of the same version. Staged and published versions share the same version reservation. Rejecting, unpublishing, moving tags or changing package ownership is a separate recovery decision; the release helper does none of those operations.

## Routine publication and retry behavior

The helper preflights both registry versions before writing anything, then publishes the exact tested core tarball followed by QR. Each first appears under a version-specific temporary `release-...` dist-tag. It verifies registry SHA512 integrity and downloaded tarball bytes, then installs both exact versions with a fresh npm cache in a temporary consumer. The consumer checks package versions, installed integrity, a stored Spirit SVG vector and QR metadata.

Only after both packages and the consumer pass does it point `next` at prereleases or `latest` at stable releases. It refuses to move a channel backward if either package already points at a newer version. npm offers no transaction spanning two package dist-tags: a failure between those two updates can temporarily leave them different. Retry the same tag to complete the second update. Release workflows are serialized and queued so different versions cannot race promotions.

A timed-out publish may already have succeeded. The helper checks the registry before retrying and skips only a name/version with matching metadata, SHA512 integrity and tarball bytes. Any conflicting existing version stops the release. Never repack a changed source tree, move the tag, overwrite assets, or reuse the version to make a retry pass. If the published bytes differ, investigate and choose a new version.

The final GitHub job creates or resumes a draft release for the existing tag, uploads the same verified artifacts and checksums, verifies uploaded asset digests, then publishes it. Draft discovery uses the authenticated release list because GitHub's release-by-tag endpoint returns published releases; subsequent reads use the release ID. Existing byte-identical assets are reused; conflicting assets are never clobbered. Prereleases are marked as such and do not become GitHub's latest stable release. GitHub provides the tagged source ZIP/tarball automatically; no custom source ZIP is generated. See [GitHub release API](https://docs.github.com/en/rest/releases/releases), [immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

The GitHub job checks out release source and automation separately. Source remains at the signed release tag, and its manifest, fingerprint and checksums must match the tested artifact. The upload helper comes from the exact commit containing the executing workflow (`github.workflow_sha`). This permits a manual dispatch from a reviewed `main` commit to repair release automation for an older tag without changing its source, npm tarballs or assets. Publication still requires the canonical repository and a clean tag reachable from fetched `origin/main`.

After a failure, inspect the failed job and its registry/release state. Use **Re-run failed jobs** to preserve the original tested artifact when possible. A rerun retains its original workflow revision; after fixing release automation, start a new manual dispatch from the corrected `main` with the same release tag and operation. Re-running verification for the same tag rebuilds from its source and fixed timestamp; compare checksums if changing Node/npm or build tools. A new toolchain can change bytes and is not an appropriate silent retry.

## Consumer verification and release limits

After publication, test installation by exact version and by its intended channel:

```sh
npm install @remcoros/spirits@0.1.0-beta.1 @remcoros/spirits-qr@0.1.0-beta.1
npm install @remcoros/spirits@next @remcoros/spirits-qr@next
```

Use `latest` for stable releases. Repository-generated tarballs can also be installed directly; standalone modules, reference vectors and original artwork remain separate release assets. Registry availability, GitHub asset publication, Pages deployment, automated QR decoding, and physical camera/print acceptance are distinct evidence. Experimental artwork and software decoder success do not establish universal wallet-camera reliability.
