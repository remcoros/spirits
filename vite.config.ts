import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collectDependencyLicenses } from './scripts/distribution.mjs';

async function legalNotices() {
  const notices: { file: string; source: Buffer }[] = await Promise.all(
    [
      ['LICENSE', 'LICENSE'],
      ['ASSET-LICENSE', 'ASSET-LICENSE'],
      ['THIRD-PARTY.md', 'THIRD-PARTY.md'],
      ['packages/qr/THIRD-PARTY.md', 'notices/qr-encoder.md'],
      ['spec/bip352-source.json', 'notices/bip352-source.json'],
    ].map(async ([source, file]) => ({ file, source: await readFile(source) })),
  );
  for (const { file, source } of await collectDependencyLicenses(process.cwd()))
    notices.push({ file: `dependency-licenses/${file}`, source });
  return notices;
}

export default defineConfig({
  root: 'apps',
  base: './',
  publicDir: '../public',
  plugins: [
    {
      name: 'spirits-legal-notices',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const pathname = request.url?.split('?', 1)[0];
          if (
            !pathname?.startsWith('/third-party/') ||
            !['GET', 'HEAD'].includes(request.method ?? '')
          )
            return next();
          void legalNotices().then((notices) => {
            const notice = notices.find(({ file }) => pathname === `/third-party/${file}`);
            if (!notice) return next();
            response.setHeader(
              'Content-Type',
              notice.file.endsWith('.json')
                ? 'application/json; charset=utf-8'
                : 'text/plain; charset=utf-8',
            );
            response.end(request.method === 'HEAD' ? undefined : notice.source);
          }, next);
        });
      },
      async generateBundle() {
        for (const { file, source } of await legalNotices())
          this.emitFile({
            type: 'asset',
            fileName: `third-party/${file}`,
            source,
          });
      },
    },
  ],
  server: { port: 5187, strictPort: true },
  preview: { port: 4187, strictPort: true },
  build: {
    outDir: '../dist/site',
    emptyOutDir: true,
    rollupOptions: {
      input: { site: resolve('apps/index.html'), lab: resolve('apps/lab/index.html') },
    },
  },
});
