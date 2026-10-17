import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
for (const name of ['core', 'qr']) {
  await build({
    entryPoints: [`packages/${name}/src/index.ts`],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    outfile: `packages/${name}/dist/spirits-${name}.mjs`,
    minify: true,
    legalComments: 'eof',
    banner: {
      js: `/*! SPirits ${name}: code MIT; original artwork CC0-1.0.\n${await readFile('LICENSE', 'utf8')}*/`,
    },
  });
}
