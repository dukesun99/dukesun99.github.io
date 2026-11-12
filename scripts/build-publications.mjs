// Generates, from src/data/publications.json, after `vite build`:
//   dist/publications.html      plain-HTML publication list
//   dist/papers/<id>.html       one page per paper with Google Scholar (Highwire) meta tags,
//                               abstract, links and a ScholarlyArticle JSON-LD block
//   dist/sitemap.xml
// PDFs live in public/papers/<id>.pdf and are copied to dist/ by Vite.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = 'https://www.dukesun99.link';
const pubs = JSON.parse(readFileSync(resolve(root, 'src/data/publications.json'), 'utf8'));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (href, label) => (href ? `<a href="${esc(href)}" rel="noopener">${label}</a>` : '');
const abs = (u) => (u && u.startsWith('/') ? site + u : u);
const authorNames = (p) => p.authors.replace(/[†✉]|\((†|✉)[^)]*\)/g, '').split(',').map((a) => a.trim()).filter(Boolean);
const pageUrl = (p) => `${site}/papers/${p.id}`;
// Google Scholar accepts YYYY or YYYY/MM/DD. Published papers use the venue year; preprints their posting date.
const scholarDate = (p) => (p.status === 'preprint' && p.published ? p.published.replace(/-/g, '/') : p.year);

const buttons = (p) => [
  link(p.pdfUrl, 'PDF'),
  link(p.paperUrl, 'Paper'),
  link(p.codeUrl, 'Code'),
  link(p.modelUrl, 'Model'),
  link(p.demoUrl, 'Demo'),
  link(p.posterUrl, 'Poster'),
  link(p.videoUrl, 'Video'),
  link(p.notesUrl, 'Notes'),
  link(p.bibtexUrl, 'BibTeX'),
].filter(Boolean).join(' · ');

const ids = (p) => [
  p.doi ? `DOI <a href="https://doi.org/${esc(p.doi)}">${esc(p.doi)}</a>` : '',
  p.arxiv ? `arXiv <a href="https://arxiv.org/abs/${esc(p.arxiv)}">${esc(p.arxiv)}</a>` : '',
].filter(Boolean).join(' · ');

const ranks = (p) => (p.rank || []).map((r) => `<span class="rank">${esc(r)}</span>`).join(' ');

const css = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0a0a0a; color: #e5e7eb; font: 16px/1.55 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  main { max-width: 56rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  a { color: #4ade80; } a:hover { color: #86efac; }
  h1 { color: #4ade80; font-size: 1.75rem; margin: 0 0 .25rem; line-height: 1.3; }
  h2 { color: #60a5fa; font-size: 1.15rem; margin: 2.25rem 0 .75rem; border-bottom: 1px solid #1f2937; padding-bottom: .35rem; }
  h3 { font-size: 1.02rem; margin: 0 0 .2rem; color: #fff; } h3 a { color: #fff; text-decoration: none; } h3 a:hover { text-decoration: underline; }
  ol { list-style: none; padding: 0; margin: 0; } li { padding: .9rem 0; border-bottom: 1px solid #111827; }
  p { margin: .15rem 0; } .authors { color: #9ca3af; font-size: .93rem; } .venue { color: #a7f3d0; font-size: .9rem; } .links { font-size: .9rem; }
  .intro, .note { color: #9ca3af; } nav { font-size: .9rem; color: #6b7280; }
  .rank { display: inline-block; font-size: .72rem; padding: .05rem .4rem; border: 1px solid #eab308; color: #fde68a; border-radius: .2rem; margin-left: .25rem; vertical-align: middle; }
  .abstract { margin-top: 1.25rem; line-height: 1.65; }
`;

const head = (title, description, canonical, extra = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
${extra}
<style>${css}</style>
</head>`;

// ---------- per-paper pages ----------
const paperMeta = (p) => {
  const m = [];
  const tag = (name, content) => content && m.push(`<meta name="${name}" content="${esc(content)}">`);
  tag('citation_title', p.title);
  authorNames(p).forEach((a) => tag('citation_author', a));
  tag('citation_publication_date', scholarDate(p));
  if (p.published) tag('citation_online_date', p.published.replace(/-/g, '/'));
  if (p.kind === 'conference') tag('citation_conference_title', p.scholarVenue || p.venue);
  if (p.kind === 'journal') tag('citation_journal_title', p.scholarVenue || p.venue);
  tag('citation_volume', p.volume);
  tag('citation_issue', p.issue);
  tag('citation_firstpage', p.firstpage);
  tag('citation_lastpage', p.lastpage);
  tag('citation_doi', p.doi);
  tag('citation_arxiv_id', p.arxiv);
  tag('citation_pdf_url', abs(p.pdfUrl));
  tag('citation_abstract_html_url', pageUrl(p));
  tag('citation_language', 'en');
  return m.join('\n');
};

const paperJsonLd = (p) => JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'ScholarlyArticle',
  headline: p.title,
  name: p.title,
  author: authorNames(p).map((name) => ({ '@type': 'Person', name })),
  datePublished: p.published || p.year,
  abstract: p.abstract,
  isPartOf: { '@type': p.kind === 'journal' ? 'Periodical' : 'PublicationEvent', name: p.scholarVenue || p.venue },
  url: pageUrl(p),
  sameAs: [p.paperUrl, p.doi && `https://doi.org/${p.doi}`, p.arxiv && `https://arxiv.org/abs/${p.arxiv}`].filter(Boolean),
  identifier: [p.doi && `https://doi.org/${p.doi}`, p.arxiv && `arXiv:${p.arxiv}`].filter(Boolean),
  ...(p.pdfUrl ? { encoding: { '@type': 'MediaObject', contentUrl: abs(p.pdfUrl), encodingFormat: 'application/pdf' } } : {}),
  ...(p.codeUrl ? { codeRepository: p.codeUrl } : {}),
});

const paperPage = (p) => `${head(
  `${p.title} — Yiqun Sun`,
  (p.abstract || p.title).slice(0, 300),
  pageUrl(p),
  paperMeta(p) + `\n<script type="application/ld+json">${paperJsonLd(p)}</script>`,
)}
<body>
<main>
  <nav><a href="/">← dukesun99.link</a> · <a href="/publications">Publications</a></nav>
  <h1>${esc(p.title)}</h1>
  <p class="authors">${esc(p.authors)}</p>
  <p class="venue">${esc(p.venue)}, ${esc(p.year)} ${ranks(p)}${ids(p) ? ` · ${ids(p)}` : ''}</p>
  <p class="links">${buttons(p)}</p>
  ${p.abstract ? `<h2>Abstract</h2><p class="abstract">${esc(p.abstract)}</p>` : ''}
  ${p.pdfNote ? `<p class="note">${esc(p.pdfNote)}</p>` : ''}
  ${p.pdfUrl ? `<p class="note">Full text: <a href="${esc(p.pdfUrl)}">${esc(abs(p.pdfUrl))}</a> (PDF)</p>` : ''}
</main>
</body>
</html>
`;

// ---------- list page ----------
const item = (p) => `
    <li id="${esc(p.id)}">
      <h3><a href="/papers/${esc(p.id)}">${esc(p.title)}</a></h3>
      <p class="authors">${esc(p.authors)}</p>
      <p class="venue">${esc(p.venue)}, ${esc(p.year)} ${ranks(p)}${ids(p) ? ` · ${ids(p)}` : ''}</p>
      <p class="links">${buttons(p)}</p>
    </li>`;

const section = (title, list) => (list.length ? `
  <h2>${title}</h2>
  <ol>${list.map(item).join('')}
  </ol>` : '');

const published = pubs.filter((p) => p.status === 'published');
const preprints = pubs.filter((p) => p.status === 'preprint');

const listJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Publications of Yiqun Sun',
  url: `${site}/publications`,
  itemListElement: pubs.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: pageUrl(p), name: p.title })),
};

const listPage = `${head(
  'Publications — Yiqun Sun',
  'Publications of Yiqun Sun (MTRI, Singapore): papers at ICML, ACL, EMNLP, ICLR, AAAI and VLDB on text embeddings, multimodal document retrieval, LLM agents, and bias mitigation in vision-language models, with PDFs, code, models, posters, and BibTeX.',
  `${site}/publications`,
  `<script type="application/ld+json">${JSON.stringify(listJsonLd)}</script>`,
)}
<body>
<main>
  <nav><a href="/">← dukesun99.link</a> · <a href="https://github.com/dukesun99">GitHub</a> · <a href="https://scholar.google.com/citations?user=maniV5gAAAAJ">Google Scholar</a></nav>
  <h1>Publications — Yiqun Sun</h1>
  <p class="intro">Research Scientist, Magellan Technology Research Institute (MTRI), Singapore. Each title links to a page with the abstract and full-text PDF. Each first-author repository includes a short research-context page (claims the paper supports, placement in the literature, limitations) and a <code>CITATION.cff</code>/<code>CITATION.bib</code>. Venue labels follow the CORE 2023 and CCF 2026 rankings.</p>
  ${section('Published papers', published)}
  ${section('Preprints', preprints)}
  <p class="intro" style="margin-top:2rem">Generated from <code>src/data/publications.json</code> at build time.</p>
</main>
</body>
</html>
`;

// ---------- write ----------
const dist = resolve(root, 'dist');
mkdirSync(resolve(dist, 'papers'), { recursive: true });
writeFileSync(resolve(dist, 'publications.html'), listPage);
pubs.forEach((p) => writeFileSync(resolve(dist, 'papers', `${p.id}.html`), paperPage(p)));
const today = new Date().toISOString().slice(0, 10);
// Sitemap: home, list page, every paper page, and every hosted PDF (Google indexes PDFs as documents).
const urls = [
  `${site}/`,
  `${site}/publications`,
  ...pubs.map(pageUrl),
  ...pubs.filter((p) => p.pdfUrl).map((p) => abs(p.pdfUrl)),
];
writeFileSync(resolve(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`);
// llms.txt (https://llmstxt.org): a Markdown index for LLM crawlers and agent tools; llms-full.txt adds abstracts.
const md = (p, full) => {
  const links = [
    p.pdfUrl && `[PDF](${abs(p.pdfUrl)})`, p.paperUrl && `[Publisher/arXiv](${p.paperUrl})`, p.codeUrl && `[Code](${p.codeUrl})`,
    p.modelUrl && `[Model](${p.modelUrl})`, p.notesUrl && `[Research notes](${p.notesUrl})`, p.bibtexUrl && `[BibTeX](${p.bibtexUrl})`,
  ].filter(Boolean).join(' · ');
  const idl = [p.doi && `doi:${p.doi}`, p.arxiv && `arXiv:${p.arxiv}`].filter(Boolean).join(', ');
  return `- [${p.title}](${pageUrl(p)}) — ${p.authors}. ${p.venue}, ${p.year}${idl ? ` (${idl})` : ''}. ${links}` +
    (full && p.abstract ? `\n\n  ${p.abstract}\n` : '');
};
const llms = (full) => `# Yiqun Sun

> Research Scientist at the Magellan Technology Research Institute (MTRI), Singapore; PhD, National University of Singapore. Research on interpretable and implicit-semantics text embeddings, multimodal document reranking, agent knowledge access, and bias mitigation in vision-language models.

- Website: ${site}/
- Publication list (HTML): ${site}/publications
- GitHub: https://github.com/dukesun99
- Google Scholar: https://scholar.google.com/citations?user=maniV5gAAAAJ

Each paper below has its own page with abstract, full-text PDF, and citation metadata. First-author repositories also carry docs/research-context.md (supported claims, placement in the literature, limitations) and CITATION.cff.

## Published papers

${published.map((p) => md(p, full)).join('\n')}

## Preprints

${preprints.map((p) => md(p, full)).join('\n')}
`;
writeFileSync(resolve(dist, 'llms.txt'), llms(false));
writeFileSync(resolve(dist, 'llms-full.txt'), llms(true));
console.log(`publications.html: ${published.length} published, ${preprints.length} preprints; ${pubs.length} paper pages; sitemap with ${urls.length} URLs; llms.txt + llms-full.txt`);
