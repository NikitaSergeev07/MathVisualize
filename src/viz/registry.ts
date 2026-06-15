import type { VizDef } from '../shared/types';
import { attractorsDef } from './attractors';
import { multiplicationDef } from './multiplication';
import { reactionDiffusionDef } from './reaction-diffusion';
import { phyllotaxisDef } from './phyllotaxis';
import { newtonDef } from './newton';

export const VISUALIZATIONS: VizDef[] = [
  attractorsDef,
  reactionDiffusionDef,
  newtonDef,
  multiplicationDef,
  phyllotaxisDef,
];

export function findViz(id: string): VizDef | undefined {
  return VISUALIZATIONS.find((v) => v.id === id);
}
