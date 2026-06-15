// Gray-Scott reaction-diffusion on the GPU. Two chemicals U and V diffuse and
// react; tiny differences in the feed/kill rates grow into corals, stripes,
// spots and mazes. Simulated with ping-pong float textures; paint with the mouse
// to seed new growth.

import type { ParamValues, VizDef, VizHost, VizInstance } from '../shared/types';
import { getGL, program, fullscreenTriangle, VERT_FULLSCREEN, createTexture } from '../shared/gl';
import { paletteTexture } from '../shared/palettes';

const PRESETS: Record<string, { feed: number; kill: number }> = {
  coral: { feed: 0.0545, kill: 0.062 },
  mitosis: { feed: 0.0367, kill: 0.0649 },
  zebra: { feed: 0.078, kill: 0.061 },
  maze: { feed: 0.029, kill: 0.057 },
  bubbles: { feed: 0.012, kill: 0.05 },
  cells: { feed: 0.022, kill: 0.051 },
};

const SIM_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uTexel;
uniform float uFeed, uKill, uDu, uDv;
in vec2 vUv;
out vec4 frag;
void main() {
  vec2 s = texture(uState, vUv).xy;
  float u = s.x, v = s.y;
  vec2 lap = vec2(0.0);
  lap += texture(uState, vUv + uTexel * vec2(-1.0, 0.0)).xy * 0.2;
  lap += texture(uState, vUv + uTexel * vec2( 1.0, 0.0)).xy * 0.2;
  lap += texture(uState, vUv + uTexel * vec2( 0.0,-1.0)).xy * 0.2;
  lap += texture(uState, vUv + uTexel * vec2( 0.0, 1.0)).xy * 0.2;
  lap += texture(uState, vUv + uTexel * vec2(-1.0,-1.0)).xy * 0.05;
  lap += texture(uState, vUv + uTexel * vec2( 1.0,-1.0)).xy * 0.05;
  lap += texture(uState, vUv + uTexel * vec2(-1.0, 1.0)).xy * 0.05;
  lap += texture(uState, vUv + uTexel * vec2( 1.0, 1.0)).xy * 0.05;
  lap += s * -1.0;
  float reaction = u * v * v;
  float du = uDu * lap.x - reaction + uFeed * (1.0 - u);
  float dv = uDv * lap.y + reaction - (uKill + uFeed) * v;
  float nu = clamp(u + du, 0.0, 1.0);
  float nv = clamp(v + dv, 0.0, 1.0);
  frag = vec4(nu, nv, 0.0, 1.0);
}`;

const SPLAT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform vec2 uMouse;
uniform float uRadius;
uniform float uAspect;
uniform float uErase;
in vec2 vUv;
out vec4 frag;
void main() {
  vec2 s = texture(uState, vUv).xy;
  vec2 d = vUv - uMouse;
  d.x *= uAspect;
  float r = length(d);
  float amt = smoothstep(uRadius, 0.0, r);
  if (uErase > 0.5) {
    s.y = clamp(s.y - amt, 0.0, 1.0);
    s.x = clamp(s.x + amt * 0.5, 0.0, 1.0);
  } else {
    s.y = clamp(s.y + amt, 0.0, 1.0);
    s.x = clamp(s.x - amt * 0.5, 0.0, 1.0);
  }
  frag = vec4(s, 0.0, 1.0);
}`;

const DISPLAY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uState;
uniform sampler2D uPalette;
in vec2 vUv;
out vec4 frag;
void main() {
  float v = texture(uState, vUv).y;
  float t = pow(clamp(v / 0.4, 0.0, 1.0), 0.75);
  vec3 col = texture(uPalette, vec2(t, 0.5)).rgb;
  frag = vec4(col, 1.0);
}`;

function makeInstance(host: VizHost): VizInstance {
  const canvas = document.createElement('canvas');
  canvas.className = 'viz-canvas';
  host.root.append(canvas);
  const gl = getGL(canvas);

  const floatExt = gl.getExtension('EXT_color_buffer_float');
  const useFloat = !!floatExt;
  const internalFormat = useFloat ? gl.RGBA16F : gl.RGBA8;
  const dataType = useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;

  const simProg = program(gl, VERT_FULLSCREEN, SIM_FRAG);
  const splatProg = program(gl, VERT_FULLSCREEN, SPLAT_FRAG);
  const dispProg = program(gl, VERT_FULLSCREEN, DISPLAY_FRAG);
  const vao = fullscreenTriangle(gl);
  let palTex = paletteTexture(gl, 'inferno');

  let simW = 0;
  let simH = 0;
  let texA: WebGLTexture | null = null;
  let texB: WebGLTexture | null = null;
  let fboA: WebGLFramebuffer | null = null;
  let fboB: WebGLFramebuffer | null = null;

  const st = {
    feed: 0.0545,
    kill: 0.062,
    palette: 'inferno',
    brush: 0.06,
    speed: 12,
  };

  // pointer painting
  let painting = false;
  let erase = false;
  let mouseUv: [number, number] = [0.5, 0.5];

  function makeStateTexture(data: ArrayBufferView | null): WebGLTexture {
    return createTexture(gl, simW, simH, {
      internalFormat,
      format: gl.RGBA,
      type: dataType,
      filter: gl.LINEAR,
      data,
    });
  }

  function makeFbo(tex: WebGLTexture): WebGLFramebuffer {
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return fbo;
  }

  function seedData(): ArrayBufferView {
    const n = simW * simH * 4;
    if (useFloat) {
      const arr = new Float32Array(n);
      for (let i = 0; i < simW * simH; i++) {
        arr[i * 4] = 1; // u
        arr[i * 4 + 1] = 0; // v
        arr[i * 4 + 3] = 1;
      }
      stampBlobs((x, y, val) => {
        const idx = (y * simW + x) * 4;
        arr[idx] = 1 - val * 0.5;
        arr[idx + 1] = Math.max(arr[idx + 1], val);
      });
      return arr;
    } else {
      const arr = new Uint8Array(n);
      for (let i = 0; i < simW * simH; i++) {
        arr[i * 4] = 255;
        arr[i * 4 + 1] = 0;
        arr[i * 4 + 3] = 255;
      }
      stampBlobs((x, y, val) => {
        const idx = (y * simW + x) * 4;
        arr[idx] = Math.round((1 - val * 0.5) * 255);
        arr[idx + 1] = Math.max(arr[idx + 1], Math.round(val * 255));
      });
      return arr;
    }
  }

  function stampBlobs(set: (x: number, y: number, val: number) => void) {
    const blobs = 8 + Math.floor(Math.random() * 8);
    for (let b = 0; b < blobs; b++) {
      const bx = Math.floor(Math.random() * simW);
      const by = Math.floor(Math.random() * simH);
      const rad = 3 + Math.floor(Math.random() * 8);
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const x = bx + dx;
          const y = by + dy;
          if (x < 0 || y < 0 || x >= simW || y >= simH) continue;
          if (dx * dx + dy * dy > rad * rad) continue;
          set(x, y, 1);
        }
      }
    }
  }

  function reseed() {
    const data = seedData();
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, simW, simH, 0, gl.RGBA, dataType, data);
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, simW, simH, 0, gl.RGBA, dataType, data);
  }

  function resize(width: number, height: number) {
    const dpr = Math.min(host.dpr, 2);
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const longSide = 520;
    const aspect = width / height;
    if (aspect >= 1) {
      simW = longSide;
      simH = Math.max(1, Math.round(longSide / aspect));
    } else {
      simH = longSide;
      simW = Math.max(1, Math.round(longSide * aspect));
    }
    // free previous buffers before reallocating
    if (texA) gl.deleteTexture(texA);
    if (texB) gl.deleteTexture(texB);
    if (fboA) gl.deleteFramebuffer(fboA);
    if (fboB) gl.deleteFramebuffer(fboB);
    const ta = makeStateTexture(null);
    const tb = makeStateTexture(null);
    texA = ta;
    texB = tb;
    fboA = makeFbo(ta);
    fboB = makeFbo(tb);
    reseed();
  }

  function runProgram(prog: WebGLProgram, fbo: WebGLFramebuffer | null, w: number, h: number) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function simStep() {
    // read texA -> write texB
    gl.useProgram(simProg);
    gl.uniform2f(gl.getUniformLocation(simProg, 'uTexel'), 1 / simW, 1 / simH);
    gl.uniform1f(gl.getUniformLocation(simProg, 'uFeed'), st.feed);
    gl.uniform1f(gl.getUniformLocation(simProg, 'uKill'), st.kill);
    gl.uniform1f(gl.getUniformLocation(simProg, 'uDu'), 0.2097);
    gl.uniform1f(gl.getUniformLocation(simProg, 'uDv'), 0.105);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(gl.getUniformLocation(simProg, 'uState'), 0);
    runProgram(simProg, fboB, simW, simH);
    swap();
  }

  function splat() {
    gl.useProgram(splatProg);
    gl.uniform2f(gl.getUniformLocation(splatProg, 'uMouse'), mouseUv[0], mouseUv[1]);
    gl.uniform1f(gl.getUniformLocation(splatProg, 'uRadius'), st.brush);
    gl.uniform1f(gl.getUniformLocation(splatProg, 'uAspect'), simW / simH);
    gl.uniform1f(gl.getUniformLocation(splatProg, 'uErase'), erase ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(gl.getUniformLocation(splatProg, 'uState'), 0);
    runProgram(splatProg, fboB, simW, simH);
    swap();
  }

  function swap() {
    [texA, texB] = [texB, texA];
    [fboA, fboB] = [fboB, fboA];
  }

  function display() {
    gl.useProgram(dispProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform1i(gl.getUniformLocation(dispProg, 'uState'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, palTex);
    gl.uniform1i(gl.getUniformLocation(dispProg, 'uPalette'), 1);
    runProgram(dispProg, null, canvas.width, canvas.height);
  }

  function update() {
    if (painting) splat();
    const steps = Math.round(st.speed);
    for (let i = 0; i < steps; i++) simStep();
    display();
  }

  function applyParams(p: ParamValues) {
    if (typeof p.feed === 'number') st.feed = p.feed;
    if (typeof p.kill === 'number') st.kill = p.kill;
    if (typeof p.brush === 'number') st.brush = p.brush;
    if (typeof p.speed === 'number') st.speed = p.speed;
    if (typeof p.preset === 'string' && PRESETS[p.preset]) {
      st.feed = PRESETS[p.preset].feed;
      st.kill = PRESETS[p.preset].kill;
      // reflect into the sliders/URL
      host.root.dispatchEvent(
        new CustomEvent('viz:params', { detail: { feed: st.feed, kill: st.kill } }),
      );
    }
    if (typeof p.palette === 'string') {
      st.palette = p.palette;
      palTex = paletteTexture(gl, st.palette, palTex);
    }
  }

  // --- pointer handlers ---
  function toUv(e: PointerEvent): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  }
  const onDown = (e: PointerEvent) => {
    painting = true;
    erase = e.button === 2 || e.shiftKey;
    mouseUv = toUv(e);
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (painting) mouseUv = toUv(e);
  };
  const onUp = () => {
    painting = false;
  };
  const onCtx = (e: Event) => e.preventDefault();
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  canvas.addEventListener('contextmenu', onCtx);

  resize(host.width, host.height);

  return {
    update,
    resize,
    setParams: applyParams,
    randomize() {
      const names = Object.keys(PRESETS);
      const preset = names[Math.floor(Math.random() * names.length)];
      const palettes = ['inferno', 'magma', 'aurora', 'ice', 'ember', 'viridis'];
      const palette = palettes[Math.floor(Math.random() * palettes.length)];
      reseed();
      const out: ParamValues = { preset, palette, brush: st.brush, speed: st.speed };
      applyParams(out);
      // applyParams already emitted feed/kill; return them too for the URL
      return { ...out, feed: st.feed, kill: st.kill };
    },
    exportCanvas: () => canvas,
    destroy() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('contextmenu', onCtx);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}

export const reactionDiffusionDef: VizDef = {
  id: 'reaction-diffusion',
  title: 'Reaction-Diffusion',
  tagline: 'Two chemicals chase each other into living, growing patterns.',
  about: `
    <p>The <strong>Gray-Scott</strong> model tracks two virtual chemicals. <em>U</em>
    is fed in everywhere; <em>V</em> is removed. When they meet, the reaction
    <code>U + 2V → 3V</code> converts U into more V. Both also diffuse, V more slowly
    than U.</p>
    <p>That's the whole rule — yet by nudging just the <strong>feed</strong> and
    <strong>kill</strong> rates you get coral reefs, zebra stripes, dividing cells,
    mazes and pulsing spots. These same equations explain real patterns on seashells
    and animal coats (Alan Turing first proposed the idea in 1952).</p>
    <p><strong>Drag</strong> on the canvas to paint new seeds. Hold <em>Shift</em> or
    right-drag to erase.</p>`,
  params: [
    {
      type: 'select',
      key: 'preset',
      label: 'Preset',
      default: 'coral',
      options: [
        { value: 'coral', label: 'Corals' },
        { value: 'zebra', label: 'Zebra' },
        { value: 'cells', label: 'Cells' },
        { value: 'mitosis', label: 'Mitosis' },
        { value: 'maze', label: 'Maze' },
        { value: 'bubbles', label: 'Bubbles' },
      ],
    },
    { type: 'range', key: 'feed', label: 'Feed', min: 0.005, max: 0.1, step: 0.0001, default: 0.0545, format: (v) => v.toFixed(4) },
    { type: 'range', key: 'kill', label: 'Kill', min: 0.03, max: 0.07, step: 0.0001, default: 0.062, format: (v) => v.toFixed(4) },
    { type: 'palette', key: 'palette', label: 'Palette', default: 'inferno' },
    { type: 'range', key: 'brush', label: 'Brush size', min: 0.01, max: 0.2, step: 0.005, default: 0.06 },
    { type: 'range', key: 'speed', label: 'Steps / frame', min: 1, max: 24, step: 1, default: 12 },
  ],
  create: makeInstance,
  thumbnail(canvas) {
    // organic gradient placeholder (running a full sim for a thumb is overkill)
    const c = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const g = c.createRadialGradient(w * 0.4, h * 0.4, 10, w * 0.5, h * 0.5, w * 0.7);
    g.addColorStop(0, '#fcffa4');
    g.addColorStop(0.3, '#ed6925');
    g.addColorStop(0.7, '#781c6d');
    g.addColorStop(1, '#000004');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'overlay';
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 4 + Math.random() * 26;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fillStyle = `rgba(${20 + Math.random() * 60},0,${40 + Math.random() * 60},0.4)`;
      c.fill();
    }
  },
};
