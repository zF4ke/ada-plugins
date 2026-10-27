import { readdir, readFile, writeFile, mkdir, copyFile, lstat, cp, rm } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ada = resolve(process.env.ADA_SOURCE ?? join(root, '../ada'));
const load = file => import(pathToFileURL(join(ada, 'packages/plugins/src', file)).href);
const [{ canonical, digest, packagePath }, { validateManifest }, { encodeArchive }] = await Promise.all([load('identity.ts'), load('manifest.ts'), load('archive.ts')]);
const { compilePlugin } = await import(pathToFileURL(join(ada, 'packages/plugins/build.mjs')).href);
const sources = await readdir(join(root, 'src'), { withFileTypes: true }), selected = new Set(process.argv.slice(2));
for (const name of selected) if (!sources.some(entry => entry.isDirectory() && entry.name === name)) throw new Error(`Unknown plugin source: ${name}`);
for (const entry of sources) {
  if (!entry.isDirectory()) continue;
  if (selected.size && !selected.has(entry.name)) continue;
  const output = resolve(root, 'dist', 'compiled-' + entry.name);
  if (!output.startsWith(resolve(root, 'dist') + '/'.replace('/', process.platform === 'win32' ? '\\' : '/'))) throw new Error('Invalid generated package path.');
  await rm(output, { recursive: true, force: true });
  await compilePlugin(join(root, 'src', entry.name), output);
  const destination = resolve(root, 'packages', entry.name);
  if (dirname(destination) !== resolve(root, 'packages')) throw new Error('Invalid package destination.');
  await rm(destination, { recursive: true, force: true });
  await cp(output, destination, { recursive: true });
}
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
      if (local === 'ada-plugin.template.json' || local === 'ada-plugin.json') continue;
      packagePath(local); files.set(local, await readFile(path));
    }
  }
  await walk(source);
  const templateBytes = await readFile(join(source, 'ada-plugin.template.json'), 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; });
  const manifest = templateBytes === undefined
    ? validateManifest(JSON.parse(await readFile(join(source, 'ada-plugin.json'), 'utf8')))
    : validateManifest({ ...JSON.parse(templateBytes), files: [...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, content]) => ({ path, bytes: content.length, sha256: digest(content) })) });
  if (manifest.files.length !== files.size || manifest.files.some(item => !files.has(item.path) || item.bytes !== files.get(item.path).length || item.sha256 !== digest(files.get(item.path)))) throw new Error(`${name} does not match its sealed inventory.`);
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
