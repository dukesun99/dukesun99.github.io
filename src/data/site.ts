import pubs from './publications.json';

export type Publication = {
  id: string;
  status: string;
  title: string;
  authors: string;
  venue: string;
  year: string;
  tags: string[];
  abstract?: string;
  published?: string;
  rank?: string[];
  pdfUrl?: string;
  paperUrl?: string;
  codeUrl?: string;
  modelUrl?: string;
  demoUrl?: string;
  posterUrl?: string;
  videoUrl?: string;
  notesUrl?: string;
  bibtexUrl?: string;
};

/** Resolves a root-relative path against the base the site is served from. */
export const url = (p: string) => (p.startsWith('/') ? import.meta.env.BASE_URL + p.slice(1) : p);

export const publications = pubs as Publication[];

export const chapters = [
  { id: 'dawn', en: 'Daybreak', covers: 'About' },
  { id: 'path', en: 'The climb', covers: 'Education and experience' },
  { id: 'research', en: 'Field of stars', covers: 'Research' },
  { id: 'water', en: 'Still water', covers: 'Projects, life, contact' },
] as const;

export const interests = [
  'Natural language processing',
  'Information retrieval',
  'Explainable AI',
  'Multi-modal models',
  'Domain-specific models',
  'News and social media analysis',
];

export const news = [
  {
    date: 'Aug 2026',
    title: 'Three papers accepted to EMNLP 2026',
    body: 'GGSS in the main conference; Corpus2Skill and “When Models Hear What They Expect” in Findings.',
  },
];

export const awards = [
  { year: '2025', title: 'DAAD AInet Fellow', detail: 'Postdoc-NeT-AI programme, Germany' },
  { year: '2017', title: 'NUS Science & Technology Undergraduate Scholarship', detail: '' },
  { year: '2015', title: 'NOIP First Prize', detail: 'National Olympiad in Informatics in Provinces, Shandong' },
];

export const experience = [
  {
    years: '2025 – now',
    title: 'Research Scientist',
    org: 'Magellan Technology Research Institute',
    logo: '/logos/mtri.png',
    text: 'Research in natural language processing and AI: multimodal retrieval, agent knowledge access, and bias mitigation in vision-language models.',
  },
  {
    years: '2021 – 2025',
    title: 'Research Assistant, full-time',
    org: 'National University of Singapore',
    logo: '/logos/nus.png',
    text: 'PhD research on interpretable representation learning and diversified information retrieval, supervised by Prof. Anthony K. H. Tung.',
  },
  {
    years: '2022 – now',
    title: 'Blockchain Developer, contract',
    org: 'Web3SG',
    logo: '/logos/web3sg.png',
    text: 'Solidity and Rust smart contracts, full-stack web3 applications, and automated on-chain bots.',
  },
  {
    years: '2018 – 2023',
    title: 'Teaching Assistant',
    org: 'National University of Singapore',
    logo: '/logos/nus.png',
    text: 'CS5344 Big-Data Analytics, and CS1101S and CS1010 Programming Methodology. Tutorials and student consultations.',
  },
  {
    years: '2019',
    title: 'Visiting Research Intern',
    org: 'NUS Suzhou Research Institute',
    logo: '/logos/nus.png',
    text: 'Worked on a blockchain project built on ForkBase, a storage engine for blockchain applications.',
  },
];

export const education = [
  {
    years: '2021 – 2025',
    title: 'PhD, Computer Science',
    org: 'National University of Singapore',
    logo: '/logos/nus.png',
    text: 'Thesis: Enhancing News Retrieval with Diversity and Interpretability. Supervisor: Prof. Anthony K. H. Tung.',
  },
  {
    years: '2017 – 2020',
    title: 'BComp, Computer Science',
    org: 'National University of Singapore',
    logo: '/logos/nus.png',
    text: 'Honours, Highest Distinction. Final-year project: A Graph Visualization Based Approach for Integration and Querying of Relational Data.',
  },
  {
    years: '2019',
    title: 'Exchange, Computer Science',
    org: 'Northwestern University',
    logo: '/logos/northwestern_university.png',
    text: 'Visiting student in Illinois. GPA 3.92 / 4.0.',
  },
];

export const services = ['ICLR', 'ICML', 'NeurIPS', 'ARR', 'WWW', 'KDD', 'AAAI', 'CIKM', 'ICASSP', 'TOMM', 'TMLR'];

export const projects = [
  {
    name: 'neovis.js',
    role: 'Core contributor',
    stars: '1.7k',
    url: 'https://github.com/neo4j-contrib/neovis.js',
    text: 'Graph visualization for Neo4j data in the browser.',
  },
  {
    name: 'MTEB',
    role: 'Contributor',
    stars: '3.4k',
    url: 'https://github.com/embeddings-benchmark/mteb',
    text: 'The Massive Text Embedding Benchmark, across languages and modalities.',
  },
  {
    name: 'AgentScope',
    role: 'Contributor',
    stars: '7.1k',
    url: 'https://github.com/modelscope/agentscope',
    text: 'A framework for building LLM-based multi-agent applications.',
  },
  {
    name: 'Graphin',
    role: 'Contributor',
    stars: '1k',
    url: 'https://github.com/antvis/Graphin',
    text: 'React components for graph visualization, from AntV.',
  },
];

export const skills = [
  { area: 'Machine learning', items: 'Python, PyTorch, Transformers, NLP, representation learning, LLMs, PEFT, scikit-learn' },
  { area: 'Web', items: 'TypeScript, JavaScript, React, Node.js, Ant Design, interactive visualization' },
  { area: 'Blockchain', items: 'Solidity, Rust, Ethereum, smart contracts, dApp development, World Chain' },
  { area: 'Systems', items: 'C++, Java, CUDA, MPI, distributed systems, parallel computing, Linux, Git, CI/CD' },
  { area: 'Cloud and data', items: 'Docker, MongoDB, Neo4j, Google Cloud, AWS, Azure, SQL, data mining, system design' },
];

export const photos = [
  { src: '/photos/budapest.jpg', w: 787, h: 1400, place: 'Liberty Bridge, Budapest', date: 'Jul 2025', note: 'Art Nouveau ironwork over the Danube.' },
  { src: '/photos/sodagreen.jpg', w: 1400, h: 1049, place: 'Sodagreen at Taipei Arena', date: 'Feb 2025', note: 'My favourite band, finally live.' },
  { src: '/photos/bali.jpg', w: 1400, h: 1049, place: 'Tirta Empul, Bali', date: 'Nov 2024', note: 'The Melukat water purification ritual.' },
  { src: '/photos/new_york.jpg', w: 1049, h: 1400, place: 'Statue of Liberty, New York', date: 'Jun 2024', note: 'Lady Liberty from the harbour.' },
  { src: '/photos/penang.jpg', w: 1049, h: 1400, place: 'Wonderfood Museum, Penang', date: 'May 2024', note: 'Pulling a very large teh tarik.' },
  { src: '/photos/mexico.jpg', w: 1400, h: 1050, place: 'Chichén Itzá, Mexico', date: 'Dec 2023', note: 'The pyramid of Kukulkan.' },
  { src: '/photos/stanford.jpg', w: 1049, h: 1400, place: 'Stanford, California', date: 'Dec 2023', note: 'A walk around the campus.' },
  { src: '/photos/futaba.jpg', w: 1276, h: 1400, place: 'Futaba, Fukushima', date: 'Sep 2023', note: 'A town reopening after the disaster.' },
  { src: '/photos/shennongjia.jpg', w: 1400, h: 1049, place: 'Shennongjia, Hubei', date: 'May 2023', note: 'Dressed as wild men in the forest.' },
];

export const contact = {
  email: 'dukesunyq@gmail.com',
  links: [
    { label: 'GitHub', url: 'https://github.com/dukesun99' },
    { label: 'Google Scholar', url: 'https://scholar.google.com/citations?user=maniV5gAAAAJ&hl=en' },
    { label: 'LinkedIn', url: 'https://linkedin.com/in/dukesun99' },
  ],
};

export function shortVenue(p: Publication) {
  const v = p.venue;
  let name = v;
  if (/Findings.*EMNLP/.test(v)) name = 'EMNLP Findings';
  else if (/VLDB Journal/.test(v)) name = 'VLDB Journal';
  else if (/PVLDB/.test(v)) name = 'VLDB Demo';
  else if (/TVCG/.test(v)) name = 'IEEE TVCG';
  else if (/SSRN/.test(v)) name = 'SSRN';
  else if (/arXiv/.test(v)) name = 'arXiv';
  else {
    const m = v.match(/\(([A-Z]{3,6})\)/);
    if (m) name = m[1];
  }
  const notes: string[] = [];
  if (/Oral/.test(v)) notes.push('Oral');
  if (/Position/i.test(v)) notes.push('Position paper');
  return { name: `${name} ${p.year}`, notes };
}

/** Splits the author string into names plus the trailing footnote, e.g. "(✉ Corresponding author)". */
export function splitAuthors(authors: string) {
  const m = authors.match(/\s*\(([†✉][^)]*)\)\s*$/);
  const list = (m ? authors.slice(0, m.index) : authors).split(',').map((a) => a.trim());
  return { list, note: m ? m[1].replace(/^([†✉])\s*/, '$1 ') : '' };
}
