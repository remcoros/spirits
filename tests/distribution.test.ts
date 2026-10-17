import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildInputFiles,
  buildFingerprint,
  readReleaseManifest,
  regularFilePath,
  releaseTimestamp,
  claimArtifactName,
  sha256,
} from '../scripts/distribution.mjs';

async function temporary(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'spirits-distribution-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function inputFixture(root: string) {
  for (const directory of ['scripts', 'spec', 'docs', 'packages/core/src', 'packages/qr/src'])
    await mkdir(join(root, directory), { recursive: true });
  for (const file of [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'LICENSE',
    'ASSET-LICENSE',
    'THIRD-PARTY.md',
    'docs/algorithm.md',
    'docs/qr.md',
  ])
    await writeFile(join(root, file), '{}');
  await writeFile(join(root, 'packages/core/src/index.ts'), 'export const fixture = true;');
  for (const [directory, name] of [
    ['core', '@remcoros/spirits'],
    ['qr', '@remcoros/spirits-qr'],
  ])
    await writeFile(
      join(root, `packages/${directory}/package.json`),
      JSON.stringify({ name, version: '9.8.7-beta.1' }),
    );
}

test('release timestamps honor SOURCE_DATE_EPOCH and reject invalid timestamps', () => {
  assert.equal(releaseTimestamp('0'), '1970-01-01T00:00:00.000Z');
  assert.equal(releaseTimestamp('1792238400'), '2026-10-17T12:00:00.000Z');
  for (const epoch of ['', '-1', '1.5', '1e3', ' 123', 'NaN', '9007199254740992', '8640000000001'])
    assert.throws(() => releaseTimestamp(epoch), /SOURCE_DATE_EPOCH/);
});

test('flat release assets reject filename collisions and directory paths', () => {
  const claimed = new Set<string>();
  assert.equal(claimArtifactName(claimed, 'algorithm.md'), 'algorithm.md');
  assert.throws(
    () => claimArtifactName(claimed, 'algorithm.md'),
    /Duplicate release asset filename/,
  );
  for (const file of ['docs/algorithm.md', '../private', 'docs\\algorithm.md', '.', '..'])
    assert.throws(() => claimArtifactName(claimed, file), /flat filenames/);
});

test('release freshness follows package/build inputs without depending on app or documentation edits', async () => {
  await temporary(async (root) => {
    await inputFixture(root);
    const initial = await buildFingerprint(root);
    for (const directory of ['apps', 'docs', 'dist/release', 'packages/core/dist'])
      await mkdir(join(root, directory), { recursive: true });
    for (const file of [
      'apps/site.ts',
      'docs/README.md',
      'dist/release/manifest.json',
      'packages/core/dist/index.js',
    ])
      await writeFile(join(root, file), 'Unrelated or generated content');
    assert.equal(await buildFingerprint(root), initial);
    await writeFile(join(root, 'scripts/release.mjs'), 'export const releaseCheck = true;');
    assert.ok((await buildInputFiles(root)).includes('scripts/release.mjs'));
    assert.notEqual(await buildFingerprint(root), initial);
    const withHelper = await buildFingerprint(root);
    await writeFile(join(root, 'packages/core/src/index.ts'), 'export const fixture = false;');
    assert.notEqual(await buildFingerprint(root), withHelper);
  });
});

test('release paths reject traversal and symlink files or parent directories', async () => {
  await temporary(async (root) => {
    await writeFile(join(root, 'safe.mjs'), 'export const safe = true;');
    for (const path of ['../outside', '/etc/passwd', 'folder/../safe.mjs', 'folder\\safe.mjs'])
      await assert.rejects(regularFilePath(root, path), /Unsafe artifact path/);
    await symlink(join(root, 'safe.mjs'), join(root, 'linked.mjs'));
    await assert.rejects(regularFilePath(root, 'linked.mjs'), /symlinks/);
    await symlink(root, join(root, 'linked-directory'));
    await assert.rejects(regularFilePath(root, 'linked-directory/safe.mjs'), /symlinks/);
  });
});

test('release manifest detects missing, stale and modified artifacts using current package identities', async () => {
  await temporary(async (root) => {
    await inputFixture(root);
    await assert.rejects(readReleaseManifest(root), /Release artifacts are missing or invalid/);
    const directory = join(root, 'dist/release');
    await mkdir(directory, { recursive: true });
    const files = {
      artwork: 'artwork.json',
      coreModule: 'core.mjs',
      qrModule: 'qr.mjs',
      vectors: 'vectors.json',
      algorithm: 'algorithm.md',
      notices: 'THIRD-PARTY.md',
    };
    const packages = {
      core: {
        name: '@remcoros/spirits',
        version: '9.8.7-beta.1',
        file: 'remcoros-spirits-9.8.7-beta.1.tgz',
        sha256: '',
      },
      qr: {
        name: '@remcoros/spirits-qr',
        version: '9.8.7-beta.1',
        file: 'remcoros-spirits-qr-9.8.7-beta.1.tgz',
        sha256: '',
      },
    };
    const integrity: Record<string, string> = {};
    for (const file of [
      ...Object.values(files),
      ...Object.values(packages).map((value) => value.file),
    ]) {
      await writeFile(join(directory, file), `Fixture ${file}`);
      integrity[file] = await sha256(join(directory, file));
    }
    for (const value of Object.values(packages)) value.sha256 = integrity[value.file];
    const manifest = {
      schemaVersion: 2,
      files,
      packages,
      integrity,
      buildFingerprint: await buildFingerprint(root),
    };
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
    assert.equal((await readReleaseManifest(root)).packages.core.name, '@remcoros/spirits');
    assert.equal((await readReleaseManifest(root)).packages.core.version, '9.8.7-beta.1');
    await writeFile(join(directory, 'core.mjs'), 'Altered artifact');
    await assert.rejects(readReleaseManifest(root), /core.mjs is missing or modified/);
    await writeFile(join(directory, 'core.mjs'), 'Fixture core.mjs');
    await writeFile(join(root, 'packages/core/src/index.ts'), 'Changed source');
    await assert.rejects(readReleaseManifest(root), /stale relative to package\/build inputs/);
    const metadata = JSON.parse(await readFile(join(root, 'packages/core/package.json'), 'utf8'));
    await writeFile(
      join(root, 'packages/core/package.json'),
      JSON.stringify({ ...metadata, version: '9.8.8-beta.1' }),
    );
    manifest.buildFingerprint = await buildFingerprint(root);
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(
      readReleaseManifest(root),
      /do not match the current @remcoros\/spirits package/,
    );
  });
});
