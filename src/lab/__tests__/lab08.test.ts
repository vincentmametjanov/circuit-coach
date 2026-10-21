// Lab 08 tests: the servo's three-leg plug (GND / 5V / signal), power from
// 3.3V, the power-signal swap, and the knob-to-angle map.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB08, gateAngle } from '../labs/lab08';
import { type BenchState, type RuntimeState, circuitOf, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

function bench(wires: [pin: string, hole: Hole][], placed = true, pot = true): BenchState {
  return {
    parts: { pot: pot ? at(3, 0) : null, servo: placed ? at(9, 0) : null },
    flipped: [],
    burnt: [],
    pressed: [],
    wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })),
  };
}

// Pot at a3 (legs a3, a5, a7): 5V → b3, A0 → b5, GND → b7.
// Servo at a9: GND a9, 5V a11, signal a13 → GND → b9, IOREF (5V) → b11, ~9 → b13.
const DIAL: [string, Hole][] = [
  ['5V', at(3, 1)],
  ['A0', at(5, 1)],
  ['GND_T', at(7, 1)],
];
const GOOD = bench([...DIAL, ['GND_P1', at(9, 1)], ['IOREF', at(11, 1)], ['D9', at(13, 1)]]);

const verdict = (b: BenchState) => judge(LAB08, b);

describe('Lab 08 verdicts', () => {
  it('passes the gate circuit', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('warns when the servo is powered from 3.3V', () => {
    const v = verdict(bench([...DIAL, ['GND_P1', at(9, 1)], ['3V3', at(11, 1)], ['D9', at(13, 1)]]));
    expect(v.code).toBe('on33');
    expect(v.detail).toContain('jitters');
  });

  it('flags power and signal swapped', () => {
    const v = verdict(bench([...DIAL, ['GND_P1', at(9, 1)], ['D9', at(11, 1)], ['IOREF', at(13, 1)]]));
    expect(v.code).toBe('swapped');
  });

  it('names the pin when the signal leg is elsewhere', () => {
    const v = verdict(bench([...DIAL, ['GND_P1', at(9, 1)], ['IOREF', at(11, 1)], ['D8', at(13, 1)]]));
    expect(v.code).toBe('sigWrongPin');
    expect(v.title).toBe('The signal leg is on pin 8, not pin ~9');
  });

  it('requires the servo’s ground', () => {
    const v = verdict(bench([...DIAL, ['IOREF', at(11, 1)], ['D9', at(13, 1)]]));
    expect(v.code).toBe('gndMissing');
  });

  it('asks for the dial too', () => {
    const v = verdict(bench([['GND_P1', at(9, 1)], ['IOREF', at(11, 1)], ['D9', at(13, 1)]], true, false));
    expect(v.code).toBe('missingParts');
  });
});

describe('Lab 08 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB08, s, a), state);

  it('maps the knob to 0–180°', () => {
    let state = run({ ...createLabStore(LAB08).state, ...GOOD }, { type: 'uploadDone' });
    expect(state.log.at(-1)?.kind).toBe('success');
    expect(state.behavior.servo ?? gateAngle(circuitOf(LAB08, GOOD), 0.5)).toBe(90);
    state = run(state, { type: 'control', id: 'knob', value: 1 });
    expect(state.behavior.servo).toBe(180);
    state = run(state, { type: 'control', id: 'knob', value: 0 });
    expect(state.behavior.servo).toBe(0);
  });

  it('holds the gate at 0 while the servo is unwired', () => {
    const state = run({ ...createLabStore(LAB08).state, ...bench(DIAL) }, { type: 'uploadDone' }, { type: 'tick' });
    expect(state.behavior.servo).toBe(0);
  });
});

describe('Lab 08 guide steps', () => {
  it('ticks off dial, servo, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB08, b, running).map((s) => s.done);
    expect(done(bench([], false, false))).toEqual([false, false, false]);
    expect(done(bench(DIAL, false))).toEqual([true, false, false]);
    expect(done(GOOD)).toEqual([true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true]);
  });
});
