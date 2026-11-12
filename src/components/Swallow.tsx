import { useEffect, useRef } from 'react';

/**
 * A swallow that trails the pointer. 逸群: the one that leaves the flock.
 */
export function Swallow() {
  const root = useRef<SVGSVGElement>(null);
  const bird = useRef<SVGGElement>(null);
  const wingL = useRef<SVGPathElement>(null);
  const wingR = useRef<SVGPathElement>(null);
  const trail = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let w = window.innerWidth;
    let h = window.innerHeight;
    const pos = { x: w * 1.1, y: h * 0.2 };
    const vel = { x: -200, y: 20 };
    const ptr = { x: w * 0.7, y: h * 0.3, t: -1e9 };
    let ang = Math.PI;
    let flap = 0;
    let last = performance.now();
    let raf = 0;
    const pts: number[][] = [];

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX;
      ptr.y = e.clientY;
      ptr.t = performance.now();
    };
    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', onResize);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      // Follow the pointer, circling it once it rests; wander on its own when there is no pointer.
      let tx: number;
      let ty: number;
      const idle = now - ptr.t;
      if (idle < 6000) {
        const orbit = Math.min(1, idle / 900);
        tx = ptr.x + Math.cos(t * 1.3) * (30 + 46 * orbit) + 26;
        ty = ptr.y + Math.sin(t * 1.7) * (16 + 22 * orbit) - 30;
      } else {
        tx = w * (0.62 + 0.3 * Math.sin(t * 0.23));
        ty = h * (0.3 + 0.16 * Math.sin(t * 0.37 + 1.3));
      }
      const dx = tx - pos.x;
      const dy = ty - pos.y;
      const dist = Math.hypot(dx, dy) || 1;
      const want = Math.min(900, 90 + dist * 2.4);
      const steer = 1 - Math.exp(-dt * 3.2);
      vel.x += ((dx / dist) * want - vel.x) * steer;
      vel.y += ((dy / dist) * want - vel.y) * steer;
      pos.x += vel.x * dt;
      pos.y += vel.y * dt;

      const speed = Math.hypot(vel.x, vel.y);
      const target = Math.atan2(vel.y, vel.x);
      let da = target - ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      ang += da * (1 - Math.exp(-dt * 9));
      const bank = Math.max(-0.9, Math.min(0.9, da * 2.4));

      // Quick beats when accelerating, long glides otherwise.
      const effort = Math.min(1, Math.max(0, (want - speed) / 260 + 0.25 + Math.abs(bank) * 0.3));
      flap += dt * (5 + 13 * effort);
      const beat = Math.sin(flap);
      const spread = 0.78 + 0.22 * beat * (0.35 + 0.65 * effort);
      const size = 0.82 + 0.1 * Math.sin(t * 0.6);

      bird.current?.setAttribute(
        'transform',
        `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)}) rotate(${((ang * 180) / Math.PI).toFixed(1)}) scale(${size.toFixed(3)})`,
      );
      wingL.current?.setAttribute('transform', `scale(1 ${(spread * (1 - bank * 0.35)).toFixed(3)})`);
      wingR.current?.setAttribute('transform', `scale(1 ${(-spread * (1 + bank * 0.35)).toFixed(3)})`);

      pts.push([pos.x, pos.y]);
      if (pts.length > 22) pts.shift();
      trail.current?.setAttribute('points', pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '));
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <svg ref={root} className="swallow" aria-hidden="true">
      <defs>
        <linearGradient id="trail" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#fff3dc" stopOpacity="0" />
          <stop offset="1" stopColor="#fff3dc" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <polyline ref={trail} className="swallow-trail" />
      <g ref={bird} className="swallow-bird">
        <path d="M-9 0 L-30 -8 L-18 0 L-30 8 Z" />
        <path ref={wingL} d="M7 -1 C4 -14 -6 -27 -22 -36 C-13 -24 -7 -11 -5 -1 Z" />
        <path ref={wingR} d="M7 -1 C4 -14 -6 -27 -22 -36 C-13 -24 -7 -11 -5 -1 Z" />
        <path d="M15 0 C11 -3.4 -6 -3.6 -12 0 C-6 3.6 11 3.4 15 0 Z" />
      </g>
    </svg>
  );
}
