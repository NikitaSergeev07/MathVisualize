// The runtime that hosts a single visualization: owns the canvas stage, the
// requestAnimationFrame loop, the control panel, export, resize and URL state.
// Each visualization stays focused on drawing; the engine handles the rest.

import type { ParamValue, ParamValues, VizDef, VizInstance } from './types';
import { defaultsFor } from './types';
import { createControlPanel, type ControlPanel } from './ui';
import { exportPng, Recorder, canRecord } from './export';
import { buildHash, coerceParams, shareUrl } from './url';

export interface EngineController {
  destroy(): void;
}

export function mountViz(def: VizDef, container: HTMLElement, rawParams: Record<string, string>): EngineController {
  container.innerHTML = '';

  // --- layout ---
  const stage = document.createElement('div');
  stage.className = 'viz-stage';
  container.append(stage);

  const topbar = buildTopbar(def);
  container.append(topbar.element);

  const aboutPanel = buildAbout(def);
  container.append(aboutPanel.element);

  // --- state ---
  const specs = def.params;
  const values: ParamValues = { ...defaultsFor(specs), ...coerceParams(specs, rawParams) };

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = stage.getBoundingClientRect();
  const instance: VizInstance = def.create({
    root: stage,
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    dpr,
  });
  instance.setParams(values);

  // --- control panel ---
  const recorder = new Recorder(def.id);
  const panel: ControlPanel = createControlPanel(
    specs,
    {
      onChange: (key, value) => {
        values[key] = value;
        instance.setParams({ [key]: value });
        scheduleUrlSync();
      },
      onRandom: () => {
        const next = instance.randomize();
        Object.assign(values, next);
        instance.setParams(values);
        panel.sync(values);
        scheduleUrlSync();
      },
      onExportPng: () => exportPng(instance.exportCanvas(), def.id),
      onToggleRecord: () => {
        if (recorder.recording) {
          recorder.stop();
          panel.setRecording(false);
          panel.toast('Saved .webm');
        } else {
          const ok = recorder.start(instance.exportCanvas());
          panel.setRecording(ok);
          panel.toast(ok ? 'Recording…' : 'Recording unsupported');
        }
      },
      onShare: async () => {
        const url = shareUrl(def.id, values);
        try {
          await navigator.clipboard.writeText(url);
          panel.toast('Link copied!');
        } catch {
          panel.toast('Copy failed — link in address bar');
        }
        history.replaceState(null, '', buildHash(def.id, values));
      },
    },
    { canRecord: canRecord() },
  );
  panel.sync(values);
  container.append(panel.element);

  // A visualization can push *derived* parameter changes back to the panel/URL
  // (e.g. picking a preset that sets several sliders at once) by dispatching a
  // `viz:params` CustomEvent on its root element.
  stage.addEventListener('viz:params', (e) => {
    const detail = (e as CustomEvent).detail as ParamValues;
    Object.assign(values, detail);
    panel.sync(values);
    scheduleUrlSync();
  });

  // --- URL sync (debounced; replaceState so we don't spam history or re-route) ---
  let urlTimer = 0;
  const scheduleUrlSync = () => {
    clearTimeout(urlTimer);
    urlTimer = window.setTimeout(() => {
      history.replaceState(null, '', buildHash(def.id, values));
    }, 250);
  };

  // --- render loop ---
  let raf = 0;
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(now - last, 100);
    last = now;
    instance.update(dt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // --- resize ---
  const ro = new ResizeObserver(() => {
    const r = stage.getBoundingClientRect();
    instance.resize(Math.max(1, r.width), Math.max(1, r.height));
  });
  ro.observe(stage);

  // --- keyboard shortcuts ---
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'r' || e.key === 'R') {
      const next = instance.randomize();
      Object.assign(values, next);
      instance.setParams(values);
      panel.sync(values);
      scheduleUrlSync();
    } else if (e.key === 'h' || e.key === 'H') {
      panel.element.classList.toggle('collapsed');
    } else if (e.key === 's' || e.key === 'S') {
      exportPng(instance.exportCanvas(), def.id);
    }
  };
  window.addEventListener('keydown', onKey);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      recorder.stop();
      clearTimeout(urlTimer);
      instance.destroy();
      container.innerHTML = '';
    },
  };
}

function buildTopbar(def: VizDef) {
  const bar = document.createElement('header');
  bar.className = 'viz-topbar';

  const back = document.createElement('a');
  back.className = 'viz-back';
  back.href = '#/';
  back.innerHTML = '<span>←</span> Gallery';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'viz-titlewrap';
  const h = document.createElement('h1');
  h.textContent = def.title;
  const tag = document.createElement('p');
  tag.textContent = def.tagline;
  titleWrap.append(h, tag);

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'btn viz-about-btn';
  aboutBtn.type = 'button';
  aboutBtn.textContent = 'What is this?';
  aboutBtn.dataset.about = 'toggle';

  bar.append(back, titleWrap, aboutBtn);
  return { element: bar };
}

function buildAbout(def: VizDef) {
  const overlay = document.createElement('div');
  overlay.className = 'about-overlay';
  const card = document.createElement('div');
  card.className = 'about-card';
  card.innerHTML = `<h2>${escapeHtml(def.title)}</h2>${def.about}<button class="btn about-close" type="button">Close</button>`;
  overlay.append(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || (e.target as HTMLElement).classList.contains('about-close')) {
      overlay.classList.remove('open');
    }
  });
  // Wire the topbar button (delegated via document since it's a sibling).
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement)?.dataset?.about === 'toggle') overlay.classList.toggle('open');
  });
  return { element: overlay };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

export type { ParamValue, ParamValues };
