import { useMemo, useState } from 'react';
import { publications, services, shortVenue, splitAuthors, url, type Publication } from '../data/site';

// Where each topic sits in the sky. Papers settle between the topics they belong to.
const TOPIC_POS: Record<string, [number, number]> = {
  'Representation Learning': [0.3, 0.42],
  Interpretability: [0.45, 0.6],
  'Diversified Retrieval': [0.7, 0.74],
  'Political Analysis': [0.5, 0.86],
  'Information Retrieval': [0.74, 0.4],
  'LLM Agents': [0.88, 0.22],
  'Multi-Modal Models': [0.52, 0.22],
  'Bias & Fairness': [0.34, 0.1],
  'Safety & Robustness': [0.66, 0.08],
  'Domain Adaptation': [0.12, 0.2],
  'Visual Analytics': [0.12, 0.76],
};
const HUES = ['#f6c97a', '#9cc4ff', '#f2a0a0', '#9fe0c4', '#c9b3ff', '#ffd9a8'];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function layout(pubs: Publication[]) {
  const pts = pubs.map((p) => {
    const cs = p.tags.map((t) => TOPIC_POS[t] ?? [0.5, 0.5]);
    const x = cs.reduce((s, c) => s + c[0], 0) / cs.length + (hash(p.id) - 0.5) * 0.1;
    const y = cs.reduce((s, c) => s + c[1], 0) / cs.length + (hash(p.id + 'y') - 0.5) * 0.1;
    return { id: p.id, x, y };
  });
  for (let it = 0; it < 80; it++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = (pts[j].y - pts[i].y) * 0.6;
        const d = Math.hypot(dx, dy) || 0.001;
        if (d < 0.085) {
          const push = (0.085 - d) / 2;
          pts[i].x -= (dx / d) * push;
          pts[j].x += (dx / d) * push;
          pts[i].y -= (dy / d) * push;
          pts[j].y += (dy / d) * push;
        }
      }
    }
    pts.forEach((p) => {
      p.x = Math.min(0.95, Math.max(0.05, p.x));
      p.y = Math.min(0.92, Math.max(0.07, p.y));
    });
  }
  return new Map(pts.map((p) => [p.id, p]));
}

const LINKS: [keyof Publication, string][] = [
  ['pdfUrl', 'PDF'],
  ['paperUrl', 'Paper'],
  ['codeUrl', 'Code'],
  ['modelUrl', 'Model'],
  ['demoUrl', 'Demo'],
  ['posterUrl', 'Poster'],
  ['videoUrl', 'Video'],
  ['notesUrl', 'Notes'],
  ['bibtexUrl', 'BibTeX'],
];

export function Research() {
  const [topic, setTopic] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const { pos, topics, lines } = useMemo(() => {
    const pos = layout(publications);
    const counts = new Map<string, number>();
    publications.forEach((p) => p.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    const topics = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count], i) => ({ name, count, hue: HUES[i % HUES.length] }));
    const lines = topics
      .filter((t) => t.count > 1)
      .map((t) => {
        const members = publications.filter((p) => p.tags.includes(t.name)).map((p) => pos.get(p.id)!);
        // nearest-neighbour chain, so each constellation reads as one stroke
        const rest = [...members].sort((a, b) => a.x - b.x);
        const chain = [rest.shift()!];
        while (rest.length) {
          const a = chain[chain.length - 1];
          let best = 0;
          rest.forEach((b, i) => {
            if (Math.hypot(b.x - a.x, b.y - a.y) < Math.hypot(rest[best].x - a.x, rest[best].y - a.y)) best = i;
          });
          chain.push(rest.splice(best, 1)[0]);
        }
        return { ...t, d: chain.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 100).toFixed(2)} ${(p.y * 100).toFixed(2)}`).join(' ') };
      });
    return { pos, topics, lines };
  }, []);

  const hue = (p: Publication) => topics.find((t) => t.name === p.tags[0])?.hue ?? HUES[0];
  const lit = (p: Publication) => !topic || p.tags.includes(topic);
  const hovered = publications.find((p) => p.id === hover);
  const groups = [
    { label: 'Published', items: publications.filter((p) => p.status === 'published') },
    { label: 'Preprints', items: publications.filter((p) => p.status !== 'published') },
  ];

  const goTo = (id: string) => {
    setOpen(id);
    requestAnimationFrame(() => {
      const el = document.getElementById(`pub-${id}`);
      if (el) window.dispatchEvent(new CustomEvent('glide', { detail: { el } }));
    });
  };

  return (
    <>
      <div data-panel="chart" className="panel chart">
      <div className="sky" onPointerLeave={() => setHover(null)}>
        <svg className="sky-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lines.map((l) => (
            <path
              key={l.name}
              d={l.d}
              stroke={l.hue}
              className={topic === l.name || hovered?.tags.includes(l.name) ? 'on' : topic ? 'off' : ''}
            />
          ))}
        </svg>
        {publications.map((p) => {
          const pt = pos.get(p.id)!;
          return (
            <button
              key={p.id}
              type="button"
              className={`star${p.status === 'published' ? '' : ' faint'}${lit(p) ? '' : ' dim'}${hover === p.id ? ' hot' : ''}`}
              style={{ left: `${pt.x * 100}%`, top: `${pt.y * 100}%`, color: hue(p), animationDelay: `${-hash(p.id) * 6}s` }}
              aria-label={`${p.title}. ${shortVenue(p).name}`}
              onPointerEnter={() => setHover(p.id)}
              onFocus={() => setHover(p.id)}
              onBlur={() => setHover(null)}
              onClick={() => goTo(p.id)}
            />
          );
        })}
        {hovered && (
          <div
            className={`star-card${pos.get(hovered.id)!.x > 0.6 ? ' left' : ''}${pos.get(hovered.id)!.y > 0.62 ? ' up' : ''}`}
            style={{ left: `${pos.get(hovered.id)!.x * 100}%`, top: `${pos.get(hovered.id)!.y * 100}%` }}
          >
            <span className="meta">{shortVenue(hovered).name}</span>
            <strong>{hovered.title}</strong>
            <span className="star-card-tags">{hovered.tags.join(', ')}</span>
          </div>
        )}
        <p className="sky-note">
          Each star is a paper. Papers that share a topic are joined into a constellation. Select one to read it.
        </p>
      </div>
      </div>

      <section data-panel="papers" className="panel papers">
        <div className="topics" role="group" aria-label="Filter papers by topic">
          <button type="button" className={topic === null ? 'on' : ''} aria-pressed={topic === null} onClick={() => setTopic(null)}>
            All papers <span>{publications.length}</span>
          </button>
          {topics.map((t) => (
            <button
              key={t.name}
              type="button"
              className={topic === t.name ? 'on' : ''}
              aria-pressed={topic === t.name}
              style={{ ['--hue' as string]: t.hue }}
              onClick={() => setTopic(topic === t.name ? null : t.name)}
            >
              <i />
              {t.name} <span>{t.count}</span>
            </button>
          ))}
        </div>

        {groups.map((g) => {
          const items = g.items.filter(lit);
          if (!items.length) return null;
          return (
            <section key={g.label} className="pub-group">
              <h3>{g.label}</h3>
              <ol className="pubs">
                {items.map((p) => {
                  const v = shortVenue(p);
                  const a = splitAuthors(p.authors);
                  const isOpen = open === p.id;
                  return (
                    <li
                      key={p.id}
                      id={`pub-${p.id}`}
                      className={`pub${hover === p.id ? ' hot' : ''}${isOpen ? ' open' : ''}`}
                      onPointerEnter={() => setHover(p.id)}
                      onPointerLeave={() => setHover(null)}
                    >
                      <div className="pub-venue meta">
                        <span style={{ color: hue(p) }}>{v.name}</span>
                        {v.notes.map((n) => (
                          <em key={n}>{n}</em>
                        ))}
                      </div>
                      <div className="pub-body">
                        <h4>{p.title}</h4>
                        <p className="pub-authors">
                          {a.list.map((name, i) => (
                            <span key={i}>
                              {i > 0 && ', '}
                              {name.startsWith('Yiqun Sun') ? <b>{name}</b> : name}
                            </span>
                          ))}
                          {a.note && <span className="pub-note"> · {a.note}</span>}
                        </p>
                        <p className="pub-links">
                          {p.abstract && (
                            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                              {isOpen ? 'Hide abstract' : 'Abstract'}
                            </button>
                          )}
                          {LINKS.filter(([k]) => p[k]).map(([k, label]) => (
                            <a key={k} href={url(p[k] as string)} target="_blank" rel="noopener">
                              {label}
                            </a>
                          ))}
                          <span className="pub-tags">{p.tags.join(' / ')}</span>
                        </p>
                        {isOpen && <p className="pub-abstract">{p.abstract}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        <section className="pub-group">
          <h3>Reviewing</h3>
          <p className="prose">
            Programme committee member and reviewer for {services.slice(0, -1).join(', ')} and {services[services.length - 1]}.
          </p>
        </section>
      </section>
    </>
  );
}
