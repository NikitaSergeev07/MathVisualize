// Modular multiplication circles. Place N points evenly on a circle and draw a
// chord from each i to (i*k mod N). As k varies, cardioids, nephroids and stars
// emerge. Fractional k makes the whole pattern morph continuously.

import type { ParamValues, VizDef, VizHost, VizInstance } from '../shared/types';
import { sample } from '../shared/palettes';

interface State {
  k: number;
  n: number;
  palette: string;
  glow: number;
  colorBy: string;
  autoplay: boolean;
  speed: number;
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
    k: 2,
    n: 400,
    palette: 'aurora',
    glow: 0.18,
    colorBy: 'index',
    autoplay: true,
    speed: 0.12,
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

    const n = Math.round(st.n);
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.44;
    const TWO_PI = Math.PI * 2;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, dpr * 0.7);

    // Reuse one palette gradient per "colorBy" choice via per-line strokeStyle.
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TWO_PI - Math.PI / 2;
      const target = (i * st.k) / n; // fractional target index (in turns)
      const a1 = target * TWO_PI - Math.PI / 2;

      const x0 = cx + Math.cos(a0) * R;
      const y0 = cy + Math.sin(a0) * R;
      const x1 = cx + Math.cos(a1) * R;
      const y1 = cy + Math.sin(a1) * R;

      let t: number;
      if (st.colorBy === 'length') {
        const dx = x1 - x0;
        const dy = y1 - y0;
        t = Math.hypot(dx, dy) / (2 * R);
      } else {
        t = i / n;
      }
      const [r, g, b] = sample(st.palette, t);
      ctx.strokeStyle = `rgba(${r},${g},${b},${st.glow})`;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }

  function update(dt: number) {
    if (st.autoplay && st.speed > 0) {
      st.k += st.speed * (dt / 1000);
    }
    draw();
  }

  function applyParams(p: ParamValues) {
    if (typeof p.k === 'number') st.k = p.k;
    if (typeof p.n === 'number') st.n = p.n;
    if (typeof p.glow === 'number') st.glow = p.glow;
    if (typeof p.speed === 'number') st.speed = p.speed;
    if (typeof p.palette === 'string') st.palette = p.palette;
    if (typeof p.colorBy === 'string') st.colorBy = p.colorBy;
    if (typeof p.autoplay === 'boolean') st.autoplay = p.autoplay;
  }

  resize(host.width, host.height);

  return {
    update,
    resize,
    setParams: applyParams,
    randomize() {
      const k = Math.round((2 + Math.random() * 58) * 1000) / 1000;
      const n = 80 + Math.floor(Math.random() * 900);
      const palettes = ['aurora', 'inferno', 'turbo', 'ice', 'sunset', 'plasma'];
      const palette = palettes[Math.floor(Math.random() * palettes.length)];
      const out: ParamValues = { k, n, palette, glow: st.glow, colorBy: st.colorBy, autoplay: st.autoplay, speed: st.speed };
      applyParams(out);
      return out;
    },
    exportCanvas: () => canvas,
    destroy() {
      canvas.remove();
    },
  };
}

export const multiplicationDef: VizDef = {
  id: 'times-tables',
  title: 'Modular Times Tables',
  tagline: 'Multiplication on a circle draws cardioids, stars and hearts.',
  about: `
    <p>Mark <strong>N</strong> points evenly around a circle, numbered
    <code>0 … N−1</code>. For each point <code>i</code>, draw a line to point
    <code>(i × k) mod N</code>. That's it — one multiplication per chord.</p>
    <p>The envelope of all those chords forms astonishing curves. At
    <strong>k = 2</strong> you get a <em>cardioid</em>; at 3 a <em>nephroid</em>; and
    other values produce many-petalled stars. Because we allow <em>fractional</em> k,
    you can watch one figure melt smoothly into the next.</p>
    <p>This is a hands-on view of the same multiply-and-wrap arithmetic behind
    modular math and even some cryptography.</p>`,
  params: [
    { type: 'range', key: 'k', label: 'Multiplier k', min: 1, max: 100, step: 0.001, default: 2, format: (v) => v.toFixed(3) },
    { type: 'range', key: 'n', label: 'Points N', min: 16, max: 2000, step: 1, default: 400 },
    { type: 'palette', key: 'palette', label: 'Palette', default: 'aurora' },
    { type: 'range', key: 'glow', label: 'Line glow', min: 0.02, max: 1, step: 0.01, default: 0.18 },
    {
      type: 'select',
      key: 'colorBy',
      label: 'Color by',
      default: 'index',
      options: [
        { value: 'index', label: 'Position' },
        { value: 'length', label: 'Chord length' },
      ],
    },
    { type: 'toggle', key: 'autoplay', label: 'Animate k', default: true },
    { type: 'range', key: 'speed', label: 'Speed', min: 0, max: 2, step: 0.01, default: 0.12 },
  ],
  create: makeInstance,
  thumbnail(canvas) {
    const c = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    c.fillStyle = '#05060d';
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';
    const n = 360;
    const k = 2;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.44;
    const TWO_PI = Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TWO_PI - Math.PI / 2;
      const a1 = ((i * k) / n) * TWO_PI - Math.PI / 2;
      const [r, g, b] = sample('aurora', i / n);
      c.strokeStyle = `rgba(${r},${g},${b},0.25)`;
      c.beginPath();
      c.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
      c.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
      c.stroke();
    }
  },
};
