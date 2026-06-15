// The landing gallery: a grid of cards, each with a live (statically rendered)
// thumbnail and a link into the visualization.

import { VISUALIZATIONS } from './viz/registry';
import { makeGradientCss } from './shared/palettes';

const FALLBACK_PALETTES = ['inferno', 'aurora', 'turbo', 'sunset', 'ice'];

export function renderGallery(container: HTMLElement): void {
  container.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'gallery';

  const hero = document.createElement('header');
  hero.className = 'hero';
  hero.innerHTML = `
    <h1 class="hero-title">Math<span>Visualize</span></h1>
    <p class="hero-sub">An open gallery of interactive mathematical art. Play with the
    sliders, roll the dice, and share the exact picture you find.</p>`;
  page.append(hero);

  const grid = document.createElement('div');
  grid.className = 'grid';
  page.append(grid);

  VISUALIZATIONS.forEach((viz, i) => {
    const card = document.createElement('a');
    card.className = 'card';
    card.href = `#/v/${viz.id}`;

    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';

    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 320;
    thumb.append(canvas);

    if (viz.thumbnail) {
      // defer so the grid paints first
      requestAnimationFrame(() => {
        try {
          viz.thumbnail!(canvas, 1234 + i);
        } catch {
          thumb.style.background = makeGradientCss(FALLBACK_PALETTES[i % FALLBACK_PALETTES.length], '135deg');
        }
      });
    } else {
      thumb.style.background = makeGradientCss(FALLBACK_PALETTES[i % FALLBACK_PALETTES.length], '135deg');
    }

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.innerHTML = `<h2>${viz.title}</h2><p>${viz.tagline}</p>`;

    card.append(thumb, meta);
    grid.append(card);
  });

  const footer = document.createElement('footer');
  footer.className = 'gallery-footer';
  footer.innerHTML = `
    <p>Built with Vite + TypeScript · WebGL & Canvas · <a href="https://github.com" target="_blank" rel="noopener">Source on GitHub</a> · MIT licensed</p>`;
  page.append(footer);

  container.append(page);
}
