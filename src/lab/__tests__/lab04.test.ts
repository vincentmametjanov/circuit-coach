// Lab 04 checker and behavior tests: the potentiometer as a voltage divider
// into A0, either way round, and the Serial Monitor readings.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB04, potReading } from '../labs/lab04';
import { type BenchState, type RuntimeState, circuitOf, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

// The pot's legs sit 2 columns apart: placed at a3 they land in a3, a5, a7
// (outer, wiper, outer). Jumpers go in row b of the same columns.
const POT = at(3, 0);
const leg = { outerA: at(3, 1), wiper: at(5, 1), outerB: at(7, 1) };

function bench(wires: [pin: string, hole: Hole][], placed = true): BenchState {
  return {
    parts: { pot: placed ? POT : null },
    flipped: [],
    burnt: [],
    pressed: [],
    wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })),
  };
}

const GOOD = bench([
  ['5V', leg.outerA],
  ['A0', leg.wiper],
  ['GND_T', leg.outerB],
]);
const verdict = (b: BenchState) => judge(LAB04, b);
const reading = (b: BenchState, knob: number) => potReading(circuitOf(LAB04, b), knob);

describe('Lab 04 verdicts', () => {
  it('passes a divider into A0', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('passes with the outer legs the other way round too', () => {
    expect(verdict(bench([['GND_T', leg.outerA], ['A0', leg.wiper], ['5V', leg.outerB]])).code).toBe('pass');
  });

  it('names the pin when the wiper is on a digital pin', () => {
    const v = verdict(bench([['5V', leg.outerA], ['D8', leg.wiper], ['GND_T', leg.outerB]]));
    expect(v.code).toBe('wiperWrongPin');
    expect(v.title).toBe('The wiper is on pin 8, not A0');
  });

  it('flags the wiper wired to a supply', () => {
    const v = verdict(bench([['5V', leg.wiper], ['A0', leg.outerA], ['GND_T', leg.outerB]]));
    expect(v.code).toBe('wiperOnSupply');
    expect(v.title).toBe('The wiper is wired to 5V');
  });

  it('flags both outer legs on the same supply', () => {
    // IOREF is tied to 5V on the Uno, so this puts 5V on both outer legs.
    const v = verdict(bench([['5V', leg.outerA], ['A0', leg.wiper], ['IOREF', leg.outerB]]));
    expect(v.code).toBe('outerSame');
    expect(v.title).toBe('Both outer legs are on 5V');
  });

  it('explains a reading stuck at one end when an outer leg is unwired', () => {
    const v = verdict(bench([['5V', leg.outerA], ['A0', leg.wiper], ['GND_T', at(12, 1)]]));
    expect(v.code).toBe('outerMissing');
    expect(v.detail).toContain('stuck at 1023');
  });

  it('explains a floating A0 when no outer leg is wired', () => {
    expect(verdict(bench([['A0', leg.wiper]])).title).toBe('The outer legs aren’t connected');
  });

  it('asks for the pot first', () => {
    expect(verdict(bench([], false)).code).toBe('missingParts');
  });

  it('checks for shorts before anything else', () => {
    expect(verdict(bench([['5V', at(12, 1)], ['GND_T', at(12, 2)]])).code).toBe('short');
  });
});

describe('Lab 04 readings', () => {
  it('scales the knob from 0 to 1023', () => {
    expect(reading(GOOD, 0)).toBe(1023);
    expect(reading(GOOD, 0.5)).toBe(512);
    expect(reading(GOOD, 1)).toBe(0);
  });

  it('runs the other way when the outer legs are swapped', () => {
    const swapped = bench([['GND_T', leg.outerA], ['A0', leg.wiper], ['5V', leg.outerB]]);
    expect(reading(swapped, 0)).toBe(0);
    expect(reading(swapped, 1)).toBe(1023);
  });

  it('reads nothing when the wiper isn’t on A0', () => {
    expect(reading(bench([['5V', leg.outerA], ['GND_T', leg.outerB]]), 0.5)).toBeNull();
  });
});

describe('Lab 04 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB04, s, a), state);
  const start = (b: BenchState) => run({ ...createLabStore(LAB04).state, ...b }, { type: 'uploadDone' });

  it('prints the reading and voltage to the Serial Monitor as the knob turns', () => {
    let state = start(GOOD);
    expect(state.log.at(-1)?.kind).toBe('success');
    state = run(state, { type: 'control', id: 'knob', value: 0.25 }, { type: 'tick' });
    expect(state.serial.at(-1)).toBe('767  3.75 V');
    state = run(state, { type: 'control', id: 'knob', value: 1 }, { type: 'tick' });
    expect(state.serial.at(-1)).toBe('0  0.00 V');
  });

  it('prints nothing while the wiper isn’t on A0', () => {
    const state = run(start(bench([['5V', leg.outerA], ['GND_T', leg.outerB]])), { type: 'tick' }, { type: 'tick' });
    expect(state.serial.filter((line) => /^\d/.test(line))).toEqual([]);
  });
});

describe('Lab 04 Output', () => {
  it('describes placing the pot by its three legs', () => {
    const state = runtimeReducer(LAB04, createLabStore(LAB04).state, { type: 'placePart', part: 'pot', hole: POT });
    expect(state.log.at(-1)?.text).toBe('Placed the 10 kΩ potentiometer: legs in a3, a5, a7.');
  });
});

describe('Lab 04 guide steps', () => {
  it('ticks off each step', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB04, b, running).map((s) => s.done);
    expect(done(bench([], false))).toEqual([false, false, false, false]);
    expect(done(bench([]))).toEqual([true, false, false, false]);
    expect(done(bench([['5V', leg.outerB], ['GND_T', leg.outerA]]))).toEqual([true, true, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true]);
  });
});
