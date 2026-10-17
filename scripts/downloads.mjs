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
  createSourceArchive,
  renderIntegrationGuide,
  sha256,
  sourceFiles,
  sourceFingerprint,
  validateMarkdownLinks,
} from './distribution.mjs';

const root = process.cwd(),
  destination = resolve('public/downloads');
await mkdir(dirname(destination), { recursive: true });
const dir = await mkdtemp(join(dirname(destination), '.downloads-'));
try {
  const sources = await sourceFiles(root);
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
          `Missing library build ${file}. Run npm run build:lib before npm run downloads.`,
        );
      }
      if (built.mtimeMs < sourceTime)
        throw new Error(
          `Stale library build ${file}. Run npm run build:lib before npm run downloads.`,
        );
    }
  }
  await mkdir(join(dir, 'dependency-licenses'));
  for (const name of [
    '@scure/base',
    '@noble/curves',
    '@noble/hashes',
    'jsqr',
    '@fontsource/manrope',
    '@fontsource/space-grotesk',
  ]) {
    const files = await readdir(`node_modules/${name}`),
      licenses = files.filter((file) => /^(license|licence|ofl)(\.|$)/i.test(file));
    if (!licenses.length) throw new Error(`No dependency licence found for ${name}.`);
    for (const file of licenses)
      await copyFile(
        `node_modules/${name}/${file}`,
        join(dir, 'dependency-licenses', `${name.replaceAll('/', '-')}-${file}`),
      );
  }
  await copyFile(
    'packages/qr/src/vendor/qrcodegen.ts',
    join(dir, 'dependency-licenses/nayuki-qrcodegen.ts'),
  );
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
    packages[name] = {
      name: metadata.name,
      version: metadata.version,
      file: packed.filename,
      sha256: await sha256(join(dir, packed.filename)),
    };
    await copyFile(`packages/${name}/dist/spirits-${name}.mjs`, join(dir, `spirits-${name}.mjs`));
  }
  const guideFiles = sources.filter(
    (file) =>
      file.startsWith('docs/') ||
      file.startsWith('spec/') ||
      [
        'README.md',
        'AGENTS.md',
        'THIRD-PARTY.md',
        'LICENSE',
        'ASSET-LICENSE',
        'packages/core/assets/spirits-v0.json',
        'packages/qr/THIRD-PARTY.md',
        'packages/qr/src/vendor/qrcodegen.ts',
      ].includes(file),
  );
  for (const file of guideFiles) {
    await mkdir(dirname(join(dir, file)), { recursive: true });
    if (file === 'README.md')
      await writeFile(
        join(dir, file),
        renderIntegrationGuide(await readFile(file, 'utf8'), packages),
      );
    else await copyFile(file, join(dir, file));
  }
  const markdownLinksChecked = await validateMarkdownLinks(
    dir,
    guideFiles.filter((file) => file.endsWith('.md')),
  );
  await createSourceArchive(root, join(dir, 'spirits-source.zip'));
  const integrity = {};
  async function recordFiles(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await recordFiles(join(directory, entry.name), `${path}/`);
      else integrity[path] = await sha256(join(directory, entry.name));
    }
  }
  await recordFiles(dir);
  await writeFile(
    join(dir, 'manifest.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        buildFingerprint: await sourceFingerprint(root),
        packages,
        files: {
          source: 'spirits-source.zip',
          guide: 'README.md',
          artwork: 'packages/core/assets/spirits-v0.json',
          coreModule: 'spirits-core.mjs',
          qrModule: 'spirits-qr.mjs',
          vectors: 'spec/test-vectors.json',
        },
        integrity,
        markdownLinksChecked,
      },
      null,
      2,
    ) + '\n',
  );
  await rm(destination, { recursive: true, force: true });
  await rename(dir, destination);
  console.log(
    `Local packages, standalone modules, linked guides and allowlisted source archive ready (${markdownLinksChecked} local Markdown links checked).`,
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
