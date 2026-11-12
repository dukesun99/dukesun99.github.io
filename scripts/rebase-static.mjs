// Adapts a finished build to where it is hosted, without touching scripts/build-publications.mjs.
// Does nothing unless one of these is set:
//   VITE_BASE  sub-path the site is served from (GitHub Pages project sites): prefixes the
//              root-relative links in the generated publication pages.
//   SITE_URL   origin this copy should present as its own (canonical links, sitemap, robots.txt,
//              structured data, citation metadata), replacing the default https://www.dukesun99.link.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SITE = 'https://www.dukesun99.link';
const base = process.env.VITE_BASE || '/';
const site = (process.env.SITE_URL || '').replace(/\/$/, '');
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const papers = readdirSync(resolve(dist, 'papers')).filter((f) => f.endsWith('.html')).map((f) => resolve(dist, 'papers', f));
const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));

if (base !== '/') {
  const pages = [resolve(dist, 'publications.html'), ...papers];
  pages.forEach((f) => edit(f, (s) => s.replace(/(href|src)="\/(?!\/)/g, `$1="${base}`)));
  console.log(`rebased ${pages.length} static pages onto ${base}`);
}
if (site && site !== DEFAULT_SITE) {
  const files = ['index.html', 'publications.html', 'sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt'].map((f) => resolve(dist, f)).concat(papers);
  let n = 0;
  files.forEach((f) => edit(f, (s) => { n += s.split(DEFAULT_SITE).length - 1; return s.replaceAll(DEFAULT_SITE, site); }));
  console.log(`pointed ${n} URLs in ${files.length} files at ${site}`);
}
