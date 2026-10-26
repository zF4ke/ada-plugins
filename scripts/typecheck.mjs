import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), ada = resolve(process.env.ADA_SOURCE ?? join(root, '../ada'));
const types = join(ada, 'node_modules/@types'), sdk = join(ada, 'packages/plugin-sdk/src');
const config = { compilerOptions: { target: 'ES2024', lib: ['ES2024', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx', strict: true, noUncheckedIndexedAccess: true, noUnusedLocals: true, noUnusedParameters: true, allowImportingTsExtensions: true, noEmit: true, skipLibCheck: true, esModuleInterop: true, typeRoots: [types], types: ['node'], paths: {
  '@ada/plugin-sdk/server': [join(sdk, 'server.ts')], '@ada/plugin-sdk/security': [join(sdk, 'security.ts')], '@ada/plugin-sdk/ui': [join(sdk, 'ui-contract.d.ts')],
  '@streamparser/json': [join(ada, 'node_modules/@streamparser/json/dist/mjs/index.d.ts')], react: [join(types, 'react/index.d.ts')], 'react/*': [join(types, 'react/*')],
} }, include: [join(root, 'src/**/*.ts'), join(root, 'src/**/*.tsx')], files: [join(ada, 'apps/desktop/src/renderer/assets.d.ts')] };
await mkdir(join(root, 'dist'), { recursive: true });
const path = join(root, 'dist/typecheck.json'); await writeFile(path, JSON.stringify(config));
execFileSync(process.execPath, [join(ada, 'node_modules/typescript/bin/tsc'), '--project', path], { cwd: root, windowsHide: true, stdio: 'inherit' });
