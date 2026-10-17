import {
  mkdir,
  copyFile,
  mkdtemp,
  readdir,
  readFile,
  writeFile,
  rm,
  rename,
  stat,
} from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import {
  collectDependencyLicenses,
  claimArtifactName,
  releaseTimestamp,
  sha256,
  buildInputFiles,
  buildFingerprint,
} from './distribution.mjs';

const root = process.cwd(),
  destination = resolve('dist/release'),
  generatedAt = releaseTimestamp(),
  claimed = new Set(['manifest.json']);
await mkdir(dirname(destination), { recursive: true });
const dir = await mkdtemp(join(dirname(destination), '.release-'));
try {
  const sources = await buildInputFiles(root);
  for (const name of ['core', 'qr']) {
    const relevant = sources.filter(
      (file) =>
        file.startsWith(`packages/${name}/src/`) ||
        (name === 'qr' && file.startsWith('packages/core/src/')),
    );
    const newestSource = Math.max(
      ...(await Promise.all(relevant.map(async (file) => (await stat(file)).mtimeMs))),
    );
    const expected = [
      [`packages/${name}/dist/index.d.ts`, 0],
      [`packages/${name}/dist/spirits-${name}.mjs`, newestSource],
      ...(await Promise.all(
        sources
          .filter((file) => file.startsWith(`packages/${name}/src/`) && file.endsWith('.ts'))
          .map(async (file) => [
            file.replace('/src/', '/dist/').replace(/\.ts$/, '.js'),
            (await stat(file)).mtimeMs,
          ]),
      )),
    ];
    for (const [file, sourceTime] of expected) {
      let built;
      try {
        built = await stat(file);
      } catch {
        throw new Error(
          `Missing library build ${file}. Run npm run build:assets to rebuild release artifacts.`,
        );
      }
      if (built.mtimeMs < sourceTime)
        throw new Error(
          `Stale library build ${file}. Run npm run build:assets to rebuild release artifacts.`,
        );
    }
  }
  for (const { file, source } of await collectDependencyLicenses(root))
    await writeFile(join(dir, claimArtifactName(claimed, file)), source);
  const packages = {};
  for (const name of ['core', 'qr']) {
    const metadata = JSON.parse(await readFile(`packages/${name}/package.json`, 'utf8')),
      [packed] = JSON.parse(
        execFileSync(
          'npm',
          [
            'pack',
            '--json',
            '--ignore-scripts',
            '--workspace',
            metadata.name,
            '--pack-destination',
            dir,
          ],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
        ),
      );
    if (
      packed.name !== metadata.name ||
      packed.version !== metadata.version ||
      basename(packed.filename) !== packed.filename ||
      !packed.filename.endsWith('.tgz')
    )
      throw new Error(`Unexpected npm pack result for ${metadata.name}.`);
    claimArtifactName(claimed, packed.filename);
    packages[name] = {
      name: metadata.name,
      version: metadata.version,
      file: packed.filename,
      sha256: await sha256(join(dir, packed.filename)),
    };
    await copyFile(
      `packages/${name}/dist/spirits-${name}.mjs`,
      join(dir, claimArtifactName(claimed, `spirits-${name}.mjs`)),
    );
  }
  const assetFiles = [
    ['packages/core/assets/spirits-v0.json', 'spirits-v0.json'],
    ['THIRD-PARTY.md', 'THIRD-PARTY.md'],
    ['LICENSE', 'LICENSE'],
    ['ASSET-LICENSE', 'ASSET-LICENSE'],
    ['packages/qr/THIRD-PARTY.md', 'qr-encoder.md'],
    ['docs/algorithm.md', 'algorithm.md'],
    ['docs/qr.md', 'qr.md'],
    ...sources.filter((file) => file.startsWith('spec/')).map((file) => [file, basename(file)]),
  ];
  for (const [source, target] of assetFiles) {
    await copyFile(source, join(dir, claimArtifactName(claimed, target)));
  }
  const integrity = {};
  for (const file of (await readdir(dir)).toSorted()) {
    if (!(await stat(join(dir, file))).isFile())
      throw new Error(`Release asset is not a file: ${file}`);
    integrity[file] = await sha256(join(dir, file));
  }
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify(
      {
        schemaVersion: 2,
        generatedAt,
        buildFingerprint: await buildFingerprint(root),
        packages,
        files: {
          artwork: 'spirits-v0.json',
          coreModule: 'spirits-core.mjs',
          qrModule: 'spirits-qr.mjs',
          vectors: 'test-vectors.json',
          algorithm: 'algorithm.md',
          notices: 'THIRD-PARTY.md',
        },
        integrity,
      },
      null,
      2,
    ) + '\n',
  );
  await rm(destination, { recursive: true, force: true });
  await rename(dir, destination);
  console.log('Local release artifacts and integrity manifest ready in dist/release/.');
} finally {
  await rm(dir, { recursive: true, force: true });
}
