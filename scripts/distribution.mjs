import { createHash } from 'node:crypto';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { deflateRawSync } from 'node:zlib';

/** Source ZIP contents are explicitly reviewed; new files require an allowlist change. */
export async function sourceFiles(root) {
  const files = JSON.parse(await readFile(join(root, 'scripts/source-files.json'), 'utf8'));
  if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length)
    throw new Error('Source allowlist must be a nonempty array of unique relative paths.');
  for (const file of files) await sourcePath(root, file);
  return files.toSorted();
}

export async function sourcePath(root, file) {
  if (
    typeof file !== 'string' ||
    !file ||
    isAbsolute(file) ||
    file.includes('\\') ||
    file.split('/').some((part) => !part || part === '.' || part === '..')
  )
    throw new Error(`Unsafe source path: ${JSON.stringify(file)}`);
  const target = resolve(root, file);
  if (!inside(root, target)) throw new Error(`Source path escapes the repository: ${file}`);
  const parts = file.split('/');
  for (let index = 0; index < parts.length; index++) {
    const path = join(root, ...parts.slice(0, index + 1));
    const entry = await lstat(path);
    if (entry.isSymbolicLink()) throw new Error(`Source paths must not contain symlinks: ${file}`);
    if (index === parts.length - 1 ? !entry.isFile() : !entry.isDirectory())
      throw new Error(`Source path is not a regular file: ${file}`);
  }
  return target;
}

function inside(root, target) {
  const path = relative(resolve(root), target);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

export async function sourceFingerprint(root) {
  const hash = createHash('sha256');
  for (const file of await sourceFiles(root)) {
    const bytes = await readFile(await sourcePath(root, file));
    hash.update(`${file}\0${bytes.length}\0`).update(bytes);
  }
  return hash.digest('hex');
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ crcTable[(value ^ byte) & 0xff];
  return (value ^ 0xffffffff) >>> 0;
}

/** A small standard ZIP writer: deflate, UTF-8 paths, CRC32 and deterministic dates. */
export async function createSourceArchive(root, output) {
  const contents = [],
    directory = [];
  let offset = 0;
  const files = await sourceFiles(root);
  if (files.length > 65535) throw new Error('Source ZIP exceeds the supported entry count.');
  for (const file of files) {
    const bytes = await readFile(await sourcePath(root, file)),
      compressed = deflateRawSync(bytes),
      name = Buffer.from(`spirits/${file}`),
      crc = crc32(bytes);
    if (bytes.length > 0xffffffff || compressed.length > 0xffffffff || name.length > 65535)
      throw new Error(`Source file exceeds ZIP limits: ${file}`);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x0021, 12); // 1980-01-01; no local-clock-dependent archive changes.
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    contents.push(local, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    local.copy(central, 6, 4, 30);
    central.writeUInt32LE(0o100644 * 65536, 38);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += local.length + name.length + compressed.length;
    if (offset > 0xffffffff) throw new Error('Source ZIP exceeds the supported archive size.');
  }
  const centralSize = directory.reduce((sum, bytes) => sum + bytes.length, 0),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(output, Buffer.concat([...contents, ...directory, end]));
  return files;
}

/** Validate local Markdown destinations in emitted guides, not just their source copies. */
export async function validateMarkdownLinks(root, files) {
  let checked = 0;
  for (const file of files) {
    const text = (await readFile(await sourcePath(root, file), 'utf8')).replace(
      /^(```|~~~)[\s\S]*?^\1.*$/gm,
      '',
    );
    for (const match of text.matchAll(/!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g)) {
      const destination = match[1].replace(/^<|>$/g, '');
      if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(destination)) continue;
      const pathname = decodeURIComponent(destination.split(/[?#]/, 1)[0]);
      if (!pathname) continue;
      const target = resolve(root, dirname(file), pathname);
      if (!inside(root, target))
        throw new Error(`Markdown link escapes downloads: ${file} → ${destination}`);
      try {
        await sourcePath(root, relative(root, target).split(sep).join('/'));
      } catch (error) {
        throw new Error(`Broken emitted Markdown link: ${file} → ${destination}`, { cause: error });
      }
      checked++;
    }
  }
  return checked;
}

export async function sha256(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

export function renderIntegrationGuide(readme, packages) {
  const pattern = /^npm install \.\/spirits-core-[^\s]+\.tgz \.\/spirits-qr-[^\s]+\.tgz$/m;
  if (!pattern.test(readme))
    throw new Error('README is missing its local package integration example.');
  return readme.replace(pattern, () => `npm install ./${packages.core.file} ./${packages.qr.file}`);
}

/** Refuse missing, stale or modified downloads before testing an isolated consumer. */
export async function readDownloadManifest(root) {
  const downloads = join(root, 'public/downloads');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(join(downloads, 'manifest.json'), 'utf8'));
  } catch (error) {
    throw new Error(
      'Downloads are missing or invalid. Run npm run build before npm run test:packages.',
      { cause: error },
    );
  }
  if (
    manifest.schemaVersion !== 1 ||
    !manifest.packages ||
    !manifest.files ||
    !manifest.integrity ||
    !Object.keys(manifest.integrity).length
  )
    throw new Error('Invalid downloads manifest. Run npm run build before npm run test:packages.');
  if (manifest.buildFingerprint !== (await sourceFingerprint(root)))
    throw new Error(
      'Downloads are stale relative to repository sources. Run npm run build before npm run test:packages.',
    );
  for (const name of ['core', 'qr']) {
    const metadata = JSON.parse(
        await readFile(join(root, `packages/${name}/package.json`), 'utf8'),
      ),
      packed = manifest.packages[name];
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
        `Downloads do not match the current ${metadata.name} package. Run npm run build.`,
      );
  }
  for (const name of ['source', 'guide', 'artwork', 'coreModule', 'qrModule', 'vectors'])
    if (typeof manifest.files[name] !== 'string' || !manifest.integrity[manifest.files[name]])
      throw new Error(`Downloads manifest is missing ${name}. Run npm run build.`);
  for (const [file, digest] of Object.entries(manifest.integrity)) {
    if (typeof digest !== 'string' || !/^[a-f\d]{64}$/.test(digest))
      throw new Error(`Invalid download digest for ${file}. Run npm run build.`);
    try {
      if ((await sha256(await sourcePath(downloads, file))) !== digest)
        throw new Error('Digest mismatch');
    } catch (error) {
      throw new Error(`Download ${file} is missing or modified. Run npm run build.`, {
        cause: error,
      });
    }
  }
  await validateMarkdownLinks(
    downloads,
    Object.keys(manifest.integrity).filter((file) => file.endsWith('.md')),
  );
  return manifest;
}
