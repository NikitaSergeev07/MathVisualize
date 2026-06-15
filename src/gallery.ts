// The landing gallery: editorial, minimal, warm. Live (statically rendered)
// thumbnails sit framed like artworks; pixel-art accents add personality.

import { VISUALIZATIONS } from './viz/registry';
import { makeGradientCss } from './shared/palettes';
import { SPARKLE, mascotSvg, rainSparkles } from './shared/pixel';

const REPO = 'https://github.com/NikitaSergeev07/MathVisualize';
const FALLBACK_PALETTES = ['inferno', 'aurora', 'turbo', 'sunset', 'ice'];

export function renderGallery(container: HTMLElement): void {
  container.innerHTML = '';

  const header = document.createElement('header');
  header.className = 'site-header';
  header.innerHTML = `
    <a class="wordmark" href="#/">${SPARKLE('#d97f57', 3)}MathVisualize</a>
    <nav class="site-nav">
      <a href="#" class="surprise" data-surprise>Surprise me</a>
      <a href="${REPO}" target="_blank" rel="noopener">GitHub</a>
      <a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener">MIT</a>
    </nav>`;
  header.querySelector('[data-surprise]')?.addEventListener('click', (e) => {
    e.preventDefault();
    const viz = VISUALIZATIONS[Math.floor(Math.random() * VISUALIZATIONS.length)];
    location.hash = `#/v/${viz.id}?rand=1`;
  });
  container.append(header);

  const page = document.createElement('div');
  page.className = 'gallery';

  const hero = document.createElement('section');
  hero.className = 'hero fade-up';
  hero.innerHTML = `
    <span class="eyebrow">${SPARKLE('#d97f57', 2)} Open-source gallery</span>
    <h1 class="hero-title">Mathematics you can <em>play</em> with.</h1>
    <p class="hero-sub">A small collection of interactive visualizations. Move a slider,
    roll the dice, and share a link to the exact picture you find.</p>`;
  page.append(hero);

  const grid = document.createElement('div');
  grid.className = 'grid';
  page.append(grid);

  // Render thumbnails one per frame instead of all at once — no load-time jank.
  const thumbJobs: Array<() => void> = [];

  VISUALIZATIONS.forEach((viz, i) => {
    const card = document.createElement('a');
    card.className = 'card fade-up';
    card.style.animationDelay = `${0.06 * (i + 1)}s`;
    card.href = `#/v/${viz.id}`;

    const thumb = document.createElement('div');
    thumb.className = 'card-thumb';
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 320;
    thumb.append(canvas);

    thumbJobs.push(() => {
      if (viz.thumbnail) {
        try {
          viz.thumbnail(canvas, 1234 + i);
        } catch {
          thumb.style.background = makeGradientCss(FALLBACK_PALETTES[i % FALLBACK_PALETTES.length], '135deg');
        }
      } else {
        thumb.style.background = makeGradientCss(FALLBACK_PALETTES[i % FALLBACK_PALETTES.length], '135deg');
      }
    });

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.innerHTML = `
      <span class="card-index">${String(i + 1).padStart(2, '0')}</span>
      <h2>${viz.title}</h2>
      <p>${viz.tagline}</p>`;

    card.append(thumb, meta);
    grid.append(card);
  });

  let job = 0;
  const runNext = () => {
    if (job >= thumbJobs.length) return;
    thumbJobs[job++]();
    requestAnimationFrame(runNext);
  };
  requestAnimationFrame(runNext);

  const footer = document.createElement('footer');
  footer.className = 'gallery-footer';

  const left = document.createElement('div');
  left.className = 'footer-left';
  const mascot = document.createElement('button');
  mascot.className = 'mascot';
  mascot.type = 'button';
  mascot.title = 'hello';
  mascot.setAttribute('aria-label', 'mascot');
  mascot.innerHTML = mascotSvg(4);
  let pats = 0;
  mascot.addEventListener('click', () => {
    mascot.classList.remove('hop');
    void mascot.offsetWidth; // restart animation
    mascot.classList.add('hop');
    if (++pats >= 5) {
      pats = 0;
      rainSparkles();
    }
  });
  const made = document.createElement('span');
  made.textContent = 'Made for the love of math.';
  left.append(mascot, made);

  const links = document.createElement('div');
  links.className = 'footer-links';
  links.innerHTML = `
    <a href="${REPO}" target="_blank" rel="noopener">Source</a>
    <a href="${REPO}/blob/main/LICENSE" target="_blank" rel="noopener">MIT licensed</a>`;

  footer.append(left, links);
  page.append(footer);

  container.append(page);
}
