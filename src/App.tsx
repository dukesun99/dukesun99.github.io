import { useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import { Journey } from './world/journey';
import { Swallow } from './components/Swallow';
import { Research } from './components/Research';
import { awards, chapters, contact, education, experience, interests, news, photos, projects, skills, url } from './data/site';

// The valley flight passes these in order, newest first; work on the left, study on the right.
const waypoints = [
  { ...experience[0], kind: 'Work', side: 'l' },
  { ...education[0], kind: 'Study', side: 'r' },
  { ...experience[1], kind: 'Work', side: 'l' },
  { ...experience[2], kind: 'Work', side: 'l' },
  { ...experience[3], kind: 'Work', side: 'l' },
  { ...education[1], kind: 'Study', side: 'r' },
  { ...experience[4], kind: 'Work', side: 'l' },
  { ...education[2], kind: 'Study', side: 'r' },
];

const NAV = [
  ['about', 'About'],
  ['path', 'Path'],
  ['research', 'Research'],
  ['projects', 'Projects'],
  ['contact', 'Contact'],
];

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const journey = useRef<Journey | null>(null);
  const lenis = useRef<Lenis | null>(null);
  const [chapter, setChapter] = useState(0);
  const [flat, setFlat] = useState(false);

  const scrollTo = (y: number) => {
    if (lenis.current) lenis.current.scrollTo(y, { duration: 2.2 });
    else window.scrollTo(0, y);
  };
  const go = (target: string | HTMLElement) => {
    const y = journey.current?.offsetOf(target);
    if (y != null) scrollTo(y);
    else if (typeof target === 'string') document.getElementById(target)?.scrollIntoView();
    else target.scrollIntoView({ block: 'center' });
  };

  useEffect(() => {
    let j: Journey | undefined;
    try {
      j = new Journey(canvas.current!, stage.current!, cam.current!, spacer.current!, setChapter);
      journey.current = j;
      if (import.meta.env.DEV) (window as unknown as { journey: Journey }).journey = j;
      j.start();
    } catch (err) {
      console.error(err);
      document.documentElement.classList.add('flat');
      setFlat(true);
    }
    return () => {
      j?.destroy();
      journey.current = null;
    };
  }, []);

  useEffect(() => {
    const glide = (e: Event) => go((e as CustomEvent).detail.el);
    // keyboard users: bring whatever receives focus in front of the camera
    const focus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (el.matches?.(':focus-visible') && el.closest('[data-panel]')) go(el);
    };
    window.addEventListener('glide', glide);
    document.addEventListener('focusin', focus);
    let raf = 0;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const l = new Lenis({ lerp: 0.09 });
      lenis.current = l;
      raf = requestAnimationFrame(function tick(t) {
        l.raf(t);
        raf = requestAnimationFrame(tick);
      });
    }
    return () => {
      cancelAnimationFrame(raf);
      lenis.current?.destroy();
      lenis.current = null;
      window.removeEventListener('glide', glide);
      document.removeEventListener('focusin', focus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = chapters[chapter] ?? chapters[0];
  useEffect(() => {
    document.documentElement.dataset.chapter = c.id;
  }, [c.id]);

  const link = (id: string) => ({
    href: `#${id}`,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      go(id);
    },
  });

  return (
    <>
      <canvas ref={canvas} className="gl" aria-hidden="true" />
      {!flat && <Swallow />}

      <nav className="nav" aria-label="Sections">
        <a className="nav-name" {...link('top')}>
          Yiqun Sun <span lang="zh">孙逸群</span>
        </a>
        <div className="nav-links">
          {NAV.map(([id, label]) => (
            <a key={id} {...link(id)}>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="chapter-mark" aria-hidden="true" key={c.id}>
        {c.en} <i>·</i> {c.covers}
      </div>

      <main className="stage" ref={stage}>
        <div className="cam" ref={cam}>
          <header data-panel="hero" className="panel hero">
            <p className="hero-zh" lang="zh" aria-hidden="true">
              孙逸群
            </p>
            <div className="hero-text">
              <h1>Yiqun Sun</h1>
              <p className="hero-lede">
                Research scientist at the Magellan Technology Research Institute in Singapore. I study how machines
                hold meaning: text embeddings a person can read, retrieval that shows more than one side of a story, and
                agents that know where to look.
              </p>
              <p className="hero-actions">
                <a className="btn" {...link('research')}>
                  Read the research
                </a>
                <a className="btn quiet" {...link('contact')}>
                  Get in touch
                </a>
              </p>
            </div>
            <p className="hero-cue" aria-hidden="true">
              Scroll to fly
            </p>
          </header>

          <section id="about" data-panel="about" className="panel about">
            <div className="prose lead">
              <p>
                I am a research scientist at MTRI, working on natural language processing and AI. I received my PhD and
                BComp (Highest Distinction) in computer science from the National University of Singapore, where
                Professor Anthony K. H. Tung supervised my thesis on making news retrieval more diverse and more
                interpretable.
              </p>
              <p>
                Most of my work asks what a representation actually contains. An embedding should capture what a text
                implies as well as what it says, and a person should be able to inspect why two texts ended up close
                together. Lately that question has carried me into multimodal reranking for long documents, knowledge
                access for LLM agents, and bias in vision-language models.
              </p>
            </div>
            <div className="facts">
              <div>
                <h3>Latest</h3>
                {news.map((n) => (
                  <p key={n.title}>
                    <span className="meta">{n.date}</span>
                    <strong>{n.title}</strong>
                    {n.body}
                  </p>
                ))}
              </div>
              <div>
                <h3>Interests</h3>
                <p>{interests.join(', ')}.</p>
              </div>
              <div>
                <h3>Honours</h3>
                {awards.map((a) => (
                  <p key={a.title}>
                    <span className="meta">{a.year}</span>
                    <strong>{a.title}</strong>
                    {a.detail}
                  </p>
                ))}
              </div>
            </div>
          </section>

          <h2 id="path" className="flat-only">
            The climb
          </h2>
          {waypoints.map((w) => (
            <article key={w.title + w.years} data-panel="tl" data-side={w.side} className="panel tl">
              <p className="meta">
                {w.years} <i>·</i> {w.kind}
              </p>
              <h3>{w.title}</h3>
              <p className="org">
                <img src={url(w.logo)} alt="" />
                {w.org}
              </p>
              <p>{w.text}</p>
            </article>
          ))}

          <h2 id="research" className="flat-only">
            Field of stars
          </h2>
          <Research />

          <h2 className="flat-only">Still water</h2>
          <section id="projects" data-panel="projects" className="panel projects">
            <div>
              <h3>Open source</h3>
              <ul className="rows">
                {projects.map((p) => (
                  <li key={p.name}>
                    <a href={p.url} target="_blank" rel="noopener">
                      <strong>{p.name}</strong>
                      <span className="meta">
                        {p.role}, {p.stars} stars
                      </span>
                    </a>
                    <p>{p.text}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Tools I work with</h3>
              <dl className="rows">
                {skills.map((s) => (
                  <div key={s.area}>
                    <dt>{s.area}</dt>
                    <dd>{s.items}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <div data-panel="away" className="panel away">
            <h3>Away from the desk</h3>
            <p>Each trip sends me home with a new way of looking at things.</p>
          </div>
          {photos.map((p) => (
            <figure key={p.src} data-panel="cap" className="panel cap">
              <img src={url(p.src)} alt={`Yiqun Sun at ${p.place}`} loading="lazy" />
              <figcaption>
                <strong>{p.place}</strong>
                <span>{p.note}</span>
                <span className="meta">{p.date}</span>
              </figcaption>
            </figure>
          ))}

          <section id="contact" data-panel="contact" className="panel contact">
            <div className="contact-text">
              <h2>Say hello</h2>
              <p>
                For collaborations, research questions, or a conversation about embeddings and retrieval, email is the
                best way to reach me. I am based in Singapore.
              </p>
              <a className="contact-mail" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
              <p className="contact-links">
                {contact.links.map((l) => (
                  <a key={l.label} href={l.url} target="_blank" rel="noopener">
                    {l.label}
                  </a>
                ))}
                <a href={url('/publications')}>Plain-text publication list</a>
              </p>
              <footer>© 2026 Yiqun Sun. The world on this page is rendered live in your browser.</footer>
            </div>
          </section>
        </div>
      </main>
      <div className="spacer" ref={spacer} aria-hidden="true" />
    </>
  );
}
