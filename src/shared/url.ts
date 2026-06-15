// Hash-based routing + parameter (de)serialization.
//
//   #/                      -> gallery
//   #/v/<id>?k=v&k2=v2      -> a specific visualization with exact parameters
//
// Hash routing means deep links survive on GitHub Pages / any static host with
// no server rewrites.

import type { ParamSpec, ParamValues } from './types';

export interface Route {
  id: string | null;
  raw: Record<string, string>;
}

export function parseHash(hash = location.hash): Route {
  const h = hash.replace(/^#\/?/, ''); // strip "#/" or "#"
  if (!h.startsWith('v/')) return { id: null, raw: {} };
  const rest = h.slice(2);
  const qIndex = rest.indexOf('?');
  const id = decodeURIComponent(qIndex === -1 ? rest : rest.slice(0, qIndex));
  const raw: Record<string, string> = {};
  if (qIndex !== -1) {
    const params = new URLSearchParams(rest.slice(qIndex + 1));
    params.forEach((v, k) => (raw[k] = v));
  }
  return { id, raw };
}

/** Coerce raw string params into typed values using the viz's spec list. */
export function coerceParams(specs: ParamSpec[], raw: Record<string, string>): ParamValues {
  const out: ParamValues = {};
  for (const spec of specs) {
    const v = raw[spec.key];
    if (v === undefined) continue;
    switch (spec.type) {
      case 'range':
        out[spec.key] = clampNumber(parseFloat(v), spec.min, spec.max);
        break;
      case 'toggle':
        out[spec.key] = v === '1' || v === 'true';
        break;
      default:
        out[spec.key] = v;
    }
  }
  return out;
}

function clampNumber(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function buildHash(id: string, params: ParamValues): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'boolean') usp.set(k, v ? '1' : '0');
    else if (typeof v === 'number') usp.set(k, trimNumber(v));
    else usp.set(k, String(v));
  }
  const q = usp.toString();
  return `#/v/${encodeURIComponent(id)}${q ? `?${q}` : ''}`;
}

function trimNumber(v: number): string {
  // Keep links short: round to 5 significant-ish digits, drop trailing zeros.
  return String(Math.round(v * 100000) / 100000);
}

export function shareUrl(id: string, params: ParamValues): string {
  return `${location.origin}${location.pathname}${buildHash(id, params)}`;
}
