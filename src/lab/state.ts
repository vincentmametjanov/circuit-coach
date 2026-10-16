// Lab 01's reducer: the Output console says only what happened, and a wiring
// mistake is flagged (error + hint) the moment it appears, once. The logic
// lives in the generic runtime (src/lab/runtime.ts) with Lab 01's definition;
// this file keeps Lab 01's original action names working.

import { type CircuitState, LAB, analyzeCircuit } from './circuit';
import { PART_DEFS } from './parts';
import type { Hole } from './geometry';
import {
  type LabLog,
  type LogKind,
  type LogLine,
  type RuntimeState,
  createRuntime,
  runtimeReducer,
} from './runtime';

export type { LogKind, LogLine };
export type { Verdict, VerdictCode } from './circuit';

export type LabState = CircuitState & {
  /** The sketch has been uploaded and is looping. */
  running: boolean;
  /** Current output of pin 7 while the sketch runs. */
  pinHigh: boolean;
  busy: 'idle' | 'compiling' | 'uploading';
  log: LogLine[];
  nextId: number;
};

export type LabAction =
  | { type: 'placePart'; part: string; hole: Hole | null }
  | { type: 'flipLed' }
  | { type: 'addWire'; pin: string | null; hole: Hole | null }
  | { type: 'moveWire'; id: string; pin?: string; hole?: Hole }
  | { type: 'removeWire'; id: string }
  | { type: 'mistake'; title: string; hint: string }
  | { type: 'clearLog' }
  | { type: 'compile' }
  | { type: 'verifyDone' }
  | { type: 'uploadStart' }
  | { type: 'uploadDone' }
  | { type: 'tick' }
  | { type: 'reset' };

export const SKETCH_NAME = LAB.sketch.name;

export function createLab(): LabState {
  return {
    parts: { resistor: null, led: null },
    ledFlipped: false,
    ledBurnt: false,
    wires: [],
    running: false,
    pinHigh: false,
    busy: 'idle',
    log: [],
    nextId: 0,
  };
}

/** The Lab 01 view in the runtime's terms. */
function toRuntime(state: LabState): RuntimeState {
  return {
    ...createRuntime(),
    parts: { ...state.parts },
    flipped: state.ledFlipped ? ['led'] : [],
    burnt: state.ledBurnt ? ['led'] : [],
    pressed: [],
    wires: state.wires.map((wire) => ({ ...wire })),
    running: state.running,
    busy: state.busy,
    log: state.log,
    nextId: state.nextId,
    behavior: { pinHigh: state.pinHigh },
  };
}

function fromRuntime(state: RuntimeState): LabState {
  return {
    parts: { resistor: state.parts.resistor ?? null, led: state.parts.led ?? null },
    ledFlipped: state.flipped.includes('led'),
    ledBurnt: state.burnt.includes('led'),
    wires: state.wires,
    running: state.running,
    pinHigh: state.behavior.pinHigh === true,
    busy: state.busy,
    log: state.log,
    nextId: state.nextId,
  };
}

export function labReducer(state: LabState, action: LabAction): LabState {
  const mapped =
    action.type === 'flipLed' ? { type: 'flipPart' as const, part: 'led' } : action;
  return fromRuntime(runtimeReducer(LAB, toRuntime(state), mapped));
}

// Re-exported so existing imports keep working.
export { PART_DEFS, analyzeCircuit };
export type { LabLog };
