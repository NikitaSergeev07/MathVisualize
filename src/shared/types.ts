// The single interface that every visualization implements.
//
// The engine (src/shared/engine.ts) owns the render loop, the control panel,
// export, URL state and the canvas sizing. A visualization only has to:
//   - declare its parameters (`params`) so the UI builds itself,
//   - create an instance that knows how to draw, resize, randomize and export.

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

export type ParamSpec =
  | {
      type: 'range';
      key: string;
      label: string;
      min: number;
      max: number;
      step: number;
      default: number;
      /** Optional pretty-printer for the value readout. */
      format?: (v: number) => string;
    }
  | {
      type: 'select';
      key: string;
      label: string;
      options: { value: string; label: string }[];
      default: string;
    }
  | {
      type: 'toggle';
      key: string;
      label: string;
      default: boolean;
    }
  | {
      type: 'palette';
      key: string;
      label: string;
      default: string;
    }
  | {
      type: 'text';
      key: string;
      label: string;
      default: string;
      placeholder?: string;
    };

export interface VizHost {
  /** Container the visualization attaches its canvas(es) and listeners to. */
  root: HTMLElement;
  /** Current CSS-pixel size of the host. */
  width: number;
  height: number;
  /** Device pixel ratio the engine wants the viz to render at. */
  dpr: number;
}

export interface VizInstance {
  /** Advance + draw one frame. `dt` is milliseconds since the previous frame. */
  update(dt: number): void;
  /** The host was resized to `width` x `height` CSS pixels. */
  resize(width: number, height: number): void;
  /** Apply a (possibly partial) set of parameter values. */
  setParams(params: ParamValues): void;
  /** Produce a brand-new random parameter set (including any seed). */
  randomize(): ParamValues;
  /** The canvas holding the current frame — used for PNG export & recording. */
  exportCanvas(): HTMLCanvasElement;
  /** Release GPU/CPU resources and detach listeners. */
  destroy(): void;
}

export interface VizDef {
  id: string;
  title: string;
  /** One-line hook shown on the gallery card. */
  tagline: string;
  /** HTML explaining the underlying mathematics (the "What is this" tab). */
  about: string;
  params: ParamSpec[];
  create(host: VizHost): VizInstance;
  /** Optional cheap static preview drawn into a small gallery canvas. */
  thumbnail?: (canvas: HTMLCanvasElement, seed: number) => void;
}

/** Build the default value object from a parameter spec list. */
export function defaultsFor(params: ParamSpec[]): ParamValues {
  const out: ParamValues = {};
  for (const p of params) out[p.key] = p.default;
  return out;
}
