import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { verifySourcemaps } from './verify-production-build.mjs';

const requiredSource = 'src/main.tsx';

async function createFixture({
  sourceMappingUrl = 'index.js.map',
  mappings = 'AAAA',
  sources = [`../../${requiredSource}`],
  sourcesContent = ['throw Error();'],
} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'sourcemap-verifier-'));
  const assets = path.join(root, 'assets');
  await mkdir(assets);
  const comment = sourceMappingUrl
    ? `\n//# sourceMappingURL=${sourceMappingUrl}`
    : '';
  await writeFile(path.join(assets, 'index.js'), `throw Error();${comment}`);
  await writeFile(
    path.join(assets, 'index.js.map'),
    JSON.stringify({
      version: 3,
      file: 'index.js',
      sources,
      sourcesContent,
      names: [],
      mappings,
    }),
  );
  return root;
}

test('accepts a linked sourcemap with mappings and embedded sources', async () => {
  const root = await createFixture();
  await verifySourcemaps('', root, [requiredSource], {
    source: requiredSource,
    marker: 'throw Error();',
  });
});

test('rejects a hidden sourcemap without a sourceMappingURL', async () => {
  const root = await createFixture({ sourceMappingUrl: null });
  await assert.rejects(
    verifySourcemaps('', root, [requiredSource]),
    /does not reference its sourcemap/,
  );
});

test('rejects a sourcemap with empty mappings', async () => {
  const root = await createFixture({ mappings: '' });
  await assert.rejects(
    verifySourcemaps('', root, [requiredSource]),
    /has no mappings/,
  );
});

test('rejects a source-resolution warning in the build log', async () => {
  const root = await createFixture();
  await assert.rejects(
    verifySourcemaps(
      'Sourcemap for dependency.js points to missing source files',
      root,
      [requiredSource],
    ),
    /source-resolution warning/,
  );
});

test('rejects malformed mappings', async () => {
  const root = await createFixture({ mappings: '!!!!' });
  await assert.rejects(
    verifySourcemaps('', root, [requiredSource], {
      source: requiredSource,
      marker: 'throw Error();',
    }),
    /has no mappings|unusable mappings|trace marker mapped/,
  );
});

test('rejects a mapping to the wrong original source', async () => {
  const root = await createFixture({
    mappings: 'ACAA',
    sources: [`../../${requiredSource}`, '../../src/wrong.ts'],
    sourcesContent: ['throw Error();', 'throw Error();'],
  });
  await assert.rejects(
    verifySourcemaps('', root, [requiredSource], {
      source: requiredSource,
      marker: 'throw Error();',
    }),
    /trace marker mapped to .*wrong\.ts/,
  );
});