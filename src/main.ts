import './style.css';
import { parseHash } from './shared/url';
import { mountViz, type EngineController } from './shared/engine';
import { renderGallery } from './gallery';
import { findViz } from './viz/registry';
import { onKonami, rainSparkles } from './shared/pixel';
import { initCursor } from './shared/cursor';

const app = document.getElementById('app')!;

initCursor();
onKonami(() => rainSparkles(40));

let current: EngineController | null = null;
let currentId: string | null = null;

function route() {
  const { id, raw } = parseHash();

  // A viz is already mounted and only its query params changed: let it be —
  // the engine wrote that URL itself and already reflects the state.
  if (id && id === currentId) return;

  if (current) {
    current.destroy();
    current = null;
  }
  currentId = id;

  if (!id) {
    document.body.classList.remove('in-viz');
    renderGallery(app);
    window.scrollTo(0, 0);
    return;
  }

  const def = findViz(id);
  if (!def) {
    document.body.classList.remove('in-viz');
    app.innerHTML = `<div class="notfound"><h1>Not found</h1><p>No visualization "${id}".</p><a href="#/">← Back to gallery</a></div>`;
    return;
  }

  document.body.classList.add('in-viz');
  current = mountViz(def, app, raw);
}

window.addEventListener('hashchange', route);
route();
