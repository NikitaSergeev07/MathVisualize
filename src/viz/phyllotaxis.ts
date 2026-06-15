// Phyllotaxis — the spiral packing a sunflower uses. Seed n sits at angle
// n·θ and radius c·√n. The single magic number is θ: at the golden angle
// (~137.507°) the florets pack with no gaps or seams.

import type { ParamValues, VizDef, VizHost, VizInstance } from '../shared/types';
import { sample } from '../shared/palettes';

interface State {
  angle: number; // degrees
  count: number;
  dotSize: number;
  palette: string;
  colorBy: string;
  drift: boolean;
}

function makeInstance(host: VizHost): VizInstance {
  const canvas = document.createElement('canvas');
  canvas.className = 'viz-canvas';
  host.root.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: false })!;

  let W = 0;
  let H = 0;
  let dpr = Math.min(host.dpr, 2);

  const st: State = {
    angle: 137.5,
    count: 1800,
    dotSize: 3,
    palette: 'plasma',
    colorBy: 'index',
    drift: false,
  };

  function resize(width: number, height: number) {
    dpr = Math.min(host.dpr, 2);
    W = Math.max(1, Math.round(width * dpr));
    H = Math.max(1, Math.round(height * dpr));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }

  function draw() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, W, H);

    const n = Math.round(st.count);
    const cx = W / 2;
    const cy = H / 2;
    const theta = (st.angle * Math.PI) / 180;
    const spread = (Math.min(W, H) * 0.46) / Math.sqrt(n);
    const dot = st.dotSize * dpr;

    for (let i = 1; i <= n; i++) {
      const r = spread * Math.sqrt(i);
      const a = i * theta;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const t = st.colorBy === 'radius' ? Math.sqrt(i / n) : i / n;
      const [cr, cg, cb] = sample(st.palette, t);
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      const size = dot * (0.4 + 0.6 * Math.sqrt(i / n));
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function update(dt: number) {
    if (st.drift) st.angle += 0.02 * (dt / 1000);
    draw();
  }

  function applyParams(p: ParamValues) {
    if (typeof p.angle === 'number') st.angle = p.angle;
    if (typeof p.count === 'number') st.count = p.count;
    if (typeof p.dotSize === 'number') st.dotSize = p.dotSize;
    if (typeof p.palette === 'string') st.palette = p.palette;
    if (typeof p.colorBy === 'string') st.colorBy = p.colorBy;
    if (typeof p.drift === 'boolean') st.drift = p.drift;
  }

  resize(host.width, host.height);

  return {
    update,
    resize,
    setParams: applyParams,
    randomize() {
      // Mix "near magic" angles with wild ones for variety.
      const near = Math.random() < 0.4;
      const angle = near
        ? 137.5 + (Math.random() - 0.5) * 4
        : Math.round(Math.random() * 360 * 1000) / 1000;
      const palettes = ['plasma', 'viridis', 'magma', 'aurora', 'turbo', 'ember'];
      const palette = palettes[Math.floor(Math.random() * palettes.length)];
      const count = 600 + Math.floor(Math.random() * 3400);
      const out: ParamValues = {
        angle: Math.round(angle * 1000) / 1000,
        count,
        palette,
        dotSize: st.dotSize,
        colorBy: st.colorBy,
        drift: st.drift,
      };
      applyParams(out);
      return out;
    },
    exportCanvas: () => canvas,
    destroy() {
      canvas.remove();
    },
  };
}

export const phyllotaxisDef: VizDef = {
  id: 'phyllotaxis',
  title: 'Phyllotaxis',
  tagline: 'One angle decides whether seeds pack like a sunflower or scatter.',
  about: `
    <p>Plants grow new florets one at a time, each rotated from the last by a fixed
    angle θ, drifting outward as <code>radius = c·√n</code>. The result depends
    entirely on θ.</p>
    <p>Rational fractions of a turn (like 90° or 144°) line the seeds up into a few
    radial arms with big gaps. The <strong>golden angle</strong>,
    <code>360° / φ² ≈ 137.507°</code>, is the "most irrational" angle — so no two
    seeds ever line up, and they fill space with the dense, seamless spirals you see
    in sunflowers, pinecones and pineapples.</p>
    <p>Nudge the angle a hair away from 137.5° and watch the perfect lattice shear
    into curving spirals.</p>`,
  params: [
    { type: 'range', key: 'angle', label: 'Angle (°)', min: 0, max: 360, step: 0.001, default: 137.5, format: (v) => v.toFixed(3) + '°' },
    { type: 'range', key: 'count', label: 'Seeds', min: 100, max: 6000, step: 10, default: 1800 },
    { type: 'range', key: 'dotSize', label: 'Dot size', min: 1, max: 9, step: 0.1, default: 3 },
    { type: 'palette', key: 'palette', label: 'Palette', default: 'plasma' },
    {
      type: 'select',
      key: 'colorBy',
      label: 'Color by',
      default: 'index',
      options: [
        { value: 'index', label: 'Order grown' },
        { value: 'radius', label: 'Distance out' },
      ],
    },
    { type: 'toggle', key: 'drift', label: 'Drift angle', default: false },
  ],
  create: makeInstance,
  thumbnail(canvas) {
    const c = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    c.fillStyle = '#05060d';
    c.fillRect(0, 0, w, h);
    const n = 900;
    const cx = w / 2;
    const cy = h / 2;
    const theta = (137.5 * Math.PI) / 180;
    const spread = (Math.min(w, h) * 0.46) / Math.sqrt(n);
    for (let i = 1; i <= n; i++) {
      const r = spread * Math.sqrt(i);
      const a = i * theta;
      const [cr, cg, cb] = sample('plasma', i / n);
      c.fillStyle = `rgb(${cr},${cg},${cb})`;
      c.beginPath();
      c.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.4 * (0.4 + 0.6 * Math.sqrt(i / n)), 0, Math.PI * 2);
      c.fill();
    }
  },
};
