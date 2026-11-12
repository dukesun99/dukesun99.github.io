import * as THREE from 'three';
import { World, heightAt, type PhotoSpec } from './world';
import { photos } from '../data/site';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sm = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const S = 0.01; // world units per CSS pixel: a 1000px-wide block of text is 10 units across
const UP = V(0, 1, 0);

type Pose = { p: THREE.Vector3; l: THREE.Vector3; tod: number };
type Seg = { from: Pose; to: Pose; start: number; len: number; ease: boolean; chapter: number; dim: number; cp?: THREE.CatmullRomCurve3; cl?: THREE.CatmullRomCurve3 };
type Placed = {
  el: HTMLElement;
  center: THREE.Vector3;
  far: [number, number]; // depth at which it is hidden / fully shown, approaching
  near: [number, number]; // depth at which it is hidden / fully shown, passing
  shade?: string;
  gate?: (tod: number, dim: number) => number;
  last: number;
};

/**
 * One continuous camera move through the world, driven by scroll.
 * Text blocks are real DOM, positioned in the same 3D space as the WebGL scene
 * (one CSS perspective camera mirrors the WebGL camera), so they have true
 * perspective and parallax and stay selectable and clickable.
 */
export class Journey {
  world: World;
  private segs: Seg[] = [];
  private placed: Placed[] = [];
  private starts = new Map<HTMLElement, { start: number; read: number }>();
  private anchors = new Map<string, number>();
  private cur: Pose = { p: V(0, 236, 900), l: V(0, 196, 560), tod: 0 };
  private first = true;
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  private chapter = -1;
  private dim = 0;
  private still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private ro: ResizeObserver;
  private timer = 0;
  private fovPx = 800;
  private roll = 0;
  private kick = 0;
  private prevYaw = 0;
  private prevP = V(0, 0, 0);
  private slow = 0;
  private W = 0;
  private H = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private stage: HTMLElement,
    private camEl: HTMLElement,
    private spacer: HTMLElement,
    private onChapter: (i: number) => void,
  ) {
    this.world = new World(canvas);
    document.documentElement.classList.add('world');
    this.ro = new ResizeObserver(() => {
      clearTimeout(this.timer);
      this.timer = window.setTimeout(() => this.build(), 60);
    });
    this.ro.observe(stage);
    stage.querySelectorAll<HTMLElement>('[data-panel]').forEach((el) => this.ro.observe(el));
    document.fonts.ready.then(() => this.build());
    window.addEventListener('pointermove', this.onMove, { passive: true });
    this.build();
  }

  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    this.mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.ty = 1 - (e.clientY / window.innerHeight) * 2;
  };

  /* ---------- placing DOM in the world ---------- */

  private quat(normal: THREE.Vector3) {
    const n = normal.clone().normalize();
    const r = new THREE.Vector3().crossVectors(UP, n).normalize();
    const u = new THREE.Vector3().crossVectors(n, r);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, u, n));
  }

  private place(el: HTMLElement, center: THREE.Vector3, normal: THREE.Vector3, scale: number, opts: Partial<Placed> & { shadeOpacity?: number } = {}) {
    const q = this.quat(normal);
    const e = new THREE.Matrix4().compose(center, q, V(scale, scale, scale)).elements;
    const f = (v: number) => (Math.abs(v) < 1e-10 ? 0 : v);
    el.style.transform =
      'translate(-50%,-50%) matrix3d(' +
      [e[0], e[1], e[2], e[3], -e[4], -e[5], -e[6], -e[7], e[8], e[9], e[10], e[11], e[12], e[13], e[14], e[15]].map(f).join(',') +
      ')';
    if (opts.shade) {
      this.world.setShade(opts.shade, center, q, el.offsetWidth * scale + 5, el.offsetHeight * scale + 4, opts.shadeOpacity ?? 0.6);
    }
    this.placed.push({ el, center: center.clone(), far: opts.far ?? [150, 60], near: opts.near ?? [1.6, 4.6], shade: opts.shade, gate: opts.gate, last: -1 });
  }

  /** A block read by craning down it: returns where the camera starts and ends, and the scroll that takes. */
  private station(el: HTMLElement, top: THREE.Vector3, normal: THREE.Vector3, D: number, tod: number, shade: string, shadeOpacity = 0.6) {
    const n = normal.clone().normalize();
    const r = new THREE.Vector3().crossVectors(UP, n).normalize();
    const u = new THREE.Vector3().crossVectors(n, r);
    const h = el.offsetHeight;
    const center = top.clone().addScaledVector(u, (-h * S) / 2);
    this.place(el, center, n, S, { shade, shadeOpacity, far: [70, 34] });
    const fits = h < this.H * 0.74;
    const read = fits ? 0 : h - this.H * 0.7;
    const focus = (off: number) => (fits ? center.clone() : top.clone().addScaledVector(u, -S * (this.H * 0.5 - this.H * 0.15 + off)));
    const pose = (off: number): Pose => {
      const f = focus(off);
      return { p: f.clone().addScaledVector(n, D), l: f, tod };
    };
    return { a: pose(0), b: pose(read), read };
  }

  /* ---------- the track ---------- */

  private build() {
    const W = (this.W = this.stage.clientWidth);
    const H = (this.H = this.stage.clientHeight);
    if (!W || !H) return;
    this.world.resize(W, H);
    const cam = this.world.camera;
    const fovPx = (this.fovPx = cam.projectionMatrix.elements[5] * (H / 2));
    const D = fovPx * S; // distance at which a block of text appears at exactly its CSS size
    const a = clamp(W / H / 1.5, 0.36, 1); // how far things may sit off-axis on this screen
    const b = clamp(a * 1.7, 0.6, 1); // headings shrink less than they shift
    this.stage.style.perspective = `${fovPx}px`;
    this.stage.style.setProperty('--W', `${W}px`);
    this.stage.style.setProperty('--H', `${H}px`);

    const q = <T extends HTMLElement = HTMLElement>(sel: string) => [...this.stage.querySelectorAll<T>(sel)];
    const one = (name: string) => this.stage.querySelector<HTMLElement>(`[data-panel="${name}"]`)!;
    this.placed = [];
    this.segs = [];
    this.starts.clear();
    this.anchors.clear();
    let cursor = 0;
    let last: Pose = { p: V(0, 236, 900), l: V(-14 * a, 196, 560), tod: 0 };
    let chapter = 0;
    const push = (to: Pose, len: number, o: { ease?: boolean; ctrl?: THREE.Vector3; dim?: number } = {}) => {
      this.segs.push({ from: last, to, start: cursor, len, ease: o.ease ?? true, chapter, dim: o.dim ?? 0 });
      cursor += len;
      last = to;
    };
    const fullScreen = (el: HTMLElement, pose: Pose, near: [number, number]) => {
      const n = pose.p.clone().sub(pose.l).normalize();
      this.place(el, pose.p.clone().addScaledVector(n, -D), n, S, { far: [1e5, 1e5 - 1], near });
    };

    /* I — above the clouds */
    this.anchors.set('top', 0);
    fullScreen(one('hero'), last, [D - 7, D - 0.6]);
    this.starts.set(one('hero'), { start: 0, read: 0 });
    this.world.setTitle('name', 'Yiqun Sun', false, V(-34 * a, 181 + (1 - a) * 44, 560), 46 * b, last.p, 1200);
    push({ p: V(40 * a + 8, 120, 470), l: V(4, 92, 296), tod: 0.6 }, H * 1.4);

    const about = this.station(one('about'), V(0, 104, 296), V(0, 0.17, 1), D, 1, 'about', 0.62);
    push(about.a, H * 0.9);
    this.anchors.set('about', cursor);
    this.starts.set(one('about'), { start: cursor, read: about.read });
    push(about.b, about.read || H * 0.35, { ease: false, dim: 1 });

    /* II — down the valley, past each year */
    chapter = 1;
    const A = V(0, 50, 165);
    const B = V(0, 36, -115);
    const span = A.z - B.z;
    this.world.setTitle('climb', 'The climb', true, V(-60 * a, heightAt(-60 * a, 52) + 7, 52), 19 * b, A, 270);
    // drop off the ledge and skim the treetops before settling onto the line down the valley
    push({ p: V(-30 * a, heightAt(-30 * a, 240) + 25, 240), l: V(-8 * a, 34, 120), tod: 1.02 }, H * 0.8);
    push({ p: A, l: V(0, 46.5, 65), tod: 1.05 }, H * 0.8);
    this.anchors.set('path', cursor);
    const items = q('[data-panel="tl"]');
    const flight = items.length * H * 0.62;
    const yLine = (z: number) => A.y + (B.y - A.y) * ((A.z - z) / span);
    const itemW = items[0]?.offsetWidth ?? 400;
    const lat = Math.min(560, Math.max(0, W / 2 - itemW / 2 - W * 0.05)) * S;
    const farIn = W < 760 ? 24 : 62;
    const orbs: THREE.Vector3[] = [];
    items.forEach((el, i) => {
      const side = el.dataset.side === 'r' ? 1 : -1;
      const z = 118 - i * 28;
      const c = V(side * lat, yLine(z + D) - D * 0.035, z);
      this.place(el, c, V(-side * 0.22 * a, 0.03, 1), S, { far: [farIn * 0.8, farIn * 0.4], near: [2.4, 5.2], shade: `tl${i}`, shadeOpacity: 0.36 });
      this.starts.set(el, { start: cursor + ((A.z - (z + D)) / span) * flight, read: 0 });
      orbs.push(V(c.x - (itemW * S) / 2 - 0.3, c.y + (el.offsetHeight * S) / 2 - 0.16, z));
    });
    this.world.setOrbs(orbs);
    push({ p: B, l: V(0, 32.5, -215), tod: 1.6 }, flight, { ease: false });

    /* III — night: look up, then read down to the water */
    chapter = 2;
    const pr = V(0, 40, -150);
    this.world.setTitle('stars', 'Field of stars', true, V(-56 * a, heightAt(-56 * a, -335) + 6, -335), 20 * b, pr, 300);
    push({ p: pr, l: V(-36 * a, 46, -335), tod: 2 }, H);
    this.anchors.set('research', cursor);
    // swing round the heading at low level, then tip the camera up to the sky
    const starsAt = V(-56 * a, heightAt(-56 * a, -335) + 14, -335);
    push({ p: V(34 * a, heightAt(34 * a, -248) + 26, -248), l: starsAt, tod: 2 }, H * 0.8);
    const pc = V(26 * a, heightAt(26 * a, -278) + 30, -278);
    const up = (27 * Math.PI) / 180;
    const dir = V(Math.sin(0.14) * Math.cos(up), Math.sin(up), -Math.cos(0.14) * Math.cos(up));
    const chartC = pc.clone().addScaledVector(dir, 620);
    this.place(one('chart'), chartC, dir.clone().negate(), 620 / fovPx, { far: [1e5, 1e5 - 1], near: [250, 500], gate: (tod, dim) => sm(1.55, 1.95, tod) * sm(2.3, 2.05, tod) * (1 - dim) });
    this.starts.set(one('chart'), { start: cursor + H * 0.9, read: 0 });
    push({ p: pc, l: chartC, tod: 2 }, H * 0.9);
    push({ p: pc.clone(), l: chartC.clone(), tod: 2 }, H * 0.45, { ease: false });

    const papersEl = one('papers');
    const papers = this.station(papersEl, V(20 * a, 8.5 + papersEl.offsetHeight * S, -398), V(0, 0, 1), D, 2, 'papers', 0.5);
    push(papers.a, H * 1.3);
    this.anchors.set('papers', cursor);
    this.starts.set(papersEl, { start: cursor, read: papers.read });
    push({ ...papers.b, tod: 2.6 }, papers.read || H * 0.35, { ease: false, dim: 1 });

    /* IV — the lake */
    chapter = 3;
    const pl = V(-6, 6.5, -455);
    this.world.setTitle('water', 'Still water', true, V(-52 * a, 0.05, -650), 15 * b, pl, 235);
    // low over the water, then ease up
    push({ p: V(4, 1.9, -428), l: V(-30 * a, 3, -650), tod: 2.9 }, H * 0.7);
    push({ p: pl, l: V(-40 * a, 5.5, -650), tod: 3 }, H * 0.8);

    const projEl = one('projects');
    const proj = this.station(projEl, V(64 * a + 10, 0.9 + projEl.offsetHeight * S, -560), V(-0.45, 0.03, 1), D, 3.1, 'projects', 0.5);
    push(proj.a, H * 1.1);
    this.anchors.set('projects', cursor);
    this.starts.set(projEl, { start: cursor, read: proj.read });
    push(proj.b, proj.read || H * 0.35, { ease: false, dim: 1 });

    // photographs standing in the shallows; the camera trucks along the row
    const rowZ = -655;
    const Dp = D * 1.12;
    const away = one('away');
    const caps = q('[data-panel="cap"]');
    const maxH = Math.min(4.7, H * S * 0.52);
    let x = 112;
    const awayC = V(x + (away.offsetWidth * S) / 2, 0.9 + maxH / 2, rowZ);
    this.place(away, awayC, V(0, 0, 1), S, { far: [90, 50] });
    x += away.offsetWidth * S + 1.6;
    const specs: PhotoSpec[] = [];
    photos.forEach((ph, i) => {
      const asp = ph.w / ph.h;
      const w = Math.min(maxH * asp, W * S * 0.84);
      const h = w / asp;
      const cx = x + w / 2;
      specs.push({ src: ph.src, x: cx, y: 0.9 + h / 2, z: rowZ, w, h });
      const cap = caps[i];
      if (cap) {
        cap.style.width = `${w / S}px`;
        this.place(cap, V(cx, 0.9 + h + 0.22 + (cap.offsetHeight * S) / 2, rowZ), V(0, 0, 1), S, { far: [70, 40] });
      }
      x += w + 1.5;
    });
    this.world.setPhotos(specs);
    const camY = 0.9 + maxH * 0.56;
    const rowA = awayC.x + Math.max(0, (W * S) / 2 - (away.offsetWidth * S) / 2 - W * S * 0.08);
    const rowB = specs[specs.length - 1].x;
    push({ p: V(rowA, camY, rowZ + Dp), l: V(rowA, camY - 0.25, rowZ), tod: 3.3 }, H * 1.2);
    this.anchors.set('life', cursor);
    this.starts.set(away, { start: cursor, read: 0 });
    push({ p: V(rowB, camY, rowZ + Dp), l: V(rowB, camY - 0.25, rowZ), tod: 3.75 }, ((rowB - rowA) / S) * 0.8, { ease: false });

    // turn to the sunrise
    const pe = V(rowB + 34, 4.6, rowZ + Dp + 6);
    const az = (13 * Math.PI) / 180;
    const dc = V(Math.sin(az), -0.012 - (1 - a) * 0.2, -Math.cos(az)).normalize();
    const side = new THREE.Vector3().crossVectors(dc, UP).normalize();
    const hello = pe.clone().addScaledVector(dc, 150).addScaledVector(side, -16 * a);
    hello.y = 0.05;
    this.world.setTitle('hello', 'Say hello', false, hello, 17 * b, pe, 215);
    const end: Pose = { p: pe, l: pe.clone().addScaledVector(dc, 100), tod: 4 };
    fullScreen(one('contact'), end, [1, 2]);
    // leave the last photograph low and climb into the sunrise
    push({ p: V(rowB + 20, 1.7, rowZ + Dp + 1), l: hello.clone().setY(3), tod: 3.9 }, H * 0.7);
    push(end, H * 0.9);
    this.anchors.set('contact', cursor);
    this.starts.set(one('contact'), { start: cursor, read: 0 });
    push({ p: pe.clone(), l: end.l.clone(), tod: 4 }, H * 0.25, { ease: false });

    // travel runs along one smooth curve through the stops, so the camera never brakes to a halt between them
    this.segs.forEach((g, i) => {
      if (!g.ease) return;
      const prev = this.segs[i - 1]?.from ?? g.from;
      const next = this.segs[i + 1]?.to ?? g.to;
      g.cp = new THREE.CatmullRomCurve3([prev.p, g.from.p, g.to.p, next.p], false, 'centripetal');
      g.cl = new THREE.CatmullRomCurve3([prev.l, g.from.l, g.to.l, next.l], false, 'centripetal');
    });
    this.spacer.style.height = `${cursor + H}px`;
  }

  private at(y: number): Pose & { chapter: number; dim: number } {
    const segs = this.segs;
    let s = segs[segs.length - 1];
    for (const g of segs) {
      if (y < g.start + g.len) {
        s = g;
        break;
      }
    }
    let t = clamp((y - s.start) / Math.max(1, s.len));
    const edge = sm(0, 0.12, t) * sm(1, 0.88, t);
    // slow a little near each stop, without stopping
    if (s.ease) t = t * 0.45 + t * t * (3 - 2 * t) * 0.55;
    const p = s.cp ? s.cp.getPoint((1 + t) / 3) : s.from.p.clone().lerp(s.to.p, t);
    const l = s.cl ? s.cl.getPoint((1 + t) / 3) : s.from.l.clone().lerp(s.to.l, t);
    return { p, l, tod: s.from.tod + (s.to.tod - s.from.tod) * t, chapter: s.chapter, dim: s.dim * edge };
  }

  /** Scroll offset for a named stop or for any element inside a placed block. */
  offsetOf(target: string | HTMLElement) {
    if (typeof target === 'string') return this.anchors.get(target) ?? 0;
    const panel = target.closest<HTMLElement>('[data-panel]');
    const info = panel && this.starts.get(panel);
    if (!panel || !info) return null;
    let top = 0;
    for (let n: HTMLElement | null = target; n && n !== panel; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
    return info.start + (info.read ? clamp(top - this.H * 0.3, 0, info.read) : 0);
  }

  start() {
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const raw = now - this.last;
      const dt = Math.min(0.1, raw / 1000);
      this.last = now;
      // long frames that are not tab switches mean the GPU is struggling: render fewer pixels
      if (raw > 27 && raw < 90) this.slow++;
      else this.slow = Math.max(0, this.slow - 1);
      if (this.slow > 30) {
        this.slow = 0;
        if (this.world.downscale()) this.world.resize(this.W, this.H);
      }
      if (!this.still) this.time += dt;
      if (!this.segs.length) return;

      const tgt = this.at(window.scrollY);
      // the craft has mass, and the gimbal trails it: position eases in, aim follows a beat later.
      // While reading, both tighten so text tracks the scroll.
      const instant = this.first || this.still;
      const k = instant ? 1 : 1 - Math.exp(-dt * (3.2 + 4 * tgt.dim));
      const kl = instant ? 1 : 1 - Math.exp(-dt * (2.5 + 4.5 * tgt.dim));
      this.first = false;
      this.cur.p.lerp(tgt.p, k);
      this.cur.l.lerp(tgt.l, kl);
      this.cur.tod += (tgt.tod - this.cur.tod) * k;
      this.dim += (tgt.dim - this.dim) * k;
      if (tgt.chapter !== this.chapter) this.onChapter((this.chapter = tgt.chapter));

      const mk = this.still ? 0 : 1 - Math.exp(-dt * 3);
      this.mouse.x += (this.mouse.tx - this.mouse.x) * mk;
      this.mouse.y += (this.mouse.ty - this.mouse.y) * mk;

      // the pointer shifts the camera, not the picture: near text and far hills part by different amounts
      const cam = this.world.camera;
      const fwd = this.cur.l.clone().sub(this.cur.p).normalize();
      const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      const upv = new THREE.Vector3().crossVectors(right, fwd);
      const drift = this.still ? 0 : 1;
      cam.position
        .copy(this.cur.p)
        .addScaledVector(right, this.mouse.x * 0.42 + Math.sin(this.time * 0.23) * 0.07 * drift)
        .addScaledVector(upv, this.mouse.y * 0.26 + Math.sin(this.time * 0.31 + 1) * 0.05 * drift);
      cam.lookAt(this.cur.l);
      // bank into turns and open the lens a little at speed
      const yaw = Math.atan2(fwd.x, -fwd.z);
      let dyaw = yaw - this.prevYaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
      const speed = this.cur.p.distanceTo(this.prevP) / Math.max(dt, 1e-3);
      this.prevYaw = yaw;
      this.prevP.copy(this.cur.p);
      const sk = this.still ? 1 : 1 - Math.exp(-dt * 4);
      const hover = (Math.sin(this.time * 1.3) * 0.0028 + Math.sin(this.time * 0.71 + 2) * 0.002) * (1 - this.dim);
      this.roll += ((clamp((dyaw / Math.max(dt, 1e-3)) * -0.34, -0.2, 0.2) + hover) * drift - this.roll) * sk;
      this.kick += (Math.min(9, speed * 0.034) * drift - this.kick) * sk;
      cam.rotateZ(this.roll);
      cam.fov = this.world.baseFov + this.kick;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      const fovPx = cam.projectionMatrix.elements[5] * (this.H / 2);
      if (Math.abs(fovPx - this.fovPx) > 0.01) {
        this.fovPx = fovPx;
        this.stage.style.perspective = `${fovPx}px`;
      }

      this.world.render(this.cur.tod, this.time, this.dim);

      const e = cam.matrixWorldInverse.elements;
      const f = (v: number) => (Math.abs(v) < 1e-10 ? 0 : v);
      this.camEl.style.transform =
        `translateZ(${this.fovPx}px) matrix3d(` +
        [e[0], -e[1], e[2], e[3], e[4], -e[5], e[6], e[7], e[8], -e[9], e[10], e[11], e[12], -e[13], e[14], e[15]].map(f).join(',') +
        `) translate(${this.W / 2}px,${this.H / 2}px)`;

      const cf = cam.getWorldDirection(new THREE.Vector3());
      for (const pl of this.placed) {
        const depth = pl.center.clone().sub(cam.position).dot(cf);
        let o = sm(pl.far[0], pl.far[1], depth) * sm(pl.near[0], pl.near[1], depth) * (pl.gate ? pl.gate(this.cur.tod, this.dim) : 1);
        o = Math.round(o * 40) / 40;
        if (o !== pl.last) {
          pl.last = o;
          pl.el.style.opacity = String(o);
          pl.el.style.visibility = o > 0 ? 'visible' : 'hidden';
          if (pl.shade) this.world.fadeShade(pl.shade, o);
        }
      }
    };
    this.raf = requestAnimationFrame(frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.ro.disconnect();
    window.removeEventListener('pointermove', this.onMove);
    document.documentElement.classList.remove('world');
    this.world.dispose();
  }
}
