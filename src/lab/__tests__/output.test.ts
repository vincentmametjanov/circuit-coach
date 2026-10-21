// The Output console: it reports what happened, flags wiring mistakes the
// moment they appear (an error plus a hint), and stays quiet otherwise.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB01 } from '../labs/lab01';
import {
  type RuntimeAction as LabAction,
  type RuntimeState as LabState,
  createLabStore,
  judge,
  runtimeReducer,
  toCircuitBoard,
} from '../runtime';

const createLab = () => createLabStore(LAB01).state;
const labReducer = (state: LabState, action: LabAction) => runtimeReducer(LAB01, state, action);
const analyzeCircuit = (state: LabState) => ({ verdict: judge(LAB01, state) });
const toBoard = (state: LabState) => toCircuitBoard(LAB01, state);

const top = (col: number, row = 0): Hole => ({ row, col: col - 1 });

const run = (...actions: LabAction[]) => actions.reduce(labReducer, createLab());
const texts = (lab: LabState) => lab.log.map((line) => `${line.kind}: ${line.text}`);

// The textbook build, as actions: resistor in cols 3–6, LED + in 6, pin 7 → col 3, GND → col 7.
const BUILD: LabAction[] = [
  { type: 'placePart', part: 'resistor', hole: top(3) },
  { type: 'placePart', part: 'led', hole: top(6, 2) },
  { type: 'addWire', pin: 'D7', hole: top(3, 1) },
  { type: 'addWire', pin: 'GND_T', hole: top(7, 1) },
];

describe('Output console', () => {
  it('starts empty', () => {
    expect(createLab().log).toEqual([]);
  });

  it('logs one line per action, saying what happened', () => {
    expect(texts(run(...BUILD))).toEqual([
      'info: Placed the 220 Ω resistor in a3 and a6.',
      'info: Placed the LED: + leg in c6, − leg in c7.',
      'info: Connected pin 7 to b3 with a jumper.',
      'info: Connected GND to b7 with a jumper.',
    ]);
  });

  it('flags a backwards LED as soon as the loop closes, with a hint', () => {
    const lab = run(...BUILD, { type: 'flipPart', part: 'led' });
    expect(texts(lab).slice(-3)).toEqual([
      'info: Flipped the LED: its + leg is now in c7.',
      'error: The LED is in backwards.',
      expect.stringMatching(/^hint: Hint: Current only flows into the \+ \(long\) leg/),
    ]);
  });

  it('does not repeat the same mistake on later actions', () => {
    const lab = run(...BUILD, { type: 'flipPart', part: 'led' }, { type: 'addWire', pin: 'D2', hole: top(14, 1) });
    expect(lab.log.filter((line) => line.text === 'The LED is in backwards.')).toHaveLength(1);
  });

  it('warns about a missing resistor before the LED can burn out', () => {
    const lab = run(
      { type: 'placePart', part: 'led', hole: top(6, 2) },
      { type: 'addWire', pin: 'D7', hole: top(6, 1) },
      { type: 'addWire', pin: 'GND_T', hole: top(7, 1) },
    );
    expect(lab.burnt.includes('led')).toBe(false);
    expect(texts(lab).at(-2)).toBe('error: No resistor in the loop.');
  });

  it('reports the burnout instead of a second warning when 5V burns the LED', () => {
    const lab = run(
      { type: 'placePart', part: 'led', hole: top(6, 2) },
      { type: 'addWire', pin: '5V', hole: top(6, 1) },
      { type: 'addWire', pin: 'GND_T', hole: top(7, 1) },
    );
    expect(lab.burnt.includes('led')).toBe(true);
    expect(texts(lab).slice(-2)).toEqual([
      expect.stringMatching(/^error: Pop! The LED burned out/),
      expect.stringMatching(/^hint: Hint: Drag the dead LED back/),
    ]);
  });

  it('does not treat an unfinished circuit as a mistake while building', () => {
    const lab = run(BUILD[0], BUILD[1]);
    expect(lab.log.every((line) => line.kind === 'info')).toBe(true);
  });

  it('on Verify, explains what is missing as a warning and hint', () => {
    const lab = run(BUILD[0], BUILD[1], { type: 'compile' }, { type: 'verifyDone' });
    expect(texts(lab).slice(-3)).toEqual([
      'muted: Verified sketch "blink_d7".',
      'warn: Pin 7 isn’t wired yet.',
      expect.stringMatching(/^hint: Hint: Drag from pin 7/),
    ]);
  });

  it('on Verify, confirms a correct circuit in one line', () => {
    const lab = run(...BUILD, { type: 'compile' }, { type: 'verifyDone' });
    expect(texts(lab).at(-1)).toBe('success: Circuit check passed: your wiring is correct.');
  });

  it('on Upload of a wrong circuit, says what happened, then the error and hint', () => {
    const lab = run(BUILD[0], BUILD[1], BUILD[2], { type: 'uploadStart' }, { type: 'uploadDone' });
    expect(texts(lab).slice(-4)).toEqual([
      'muted: Uploaded "blink_d7" to the Arduino Uno.',
      'warn: The sketch is running, but the LED isn’t blinking.',
      'error: Nothing returns to GND.',
      expect.stringMatching(/^hint: Hint: Current needs a path back/),
    ]);
  });

  it('shows workbench mistakes as an error plus a hint', () => {
    const lab = run({ type: 'mistake', title: 'pin 7 already has a jumper in it.', hint: 'Pick another pin.' });
    expect(texts(lab)).toEqual(['error: pin 7 already has a jumper in it.', 'hint: Hint: Pick another pin.']);
  });
});

describe('Jumpers from the parts bin', () => {
  it('can start with one end loose and is ignored by the checker until plugged in', () => {
    const lab = run(BUILD[0], BUILD[1], BUILD[3], { type: 'addWire', pin: null, hole: top(3, 1) });
    expect(texts(lab).at(-1)).toBe('info: Plugged a jumper into b3. Its other end is loose.');
    expect(toBoard(lab).wires).toHaveLength(1);
    expect(toBoard(lab).links).toEqual([]);
    expect(analyzeCircuit(lab).verdict.title).toBe('Pin 7 isn’t wired yet');
  });

  it('completes the circuit once the loose end goes into pin 7', () => {
    const loose = run(BUILD[0], BUILD[1], BUILD[3], { type: 'addWire', pin: null, hole: top(3, 1) });
    const lab = labReducer(loose, { type: 'moveWire', id: loose.wires.at(-1)!.id, pin: 'D7' });
    expect(texts(lab).at(-1)).toBe('info: Connected pin 7 to b3 with a jumper.');
    expect(analyzeCircuit(lab).verdict.code).toBe('pass');
  });

  it('can start in a pin and finish in a hole', () => {
    const loose = run(BUILD[0], BUILD[1], BUILD[3], { type: 'addWire', pin: 'D7', hole: null });
    expect(texts(loose).at(-1)).toBe('info: Plugged a jumper into pin 7. Its other end is loose.');
    const lab = labReducer(loose, { type: 'moveWire', id: loose.wires.at(-1)!.id, hole: top(3, 1) });
    expect(analyzeCircuit(lab).verdict.code).toBe('pass');
  });
});
