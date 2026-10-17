import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readReleaseManifest } from './distribution.mjs';
const root = process.cwd(),
  manifest = await readReleaseManifest(root).catch((error) => {
    console.error(error.message);
    process.exit(1);
  }),
  directory = await mkdtemp(join(tmpdir(), 'spirits-consumer-'));
try {
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'spirits-consumer-check',
      version: '1.0.0',
      private: true,
      type: 'module',
    }),
  );
  execFileSync(
    'npm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      resolve('dist/release', manifest.packages.core.file),
      resolve('dist/release', manifest.packages.qr.file),
    ],
    { cwd: directory, stdio: 'pipe' },
  );
  const vectors = JSON.parse(await readFile('spec/test-vectors.json', 'utf8'));
  const address = vectors[0].address;
  const consumer = `import {createSpirit,parseAddress} from '@remcoros/spirits';
import {createSpiritQr} from '@remcoros/spirits-qr';
const address=${JSON.stringify(address)};
const spirit=createSpirit(address),qr=createSpiritQr(address);
if(qr.address!==address||!spirit.svg.includes('<svg')||!qr.svg.includes('<svg')||parseAddress(address).network!=='mainnet')throw new Error('Packaged consumer failed');
const {createHash}=await import('node:crypto');
if(createHash('sha256').update(spirit.svg).digest('hex')!==${JSON.stringify(vectors[0].svgSha256)})throw new Error('Packaged SVG does not match portable vector');
console.log(JSON.stringify({address:qr.address,scheme:spirit.recipe.scheme,version:qr.version}));`;
  await writeFile(join(directory, 'consumer.mjs'), consumer);
  const packaged = JSON.parse(
    execFileSync(process.execPath, ['consumer.mjs'], { cwd: directory, encoding: 'utf8' }),
  );
  await writeFile(
    join(directory, 'consumer.ts'),
    `import {createSpirit, type SpiritRecipe} from '@remcoros/spirits';\nimport {createSpiritQr} from '@remcoros/spirits-qr';\nconst {recipe}: {recipe:SpiritRecipe}=createSpirit(${JSON.stringify(address)});\nconst qr=createSpiritQr(recipe.address);\nconsole.log(qr.svg);\n`,
  );
  execFileSync(
    process.execPath,
    [
      join(root, 'node_modules/typescript/bin/tsc'),
      '--strict',
      '--noEmit',
      '--skipLibCheck',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      'consumer.ts',
    ],
    { cwd: directory, stdio: 'pipe' },
  );
  const standaloneCore = await import(
    pathToFileURL(resolve('dist/release', manifest.files.coreModule)).href
  );
  const standaloneQr = await import(
    pathToFileURL(resolve('dist/release', manifest.files.qrModule)).href
  );
  if (
    createHash('sha256').update(standaloneCore.createSpirit(address).svg).digest('hex') !==
    vectors[0].svgSha256
  )
    throw new Error('Standalone SVG does not match portable vector');
  if (standaloneQr.createSpiritQr(address).address !== address)
    throw new Error('Standalone QR failed');
  const report = {
    tarballInstallOffline: true,
    externalNodeConsumer: true,
    externalTypeScriptConsumer: true,
    standaloneCore: true,
    standaloneQr: true,
    currentManifest: true,
    packageVersions: Object.fromEntries(
      Object.entries(manifest.packages).map(([name, value]) => [name, value.version]),
    ),
    packaged,
  };
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/package-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await rm(directory, { recursive: true, force: true });
}
