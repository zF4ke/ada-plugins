# Ada plugins

Themes and example plugins for [Ada](https://github.com/zF4ke/ada). Packages have explicit versions, authors, compatibility ranges and SHA-256 inventories. The catalog contains downloadable packages, with no account required.

## Install

In Ada, open **Settings > Plugins > Browse** and enter this catalog URL:

```text
https://raw.githubusercontent.com/zF4ke/ada-plugins/main/catalog.json
```

Choose a package, then its destination. Themes run in the desktop app. Executable packages start disabled, and enabling them asks for their declared access. A theme's **Use theme** action applies its colors directly.

The theme packages currently require the experimental Ada 0.16.2 build. They do not support stable Ada 0.16.1. Read each package's compatibility range before installing.

| Package | Runs in | Purpose |
| --- | --- | --- |
| Orchid | Desktop app | Violet accents on Ada's dark appearance |
| Paper | Desktop app | Warm light appearance |
| Counter example | Ada server | A local counter, sandbox Settings view and read-only task tool |

Google and Discord currently ship with Ada because their compiled interfaces are tied to its checked build. This repository does not duplicate those integration sources.

## Build packages

Use Node 24 or later and a sibling Ada source checkout with its dependencies installed:

```powershell
node scripts/build.mjs
npm test
```

For a checkout elsewhere, set `ADA_SOURCE` to its absolute path first. The build uses Ada's own manifest validator and archive encoder. It writes archives under `packages/releases`, installable folders under `dist`, and `catalog.json` at the repository root. It does not run plugin code or call a model.

Commit templates, source files, generated archives and the catalog together. Change a package's version whenever its bytes change. Keep older published archives available because an installed package refers to exact bytes. Publish catalog changes only after checking installation in a disposable Ada profile.

## Develop a plugin

Start with [Ada's plugin development guide](https://github.com/zF4ke/ada/blob/master/docs/guide/plugins-development.md), which defines the manifest, grants, settings, views, source patches and update lifecycle. The counter is a small working example. Plugin settings belong to their own package.

Package authorship is attribution, not publisher verification. Executable packages run with the owner's account authority. Review their source and requested access before enabling them. The package manifests retain their declared licenses.
