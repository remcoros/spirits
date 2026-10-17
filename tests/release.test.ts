import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
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
  validateNotesOnlyRelease,
  previousPublishedRelease,
  renderReleaseNotes,
  publishNotesRelease,
  findGitHubRelease,
  tarballIntegrity,
  ensurePublished,
  publishPair,
  type ReleasePackage,
  type PublishedPackage,
  type PublishOperations,
  type GitHubRelease,
  type NotesPublicationOperations,
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

const githubRecord = (overrides: Partial<GitHubRelease> = {}): GitHubRelease => ({
  id: 42,
  tag_name: release.tag,
  draft: false,
  prerelease: true,
  assets: [],
  body: 'Maintainer release notes.',
  ...overrides,
});

test('GitHub release validation requires no attachments and never deletes historical assets', () => {
  validateNotesOnlyRelease(githubRecord(), release);
  assert.throws(
    () =>
      validateNotesOnlyRelease(githubRecord({ assets: [{ name: 'old-package.tgz' }] }), release),
    /manually remove.*never deletes/,
  );
  assert.throws(
    () => validateNotesOnlyRelease(githubRecord({ tag_name: 'v0.1.0-beta.2' }), release),
    /unexpected tag/,
  );
});

test('initial beta notes contain exact npm installs, features, source and validation limits', () => {
  const notes = renderReleaseNotes(release);
  assert.equal(notes, renderReleaseNotes(release));
  assert.match(
    notes,
    /npm install @remcoros\/spirits@0\.1\.0-beta\.1 @remcoros\/spirits-qr@0\.1\.0-beta\.1/,
  );
  assert.match(notes, /npmjs\.com\/package\/@remcoros\/spirits\/v\/0\.1\.0-beta\.1/);
  assert.match(notes, /scan public key/);
  assert.match(notes, /circular Spirit badge/);
  assert.match(notes, /blob\/v0\.1\.0-beta\.1\/docs\/usage\.md/);
  assert.match(notes, /tree\/v0\.1\.0-beta\.1/);
  assert.match(notes, /not proof of ownership/);
  assert.match(notes, /Physical wallet-camera and print reliability/);
  assert.doesNotMatch(notes, /releases\/download|SHA256SUMS|attached assets/);
});

test('later notes use the highest lower published SemVer and retain real changes without PRs', () => {
  const next = parseReleaseTag('v0.2.0');
  const candidates = [
    githubRecord({ tag_name: 'v0.1.0' }),
    githubRecord({ tag_name: 'v0.2.0-rc.1' }),
    githubRecord({ tag_name: 'v0.2.0-rc.2', draft: true }),
    githubRecord({ tag_name: 'v0.2.0' }),
    githubRecord({ tag_name: 'v0.3.0' }),
    githubRecord({ tag_name: 'launch' }),
  ];
  assert.equal(previousPublishedRelease(next, candidates)?.tag_name, 'v0.2.0-rc.1');
  assert.equal(previousPublishedRelease(release, candidates), null);
  const sha = 'a'.repeat(40);
  const notes = renderReleaseNotes(next, {
    previousTag: 'v0.2.0-rc.1',
    generatedNotes:
      '**Full Changelog**: https://github.com/remcoros/spirits/compare/v0.2.0-rc.1...v0.2.0',
    commits: [{ sha, subject: 'Fix stale QR export after address changes' }],
  });
  assert.match(notes, /Fix stale QR export after address changes/);
  assert.match(notes, new RegExp(`/commit/${sha}`));
  assert.match(notes, /Full Changelog/);
  assert.match(notes, /blob\/v0\.2\.0\/docs\/usage\.md/);
  assert.throws(
    () => renderReleaseNotes(next, { generatedNotes: '**Full Changelog**: compare only' }),
    /No changes found/,
  );
  const generated = renderReleaseNotes(next, {
    previousTag: 'v0.1.0',
    generatedNotes: "## What's Changed\n* Improve recognition at 32px by @contributor in #12",
    commits: [{ sha, subject: 'Implementation detail' }],
  });
  assert.match(generated, /Improve recognition at 32px/);
  assert.doesNotMatch(generated, /Implementation detail/);
});

function fakeNotesRelease(existing: GitHubRelease | null = null) {
  let current = existing;
  const calls: string[] = [],
    creates: unknown[] = [],
    updates: Parameters<NotesPublicationOperations['update']>[1][] = [];
  const operations: NotesPublicationOperations = {
    find: async () => {
      calls.push('find');
      return current;
    },
    list: async () => {
      calls.push('list');
      return [];
    },
    generateNotes: async () => {
      calls.push('generate');
      return '* Real improvement';
    },
    changes: async () => {
      calls.push('changes');
      return [];
    },
    latest: async () => {
      calls.push('latest');
      return null;
    },
    create: async (body) => {
      calls.push('create');
      creates.push(body);
      current = githubRecord(body);
      return current;
    },
    update: async (id, body) => {
      assert.equal(id, 42);
      calls.push('update');
      updates.push(body);
      current = { ...current!, ...body };
    },
    read: async (id) => {
      assert.equal(id, 42);
      calls.push('read');
      return current!;
    },
  };
  return { operations, calls, creates, updates };
}

test('notes-only publication creates and publishes a draft without any build-file or upload operation', async () => {
  const fake = fakeNotesRelease();
  const final = await publishNotesRelease({ ...release, commit: 'a'.repeat(40) }, fake.operations);
  assert.equal(final.draft, false);
  assert.deepEqual(final.assets, []);
  assert.deepEqual(fake.calls, ['find', 'list', 'create', 'latest', 'update', 'read']);
  assert.deepEqual(Object.keys(fake.creates[0] as object).sort(), [
    'body',
    'draft',
    'name',
    'prerelease',
    'tag_name',
    'target_commitish',
  ]);
  assert.equal(fake.updates[0].make_latest, 'false');
  assert.deepEqual(fake.updates[0].body, renderReleaseNotes(release));
});

test('published retries preserve curated notes and do not create, update or regenerate content', async () => {
  const record = githubRecord({
    body: 'Manually curated beta notes and corrected main usage guide.',
  });
  const fake = fakeNotesRelease(record);
  assert.equal(await publishNotesRelease(release, fake.operations), record);
  assert.deepEqual(fake.calls, ['find']);
  const attached = fakeNotesRelease(githubRecord({ assets: [{ name: 'legacy.tgz' }] }));
  await assert.rejects(publishNotesRelease(release, attached.operations), /manually remove/);
  assert.deepEqual(attached.calls, ['find']);
  const wrong = fakeNotesRelease(githubRecord({ tag_name: 'v0.1.0-beta.2' }));
  await assert.rejects(publishNotesRelease(release, wrong.operations), /unexpected tag/);
  assert.deepEqual(wrong.calls, ['find']);
});

test('draft retries preserve manually edited notes and stable publication never rolls latest backward', async () => {
  const draft = fakeNotesRelease(githubRecord({ draft: true, body: 'Edited draft notes.' }));
  const result = await publishNotesRelease(release, draft.operations);
  assert.equal(result.body, 'Edited draft notes.');
  assert.deepEqual(draft.calls, ['find', 'latest', 'update', 'read']);
  for (const [latestTag, expectedLatest] of [
    ['v0.3.0', 'false'],
    ['v0.1.0', 'true'],
  ] as const) {
    const stable = parseReleaseTag('v0.2.0');
    const fake = fakeNotesRelease(
      githubRecord({ tag_name: stable.tag, prerelease: false, draft: true }),
    );
    fake.operations.latest = async () => githubRecord({ tag_name: latestTag, prerelease: false });
    await publishNotesRelease(stable, fake.operations);
    assert.equal(fake.updates[0].make_latest, expectedLatest);
    assert.equal(fake.updates[0].prerelease, false);
  }
  const wrongRead = fakeNotesRelease();
  wrongRead.operations.read = async () => githubRecord({ tag_name: 'v9.0.0' });
  await assert.rejects(publishNotesRelease(release, wrongRead.operations), /unexpected tag/);
});

test('GitHub workflow uses current tooling with tagged cwd and no release artifact download', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8',
  );
  const [beforeGitHub, github] = workflow.split('\n  github:');
  assert.match(beforeGitHub, /actions\/upload-artifact@/);
  assert.match(beforeGitHub, /actions\/download-artifact@/);
  assert.match(github, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.match(github, /working-directory: release-source/);
  assert.match(github, /node \.\.\/release-tools\/scripts\/release\.mjs github/);
  assert.doesNotMatch(github, /download-artifact|dist\/release|release upload/);
});

test('release discovery resumes a draft after the published-tag endpoint returns 404', async () => {
  const draft = { id: 42, tag_name: release.tag, draft: true };
  const calls: string[] = [];
  const api = async (path: string, missing?: boolean) => {
    calls.push(path);
    if (path.startsWith('releases/tags/')) {
      assert.equal(missing, true);
      return null;
    }
    if (path.endsWith('page=1'))
      return Array.from({ length: 100 }, (_, i) => ({
        id: i + 100,
        tag_name: `v1.0.${i}`,
        draft: false,
      }));
    assert.equal(path, 'releases?per_page=100&page=2');
    return [draft];
  };
  assert.deepEqual(await findGitHubRelease(release.tag, api), draft);
  assert.deepEqual(calls, [
    `releases/tags/${release.tag}`,
    'releases?per_page=100&page=1',
    'releases?per_page=100&page=2',
  ]);
  assert.equal(
    await findGitHubRelease(release.tag, async (path) =>
      path.startsWith('releases/tags/') ? null : [],
    ),
    null,
  );
  assert.deepEqual(await findGitHubRelease(release.tag, async () => draft), draft);
  await assert.rejects(
    findGitHubRelease(release.tag, async (path) =>
      path.startsWith('releases/tags/') ? null : [draft, draft],
    ),
    /Multiple GitHub releases/,
  );
  await assert.rejects(
    findGitHubRelease(release.tag, async (path) => {
      assert.equal(path, `releases/tags/${release.tag}`);
      throw new Error('HTTP 403');
    }),
    /HTTP 403/,
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
