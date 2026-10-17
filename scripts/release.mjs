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

export function validateGitHubAssets(assets, files) {
  const expected = new Set(files.map((file) => basename(file)));
  if (assets.some((asset) => !expected.has(asset.name)))
    throw new Error('GitHub release contains an unreviewed asset.');
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

async function artifactFiles(directory, manifest) {
  const files = [...Object.keys(manifest.integrity), 'manifest.json'].toSorted();
  const seen = new Set();
  for (const file of files) {
    // Release asset names are flat. Refuse collisions between nested notices/spec files.
    if (seen.has(basename(file))) throw new Error(`Duplicate GitHub asset basename: ${file}`);
    seen.add(basename(file));
  }
  return files;
}
async function prepare(root, tag) {
  const { release, directory, manifest } = await loadArtifacts(root, tag);
  const files = await artifactFiles(directory, manifest);
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
  const { release, directory, manifest } = await loadArtifacts(root, tag);
  if (!process.env.GH_TOKEN || process.env.GITHUB_REPOSITORY !== REPOSITORY)
    throw new Error('GitHub release requires canonical repository workflow credentials.');
  const headers = {
    Authorization: `Bearer ${process.env.GH_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const api = async (path, missing = false) => {
    const response = await request(
      `https://api.github.com/repos/${REPOSITORY}/${path}`,
      { headers },
      missing,
    );
    return response ? response.json() : null;
  };
  const files = [...(await artifactFiles(directory, manifest)), 'SHA256SUMS'];
  // Verify the checksum file itself is the one generated from this same artifact set.
  const expected =
    (
      await Promise.all(
        files
          .filter((f) => f !== 'SHA256SUMS')
          .map(
            async (file) =>
              `${createHash('sha256')
                .update(await readFile(join(directory, file)))
                .digest('hex')}  ${file}`,
          ),
      )
    ).join('\n') + '\n';
  if ((await readFile(join(directory, 'SHA256SUMS'), 'utf8')) !== expected)
    throw new Error('Release checksum file is missing or stale.');
  let current = await findGitHubRelease(tag, api);
  if (!current) {
    const notes = join(await mkdtemp(join(tmpdir(), 'spirits-notes-')), 'notes.md');
    try {
      await writeFile(
        notes,
        `Experimental SPirits ${release.version}.\n\nInstall both matching packages with \`npm install ${PACKAGE_NAMES.map((name) => `${name}@${release.version}`).join(' ')}\`.\n\nThe generator follows main; these assets contain the exact tagged source build. See docs/releasing.md for verification and remaining camera/print validation limits.\n`,
      );
      run(
        'gh',
        [
          'release',
          'create',
          tag,
          '--repo',
          REPOSITORY,
          '--verify-tag',
          '--draft',
          '--title',
          tag,
          '--notes-file',
          notes,
        ],
        { stdio: 'inherit' },
      );
    } finally {
      await rm(resolve(notes, '..'), { recursive: true, force: true });
    }
    current = await findGitHubRelease(tag, api);
  }
  if (!current || current.tag_name !== tag)
    throw new Error('GitHub release refers to an unexpected tag or could not be found.');
  const releasePath = `releases/${current.id}`;
  validateGitHubAssets(current.assets, files);
  for (const file of files) {
    const path = join(directory, file),
      digest = `sha256:${createHash('sha256')
        .update(await readFile(path))
        .digest('hex')}`;
    const existing = current.assets.find((asset) => asset.name === basename(file));
    if (existing) {
      if (existing.digest !== digest)
        throw new Error(`Existing GitHub asset differs: ${file}; never clobber release assets.`);
    } else {
      if (!current.draft)
        throw new Error(
          `Published release is missing ${file}; investigate before publishing another version.`,
        );
      run('gh', ['release', 'upload', tag, path, '--repo', REPOSITORY], { stdio: 'inherit' });
      current = await api(releasePath);
      if (current.assets.find((asset) => asset.name === basename(file))?.digest !== digest)
        throw new Error(`Could not verify uploaded GitHub asset ${file}.`);
    }
  }
  if (current.draft) {
    const latest = await api('releases/latest', true);
    const markLatest =
      !release.prerelease &&
      (!latest || compareVersions(latest.tag_name.slice(1), release.version) <= 0);
    run(
      'gh',
      [
        'release',
        'edit',
        tag,
        '--repo',
        REPOSITORY,
        '--draft=false',
        `--prerelease=${release.prerelease}`,
        `--latest=${markLatest}`,
      ],
      { stdio: 'inherit' },
    );
  }
  const final = await api(releasePath);
  if (final.tag_name !== tag || final.draft || final.prerelease !== release.prerelease)
    throw new Error('GitHub release publication state could not be verified.');
  console.log(`Verified GitHub release ${tag} and ${files.length} identical assets.`);
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
