import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPOSITORY = 'remcoros/spirits';
export const REGISTRY = 'https://registry.npmjs.org/';
export const PACKAGE_NAMES = ['@remcoros/spirits', '@remcoros/spirits-qr'];
const run = (command, args, options = {}) => {
  const output = execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    ...options,
  });
  return typeof output === 'string' ? output.trim() : '';
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Deliberately reject build metadata: npm versions must have one unambiguous tag spelling. */
export function parseReleaseTag(tag) {
  const match =
    /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      tag,
    );
  if (
    !match ||
    match[0] !== tag ||
    match[4]?.split('.').some((part) => /^\d+$/.test(part) && /^0\d/.test(part))
  )
    throw new Error(
      'Release tag must be vMAJOR.MINOR.PATCH with optional SemVer prerelease identifiers.',
    );
  return {
    tag,
    version: tag.slice(1),
    channel: match[4] ? 'next' : 'latest',
    prerelease: !!match[4],
  };
}

export function compareVersions(left, right) {
  const a = parseReleaseTag(`v${left}`).version.split('-'),
    b = parseReleaseTag(`v${right}`).version.split('-');
  // A hyphen is also legal inside prerelease identifiers.
  const split = (value) => [
    value.split('-', 1)[0].split('.').map(BigInt),
    value.slice(value.indexOf('-') + 1),
  ];
  const [an, ap] = split(left),
    [bn, bp] = split(right);
  for (let i = 0; i < 3; i++) if (an[i] !== bn[i]) return an[i] > bn[i] ? 1 : -1;
  if (a.length === 1 || b.length === 1) return a.length === b.length ? 0 : a.length === 1 ? 1 : -1;
  const ai = ap.split('.'),
    bi = bp.split('.');
  for (let i = 0; i < Math.max(ai.length, bi.length); i++) {
    if (ai[i] === bi[i]) continue;
    if (ai[i] === undefined || bi[i] === undefined) return ai[i] === undefined ? -1 : 1;
    const numericA = /^\d+$/.test(ai[i]),
      numericB = /^\d+$/.test(bi[i]);
    if (numericA && numericB) return BigInt(ai[i]) > BigInt(bi[i]) ? 1 : -1;
    if (numericA !== numericB) return numericA ? -1 : 1;
    return ai[i] > bi[i] ? 1 : -1;
  }
  return 0;
}

export function validateVersions(release, root, core, qr, lock) {
  if (core.name !== PACKAGE_NAMES[0] || qr.name !== PACKAGE_NAMES[1])
    throw new Error('Unexpected release package names.');
  if (
    [
      root.version,
      core.version,
      qr.version,
      lock.version,
      ...['', 'packages/core', 'packages/qr'].map((p) => lock.packages?.[p]?.version),
    ].some((v) => v !== release.version)
  )
    throw new Error('Tag, root, package, and lockfile versions must match exactly.');
  if (
    qr.dependencies?.[core.name] !== release.version ||
    lock.packages?.['packages/qr']?.dependencies?.[core.name] !== release.version
  )
    throw new Error('QR must depend on the exact lockstep core version.');
  for (const pkg of [core, qr]) {
    if (
      pkg.private ||
      pkg.publishConfig?.access !== 'public' ||
      pkg.publishConfig?.registry !== REGISTRY
    )
      throw new Error('Release packages must explicitly target the public npm registry.');
    if (pkg.repository?.url !== `git+https://github.com/${REPOSITORY}.git`)
      throw new Error('Package repository must match the trusted publishing repository.');
  }
}

export async function validateCheckout(root, tag, env = process.env) {
  const release = parseReleaseTag(tag);
  if (env.GITHUB_REPOSITORY && env.GITHUB_REPOSITORY !== REPOSITORY)
    throw new Error('Only the canonical repository can release.');
  if (
    env.GITHUB_EVENT_NAME === 'push' &&
    (env.GITHUB_REF_TYPE !== 'tag' || env.GITHUB_REF_NAME !== tag)
  )
    throw new Error('A release push must refer to the requested tag.');
  const git = (...args) => run('git', args, { cwd: root });
  const commit = git('rev-parse', `refs/tags/${tag}^{commit}`);
  if (git('rev-parse', 'HEAD') !== commit)
    throw new Error('Checkout is not the requested tag commit.');
  if (git('status', '--porcelain', '--untracked-files=all'))
    throw new Error('Release source tree must be clean.');
  try {
    git('merge-base', '--is-ancestor', commit, 'refs/remotes/origin/main');
  } catch {
    throw new Error(
      'Release tag commit must be reachable from origin/main; fetch full history first.',
    );
  }
  const [metadata, core, qr, lock] = await Promise.all(
    [
      'package.json',
      'packages/core/package.json',
      'packages/qr/package.json',
      'package-lock.json',
    ].map(async (file) => JSON.parse(await readFile(join(root, file), 'utf8'))),
  );
  validateVersions(release, metadata, core, qr, lock);
  return { ...release, commit };
}

export const tarballIntegrity = (bytes) =>
  `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
export function requireMatchingVersion(pkg, published) {
  if (
    published &&
    (published.name !== pkg.name ||
      published.version !== pkg.version ||
      published.dist?.integrity !== pkg.integrity)
  )
    throw new Error(
      `Registry conflict for ${pkg.name}@${pkg.version}: bytes or metadata differ; never overwrite/reuse this version.`,
    );
}

export function validateNotesOnlyRelease(current, release) {
  if (!current || current.tag_name !== release.tag)
    throw new Error('GitHub release refers to an unexpected tag or could not be found.');
  if (!Array.isArray(current.assets) || current.assets.length)
    throw new Error(
      `GitHub release ${release.tag} must contain notes only. Review and manually remove its uploaded attachments before retrying; this workflow never deletes historical assets.`,
    );
}

/** Ignore draft, unrelated and newer releases when determining the actual preceding version. */
export function previousPublishedRelease(release, releases) {
  return (
    releases
      .filter((candidate) => {
        if (candidate.draft) return false;
        try {
          return compareVersions(parseReleaseTag(candidate.tag_name).version, release.version) < 0;
        } catch {
          return false;
        }
      })
      .sort((a, b) => compareVersions(b.tag_name.slice(1), a.tag_name.slice(1)))[0] ?? null
  );
}

const markdownText = (value) => value.replace(/[\\`*_{}\[\]<>]/g, '\\$&');

export function renderReleaseNotes(
  release,
  { previousTag = null, generatedNotes = '', commits = [] } = {},
) {
  const source = `https://github.com/${REPOSITORY}`,
    tagged = `${source}/blob/${release.tag}`,
    initial = release.version === '0.1.0-beta.1';
  const introduction = initial
    ? 'First public beta of SPirits: deterministic ghost avatars for Bitcoin Silent Payment addresses.'
    : `SPirits ${release.version}${release.prerelease ? ' is a prerelease' : ' is available'}.`;
  let changes;
  if (initial) {
    changes = [
      '- Derive expressive ghosts from validated Silent Payment public addresses, with stable character traits and permanent accessories selected by the scan public key.',
      '- Preserve the character across wallet labels while changing its small badge and trim accents.',
      '- Render SVG from a platform-neutral TypeScript library, with an optional browser PNG adapter.',
      '- Generate complete-address payment QRs with a larger circular Spirit badge, H error correction, four-module quiet zones and protected structural markers.',
      '- Explore the local browser generator and development lab; address processing stays on the device.',
    ].join('\n');
  } else {
    const details = generatedNotes.trim();
    const hasGeneratedChanges = /^\s*[-*]\s+\S/m.test(details);
    if (!hasGeneratedChanges && !commits.length)
      throw new Error(
        'No changes found for release notes; supply a real version change before publishing.',
      );
    changes = details;
    if (!hasGeneratedChanges)
      changes = `${commits.map(({ sha, subject }) => `- ${markdownText(subject)} ([${sha.slice(0, 7)}](${source}/commit/${sha}))`).join('\n')}${details ? `\n\n${details}` : ''}`;
    if (previousTag && !details.includes('/compare/'))
      changes += `\n\n[Compare ${previousTag} with ${release.tag}](${source}/compare/${previousTag}...${release.tag}).`;
  }
  return `${introduction}\n\n## Changes\n\n${changes}\n\n## Install\n\nBoth npm packages use the same exact version:\n\n\`\`\`sh\nnpm install ${PACKAGE_NAMES.map((name) => `${name}@${release.version}`).join(' ')}\n\`\`\`\n\n${PACKAGE_NAMES.map((name) => `[${name} ${release.version}](https://www.npmjs.com/package/${name}/v/${release.version})`).join(' · ')}\n\n[Usage guide for ${release.tag}](${tagged}/docs/usage.md) · [Tagged source](${source}/tree/${release.tag}) · [Algorithm](${tagged}/docs/algorithm.md) · [QR behavior](${tagged}/docs/qr.md)\n\nThe public generator follows main; the npm versions above contain the tagged library implementation. GitHub provides automatic source archives; built packages are distributed through npm.\n\n## Experimental status\n\nThe spirits-v0 visual scheme is experimental and may change before v1. A Spirit is a recognition aid, not proof of ownership or a globally unique address fingerprint.\n\nAutomated tests decode final composed QR images in software. Physical wallet-camera and print reliability still need separate validation; software decoding does not establish compatibility with every reader.\n`;
}

/** Publish or resume a notes-only release. npm publication and verification already completed. */
export async function publishNotesRelease(release, operations) {
  let current = await operations.find(release.tag);
  if (current) {
    validateNotesOnlyRelease(current, release);
    if (!current.draft) {
      if (current.prerelease !== release.prerelease || !current.body?.trim())
        throw new Error('Published release metadata or notes need manual review before retrying.');
      return current; // Preserve published and manually curated notes on retries.
    }
  }
  let notes = current?.body?.trim() ? current.body : null;
  if (!notes) {
    const previous = previousPublishedRelease(release, await operations.list());
    const previousTag = previous?.tag_name ?? null;
    notes = renderReleaseNotes(release, {
      previousTag,
      generatedNotes:
        release.version === '0.1.0-beta.1'
          ? ''
          : await operations.generateNotes(release.tag, previousTag),
      commits:
        release.version === '0.1.0-beta.1'
          ? []
          : await operations.changes(release.tag, previousTag),
    });
  }
  if (!current) {
    current = await operations.create({
      tag_name: release.tag,
      target_commitish: release.commit,
      name: release.tag,
      body: notes,
      draft: true,
      prerelease: release.prerelease,
    });
    validateNotesOnlyRelease(current, release);
    if (!current.draft) throw new Error('New GitHub release was not created as a draft.');
  }
  const latest = await operations.latest();
  const markLatest =
    !release.prerelease &&
    (!latest || compareVersions(latest.tag_name.slice(1), release.version) <= 0);
  await operations.update(current.id, {
    body: notes,
    draft: false,
    prerelease: release.prerelease,
    make_latest: String(markLatest),
  });
  const final = await operations.read(current.id);
  validateNotesOnlyRelease(final, release);
  if (final.draft || final.prerelease !== release.prerelease || final.body !== notes)
    throw new Error('GitHub release publication state or notes could not be verified.');
  return final;
}

/** The tag endpoint only returns published releases; drafts must be found in the list. */
export async function findGitHubRelease(tag, api) {
  const published = await api(`releases/tags/${encodeURIComponent(tag)}`, true);
  if (published) return published;
  for (let page = 1; ; page++) {
    const releases = await api(`releases?per_page=100&page=${page}`);
    const matches = releases.filter((release) => release.tag_name === tag);
    if (matches.length > 1) throw new Error(`Multiple GitHub releases refer to ${tag}.`);
    if (matches.length) return matches[0];
    if (releases.length < 100) return null;
  }
}

/** Retry uncertain publish outcomes, but only skip a version after verifying identical bytes. */
export async function ensurePublished(pkg, { lookup, publish, wait = sleep }) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await lookup(pkg);
    requireMatchingVersion(pkg, existing);
    if (existing) return;
    try {
      await publish(pkg);
    } catch (error) {
      lastError = error;
    }
    for (let poll = 0; poll < 5; poll++) {
      const result = await lookup(pkg);
      requireMatchingVersion(pkg, result);
      if (result) return;
      await wait(500 * 2 ** poll);
    }
  }
  throw new Error(
    `Could not verify publication of ${pkg.name}@${pkg.version}. Retry the same tag and verified artifacts.`,
    { cause: lastError },
  );
}

export async function publishPair(packages, release, operations) {
  // Preflight both packages before the first write, so a QR conflict cannot leave a new core publish.
  for (const pkg of packages) requireMatchingVersion(pkg, await operations.lookup(pkg));
  for (const pkg of packages) await ensurePublished(pkg, operations);
  await operations.verifyConsumer(packages);
  const targets = await Promise.all(packages.map((pkg) => operations.getTag(pkg, release.channel)));
  if (targets.some((version) => version && compareVersions(version, release.version) > 0))
    return {
      promoted: false,
      reason: 'A newer version already owns this channel; existing channel left in place.',
    };
  // npm has no cross-package transaction. A retry repairs a partial tag update after both publishes.
  for (const pkg of packages) await operations.promote(pkg, release.channel);
  for (const pkg of packages) await operations.removePending(pkg);
  return { promoted: true };
}

async function request(url, options = {}, allowMissing = false) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let response;
    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (response.status === 404 && allowMissing) return null;
    if (response.ok) return response;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 3)
      throw new Error(
        `HTTP ${response.status} from ${new URL(url).origin}${new URL(url).pathname}`,
      );
    await sleep(500 * 2 ** attempt);
  }
}
const registryMetadata = async (pkg) => {
  const response = await request(
    `${REGISTRY}${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`,
    {},
    true,
  );
  return response ? response.json() : null;
};
async function registryLookup(pkg) {
  const published = await registryMetadata(pkg);
  requireMatchingVersion(pkg, published);
  if (published) {
    const url = new URL(published.dist.tarball);
    if (url.origin !== new URL(REGISTRY).origin)
      throw new Error('Unexpected registry tarball host.');
    const bytes = Buffer.from(await (await request(url)).arrayBuffer());
    if (tarballIntegrity(bytes) !== pkg.integrity)
      throw new Error(`Registry tarball bytes differ for ${pkg.name}.`);
  }
  return published;
}

async function loadArtifacts(root, tag) {
  const release = await validateCheckout(root, tag);
  const { readReleaseManifest, regularFilePath } = await import('./distribution.mjs');
  const manifest = await readReleaseManifest(root);
  const directory = join(root, 'dist/release');
  if (manifest.schemaVersion !== 2) throw new Error('Expected release manifest schema 2.');
  const packages = await Promise.all(
    ['core', 'qr'].map(async (key, i) => {
      const pkg = manifest.packages[key];
      if (
        pkg.name !== PACKAGE_NAMES[i] ||
        pkg.version !== release.version ||
        basename(pkg.file) !== pkg.file
      )
        throw new Error('Release manifest package mismatch.');
      const path = await regularFilePath(directory, pkg.file);
      return { ...pkg, path, integrity: tarballIntegrity(await readFile(path)) };
    }),
  );
  return { release, directory, manifest, packages };
}

async function verifyRegistryConsumer(root, packages) {
  const directory = await mkdtemp(join(tmpdir(), 'spirits-registry-'));
  try {
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    );
    run(
      'npm',
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--prefer-online',
        '--registry',
        REGISTRY,
        '--cache',
        join(directory, '.npm'),
        ...packages.map((p) => `${p.name}@${p.version}`),
      ],
      { cwd: directory, stdio: 'inherit' },
    );
    for (const pkg of packages) {
      const installed = JSON.parse(
        await readFile(join(directory, 'node_modules', pkg.name, 'package.json'), 'utf8'),
      );
      if (installed.name !== pkg.name || installed.version !== pkg.version)
        throw new Error('Registry consumer installed unexpected package versions.');
    }
    const [vector] = JSON.parse(await readFile(join(root, 'spec/test-vectors.json'), 'utf8'));
    await writeFile(
      join(directory, 'consumer.mjs'),
      `import {createHash} from 'node:crypto';
import {createSpirit} from '${PACKAGE_NAMES[0]}';
import {createSpiritQr} from '${PACKAGE_NAMES[1]}';
const address=${JSON.stringify(vector.address)},spirit=createSpirit(address),qr=createSpiritQr(address);
if(createHash('sha256').update(spirit.svg).digest('hex')!==${JSON.stringify(vector.svgSha256)}||qr.address!==address||qr.quietZone!==4||qr.errorCorrection!=='H')throw new Error('Registry package consumer failed');
console.log('Verified isolated registry consumer');\n`,
    );
    run(process.execPath, ['consumer.mjs'], { cwd: directory, stdio: 'inherit' });
    const lock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'));
    for (const pkg of packages)
      if (lock.packages?.[`node_modules/${pkg.name}`]?.integrity !== pkg.integrity)
        throw new Error('Installed registry tarball integrity differs from the tested release.');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function publishNpm(root, tag) {
  const { release, packages } = await loadArtifacts(root, tag);
  const [major, minor] = run('npm', ['--version']).split('.').map(Number);
  if (major !== 11 || minor < 21)
    throw new Error('Release publishing requires pinned npm 11.21.0 or later in the npm 11 line.');
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    !process.env.ACTIONS_ID_TOKEN_REQUEST_URL ||
    process.env.RUNNER_ENVIRONMENT !== 'github-hosted'
  )
    throw new Error('Direct publication requires the GitHub-hosted trusted publishing job.');
  const pending = `release-${release.version.replaceAll('.', '-')}`;
  const metadata = async (pkg) =>
    await (await request(`${REGISTRY}${encodeURIComponent(pkg.name)}`)).json();
  const result = await publishPair(packages, release, {
    lookup: registryLookup,
    publish: (pkg) =>
      run(
        'npm',
        [
          'publish',
          pkg.path,
          '--ignore-scripts',
          '--workspaces=false',
          '--access=public',
          '--provenance',
          `--tag=${pending}`,
          `--registry=${REGISTRY}`,
        ],
        { stdio: 'inherit' },
      ),
    verifyConsumer: () => verifyRegistryConsumer(root, packages),
    getTag: async (pkg, channel) => (await metadata(pkg))['dist-tags']?.[channel],
    promote: async (pkg, channel) => {
      let failure;
      try {
        run(
          'npm',
          ['dist-tag', 'add', `${pkg.name}@${pkg.version}`, channel, `--registry=${REGISTRY}`],
          { stdio: 'inherit' },
        );
      } catch (error) {
        failure = error;
      }
      if ((await metadata(pkg))['dist-tags']?.[channel] !== pkg.version)
        throw new Error(`Could not verify ${channel} promotion for ${pkg.name}.`, {
          cause: failure,
        });
    },
    removePending: async (pkg) => {
      if ((await metadata(pkg))['dist-tags']?.[pending] === pkg.version)
        run('npm', ['dist-tag', 'rm', pkg.name, pending, `--registry=${REGISTRY}`], {
          stdio: 'inherit',
        });
    },
  });
  console.log(JSON.stringify({ ...release, ...result }));
}

async function verifyBootstrap(root, tag) {
  const { release, packages } = await loadArtifacts(root, tag);
  for (const pkg of packages) {
    if (!(await registryLookup(pkg)))
      throw new Error(`Bootstrap package not publicly available: ${pkg.name}@${pkg.version}.`);
    const metadata = await (await request(`${REGISTRY}${encodeURIComponent(pkg.name)}`)).json();
    if (metadata['dist-tags']?.[release.channel] !== pkg.version)
      throw new Error(
        `Bootstrap ${release.channel} tag does not point at ${pkg.name}@${pkg.version}.`,
      );
  }
  await verifyRegistryConsumer(root, packages);
  console.log('Verified manually bootstrapped registry packages and channel without npm writes.');
}

async function artifactFiles(manifest) {
  const files = [...Object.keys(manifest.integrity), 'manifest.json'].toSorted();
  const seen = new Set();
  for (const file of files) {
    // The CI artifact uses flat names for portable bootstrap checksum verification.
    if (seen.has(basename(file))) throw new Error(`Duplicate CI artifact basename: ${file}`);
    seen.add(basename(file));
  }
  return files;
}
async function prepare(root, tag) {
  const { release, directory, manifest } = await loadArtifacts(root, tag);
  const files = await artifactFiles(manifest);
  const sums = await Promise.all(
    files.map(
      async (file) =>
        `${createHash('sha256')
          .update(await readFile(join(directory, file)))
          .digest('hex')}  ${file}`,
    ),
  );
  await writeFile(join(directory, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  console.log(JSON.stringify({ ...release, assets: files.length + 1 }));
}

async function githubRelease(root, tag) {
  // Release tooling can come from the workflow commit while cwd remains the signed source tag.
  // This phase deliberately needs no build outputs or artifact manifest.
  const release = await validateCheckout(root, tag);
  if (!process.env.GH_TOKEN || process.env.GITHUB_REPOSITORY !== REPOSITORY)
    throw new Error('GitHub release requires canonical repository workflow credentials.');
  const headers = {
    Authorization: `Bearer ${process.env.GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const api = async (path, missing = false, write) => {
    const response = await request(
      `https://api.github.com/repos/${REPOSITORY}/${path}`,
      write
        ? {
            headers: { ...headers, 'Content-Type': 'application/json' },
            method: write.method,
            body: JSON.stringify(write.body),
          }
        : { headers },
      missing,
    );
    return response ? response.json() : null;
  };
  await publishNotesRelease(release, {
    find: (tag) => findGitHubRelease(tag, api),
    list: async () => {
      const releases = [];
      for (let page = 1; ; page++) {
        const batch = await api(`releases?per_page=100&page=${page}`);
        releases.push(...batch);
        if (batch.length < 100) return releases;
      }
    },
    generateNotes: async (tag, previousTag) =>
      (
        await api('releases/generate-notes', false, {
          method: 'POST',
          body: {
            tag_name: tag,
            target_commitish: release.commit,
            ...(previousTag ? { previous_tag_name: previousTag } : {}),
          },
        })
      ).body,
    changes: async (tag, previousTag) => {
      const range = previousTag ? `refs/tags/${previousTag}..refs/tags/${tag}` : `refs/tags/${tag}`;
      const output = run(
        'git',
        ['log', '--reverse', '--no-merges', '--format=%H%x00%s', range, '--'],
        { cwd: root },
      );
      return output
        ? output.split('\n').map((line) => {
            const [sha, subject] = line.split('\0');
            return { sha, subject };
          })
        : [];
    },
    create: (body) => api('releases', false, { method: 'POST', body }),
    update: (id, body) => api(`releases/${id}`, false, { method: 'PATCH', body }),
    read: (id) => api(`releases/${id}`),
    latest: () => api('releases/latest', true),
  });
  console.log(
    `Verified notes-only GitHub release ${tag}; built packages are distributed through npm.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode = 'check', argumentTag] = process.argv.slice(2),
    tag = argumentTag ?? process.env.RELEASE_TAG;
  try {
    if (!tag) throw new Error('Specify a release tag as the second argument or RELEASE_TAG.');
    const root = process.cwd();
    if (mode === 'check') console.log(JSON.stringify(await validateCheckout(root, tag)));
    else if (mode === 'prepare') await prepare(root, tag);
    else if (mode === 'publish') await publishNpm(root, tag);
    else if (mode === 'verify-bootstrap') await verifyBootstrap(root, tag);
    else if (mode === 'github') await githubRelease(root, tag);
    else
      throw new Error('Release mode must be check, prepare, publish, verify-bootstrap or github.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
