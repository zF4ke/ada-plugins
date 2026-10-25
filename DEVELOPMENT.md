# Create an Ada plugin

Start with [Ada's plugin development guide](https://github.com/zF4ke/ada/blob/master/docs/guide/plugins-development.md) for contributions, grants, settings, state and source patches. The [counter](packages/counter) is a working example. Plugin configuration belongs inside the owning package.

Google and Discord are published here as exact copies of Ada's checked packages, including their compiled views and retained source. Their editable integration sources remain in Ada. [bundled-packages.json](bundled-packages.json) records the source commit and manifest digests. A compiled view must match the client build; publishing its archive does not bypass that check.

## Build and check

Use Node 24 or later and a sibling Ada checkout with its dependencies installed. Set `ADA_SOURCE` to its absolute path if it lives elsewhere.

```powershell
npm run build
npm test
```

The build uses Ada's own manifest validator and archive encoder. It writes archives under `packages/releases`, installable folders under `dist`, and `catalog.json`. The test acquires that catalog into a disposable home and verifies the installed file inventories. Neither command runs plugin code or a model.

Commit templates, source files, archives and the catalog together. Change the package version whenever its bytes change. The build rejects changed bytes for an already published archive. Keep older archives available because installations refer to exact versions and digests.

For the bundled connections, copy the complete package directory from the matching checked Ada release under `resources/server/plugins`. Preserve its `ada-plugin.json` and every inventoried byte. Update the provenance file, then run the same build and verification commands. The repository stores those immutable directories without line-ending conversion.

Before publishing, test the package's actions, settings, enable/disable and update behavior in an isolated Ada profile with fake services. Executable packages run with the owner's account authority. Authorship is attribution, not publisher verification. Each manifest retains its declared license.
