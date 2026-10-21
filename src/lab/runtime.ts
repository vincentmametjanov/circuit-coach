// Drives any lab built to the LabDef shape: a reducer over bench state, the
// Output console log, build-time mistake flagging, burn-out physics, and the
// behavior hook that runs while a sketch is "uploaded". LabScreen uses this
// shared reducer directly for every lab.

import { type Circuit, type CircuitBoard, type PlacedPart, type WireEnd, buildCircuit, pathThrough } from './engine/circuit';
import type { LabDef, Message, StepQuery, VerdictSpec } from './lab';
import { type Hole, PIN_BY_ID, holeName } from './geometry';
import { PART_DEFS, partLegs } from './parts';

export type LogKind = 'muted' | 'info' | 'success' | 'warn' | 'error' | 'hint';
export type LogLine = { id: number; kind: LogKind; text: string };
export type LabLog = [LogKind, string][];

export type BenchState = {
  /** Instance id → hole of the part's first leg, null while it sits in the bin. */
  parts: Record<string, Hole | null>;
  flipped: string[];
  burnt: string[];
  pressed: string[];
  /**
   * Jumpers. A pin jumper runs from an Arduino pin (`pin`) to a breadboard hole
   * (`hole`). A breadboard jumper has no pin and joins `hole` to `hole2`. An end
   * that is still loose is null.
   */
  wires: BenchWire[];
};

export type BenchWire = { id: string; pin: string | null; hole: Hole | null; hole2?: Hole | null };

type PinWire = BenchWire & { pin: string; hole: Hole };
type BreadboardWire = BenchWire & { pin: null; hole: Hole; hole2: Hole };

/** True when a jumper connects an Arduino pin to a breadboard hole. */
function isPinWire(wire: BenchWire): wire is PinWire {
  return wire.pin !== null && wire.hole !== null;
}

/** True when a jumper joins two breadboard holes. */
function isBreadboardWire(wire: BenchWire): wire is BreadboardWire {
  return wire.pin === null && wire.hole !== null && wire.hole2 !== null && wire.hole2 !== undefined;
}

/** True when both ends of either kind of jumper are plugged in. */
export const isPlugged = (wire: BenchWire) => isPinWire(wire) || isBreadboardWire(wire);

export type RuntimeState = BenchState & {
  running: boolean;
  busy: 'idle' | 'compiling' | 'uploading';
  log: LogLine[];
  nextId: number;
  /** Pseudo-random source shared by behavior models (deterministic). */
  seed: number;
  /** Free-form per-lab behavior scratch space (button memory, flicker phase…). */
  behavior: Record<string, unknown>;
  /** What the running sketch has printed to the Serial Monitor. */
  serial: string[];
};

export type RuntimeAction =
  | { type: 'placePart'; part: string; hole: Hole | null }
  | { type: 'flipPart'; part: string }
  | { type: 'pressPart'; part: string; pressed: boolean }
  | { type: 'control'; id: string; value: number }
  | { type: 'addWire'; pin: string | null; hole: Hole | null }
  | { type: 'moveWire'; id: string; pin?: string; hole?: Hole; hole2?: Hole }
  | { type: 'removeWire'; id: string }
  | { type: 'mistake'; title: string; hint: string }
  | { type: 'clearLog' }
  | { type: 'compile' }
  | { type: 'verifyDone' }
  | { type: 'uploadStart' }
  | { type: 'uploadDone' }
  | { type: 'tick' }
  | { type: 'reset' };

const MAX_LOG_LINES = 150;
// Pressing a button is using the circuit, not building it, so it never flags a wiring mistake.
const BUILD_ACTIONS: RuntimeAction['type'][] = ['placePart', 'flipPart', 'addWire', 'moveWire', 'removeWire'];

export function createRuntime(): RuntimeState {
  return {
    parts: {},
    flipped: [],
    burnt: [],
    pressed: [],
    wires: [],
    running: false,
    busy: 'idle',
    log: [],
    nextId: 0,
    seed: 1,
    behavior: {},
    serial: [],
  };
}

/** Print a line to the Serial Monitor, capped like the Output console. */
export function printSerial(state: RuntimeState, line: string): RuntimeState {
  return { ...state, serial: [...state.serial, line].slice(-MAX_LOG_LINES) };
}

/** What an analog pin reads right now, per the lab's behavior model, or null. */
export function analogRead(lab: LabDef, state: RuntimeState, node: string): number | null {
  const reads = lab.behavior.analogReads?.(lab, { lab, state });
  return reads?.[node] ?? null;
}
export function nextRandom(seed: number): { seed: number; value: number } {
  const next = (seed * 48271) % 2147483647;
  return { seed: next, value: next / 2147483647 };
}

export function appendLog(state: RuntimeState, ...lines: LabLog): RuntimeState {
  const added = lines.map(([kind, text], index) => ({ id: state.nextId + index, kind, text }));
  return { ...state, log: [...state.log, ...added].slice(-MAX_LOG_LINES), nextId: state.nextId + added.length };
}

/** An error line naming the problem, then a hint for fixing it. */
export const problem = (message: Message, kind: LogKind = 'error'): LabLog => [
  [kind, message.title + '.'],
  ['hint', `Hint: ${message.detail}`],
];

// ---- bench → circuit board --------------------------------------------------

export function toCircuitBoard(lab: LabDef, bench: BenchState): CircuitBoard {
  const parts: PlacedPart[] = [];
  for (const spec of lab.parts) {
    const start = bench.parts[spec.id];
    if (!start) continue;
    parts.push({ id: spec.id, def: spec.def, legs: partLegs(spec.def, start), flipped: bench.flipped.includes(spec.id) });
  }
  return {
    parts,
    wires: bench.wires
      .filter(isPinWire)
      .map((wire) => ({ id: wire.id, pin: wire.pin, hole: wire.hole }) satisfies WireEnd & { id: string }),
    links: bench.wires.filter(isBreadboardWire).map((wire) => [wire.hole, wire.hole2]),
    burnt: bench.burnt,
    pressed: bench.pressed,
  };
}

export const circuitOf = (lab: LabDef, bench: BenchState): Circuit => buildCircuit(toCircuitBoard(lab, bench));

/** The circuit with every button released: verdicts and guide steps judge the wiring, not a press in progress. */
export const restingCircuit = (lab: LabDef, bench: BenchState): Circuit =>
  bench.pressed.length === 0 ? circuitOf(lab, bench) : circuitOf(lab, { ...bench, pressed: [] });

// ---- what the running circuit does --------------------------------------------

/** Supplies that are live whenever a jumper reaches them, sketch or no sketch. */
const LIVE_SUPPLIES = ['5V', '3V3', 'VIN'];

/** Board nodes at a HIGH voltage right now: wired supplies, plus the pins the running sketch drives HIGH. */
export function drivenHigh(lab: LabDef, state: RuntimeState, circuit: Circuit): string[] {
  const outputs = state.running ? (lab.behavior.outputs?.(lab, { lab, state }) ?? []) : [];
  return [...LIVE_SUPPLIES.filter((node) => circuit.wired(node)), ...outputs.filter((node) => circuit.wired(node))];
}

export type Glow = 'off' | 'dim' | 'on';

const resistorIds = (lab: LabDef) => lab.parts.filter((p) => p.def === 'resistor' || p.def === 'resistor10k');

/**
 * How brightly each LED glows: lit when current can flow from a HIGH node
 * through a resistor and the LED (+ to −) to GND. Dim from 3.3V or through
 * the 10 kΩ resistor.
 */
export function ledGlowFor(lab: LabDef, state: RuntimeState, circuit = circuitOf(lab, state)): Record<string, Glow> {
  const high = drivenHigh(lab, state, circuit);
  const glow: Record<string, Glow> = {};
  for (const led of lab.parts.filter((p) => p.def === 'led')) {
    glow[led.id] = 'off';
    if (state.burnt.includes(led.id) || !circuit.part(led.id)) continue;
    for (const node of high) {
      for (const resistor of resistorIds(lab)) {
        if (!pathThrough(circuit, node, 'GND', [resistor.id, led.id])) continue;
        const level: Glow = node === '3V3' || resistor.def === 'resistor10k' ? 'dim' : 'on';
        if (level === 'on' || glow[led.id] === 'off') glow[led.id] = level;
      }
    }
  }
  return glow;
}

/** An LED with a HIGH node straight across it (no resistor) burns out. Every lab gets this physics. */
function burnOut(lab: LabDef, state: RuntimeState): { state: RuntimeState; lines: LabLog } | null {
  const circuit = circuitOf(lab, state);
  const high = drivenHigh(lab, state, circuit);
  for (const led of lab.parts.filter((p) => p.def === 'led')) {
    if (state.burnt.includes(led.id) || !circuit.part(led.id)) continue;
    if (!high.some((node) => pathThrough(circuit, node, 'GND', [led.id]))) continue;
    const name = led.color ? `${led.color} LED` : 'LED';
    const resistor = led.color ? 'its own 220 Ω resistor' : 'the 220 Ω resistor';
    return {
      state: { ...state, burnt: [...state.burnt, led.id] },
      lines: [
        ['error', `Pop! The ${name} burned out: with no resistor in the loop, nothing limited the current.`],
        ['hint', `Hint: Drag the dead ${name} back to the parts bin for a fresh one, then put ${resistor} in series with it.`],
      ],
    };
  }
  return null;
}

// ---- verdicts ---------------------------------------------------------------

export type Verdict = Message & { code: string; source?: string };

export function judge(lab: LabDef, bench: BenchState, circuit?: Circuit): Verdict {
  const c = circuit ?? restingCircuit(lab, bench);
  for (const code of lab.verdict.order) {
    const message = lab.verdict.check(code, c, lab);
    if (message) {
      return { code, ...message, source: message.source };
    }
  }
  return { code: 'pass', ...passMessage(lab, c) };
}

function passMessage(lab: LabDef, circuit: Circuit): Message {
  return lab.verdict.check('pass', circuit, lab) ?? { title: 'Circuit check passed', detail: 'Your wiring is correct.' };
}

export function isMistake(spec: VerdictSpec, verdict: Verdict): boolean {
  return spec.mistakes.includes(verdict.code);
}

export type RuntimeStep = { id: string; title: string; detail: string; done: boolean };

export function runtimeSteps(lab: LabDef, bench: BenchState, running: boolean, circuit = restingCircuit(lab, bench), pass?: boolean): RuntimeStep[] {
  const isPass = pass ?? judge(lab, bench, circuit).code === 'pass';
  const query: StepQuery = { ...circuit, pass: isPass, running };
  return lab.steps.map(({ id, title, detail, built }) => ({
    id,
    title,
    detail,
    done: built ? isPass || built(query) : isPass && running,
  }));
}

// ---- log descriptions ---------------------------------------------------------

export function partName(lab: LabDef, id: string): string {
  const spec = lab.parts.find((p) => p.id === id);
  return spec?.name ?? (spec ? PART_DEFS[spec.def].name : id);
}

function describePlacement(lab: LabDef, bench: BenchState, part: string, start: Hole): string {
  const spec = lab.parts.find((p) => p.id === part)!;
  const def = PART_DEFS[spec.def];
  const holes = partLegs(spec.def, start);
  if (def.polarized) {
    const flipped = bench.flipped.includes(part);
    const plus = holes[flipped ? 1 : 0];
    const minus = holes[flipped ? 0 : 1];
    return `Placed the ${partName(lab, part)}: + leg in ${holeName(plus)}, − leg in ${holeName(minus)}.`;
  }
  if (def.pattern.kind === 'across') {
    return `Placed the ${partName(lab, part)} across the gap: legs in ${holes.map(holeName).join(', ')}.`;
  }
  if (holes.length > 2) return `Placed the ${partName(lab, part)}: legs in ${holes.map(holeName).join(', ')}.`;
  return `Placed the ${partName(lab, part)} in ${holeName(holes[0])} and ${holeName(holes[1])}.`;
}

function describeWire(wire: BenchWire): string {
  if (!wire.pin && wire.hole && wire.hole2) return `Connected ${holeName(wire.hole)} to ${holeName(wire.hole2)} with a jumper.`;
  const pin = wire.pin ? PIN_BY_ID[wire.pin].name : 'a loose end';
  if (wire.pin && wire.hole) return `Connected ${pin} to ${holeName(wire.hole)} with a jumper.`;
  if (wire.pin) return `Plugged a jumper into ${pin}. Its other end is loose.`;
  if (wire.hole) return `Plugged a jumper into ${holeName(wire.hole)}. Its other end is loose.`;
  return 'Took a jumper from the bin.';
}

// ---- the reducer ---------------------------------------------------------------

export function createLabStore(lab: LabDef): LabStore {
  const parts: Record<string, Hole | null> = {};
  for (const spec of lab.parts) parts[spec.id] = null;
  return { lab, state: { ...createRuntime(), parts } };
}

export type LabStore = { lab: LabDef; state: RuntimeState };

export function runtimeReducer(lab: LabDef, state: RuntimeState, action: RuntimeAction): RuntimeState {
  const before = judge(lab, state);
  const store: LabStore = { lab, state };
  let next = update(lab, state, action);

  // An upload powers the circuit before anything is judged: the sketch's first
  // pin state is already in effect when physics and verdicts look at it.
  if (action.type === 'uploadDone' && lab.behavior.onUpload) {
    store.state = next;
    next = lab.behavior.onUpload(lab, store).state;
  }
  const burnt = burnOut(lab, next);
  if (burnt) next = appendLog(burnt.state, ...burnt.lines);
  if (lab.physics) {
    store.state = next;
    const lines = lab.physics(lab, store);
    next = store.state;
    if (lines) next = appendLog(next, ...lines);
  }
  if (action.type === 'uploadDone') {
    next = reportUpload(lab, next);
  }
  if (!BUILD_ACTIONS.includes(action.type)) return next;

  // Flag a wiring mistake the moment it appears, once — unless physics (a
  // burn-out) already reported the same action's consequence.
  const after = judge(lab, next);
  const burntChanged = next.burnt.length !== state.burnt.length;
  if (!burntChanged && isMistake(lab.verdict, after) && (after.code !== before.code || after.title !== before.title)) {
    next = appendLog(next, ...problem(after));
  }
  return next;
}

/** What the console says when the sketch starts running. */
function reportUpload(lab: LabDef, state: RuntimeState): RuntimeState {
  const verdict = judge(lab, state);
  if (verdict.code === 'pass' && lab.behavior.success) {
    return appendLog(state, ['success', lab.behavior.success]);
  }
  const note = lab.behavior.runningNote?.(lab, { lab, state });
  const withNote = note ? appendLog(state, ['warn', note.title + '.']) : state;
  return appendLog(withNote, ...problem(verdict));
}

function update(lab: LabDef, state: RuntimeState, action: RuntimeAction): RuntimeState {
  const store = { lab, state };
  switch (action.type) {
    case 'placePart': {
      const { part, hole } = action;
      let next: RuntimeState = { ...state, parts: { ...state.parts, [part]: hole } };
      if (hole) return appendLog(next, ['info', describePlacement(lab, state, part, hole)]);
      if (state.burnt.includes(part)) {
        next = { ...next, burnt: next.burnt.filter((id) => id !== part), flipped: next.flipped.filter((id) => id !== part) };
        return appendLog(next, ['info', `Swapped the burned-out ${partName(lab, part)} for a fresh one.`]);
      }
      return state.parts[part] ? appendLog(next, ['info', `Returned the ${partName(lab, part)} to the parts bin.`]) : next;
    }
    case 'flipPart': {
      const flipped = state.flipped.includes(action.part)
        ? state.flipped.filter((id) => id !== action.part)
        : [...state.flipped, action.part];
      const next = { ...state, flipped };
      const start = state.parts[action.part];
      const spec = lab.parts.find((p) => p.id === action.part);
      const holes = start && spec ? partLegs(spec.def, start) : null;
      const plus = holes ? holes[next.flipped.includes(action.part) ? 1 : 0] : null;
      return appendLog(next, [
        'info',
        plus ? `Flipped the ${partName(lab, action.part)}: its + leg is now in ${holeName(plus)}.` : `Flipped the ${partName(lab, action.part)}.`,
      ]);
    }
    case 'pressPart': {
      const pressed = action.pressed ? [...state.pressed, action.part] : state.pressed.filter((id) => id !== action.part);
      const next = { ...state, pressed };
      if (next.running && lab.behavior.onPress) {
        return lab.behavior.onPress(lab, { lab, state: next }, action.part, action.pressed).state;
      }
      return next;
    }
    case 'control': {
      const next = { ...state, behavior: { ...state.behavior, [action.id]: action.value } };
      if (next.running && lab.behavior.onTick) return lab.behavior.onTick(lab, { lab, state: next }).state;
      return next;
    }
    case 'addWire': {
      const wire = { id: `w${state.nextId}`, pin: action.pin, hole: action.hole };
      return appendLog({ ...state, wires: [...state.wires, wire] }, ['info', describeWire(wire)]);
    }
    case 'moveWire': {
      const before = state.wires.find((wire) => wire.id === action.id);
      if (!before) return state;
      const moved: BenchWire = {
        ...before,
        pin: action.pin ?? before.pin,
        hole: action.hole ?? before.hole,
        hole2: action.hole2 ?? before.hole2 ?? null,
      };
      const wires = state.wires.map((wire) => (wire.id === action.id ? moved : wire));
      const completed = !isPlugged(before) && isPlugged(moved);
      const end = (w: BenchWire) => (w.pin ? PIN_BY_ID[w.pin].name : w.hole2 ? holeName(w.hole2) : 'a loose end');
      const text = completed
        ? describeWire(moved)
        : `Moved the jumper: ${end(moved)} → ${moved.hole ? holeName(moved.hole) : 'a loose end'}.`;
      return appendLog({ ...state, wires }, ['info', text]);
    }
    case 'removeWire': {
      const removed = state.wires.find((wire) => wire.id === action.id);
      if (!removed) return state;
      const which = removed.pin ? `the ${PIN_BY_ID[removed.pin].name} jumper` : 'a breadboard jumper';
      return appendLog({ ...state, wires: state.wires.filter((wire) => wire.id !== action.id) }, [
        'info',
        `Removed ${which}.`,
      ]);
    }
    case 'mistake':
      return appendLog(state, ['error', action.title], ['hint', `Hint: ${action.hint}`]);
    case 'clearLog':
      return { ...state, log: [] };
    case 'compile':
      return { ...state, busy: 'compiling' };
    case 'verifyDone': {
      const next = appendLog({ ...state, busy: 'idle' }, ['muted', `Verified sketch "${lab.sketch.name}".`]);
      const verdict = judge(lab, next);
      if (verdict.code === 'pass') return appendLog(next, ['success', `${verdict.title}: your wiring is correct.`]);
      return appendLog(next, ...problem(verdict, isMistake(lab.verdict, verdict) || verdict.code === 'burnt' ? 'error' : 'warn'));
    }
    case 'uploadStart':
      return { ...state, busy: 'uploading', running: false };
    case 'uploadDone':
      // Verdicts and success reporting happen after physics in the reducer.
      return appendLog({ ...state, busy: 'idle', running: true }, [
        'muted',
        `Uploaded "${lab.sketch.name}" to the Arduino Uno.`,
      ]);
    case 'tick': {
      if (!state.running || !lab.behavior.onTick) return state;
      return lab.behavior.onTick(lab, store).state;
    }
    case 'reset': {
      const fresh = createLabStore(lab).state;
      return appendLog({ ...fresh, nextId: state.nextId }, ['muted', 'Lab reset. Everything is back in the parts bin.']);
    }
  }
}
