export function buildInputFiles(root: string): Promise<string[]>;
export function regularFilePath(root: string, file: string): Promise<string>;
export function buildFingerprint(root: string): Promise<string>;
export function sha256(path: string): Promise<string>;
export function releaseTimestamp(epoch?: string): string;
export function claimArtifactName(claimed: Set<string>, name: string): string;
export function collectDependencyLicenses(
  root: string,
): Promise<{ file: string; source: Buffer }[]>;
export interface ReleaseManifest {
  schemaVersion: 2;
  generatedAt: string;
  packages: Record<'core' | 'qr', { name: string; version: string; file: string; sha256: string }>;
  files: Record<
    'artwork' | 'coreModule' | 'qrModule' | 'vectors' | 'algorithm' | 'notices',
    string
  >;
  integrity: Record<string, string>;
  buildFingerprint: string;
}
export function readReleaseManifest(root: string): Promise<ReleaseManifest>;
