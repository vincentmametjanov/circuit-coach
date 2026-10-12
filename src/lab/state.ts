import { type CircuitState, analyzeCircuit } from './circuit';
import { type Hole, PART_NAME, PIN_BY_ID, type PartId, holeName, leadHoles } from './geometry';

export type LogKind = 'muted' | 'info' | 'success' | 'warn' | 'error';
export type LogLine = { id: number; kind: LogKind; text: string };

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
  | { type: 'placePart'; part: PartId; hole: Hole | null }
  | { type: 'flipLed' }
  | { type: 'addWire'; pin: string; hole: Hole }
  | { type: 'moveWire'; id: string; pin?: string; hole?: Hole }
  | { type: 'removeWire'; id: string }
  | { type: 'log'; kind: LogKind; text: string }
  | { type: 'clearLog' }
  | { type: 'compile' }
  | { type: 'verifyDone' }
  | { type: 'uploadStart' }
  | { type: 'uploadDone' }
  | { type: 'tick' }
  | { type: 'reset' };

const MAX_LOG_LINES = 150;

export const SKETCH_NAME = 'blink_d7';

export function createLab(): LabState {
  return {
    parts: { resistor: null, led: null },
    ledFlipped: false,
    ledBurnt: false,
    wires: [],
    running: false,
    pinHigh: false,
    busy: 'idle',
    log: [
      { id: 0, kind: 'muted', text: 'Circuit Coach — Lab 01: Blink an LED on pin 7' },
      { id: 1, kind: 'info', text: 'Drag the resistor and LED onto the breadboard, then drag from the Arduino’s pins to wire them up.' },
    ],
    nextId: 2,
  };
}

function append(state: LabState, ...lines: [LogKind, string][]): LabState {
  const added = lines.map(([kind, text], index) => ({ id: state.nextId + index, kind, text }));
  return {
    ...state,
    log: [...state.log, ...added].slice(-MAX_LOG_LINES),
    nextId: state.nextId + added.length,
  };
}

function report(state: LabState, context: 'verify' | 'upload'): LabState {
  const { verdict } = analyzeCircuit(state);
  if (verdict.code === 'pass') {
    return context === 'upload'
      ? append(state, ['success', 'Your LED is blinking on pin 7. Lab 01 complete!'], ['info', verdict.detail])
      : append(state, ['success', `${verdict.title}.`], ['info', verdict.detail]);
  }
  const lead = context === 'upload' ? 'The sketch is running, but the LED isn’t blinking:' : 'Circuit check:';
  return append(state, ['warn', `${lead} ${verdict.title}.`], ['info', verdict.detail]);
}

/** An LED wired with no resistor burns out as soon as current reaches it. */
function applyPhysics(state: LabState): LabState {
  if (state.ledBurnt || !state.parts.led) return state;
  const { verdict } = analyzeCircuit(state);
  if (verdict.code !== 'noResistor') return state;
  const powered = verdict.source !== 'D7' || (state.running && state.pinHigh);
  if (!powered) return state;
  return append(
    { ...state, ledBurnt: true },
    ['error', 'Pop! The LED burned out — with no resistor in the loop, nothing limited the current.'],
    ['info', 'Drag the dead LED back to the parts bin for a fresh one, then put the 220 Ω resistor in series.'],
  );
}

function wireLabel(pinId: string) {
  return PIN_BY_ID[pinId].name;
}

function update(state: LabState, action: LabAction): LabState {
  switch (action.type) {
    case 'placePart': {
      const { part, hole } = action;
      let next: LabState = { ...state, parts: { ...state.parts, [part]: hole } };
      if (hole) {
        const [a, b] = leadHoles(part, hole);
        return append(next, ['muted', `Placed the ${PART_NAME[part]}: legs in ${holeName(a)} and ${holeName(b)}.`]);
      }
      if (part === 'led' && state.ledBurnt) {
        next = { ...next, ledBurnt: false, ledFlipped: false };
        return append(next, ['muted', 'Swapped in a fresh LED.']);
      }
      return state.parts[part] ? append(next, ['muted', `Returned the ${PART_NAME[part]} to the parts bin.`]) : next;
    }
    case 'flipLed':
      return append(
        { ...state, ledFlipped: !state.ledFlipped },
        ['muted', `Flipped the LED: its + leg is now on the ${state.ledFlipped ? 'left' : 'right'}.`],
      );
    case 'addWire': {
      const wire = { id: `w${state.nextId}`, pin: action.pin, hole: action.hole };
      return append(
        { ...state, wires: [...state.wires, wire] },
        ['muted', `Jumper: ${wireLabel(action.pin)} → ${holeName(action.hole)}.`],
      );
    }
    case 'moveWire': {
      const wires = state.wires.map((wire) =>
        wire.id === action.id ? { ...wire, pin: action.pin ?? wire.pin, hole: action.hole ?? wire.hole } : wire,
      );
      const moved = wires.find((wire) => wire.id === action.id);
      return moved
        ? append({ ...state, wires }, ['muted', `Jumper moved: ${wireLabel(moved.pin)} → ${holeName(moved.hole)}.`])
        : state;
    }
    case 'removeWire': {
      const removed = state.wires.find((wire) => wire.id === action.id);
      if (!removed) return state;
      return append(
        { ...state, wires: state.wires.filter((wire) => wire.id !== action.id) },
        ['muted', `Removed the ${wireLabel(removed.pin)} jumper.`],
      );
    }
    case 'log':
      return append(state, [action.kind, action.text]);
    case 'clearLog':
      return { ...state, log: [] };
    case 'compile':
      return append({ ...state, busy: 'compiling' }, ['muted', `Compiling sketch "${SKETCH_NAME}"…`]);
    case 'verifyDone':
      return report(
        append(
          { ...state, busy: 'idle' },
          ['info', 'Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.'],
          ['info', 'Global variables use 9 bytes (0%) of dynamic memory. Maximum is 2048 bytes.'],
          ['success', 'Done compiling.'],
        ),
        'verify',
      );
    case 'uploadStart':
      return append(
        { ...state, busy: 'uploading', running: false, pinHigh: false },
        ['info', 'Sketch uses 924 bytes (2%) of program storage space. Maximum is 32256 bytes.'],
        ['muted', 'Uploading to Arduino Uno on sim-usb0…'],
      );
    case 'uploadDone':
      return report(
        append({ ...state, busy: 'idle', running: true, pinHigh: true }, ['success', 'Done uploading.']),
        'upload',
      );
    case 'tick':
      return state.running ? { ...state, pinHigh: !state.pinHigh } : state;
    case 'reset':
      return append({ ...createLab(), log: [], nextId: state.nextId }, ['muted', 'Lab reset. Everything is back in the parts bin.']);
  }
}

export function labReducer(state: LabState, action: LabAction): LabState {
  return applyPhysics(update(state, action));
}
