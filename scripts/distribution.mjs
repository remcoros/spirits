import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Fingerprint package/build inputs without coupling release artifacts to either website. */
export async function buildInputFiles(root) {
  const files = [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'LICENSE',
    'ASSET-LICENSE',
    'THIRD-PARTY.md',
    'docs/algorithm.md',
    'docs/qr.md',
  ];
  async function visit(directory) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['dist', 'node_modules'].includes(entry.name)) continue;
      const file = `${directory}/${entry.name}`;
      if (entry.isSymbolicLink())
        throw new Error(`Build inputs must not contain symlinks: ${file}`);
      if (entry.isDirectory()) await visit(file);
      else if (
        /\.(?:[cm]?ts|mjs|json|md)$/.test(entry.name) ||
        /^(?:LICENSE|ASSET-LICENSE|NOTICE)$/.test(entry.name)
      ) {
        await regularFilePath(root, file);
        files.push(file);
      }
    }
  }
  for (const directory of ['packages/core', 'packages/qr', 'scripts', 'spec'])
    await visit(directory);
  for (const file of files) await regularFilePath(root, file);
  return files.toSorted();
}

export async function regularFilePath(root, file) {
  if (
    typeof file !== 'string' ||
    !file ||
    isAbsolute(file) ||
    file.includes('\\') ||
    file.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`Unsafe artifact path: ${JSON.stringify(file)}`);
  const target = resolve(root, file),
    path = relative(resolve(root), target);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error(`Artifact path escapes its directory: ${file}`);
  const parts = file.split('/');
  for (let index = 0; index < parts.length; index++) {
    const entry = await lstat(join(root, ...parts.slice(0, index + 1)));
    if (entry.isSymbolicLink())
      throw new Error(`Artifact paths must not contain symlinks: ${file}`);
    if (index === parts.length - 1 ? !entry.isFile() : !entry.isDirectory())
      throw new Error(`Artifact path is not a regular file: ${file}`);
  }
  return target;
}

export async function buildFingerprint(root) {
  const hash = createHash('sha256');
  for (const file of await buildInputFiles(root)) {
    const bytes = await readFile(await regularFilePath(root, file));
    hash.update(`${file}\0${bytes.length}\0`).update(bytes);
  }
  return hash.digest('hex');
}

export async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

export function releaseTimestamp(epoch = process.env.SOURCE_DATE_EPOCH) {
  if (epoch === undefined) return new Date().toISOString();
  if (typeof epoch !== 'string' || !/^\d+$/.test(epoch))
    throw new Error('SOURCE_DATE_EPOCH must contain nonnegative integer seconds.');
  const seconds = Number(epoch),
    date = new Date(seconds * 1000);
  if (!Number.isSafeInteger(seconds) || Number.isNaN(date.getTime()))
    throw new Error('SOURCE_DATE_EPOCH is outside the supported timestamp range.');
  return date.toISOString();
}

export function claimArtifactName(claimed, name) {
  if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[/\\\0]/.test(name))
    throw new Error(`Release assets must have flat filenames: ${JSON.stringify(name)}`);
  if (claimed.has(name)) throw new Error(`Duplicate release asset filename: ${name}`);
  claimed.add(name);
  return name;
}

/** Shared by local release staging and the static site's legal-notice assets. */
export async function collectDependencyLicenses(root) {
  const result = [];
  for (const name of [
    '@scure/base',
    '@noble/curves',
    '@noble/hashes',
    'jsqr',
    '@fontsource/manrope',
    '@fontsource/space-grotesk',
  ]) {
    const directory = join(root, 'node_modules', name),
      files = (await readdir(directory)).filter((file) =>
        /^(license|licence|ofl)(\.|$)/i.test(file),
      );
    if (!files.length) throw new Error(`No dependency licence found for ${name}.`);
    for (const file of files)
      result.push({
        file: `${name.replaceAll('/', '-')}-${file}`,
        source: await readFile(join(directory, file)),
      });
  }
  result.push({
    file: 'nayuki-qrcodegen.ts',
    source: await readFile(join(root, 'packages/qr/src/vendor/qrcodegen.ts')),
  });
  return result;
}

/** Refuse missing, stale or modified release artifacts before testing a consumer. */
export async function readReleaseManifest(root) {
  const directory = join(root, 'dist/release');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  } catch (error) {
    throw new Error(
      'Release artifacts are missing or invalid. Run npm run build:assets before npm run test:packages.',
      { cause: error },
    );
  }
  if (
    manifest.schemaVersion !== 2 ||
    !manifest.packages ||
    !manifest.files ||
    !manifest.integrity ||
    !Object.keys(manifest.integrity).length
  )
    throw new Error('Invalid release manifest. Run npm run build:assets.');
  if (manifest.buildFingerprint !== (await buildFingerprint(root)))
    throw new Error(
      'Release artifacts are stale relative to package/build inputs. Run npm run build:assets before npm run test:packages.',
    );
  for (const key of ['core', 'qr']) {
    const metadata = JSON.parse(await readFile(join(root, `packages/${key}/package.json`), 'utf8')),
      packed = manifest.packages[key];
    if (
      !packed ||
      packed.name !== metadata.name ||
      packed.version !== metadata.version ||
      typeof packed.file !== 'string' ||
      !packed.file.endsWith('.tgz') ||
      packed.file.includes('/') ||
      packed.file.includes('\\') ||
      packed.sha256 !== manifest.integrity[packed.file]
    )
      throw new Error(
        `Release artifacts do not match the current ${metadata.name} package. Run npm run build:assets.`,
      );
  }
  for (const name of ['artwork', 'coreModule', 'qrModule', 'vectors', 'algorithm', 'notices'])
    if (typeof manifest.files[name] !== 'string' || !manifest.integrity[manifest.files[name]])
      throw new Error(`Release manifest is missing ${name}. Run npm run build:assets.`);
  for (const [file, digest] of Object.entries(manifest.integrity)) {
    claimArtifactName(new Set(), file);
    if (typeof digest !== 'string' || !/^[a-f\d]{64}$/.test(digest))
      throw new Error(`Invalid release digest for ${file}. Run npm run build:assets.`);
    try {
      if ((await sha256(await regularFilePath(directory, file))) !== digest)
        throw new Error('Digest mismatch');
    } catch (error) {
      throw new Error(
        `Release artifact ${file} is missing or modified. Run npm run build:assets.`,
        { cause: error },
      );
    }
  }
  return manifest;
}
