# dukesun99.link — 3D edition

Personal academic website of Yiqun Sun. One continuous, scroll-driven flight through a small
WebGL world (cloud sea → valley → night sky → lake), with the page's text placed in the same
3D space as real, selectable DOM.

- `src/world/world.ts` — the scene: terrain, forest, volumetric clouds, water, sky, lighting through the day.
- `src/world/journey.ts` — the camera path and where each block of content stands in the world.
- `src/data/site.ts`, `src/data/publications.json` — all content.
- `scripts/prerender.mjs` — writes the content into `dist/index.html` as static HTML at build time, for crawlers and no-JS readers.
- `scripts/build-publications.mjs` — generates `/publications`, `/papers/<id>`, `sitemap.xml` and `llms.txt` from the same JSON.

```bash
npm ci
npm run dev      # local development
npm run build    # type-check, bundle, prerender, generate publication pages into dist/
```
