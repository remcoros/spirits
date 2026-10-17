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
export function validateGitHubAssets(assets: { name: string }[], files: string[]): void;
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
