import { readdir, readFile, writeFile, mkdir, copyFile, lstat } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ada = resolve(process.env.ADA_SOURCE ?? join(root, '../ada'));
const load = file => import(pathToFileURL(join(ada, 'packages/plugins/src', file)).href);
const [{ canonical, digest, packagePath }, { validateManifest }, { encodeArchive }] = await Promise.all([load('identity.ts'), load('manifest.ts'), load('archive.ts')]);
const packages = [];
await mkdir(join(root, 'packages/releases'), { recursive: true });
for (const name of (await readdir(join(root, 'packages'))).sort()) {
  if (name === 'releases') continue;
  const source = join(root, 'packages', name), files = new Map();
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name), stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error('Package links are not supported.');
      if (stat.isDirectory()) { await walk(path); continue; }
      const local = relative(source, path).replaceAll('\\', '/');
      if (local === 'ada-plugin.template.json') continue;
      packagePath(local); files.set(local, await readFile(path));
    }
  }
  await walk(source);
  const template = JSON.parse(await readFile(join(source, 'ada-plugin.template.json'), 'utf8'));
  const manifest = validateManifest({ ...template, files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({ path, bytes: content.length, sha256: digest(content) })) });
  const output = join(root, 'dist', name); await mkdir(output, { recursive: true });
  for (const [path] of files) { await mkdir(dirname(join(output, path)), { recursive: true }); await copyFile(join(source, path), join(output, path)); }
  await writeFile(join(output, 'ada-plugin.json'), canonical(manifest));
  const archive = encodeArchive(manifest, files), filename = `${manifest.id}-${manifest.version}.ada-plugin`;
  const published = join(root, 'packages/releases', filename);
  const previous = await readFile(published).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (previous && digest(previous) !== digest(archive)) throw new Error(`${filename} changed. Publish a new package version.`);
  await writeFile(published, archive);
  packages.push({ id: manifest.id, version: manifest.version, name: manifest.name, description: manifest.description, ...(manifest.author ? { author: manifest.author } : {}), url: `https://raw.githubusercontent.com/zF4ke/ada-plugins/main/packages/releases/${filename}`, sha256: digest(archive), bytes: archive.length });
}
await writeFile(join(root, 'catalog.json'), JSON.stringify({ format: 1, id: 'zf4ke.ada-plugins', packages }, null, 2) + '\n');
console.log(`Validated and packaged ${packages.length} plugins.`);
