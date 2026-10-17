export function sourceFiles(root: string): Promise<string[]>;
export function sourcePath(root: string, file: string): Promise<string>;
export function sourceFingerprint(root: string): Promise<string>;
export function createSourceArchive(root: string, output: string): Promise<string[]>;
export function validateMarkdownLinks(root: string, files: string[]): Promise<number>;
export function sha256(path: string): Promise<string>;
export interface DownloadManifest {
  schemaVersion: 1;
  packages: Record<'core' | 'qr', { name: string; version: string; file: string; sha256: string }>;
  files: Record<'source' | 'guide' | 'artwork' | 'coreModule' | 'qrModule' | 'vectors', string>;
  integrity: Record<string, string>;
  buildFingerprint: string;
}
export function readDownloadManifest(root: string): Promise<DownloadManifest>;
export function renderIntegrationGuide(
  readme: string,
  packages: Record<'core' | 'qr', { file: string }>,
): string;
