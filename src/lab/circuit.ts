// Connects the workbench state to the shared checker. The lab-specific rules
// live in src/lab/labs/, and the checking logic in src/lab/engine/.

import { type Analysis, type LabStep, analyzeSeriesLab, seriesLabSteps } from './engine/seriesLab';
import type { Board, Wire } from './engine/netlist';
import { type Hole, type PartId, leadHoles } from './geometry';
import { LAB01 } from './labs/lab01';

export type { Analysis, LabStep, Verdict, VerdictCode } from './engine/seriesLab';
export type { Wire } from './engine/netlist';

/** The lab currently on the workbench. */
export const LAB = LAB01;

export type CircuitState = {
  /** Hole of each part's left leg, or null while it sits in the parts bin. */
  parts: Record<PartId, Hole | null>;
  /** false: the LED's + leg (anode) is the left leg. */
  ledFlipped: boolean;
  ledBurnt: boolean;
  wires: Wire[];
};

/** Describes the workbench in the checker's terms: placed parts (+ leg first), wires, burned-out parts. */
export function toBoard(circuit: CircuitState): Board {
  const parts: Board['parts'] = [];
  for (const id of Object.keys(circuit.parts) as PartId[]) {
    const left = circuit.parts[id];
    if (!left) continue;
    const [a, b] = leadHoles(id, left);
    const polarized = id === 'led';
    parts.push({ id, polarized, legs: polarized && circuit.ledFlipped ? [b, a] : [a, b] });
  }
  return { parts, wires: circuit.wires, burnt: circuit.ledBurnt ? ['led'] : [] };
}

export function analyzeCircuit(circuit: CircuitState): Analysis {
  return analyzeSeriesLab(LAB, toBoard(circuit));
}

export function labSteps(analysis: Analysis, running: boolean): LabStep[] {
  return seriesLabSteps(LAB, analysis, running);
}
