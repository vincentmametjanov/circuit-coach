// Connects the workbench state to the lab runtime. The lab-specific rules
// live in src/lab/labs/, and the checking logic in src/lab/engine/ and
// src/lab/runtime.ts.

import type { Message, VerdictSpec } from './lab';
import { LAB01 } from './labs/lab01v2';
import type { Hole } from './geometry';
import type { RuntimeStep } from './runtime';
import { circuitOf, judge, runtimeSteps } from './runtime';

export type Verdict = Message & { code: string };
export type VerdictCode = string;
export type { RuntimeStep as LabStep };

/** The default lab on the workbench (Lab 01). */
export const LAB = LAB01;

/**
 * A jumper on the workbench. A jumper taken from the parts bin starts with one
 * end loose (null) until the student plugs it in; only jumpers with both ends
 * plugged in conduct.
 */
export type BenchWire = { id: string; pin: string | null; hole: Hole | null };

export const isPlugged = (wire: BenchWire): boolean => wire.pin !== null && wire.hole !== null;

export type CircuitState = {
  /** Hole of each part's first leg, or null while it sits in the parts bin. */
  parts: Record<string, Hole | null>;
  /** Lab 01 convenience flags: the LED's flip and burn-out state. */
  ledFlipped: boolean;
  ledBurnt: boolean;
  wires: BenchWire[];
};

export type Analysis = { verdict: Verdict; bench: BenchStateView };

type BenchStateView = ReturnType<typeof toBench>;

function toBench(circuit: CircuitState) {
  return {
    parts: circuit.parts,
    flipped: circuit.ledFlipped ? ['led'] : [],
    burnt: circuit.ledBurnt ? ['led'] : [],
    pressed: [] as string[],
    wires: circuit.wires,
  };
}

/** The verdict for the circuit as it stands. */
export function analyzeCircuit(circuit: CircuitState): Analysis {
  const bench = toBench(circuit);
  return { verdict: judge(LAB01, bench), bench };
}

export function labSteps(analysis: Analysis, running = false): RuntimeStep[] {
  return runtimeSteps(LAB01, analysis.bench, running);
}

/** Kept for the engine tests: the board a Lab 01-style state describes. */
export function toBoard(circuit: CircuitState) {
  return {
    parts: Object.entries(circuit.parts)
      .filter(([, start]) => start !== null)
      .map(([id, start]) => ({
        id,
        def: id as 'resistor' | 'led',
        legs: [start!, { row: start!.row, col: start!.col + (id === 'led' ? 1 : 3) }],
        flipped: id === 'led' && circuit.ledFlipped,
      })),
    wires: circuit.wires.filter(isPlugged),
    burnt: circuit.ledBurnt ? ['led'] : [],
    pressed: [] as string[],
  };
}

export { circuitOf };
export type { VerdictSpec };
