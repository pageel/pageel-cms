# @pageel/cms

Astro integration for [Pageel CMS](https://pageel.app) — add a `/cms` admin route to your Astro site.

## Installation

```bash
npx astro add @pageel/cms
```

Or manually:

```bash
npm install @pageel/cms
```

```js
// astro.config.mjs
import pageelCms from '@pageel/cms';

export default defineConfig({
  integrations: [pageelCms()]
});
```

## Features

- 🔄 **Auto-detect** content collections from `src/content/`
- 📝 **Auto-generate** `.pageelrc.json` with detected collections
- 🔗 **Inject /cms route** → redirects to Pageel CMS backend
- ⚙️ **Zero config** — works out of the box

## Options

```js
pageelCms({
  cmsUrl: 'https://cms.pageel.app',  // CMS backend URL
  adminRoute: '/cms',                 // Admin route path
  autoConfig: true,                   // Auto-generate .pageelrc.json
  contentDir: 'src/content',          // Content directory to scan
})
```

## How it works

1. Scans `src/content/` for subdirectories (= Astro content collections)
2. Generates/syncs `.pageelrc.json` with detected collections
3. Adds `/cms` route that redirects to the Pageel CMS backend
4. Your CMS reads `.pageelrc.json` to know which collections to manage

## License

MIT
