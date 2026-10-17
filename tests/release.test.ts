import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  PACKAGE_NAMES,
  REGISTRY,
  parseReleaseTag,
  compareVersions,
  validateVersions,
  validateCheckout,
  validateGitHubAssets,
  tarballIntegrity,
  ensurePublished,
  publishPair,
  type ReleasePackage,
  type PublishedPackage,
  type PublishOperations,
} from '../scripts/release.mjs';

const release = parseReleaseTag('v0.1.0-beta.1');
const packages: ReleasePackage[] = PACKAGE_NAMES.map((name, i) => ({
  name,
  version: release.version,
  integrity: tarballIntegrity(Buffer.from(`tested tarball ${i}`)),
}));
const published = (pkg: ReleasePackage): PublishedPackage => ({
  name: pkg.name,
  version: pkg.version,
  dist: { integrity: pkg.integrity },
});
const metadata = () => {
  const root = { version: release.version };
  const core = {
    name: PACKAGE_NAMES[0],
    version: release.version,
    repository: { url: 'git+https://github.com/remcoros/spirits.git' },
    publishConfig: { access: 'public', registry: REGISTRY },
  };
  const qr = { ...core, name: PACKAGE_NAMES[1], dependencies: { [core.name]: release.version } };
  const lock = {
    version: release.version,
    packages: { '': root, 'packages/core': core, 'packages/qr': qr },
  };
  return { root, core, qr, lock };
};

test('GitHub release asset names are validated without treating map indexes as path suffixes', () => {
  validateGitHubAssets(
    [{ name: 'manifest.json' }, { name: 'spirits.mjs' }],
    ['manifest.json', 'spirits.mjs', 'SHA256SUMS'],
  );
  validateGitHubAssets([], ['manifest.json']);
  assert.throws(
    () => validateGitHubAssets([{ name: 'surprise.tgz' }], ['manifest.json']),
    /unreviewed/,
  );
});

test('release tag syntax and channel policy reject ambiguous or invalid versions', () => {
  assert.equal(release.channel, 'next');
  assert.equal(parseReleaseTag('v1.2.3').channel, 'latest');
  assert.equal(parseReleaseTag('v1.2.3-rc.10').prerelease, true);
  for (const tag of [
    '1.2.3',
    'v01.2.3',
    'v1.2',
    'v1.2.3-beta.01',
    'v1.2.3+',
    'v1.2.3+build',
    'v1.2.3-',
    'v1.2.3-../x',
    'v1.2.3\n',
  ])
    assert.throws(() => parseReleaseTag(tag), Error, tag);
  const order = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
    '1.0.1',
    '2.0.0',
  ];
  for (let i = 0; i < order.length; i++) {
    assert.equal(compareVersions(order[i], order[i]), 0);
    for (let j = i + 1; j < order.length; j++) {
      assert.equal(compareVersions(order[i], order[j]), -1);
      assert.equal(compareVersions(order[j], order[i]), 1);
    }
  }
  assert.equal(compareVersions('1.0.0-beta-one.2', '1.0.0-beta-one.11'), -1);
  assert.equal(compareVersions('999999999999999999999.0.0', '999999999999999999998.0.0'), 1);
});

test('lockstep version, dependency, repository and public-registry metadata are required', () => {
  const check = (m: ReturnType<typeof metadata>) =>
    validateVersions(release, m.root, m.core, m.qr, m.lock);
  check(metadata());
  for (const mutate of [
    (m: ReturnType<typeof metadata>) => {
      m.root.version = '0.1.0';
    },
    (m: ReturnType<typeof metadata>) => {
      m.lock.packages['packages/qr'].version = '0.1.0';
    },
    (m: ReturnType<typeof metadata>) => {
      m.qr.dependencies[m.core.name] = '^0.1.0-beta.1';
    },
    (m: ReturnType<typeof metadata>) => {
      m.core.repository.url = 'git+https://github.com/other/spirits.git';
    },
    (m: ReturnType<typeof metadata>) => {
      m.core.publishConfig.access = 'restricted';
    },
  ]) {
    const m = metadata();
    mutate(m);
    assert.throws(() => check(m));
  }
});

test('release source must be the clean tagged commit reachable from fetched main', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spirits-release-git-'));
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    git('init', '-b', 'main');
    git('config', 'user.name', 'Release Test');
    git('config', 'user.email', 'release@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    git('config', 'tag.gpgsign', 'false');
    const m = metadata();
    await mkdir(join(directory, 'packages/core'), { recursive: true });
    await mkdir(join(directory, 'packages/qr'), { recursive: true });
    for (const [file, value] of [
      ['package.json', m.root],
      ['packages/core/package.json', m.core],
      ['packages/qr/package.json', m.qr],
      ['package-lock.json', m.lock],
    ] as const)
      await writeFile(join(directory, file), JSON.stringify(value));
    git('add', '.');
    git('commit', '-m', 'Fixture');
    git('tag', release.tag);
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    assert.equal((await validateCheckout(directory, release.tag, {})).version, release.version);
    await assert.rejects(
      validateCheckout(directory, release.tag, { GITHUB_REPOSITORY: 'fork/spirits' }),
      /canonical/,
    );
    await assert.rejects(
      validateCheckout(directory, release.tag, {
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF_TYPE: 'branch',
        GITHUB_REF_NAME: 'main',
      }),
      /push/,
    );
    await writeFile(join(directory, 'untracked'), 'not reviewed');
    await assert.rejects(validateCheckout(directory, release.tag, {}), /clean/);
    await rm(join(directory, 'untracked'));
    await writeFile(join(directory, 'package.json'), JSON.stringify({ version: 'wrong' }));
    await assert.rejects(validateCheckout(directory, release.tag, {}), /clean/);
    git('checkout', '--', 'package.json');
    git('checkout', '-b', 'side');
    await writeFile(join(directory, 'side'), 'side commit');
    git('add', '.');
    git('commit', '-m', 'Side');
    await assert.rejects(validateCheckout(directory, release.tag, {}), /requested tag/);
    git('tag', 'v0.1.0-beta.2');
    await assert.rejects(validateCheckout(directory, 'v0.1.0-beta.2', {}), /reachable/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function fakeRegistry() {
  const registry = new Map<string, PublishedPackage>(),
    events: string[] = [];
  const operations: PublishOperations = {
    lookup: async (pkg) => registry.get(pkg.name) ?? null,
    publish: async (pkg) => {
      events.push(`publish:${pkg.name}`);
      registry.set(pkg.name, published(pkg));
    },
    wait: async () => {},
    verifyConsumer: async () => {
      events.push('consumer');
    },
    getTag: async () => undefined,
    promote: async (pkg, channel) => {
      events.push(`promote:${pkg.name}:${channel}`);
    },
    removePending: async (pkg) => {
      events.push(`clean:${pkg.name}`);
    },
  };
  return { registry, events, operations };
}

test('publish retries verify existing bytes, including a timeout after the registry accepted a tarball', async () => {
  const { registry, events, operations } = fakeRegistry();
  operations.publish = async (pkg) => {
    registry.set(pkg.name, published(pkg));
    events.push('accepted');
    throw new Error('lost response');
  };
  await ensurePublished(packages[0], operations);
  await ensurePublished(packages[0], operations);
  assert.deepEqual(events, ['accepted']);
  registry.set(packages[0].name, {
    ...published(packages[0]),
    dist: { integrity: 'sha512-different' },
  });
  await assert.rejects(ensurePublished(packages[0], operations), /Registry conflict/);
  assert.deepEqual(events, ['accepted']);
});

test('both registry versions and isolated consumer are verified before channel promotion', async () => {
  const { events, operations } = fakeRegistry();
  assert.deepEqual(await publishPair(packages, release, operations), { promoted: true });
  assert.deepEqual(events, [
    `publish:${PACKAGE_NAMES[0]}`,
    `publish:${PACKAGE_NAMES[1]}`,
    'consumer',
    `promote:${PACKAGE_NAMES[0]}:next`,
    `promote:${PACKAGE_NAMES[1]}:next`,
    `clean:${PACKAGE_NAMES[0]}`,
    `clean:${PACKAGE_NAMES[1]}`,
  ]);
  const conflict = fakeRegistry();
  conflict.registry.set(packages[1].name, {
    ...published(packages[1]),
    dist: { integrity: 'wrong' },
  });
  await assert.rejects(publishPair(packages, release, conflict.operations), /Registry conflict/);
  assert.deepEqual(conflict.events, []);
  const consumer = fakeRegistry();
  consumer.operations.verifyConsumer = async () => {
    throw new Error('consumer mismatch');
  };
  await assert.rejects(publishPair(packages, release, consumer.operations), /consumer mismatch/);
  assert.ok(consumer.events.every((event) => event.startsWith('publish:')));
});

test('retry completes a partial core publish, refuses a newer channel rollback, and repairs partial promotion', async () => {
  const { registry, events, operations } = fakeRegistry();
  registry.set(packages[0].name, published(packages[0]));
  operations.getTag = async () => '0.2.0-beta.1';
  assert.equal((await publishPair(packages, release, operations)).promoted, false);
  assert.deepEqual(events, [`publish:${PACKAGE_NAMES[1]}`, 'consumer']);
  events.length = 0;
  operations.getTag = async (pkg) =>
    pkg.name === packages[0].name ? release.version : '0.0.1-beta.1';
  await publishPair(packages, release, operations);
  assert.ok(events.includes(`promote:${PACKAGE_NAMES[1]}:next`));
  assert.ok(!events.some((event) => event.startsWith('publish:')));
});
