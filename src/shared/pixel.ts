// Tiny 8-bit pixel-art helpers. Used sparingly: button icons, the favicon and a
// clickable mascot easter egg. The rest of the site stays minimal — these are
// the playful accents.

type ColorMap = Record<string, string>;

/** Turn a grid of characters into a crisp-edged inline SVG string. */
export function pixelArt(rows: string[], map: ColorMap, px = 2): string {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  let rects = '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const fill = map[rows[y][x]];
      if (!fill) continue;
      rects += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${fill}"/>`;
    }
  }
  return `<svg width="${w * px}" height="${h * px}" viewBox="0 0 ${w * px} ${h * px}" fill="none" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" class="px">${rects}</svg>`;
}

const cur: ColorMap = { '#': 'currentColor' };

// --- button / inline icons (inherit text color) ---
export const ICON_RANDOM = pixelArt(
  ['.......', '.#...#.', '.......', '...#...', '.......', '.#...#.', '.......'],
  cur,
);
export const ICON_PNG = pixelArt(
  ['#######', '#.....#', '#.#...#', '#.....#', '#..#..#', '#.#.#.#', '#######'],
  cur,
);
export const ICON_SHARE = pixelArt(
  ['....###', '.....##', '....#.#', '#####.#', '#...#..', '#...#..', '#####..'],
  cur,
);
export const ICON_REC = pixelArt(
  ['.###.', '#####', '#####', '#####', '.###.'],
  { '#': '#cc4033' },
);

// clay diamond "sparkle" used as an editorial bullet / favicon
export const SPARKLE = (color = '#c15f3c', px = 3) =>
  pixelArt(['..#..', '.###.', '#####', '.###.', '..#..'], { '#': color }, px);

// --- the mascot: an original pixel cat (the easter egg) ---
const MASCOT_ROWS = [
  '..c......c..',
  '..cc....cc..',
  '..cccccccc..',
  '.cccccccccc.',
  '.cwkcccckwc.',
  '.cccccccccc.',
  '.ccccwwcccc.',
  '.cccccccccc.',
  '..cccccccc..',
  '..cc.cc.cc..',
];
const MASCOT_MAP: ColorMap = { c: '#c15f3c', w: '#f3efe6', k: '#2a2722' };

export function mascotSvg(px = 4): string {
  return pixelArt(MASCOT_ROWS, MASCOT_MAP, px);
}

/** Easter egg: rain a handful of pixel diamonds down the screen, then clean up. */
export function rainSparkles(count = 28): void {
  const colors = ['#c15f3c', '#4a6fa5', '#d9a441', '#7a9b6e'];
  const layer = document.createElement('div');
  layer.className = 'sparkle-layer';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'sparkle-drop';
    s.innerHTML = SPARKLE(colors[i % colors.length], 3 + (i % 3));
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDelay = Math.random() * 0.8 + 's';
    s.style.animationDuration = 1.8 + Math.random() * 1.6 + 's';
    layer.append(s);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 4000);
}

/** Listen for the Konami code and fire `cb` once it's entered. */
export function onKonami(cb: () => void): () => void {
  const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let i = 0;
  const handler = (e: KeyboardEvent) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    i = key === seq[i] ? i + 1 : key === seq[0] ? 1 : 0;
    if (i === seq.length) {
      i = 0;
      cb();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
