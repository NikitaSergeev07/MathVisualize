// Strange attractors — Clifford & De Jong (2D maps), Lorenz & Thomas (3D flows).
// Hundreds of thousands of points accumulate into a Float32 density buffer which
// is tone-mapped through a palette for a glowing, additive look.

import type { ParamValues, VizDef, VizHost, VizInstance } from '../shared/types';
import { makeLUT } from '../shared/palettes';

type AttractorType = 'clifford' | 'dejong' | 'lorenz' | 'thomas';

interface State {
  type: AttractorType;
  a: number;
  b: number;
  c: number;
  d: number;
  palette: string;
  exposure: number;
  densityK: number;
  autoRotate: boolean;
  rotSpeed: number;
}

const is3D = (t: AttractorType) => t === 'lorenz' || t === 'thomas';

function makeInstance(host: VizHost): VizInstance {
  const canvas = document.createElement('canvas');
  canvas.className = 'viz-canvas';
  host.root.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: false })!;

  let W = 0;
  let H = 0; // backing-store size (pixels)
  let density!: Float32Array;
  let image!: ImageData;
  let lut = makeLUT('inferno');

  const st: State = {
    type: 'clifford',
    a: -1.4,
    b: 1.6,
    c: 1.0,
    d: 0.7,
    palette: 'inferno',
    exposure: 0.9,
    densityK: 120,
    autoRotate: true,
    rotSpeed: 0.25,
  };

  // trajectory + view
  let px = 0.1;
  let py = 0;
  let pz = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0; // centroid
  let scale = 1;
  let yaw = 0.6;
  let pitch = 0.5;
  let dirty = true; // re-fit needed
  let accumFrames = 0;
  let needsTone = false; // force a re-tone-map (e.g. palette changed while static)

  function resize(width: number, height: number) {
    const dpr = Math.min(host.dpr, 1.5);
    const longSide = Math.max(width, height) * dpr;
    const k = longSide > 1300 ? 1300 / longSide : 1;
    W = Math.max(1, Math.round(width * dpr * k));
    H = Math.max(1, Math.round(height * dpr * k));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    density = new Float32Array(W * H);
    image = ctx.createImageData(W, H);
    dirty = true;
  }

  // --- attractor step (returns next point in model space) ---
  function step() {
    const { a, b, c, d } = st;
    switch (st.type) {
      case 'clifford': {
        const nx = Math.sin(a * py) + c * Math.cos(a * px);
        const ny = Math.sin(b * px) + d * Math.cos(b * py);
        px = nx;
        py = ny;
        pz = 0;
        break;
      }
      case 'dejong': {
        const nx = Math.sin(a * py) - Math.cos(b * px);
        const ny = Math.sin(c * px) - Math.cos(d * py);
        px = nx;
        py = ny;
        pz = 0;
        break;
      }
      case 'lorenz': {
        // sliders -> canonical-ish ranges
        const sigma = 4 + ((a + 3) / 6) * 16; // [4,20]
        const rho = 14 + ((b + 3) / 6) * 28; // [14,42]
        const beta = 1 + ((c + 3) / 6) * 3; // [1,4]
        const dt = 0.006;
        const dx = sigma * (py - px);
        const dy = px * (rho - pz) - py;
        const dz = px * py - beta * pz;
        px += dx * dt;
        py += dy * dt;
        pz += dz * dt;
        break;
      }
      case 'thomas': {
        const bc = 0.1 + ((a + 3) / 6) * 0.18; // [0.1,0.28]
        const dt = 0.06;
        const dx = Math.sin(py) - bc * px;
        const dy = Math.sin(pz) - bc * py;
        const dz = Math.sin(px) - bc * pz;
        px += dx * dt;
        py += dy * dt;
        pz += dz * dt;
        break;
      }
    }
  }

  function reseed() {
    px = is3D(st.type) ? 0.1 : st.a * 0.1 + 0.1;
    py = is3D(st.type) ? 0 : 0.1;
    pz = is3D(st.type) ? 0.2 : 0;
  }

  // Warm up + compute bounding sphere so any parameters frame nicely.
  function refit(): boolean {
    reseed();
    for (let i = 0; i < 1000; i++) step(); // settle onto attractor
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    const N = 4000;
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];
    for (let i = 0; i < N; i++) {
      step();
      if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) return false;
      sx += px;
      sy += py;
      sz += pz;
      xs.push(px);
      ys.push(py);
      zs.push(pz);
      n++;
    }
    cx = sx / n;
    cy = sy / n;
    cz = sz / n;
    let r = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - cx;
      const dy = ys[i] - cy;
      const dz = zs[i] - cz;
      r = Math.max(r, Math.hypot(dx, dy, dz));
    }
    if (!Number.isFinite(r) || r < 1e-4 || r > 1e6) return false;
    const fit = 0.42 * Math.min(W, H);
    scale = fit / r;
    reseed();
    for (let i = 0; i < 1000; i++) step();
    return true;
  }

  function clearDensity() {
    density.fill(0);
    accumFrames = 0;
  }

  function accumulate(count: number) {
    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const cpit = Math.cos(pitch);
    const spit = Math.sin(pitch);
    const ox = W * 0.5;
    const oy = H * 0.5;
    const three = is3D(st.type);
    for (let i = 0; i < count; i++) {
      step();
      const x = px - cx;
      const y = py - cy;
      const z = pz - cz;
      let X: number;
      let Y: number;
      if (three) {
        // yaw about Y, then pitch about X
        const x1 = x * cyaw + z * syaw;
        const z1 = -x * syaw + z * cyaw;
        const y2 = y * cpit - z1 * spit;
        X = x1;
        Y = y2;
      } else {
        // in-plane spin
        X = x * cyaw - y * syaw;
        Y = x * syaw + y * cyaw;
      }
      const sxp = (ox + X * scale) | 0;
      const syp = (oy - Y * scale) | 0;
      if (sxp >= 0 && sxp < W && syp >= 0 && syp < H) {
        density[syp * W + sxp] += 1;
      }
    }
    accumFrames++;
  }

  function toneMap() {
    const data = image.data;
    const exposure = st.exposure / Math.max(1, accumFrames * 0.5);
    for (let i = 0, p = 0; i < density.length; i++, p += 4) {
      const dval = density[i];
      // filmic-ish saturating curve -> [0,1]
      const v = 1 - Math.exp(-dval * exposure);
      const idx = (v * 255) | 0;
      const li = idx << 2;
      const bright = v; // fade to black at low density for clean dark background
      data[p] = lut[li] * bright;
      data[p + 1] = lut[li + 1] * bright;
      data[p + 2] = lut[li + 2] * bright;
      data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  function update(dt: number) {
    if (dirty) {
      const ok = refit();
      clearDensity();
      dirty = false;
      if (!ok) {
        // bad params: show nothing rather than NaN soup
        ctx.fillStyle = '#06070d';
        ctx.fillRect(0, 0, W, H);
        return;
      }
    }

    const rotating = st.autoRotate && st.rotSpeed > 0;
    if (rotating) {
      yaw += st.rotSpeed * (dt / 1000);
      clearDensity();
    }

    const budget = Math.round(st.densityK * 1000);
    // Cap progressive accumulation so a static view eventually stops working.
    let drew = false;
    if (rotating || accumFrames < 40) {
      accumulate(budget);
      toneMap();
      drew = true;
    }
    if (needsTone && !drew) toneMap();
    needsTone = false;
  }

  function applyParams(p: ParamValues) {
    let needFit = false;
    if (p.type !== undefined && p.type !== st.type) {
      st.type = p.type as AttractorType;
      needFit = true;
    }
    for (const key of ['a', 'b', 'c', 'd', 'exposure', 'rotSpeed', 'densityK'] as const) {
      const val = p[key];
      if (typeof val === 'number') {
        if (key === 'a' || key === 'b' || key === 'c' || key === 'd') needFit = needFit || val !== st[key];
        st[key] = val;
      }
    }
    if (typeof p.autoRotate === 'boolean') st.autoRotate = p.autoRotate;
    if (typeof p.palette === 'string') {
      st.palette = p.palette;
      lut = makeLUT(st.palette);
      needsTone = true; // re-tone-map current density with the new colors
    }
    if (needFit) dirty = true;
  }

  // --- pointer drag to rotate ---
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.01;
    if (is3D(st.type)) pitch += (e.clientY - lastY) * 0.01;
    lastX = e.clientX;
    lastY = e.clientY;
    clearDensity();
  };
  const onUp = () => {
    dragging = false;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  resize(host.width, host.height);

  return {
    update,
    resize,
    setParams: applyParams,
    randomize() {
      const type: AttractorType =
        Math.random() < 0.65
          ? Math.random() < 0.5
            ? 'clifford'
            : 'dejong'
          : Math.random() < 0.5
            ? 'lorenz'
            : 'thomas';
      // try a few coefficient sets until one produces a bounded attractor
      let chosen: ParamValues | null = null;
      for (let attempt = 0; attempt < 24 && !chosen; attempt++) {
        const cand: State = {
          ...st,
          type,
          a: rand(-2.5, 2.5),
          b: rand(-2.5, 2.5),
          c: rand(-2.5, 2.5),
          d: rand(-2.5, 2.5),
        };
        Object.assign(st, cand);
        if (refit()) {
          chosen = { type, a: cand.a, b: cand.b, c: cand.c, d: cand.d };
        }
      }
      const result: ParamValues = chosen ?? { type, a: st.a, b: st.b, c: st.c, d: st.d };
      result.palette = st.palette;
      result.exposure = st.exposure;
      result.densityK = st.densityK;
      result.autoRotate = st.autoRotate;
      result.rotSpeed = st.rotSpeed;
      return result;
    },
    exportCanvas: () => canvas,
    destroy() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      canvas.remove();
    },
  };
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export const attractorsDef: VizDef = {
  id: 'attractors',
  title: 'Strange Attractors',
  tagline: 'Chaotic trajectories condense into glowing clouds of light.',
  about: `
    <p>A <strong>strange attractor</strong> is the shape a chaotic dynamical system
    settles onto. Each new point is computed from the previous one by a fixed rule,
    yet the orbit never repeats — it threads endlessly through the same delicate,
    fractal cloud.</p>
    <p>Here we plot hundreds of thousands of iterations and let them accumulate.
    Where the trajectory lingers, light builds up; the brightness you see is literally
    how often the system visits each point.</p>
    <ul>
      <li><strong>Clifford & De Jong</strong> — 2D maps of sines and cosines.</li>
      <li><strong>Lorenz</strong> — the original "butterfly", a model of convection.</li>
      <li><strong>Thomas</strong> — a cyclically symmetric 3D flow.</li>
    </ul>
    <p>Drag to rotate. Hit <em>Random</em> for a fresh set of coefficients — most are
    beautiful, some are duds, that's chaos.</p>`,
  params: [
    {
      type: 'select',
      key: 'type',
      label: 'Attractor',
      default: 'clifford',
      options: [
        { value: 'clifford', label: 'Clifford (2D)' },
        { value: 'dejong', label: 'De Jong (2D)' },
        { value: 'lorenz', label: 'Lorenz (3D)' },
        { value: 'thomas', label: 'Thomas (3D)' },
      ],
    },
    { type: 'range', key: 'a', label: 'Coefficient A', min: -3, max: 3, step: 0.001, default: -1.4 },
    { type: 'range', key: 'b', label: 'Coefficient B', min: -3, max: 3, step: 0.001, default: 1.6 },
    { type: 'range', key: 'c', label: 'Coefficient C', min: -3, max: 3, step: 0.001, default: 1.0 },
    { type: 'range', key: 'd', label: 'Coefficient D', min: -3, max: 3, step: 0.001, default: 0.7 },
    { type: 'palette', key: 'palette', label: 'Palette', default: 'inferno' },
    { type: 'range', key: 'exposure', label: 'Exposure', min: 0.1, max: 4, step: 0.01, default: 0.9 },
    { type: 'range', key: 'densityK', label: 'Density (×1k/frame)', min: 20, max: 400, step: 10, default: 120 },
    { type: 'toggle', key: 'autoRotate', label: 'Auto-rotate', default: true },
    { type: 'range', key: 'rotSpeed', label: 'Rotation speed', min: 0, max: 1, step: 0.01, default: 0.25 },
  ],
  create: makeInstance,
  thumbnail(canvas) {
    // cheap static Clifford preview
    const c = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    c.fillStyle = '#070813';
    c.fillRect(0, 0, w, h);
    const lut = makeLUT('inferno');
    let x = 0.1;
    let y = 0;
    const a = -1.7;
    const b = 1.8;
    const cc = -1.0;
    const d = -0.4;
    const img = c.getImageData(0, 0, w, h);
    const dens = new Float32Array(w * h);
    for (let i = 0; i < 60000; i++) {
      const nx = Math.sin(a * y) + cc * Math.cos(a * x);
      const ny = Math.sin(b * x) + d * Math.cos(b * y);
      x = nx;
      y = ny;
      const sx = ((x / 3.2 + 0.5) * w) | 0;
      const sy = ((y / 3.2 + 0.5) * h) | 0;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) dens[sy * w + sx] += 1;
    }
    for (let i = 0, p = 0; i < dens.length; i++, p += 4) {
      const v = 1 - Math.exp(-dens[i] * 0.5);
      const li = ((v * 255) | 0) << 2;
      img.data[p] = lut[li] * v;
      img.data[p + 1] = lut[li + 1] * v;
      img.data[p + 2] = lut[li + 2] * v;
      img.data[p + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  },
};
