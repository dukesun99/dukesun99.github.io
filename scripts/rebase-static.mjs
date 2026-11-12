// Only for hosting under a sub-path (e.g. a GitHub Pages project site). The generated publication
// pages use root-relative links; this prefixes them with VITE_BASE. It does nothing at the domain root,
// and leaves scripts/build-publications.mjs itself untouched.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.VITE_BASE || '/';
if (base === '/') process.exit(0);
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const files = [resolve(dist, 'publications.html'), ...readdirSync(resolve(dist, 'papers')).filter((f) => f.endsWith('.html')).map((f) => resolve(dist, 'papers', f))];
for (const f of files) writeFileSync(f, readFileSync(f, 'utf8').replace(/(href|src)="\/(?!\/)/g, `$1="${base}`));
console.log(`rebased ${files.length} static pages onto ${base}`);
