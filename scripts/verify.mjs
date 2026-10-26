import { mkdtemp, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ada = resolve(process.env.ADA_SOURCE ?? join(root, '../ada'));
const { PluginPackages } = await import(pathToFileURL(join(ada, 'packages/plugins/src/acquisition.ts')).href);
const { canonical, digest } = await import(pathToFileURL(join(ada, 'packages/plugins/src/identity.ts')).href);
const provenance = JSON.parse(await readFile(join(root, 'bundled-packages.json'), 'utf8'));
const home = await mkdtemp(join(tmpdir(), 'Ada plugin catalog verification '));
try {
  const packages = new PluginPackages(home, { fetch: async url => {
    const path = new URL(url).pathname.replace('/zF4ke/ada-plugins/main/', '');
    assert.ok(path === 'catalog.json' || /^packages\/releases\/[a-z0-9.-]+\.ada-plugin$/.test(path));
    return new Response(await readFile(join(root, path)));
  } });
  const url = 'https://raw.githubusercontent.com/zF4ke/ada-plugins/main/catalog.json';
  const catalog = await packages.catalog(url, new AbortController().signal);
  for (const entry of catalog.packages) {
    const installed = await packages.acquire({ kind: 'catalog', catalog: url, id: entry.id, version: entry.version }, new AbortController().signal);
    const checked = await packages.inspect(installed.reference);
    assert.equal(checked.manifest.id, entry.id);
    assert.equal(checked.manifest.version, entry.version);
    assert.equal(checked.integrity, 'verified');
    const bundled = provenance.packages.find(item => item.id === entry.id);
    if (bundled && checked.manifest.version === bundled.version) {
      assert.equal(checked.manifest.version, bundled.version);
      assert.equal(digest(canonical(checked.manifest)), bundled.manifestSha256);
    }
  }
  const { decodeArchive } = await import(pathToFileURL(join(ada, 'packages/plugins/src/archive.ts')).href);
  for (const name of await readdir(join(root, 'packages/releases'))) { if (!name.endsWith('.ada-plugin')) continue; const archive = decodeArchive(await readFile(join(root, 'packages/releases', name))); assert.equal(name, `${archive.manifest.id}-${archive.manifest.version}.ada-plugin`); }
  console.log(`Verified catalog acquisition and installed inventories for ${catalog.packages.length} packages.`);
} finally {
  await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
