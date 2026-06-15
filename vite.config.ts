import { defineConfig } from 'vite';

// Relative base so the build works under any path (GitHub Pages project sites,
// Vercel, plain static hosting). Hash-based routing keeps deep links working
// without server rewrites.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
});
