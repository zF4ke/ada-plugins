# Create an Ada plugin

Keep the integration inside its package. Ada supplies the shared SDK and checks; adding a service does not require a host registration or a core source edit.

## Build and test

Use Node 24 and an Ada 0.16.7 source checkout with dependencies installed. Set `ADA_SOURCE` to that checkout if it is not the sibling `ada` directory.

```powershell
npm run build
npm test
```

The build compiles `src/discord` and `src/google-calendar`, then inventories and packages all five plugins. Tests typecheck the independent integration source and verify catalog acquisition and every retained archive. They use no accounts or models.

## Add a package

Create `src/your-plugin` with `ada-plugin.template.json`, `build.json`, and its source and assets. `build.json` declares source entry points, for example:

```json
{ "format": 1, "server": "server/module.ts", "desktop": "desktop/index.tsx" }
```

The generic compiler builds those files and retains the source with the package. Use `@ada/plugin-sdk/server` for handlers and broker helpers, and `@ada/plugin-sdk/ui` for shared controls. Own your service types, guidance, artwork and account settings. The [development guide](https://github.com/zF4ke/ada/blob/master/docs/guide/plugins-development.md) describes contributions and grants.

`hosts` selects where the package is installed. A server integration can include a compiled settings view for its client without a second desktop installation. HTML views and ordinary server modules can install at runtime. Compiled client views need a checked build. Source patches can change core behavior and retain broader checks and conflict handling.

Change the version whenever package bytes change. Commit source, packages and catalog together. Keep published archives under `packages/releases` for GitHub history. Ada removes superseded installed copies after replacement succeeds; active or unfinished startup inputs stay available until that transition finishes.

`bundled-packages.json` records the original 1.1.0 extraction. Current integration source is maintained here. Test actions and settings with fake services in a disposable Ada profile before publishing.
