// Renders the page's content to static HTML and writes it into dist/index.html, so crawlers and
// readers without JavaScript or WebGL get the full text, headings and links. The browser then
// hydrates this markup and starts the 3D world on top of it.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { default: App } = await vite.ssrLoadModule('/src/App.tsx');
  const html = renderToString(createElement(App));
  const file = resolve(root, 'dist/index.html');
  const page = readFileSync(file, 'utf8');
  const slot = '<div id="root"></div>';
  if (!page.includes(slot)) throw new Error('dist/index.html has no empty #root to fill');
  writeFileSync(file, page.replace(slot, `<div id="root">${html}</div>`));
  console.log(`index.html: prerendered ${html.length} bytes of content`);
} finally {
  await vite.close();
}
