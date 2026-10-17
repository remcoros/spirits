import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { inflateRawSync } from 'node:zlib';
import {
  createSourceArchive,
  readDownloadManifest,
  renderIntegrationGuide,
  sha256,
  sourceFiles,
  sourceFingerprint,
  validateMarkdownLinks,
} from '../scripts/distribution.mjs';

async function temporary(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'spirits-distribution-'));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function readZip(bytes: Buffer) {
  const entries = new Map<string, Buffer>();
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  let offset = bytes.readUInt32LE(end + 16);
  const count = bytes.readUInt16LE(end + 10);
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const nameLength = bytes.readUInt16LE(offset + 28),
      name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString(),
      compressedLength = bytes.readUInt32LE(offset + 20),
      length = bytes.readUInt32LE(offset + 24),
      local = bytes.readUInt32LE(offset + 42);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    assert.equal(bytes.readUInt16LE(local + 8), 8);
    const data = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28),
      content = inflateRawSync(bytes.subarray(data, data + compressedLength));
    assert.equal(content.length, length);
    assert.equal(entries.has(name), false);
    entries.set(name, content);
    offset += 46 + nameLength + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  return entries;
}

test('source ZIP includes canonical sources only, excluding ignored and nested local credentials', async () => {
  await temporary(async (root) => {
    const allowlist = await sourceFiles(process.cwd());
    for (const file of allowlist) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await copyFile(file, join(root, file));
    }
    const marker = `DISPOSABLE_SECRET_MARKER_${randomUUID()}`;
    for (const file of [
      '.env',
      'credentials.json',
      'apps/shared/.env.local',
      'packages/core/src/credentials.json',
      'scripts/local-scratch.mjs',
      'artifacts/private.txt',
    ]) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), marker);
    }
    await writeFile(
      join(root, '.gitignore'),
      (await readFile(join(root, '.gitignore'), 'utf8')) + '\n.env\ncredentials.json\n',
    );
    const fingerprint = await sourceFingerprint(root);
    const archive = join(root, 'source.zip');
    await createSourceArchive(root, archive);
    const entries = readZip(await readFile(archive));
    assert.deepEqual([...entries.keys()].sort(), allowlist.map((file) => `spirits/${file}`).sort());
    for (const file of [
      'README.md',
      'package-lock.json',
      'packages/core/src/index.ts',
      'packages/qr/src/vendor/qrcodegen.ts',
      'spec/bip352-source.json',
      'scripts/source-files.json',
    ])
      assert.deepEqual(entries.get(`spirits/${file}`), await readFile(join(root, file)));
    for (const bytes of entries.values()) assert.equal(bytes.includes(marker), false);
    await writeFile(join(root, '.env'), 'another private local value');
    assert.equal(await sourceFingerprint(root), fingerprint);
    await createSourceArchive(root, join(root, 'second.zip'));
    assert.deepEqual(await readFile(archive), await readFile(join(root, 'second.zip')));
    await writeFile(join(root, 'README.md'), 'Changed reviewed source');
    assert.notEqual(await sourceFingerprint(root), fingerprint);
  });
});

test('source allowlist rejects path escapes and symlink files or parent directories', async () => {
  await temporary(async (root) => {
    await mkdir(join(root, 'scripts'));
    await writeFile(join(root, 'safe.ts'), 'export const safe = true;');
    for (const path of ['../outside', '/etc/passwd', 'folder/../safe.ts', 'folder\\safe.ts']) {
      await writeFile(join(root, 'scripts/source-files.json'), JSON.stringify([path]));
      await assert.rejects(
        createSourceArchive(root, join(root, 'source.zip')),
        /Unsafe source path/,
      );
    }
    await symlink(join(root, 'safe.ts'), join(root, 'linked.ts'));
    await writeFile(join(root, 'scripts/source-files.json'), JSON.stringify(['linked.ts']));
    await assert.rejects(createSourceArchive(root, join(root, 'source.zip')), /symlinks/);
    await symlink(root, join(root, 'linked-directory'));
    await writeFile(
      join(root, 'scripts/source-files.json'),
      JSON.stringify(['linked-directory/safe.ts']),
    );
    await assert.rejects(createSourceArchive(root, join(root, 'source.zip')), /symlinks/);
  });
});

test('emitted guide links resolve within the preserved documentation tree', async () => {
  await temporary(async (root) => {
    await mkdir(join(root, 'docs'));
    await writeFile(
      join(root, 'README.md'),
      '[Docs](docs/README.md) and [external](https://example.com).\n',
    );
    await writeFile(join(root, 'docs/README.md'), '[Home](../README.md)\n');
    assert.equal(await validateMarkdownLinks(root, ['README.md', 'docs/README.md']), 2);
    await writeFile(join(root, 'docs/README.md'), '[Missing](missing.md)\n');
    await assert.rejects(
      validateMarkdownLinks(root, ['docs/README.md']),
      /Broken emitted Markdown link/,
    );
    await writeFile(join(root, 'docs/README.md'), '[Escape](../../private.md)\n');
    await assert.rejects(validateMarkdownLinks(root, ['docs/README.md']), /escapes downloads/);
    const guide = renderIntegrationGuide(
      '```sh\nnpm install ./spirits-core-0.1.0.tgz ./spirits-qr-0.1.0.tgz\n```',
      { core: { file: 'spirits-core-9.8.7.tgz' }, qr: { file: 'spirits-qr-9.8.7.tgz' } },
    );
    assert.match(guide, /spirits-core-9\.8\.7\.tgz \.\/spirits-qr-9\.8\.7\.tgz/);
    assert.equal(guide.includes('0.1.0'), false);
  });
});

test('package manifest detects missing, stale and modified builds using current versions', async () => {
  await temporary(async (root) => {
    await mkdir(join(root, 'scripts'));
    const listed = [
      'README.md',
      'packages/core/package.json',
      'packages/qr/package.json',
      'scripts/source-files.json',
    ];
    await writeFile(join(root, 'scripts/source-files.json'), JSON.stringify(listed));
    await writeFile(join(root, 'README.md'), 'Source guide');
    for (const name of ['core', 'qr']) {
      await mkdir(join(root, `packages/${name}`), { recursive: true });
      await writeFile(
        join(root, `packages/${name}/package.json`),
        JSON.stringify({ name: `@spirits/${name}`, version: '9.8.7' }),
      );
    }
    await assert.rejects(readDownloadManifest(root), /Downloads are missing or invalid/);
    const downloads = join(root, 'public/downloads');
    await mkdir(downloads, { recursive: true });
    const files = {
      source: 'source.zip',
      guide: 'README.md',
      artwork: 'artwork.json',
      coreModule: 'core.mjs',
      qrModule: 'qr.mjs',
      vectors: 'vectors.json',
    };
    const integrity: Record<string, string> = {};
    for (const file of [
      ...Object.values(files),
      'spirits-core-9.8.7.tgz',
      'spirits-qr-9.8.7.tgz',
    ]) {
      await writeFile(join(downloads, file), `Fixture ${file}`);
      integrity[file] = await sha256(join(downloads, file));
    }
    const packages = Object.fromEntries(
      ['core', 'qr'].map((name) => {
        const file = `spirits-${name}-9.8.7.tgz`;
        return [
          name,
          { name: `@spirits/${name}`, version: '9.8.7', file, sha256: integrity[file] },
        ];
      }),
    );
    await writeFile(
      join(downloads, 'manifest.json'),
      JSON.stringify({
        schemaVersion: 1,
        files,
        packages,
        integrity,
        buildFingerprint: await sourceFingerprint(root),
      }),
    );
    assert.equal((await readDownloadManifest(root)).packages.core.version, '9.8.7');
    await writeFile(join(downloads, 'core.mjs'), 'Altered download');
    await assert.rejects(readDownloadManifest(root), /core.mjs is missing or modified/);
    await writeFile(join(downloads, 'core.mjs'), 'Fixture core.mjs');
    await writeFile(join(root, 'README.md'), 'New source guide');
    await assert.rejects(readDownloadManifest(root), /stale relative to repository sources/);
  });
});
