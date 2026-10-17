export const REPOSITORY: string;
export const REGISTRY: string;
export const PACKAGE_NAMES: string[];
export interface Release {
  tag: string;
  version: string;
  channel: 'next' | 'latest';
  prerelease: boolean;
}
export interface ReleasePackage {
  name: string;
  version: string;
  integrity: string;
}
export interface PublishedPackage {
  name: string;
  version: string;
  dist: { integrity: string; tarball?: string };
}
export interface PublishOperations {
  lookup(pkg: ReleasePackage): Promise<PublishedPackage | null>;
  publish(pkg: ReleasePackage): unknown | Promise<unknown>;
  wait?(ms: number): Promise<unknown>;
  verifyConsumer(packages: ReleasePackage[]): Promise<unknown>;
  getTag(pkg: ReleasePackage, channel: string): Promise<string | undefined>;
  promote(pkg: ReleasePackage, channel: string): Promise<unknown>;
  removePending(pkg: ReleasePackage): Promise<unknown>;
}
export function parseReleaseTag(tag: string): Release;
export function compareVersions(left: string, right: string): number;
export function validateVersions(release: Release, root: any, core: any, qr: any, lock: any): void;
export function validateCheckout(
  root: string,
  tag: string,
  env?: NodeJS.ProcessEnv,
): Promise<Release & { commit: string }>;
export function tarballIntegrity(bytes: Buffer): string;
export function requireMatchingVersion(
  pkg: ReleasePackage,
  published: PublishedPackage | null,
): void;
export interface GitHubRelease {
  id: number;
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  assets: { name: string }[];
  body: string | null;
}
export interface ReleaseNotesContext {
  previousTag?: string | null;
  generatedNotes?: string;
  commits?: { sha: string; subject: string }[];
}
export function validateNotesOnlyRelease(current: GitHubRelease | null, release: Release): void;
export function previousPublishedRelease(
  release: Release,
  releases: GitHubRelease[],
): GitHubRelease | null;
export function renderReleaseNotes(release: Release, context?: ReleaseNotesContext): string;
export interface NotesPublicationOperations {
  find(tag: string): Promise<GitHubRelease | null>;
  list(): Promise<GitHubRelease[]>;
  generateNotes(tag: string, previousTag: string | null): Promise<string>;
  changes(tag: string, previousTag: string | null): Promise<{ sha: string; subject: string }[]>;
  create(body: {
    tag_name: string;
    target_commitish?: string;
    name: string;
    body: string;
    draft: boolean;
    prerelease: boolean;
  }): Promise<GitHubRelease>;
  update(
    id: number,
    body: { body: string; draft: boolean; prerelease: boolean; make_latest: string },
  ): Promise<unknown>;
  read(id: number): Promise<GitHubRelease>;
  latest(): Promise<GitHubRelease | null>;
}
export function publishNotesRelease(
  release: Release & { commit?: string },
  operations: NotesPublicationOperations,
): Promise<GitHubRelease>;
export function findGitHubRelease<T extends { tag_name: string }>(
  tag: string,
  api: (path: string, missing?: boolean) => Promise<T | T[] | null>,
): Promise<T | null>;
export function ensurePublished(
  pkg: ReleasePackage,
  operations: Pick<PublishOperations, 'lookup' | 'publish' | 'wait'>,
): Promise<void>;
export function publishPair(
  packages: ReleasePackage[],
  release: Release,
  operations: PublishOperations,
): Promise<{ promoted: boolean; reason?: string }>;
