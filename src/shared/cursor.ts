// Custom cursor: a precise dot, an eased follower ring, and a glowing comet
// trail. Fine-pointer devices only (skipped on touch and for users who prefer
// reduced motion).

interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

const CLAY: [number, number, number] = [217, 127, 87];
const BLUE: [number, number, number] = [122, 155, 208];

export function initCursor(): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.documentElement.classList.add('custom-cursor');

  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-trail';
  const ctx = canvas.getContext('2d')!;
  const ring = div('cursor-ring');
  const dot = div('cursor-dot');
  document.body.append(canvas, ring, dot);

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  let mx = window.innerWidth / 2;
  let my = window.innerHeight / 2;
  let rx = mx;
  let ry = my;
  let shown = false;
  const pts: TrailPoint[] = [];

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      pts.push({ x: mx, y: my, life: 1 });
      if (pts.length > 90) pts.shift();
      if (!shown) {
        shown = true;
        document.body.classList.add('cursor-on');
      }
    },
    { passive: true },
  );

  window.addEventListener('pointerdown', () => ring.classList.add('down'));
  window.addEventListener('pointerup', () => ring.classList.remove('down'));
  window.addEventListener(
    'pointerover',
    (e) => {
      const t = e.target as HTMLElement | null;
      const interactive = !!t?.closest?.('a, button, input, select, textarea, label, .swatch, .card');
      ring.classList.toggle('hover', interactive);
    },
    { passive: true },
  );
  document.addEventListener('mouseleave', () => {
    document.body.classList.remove('cursor-on');
    shown = false;
  });
  document.addEventListener('mouseenter', () => {
    document.body.classList.add('cursor-on');
    shown = true;
  });

  const frame = () => {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of pts) p.life -= 0.045;
    while (pts.length && pts[0].life <= 0) pts.shift();
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const a = Math.max(0, p1.life);
      const t = 1 - a;
      const r = Math.round(CLAY[0] + (BLUE[0] - CLAY[0]) * t);
      const g = Math.round(CLAY[1] + (BLUE[1] - CLAY[1]) * t);
      const b = Math.round(CLAY[2] + (BLUE[2] - CLAY[2]) * t);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a * 0.5})`;
      ctx.lineWidth = 1 + a * 7;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}
