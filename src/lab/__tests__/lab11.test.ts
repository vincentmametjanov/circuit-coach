// Lab 11 tests: the stepper driver's step/direction wiring and the homing
// routine — trip the limit switch in time, or the axis runs past it.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB11 } from '../labs/lab11';
import { type BenchState, type RuntimeState, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

type Ids = 'stepper' | 'limit' | 'resistor10k';

function bench(parts: Partial<Record<Ids, Hole | null>>, wires: [pin: string, hole: Hole][] = []): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB11.parts) all[spec.id] = parts[spec.id as Ids] ?? null;
  return { parts: all, flipped: [], burnt: [], pressed: [], wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })) };
}

// Stepper at a3: step a3 → pin ~3 (b3), dir a5 → pin 4 (b5), GND a7 → GND (b7).
// Limit across cols 11/14: 5V → a11, pin 2 → j11, 10 kΩ i8–i11, GND → j8.
const GOOD = bench(
  { stepper: at(3, 0), limit: at(11, 2), resistor10k: at(8, 8) },
  [
    ['D3', at(3, 1)],
    ['D4', at(5, 1)],
    ['GND_T', at(7, 1)],
    ['5V', at(11, 0)],
    ['D2', at(11, 9)],
    ['GND_P1', at(8, 9)],
  ],
);

const verdict = (b: BenchState) => judge(LAB11, b);

describe('Lab 11 verdicts', () => {
  it('passes the homing circuit', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('flags step and direction swapped', () => {
    const v = verdict(
      bench(
        { stepper: at(3, 0), limit: at(11, 2), resistor10k: at(8, 8) },
        [
          ['D4', at(3, 1)],
          ['D3', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['5V', at(11, 0)],
          ['D2', at(11, 9)],
          ['GND_P1', at(8, 9)],
        ],
      ),
    );
    expect(v.code).toBe('stepDirSwapped');
  });

  it('names the pin when step is elsewhere', () => {
    const v = verdict(
      bench(
        { stepper: at(3, 0), limit: at(11, 2), resistor10k: at(8, 8) },
        [
          ['D5', at(3, 1)],
          ['D4', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['5V', at(11, 0)],
          ['D2', at(11, 9)],
          ['GND_P1', at(8, 9)],
        ],
      ),
    );
    expect(v.code).toBe('signalPins');
    expect(v.title).toBe('The step leg is on pin 5, not pin ~3');
  });

  it('requires the driver ground', () => {
    const v = verdict(
      bench(
        { stepper: at(3, 0), limit: at(11, 2), resistor10k: at(8, 8) },
        [
          ['D3', at(3, 1)],
          ['D4', at(5, 1)],
          ['5V', at(11, 0)],
          ['D2', at(11, 9)],
          ['GND_P1', at(8, 9)],
        ],
      ),
    );
    expect(v.code).toBe('gndMissing');
  });

  it('flags a floating limit input', () => {
    const v = verdict(
      bench(
        { stepper: at(3, 0), limit: at(11, 2) },
        [
          ['D3', at(3, 1)],
          ['D4', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['5V', at(11, 0)],
          ['D2', at(11, 9)],
        ],
      ),
    );
    expect(v.code).toBe('floating');
  });
});

describe('Lab 11 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB11, s, a), state);
  const start = (b: BenchState) => run({ ...createLabStore(LAB11).state, ...b }, { type: 'uploadDone' });

  it('homes when the limit switch trips, then reports position zero', () => {
    let state = start(GOOD);
    expect(state.serial.at(-1)).toBe('Homing…');
    state = run(state, { type: 'tick' }, { type: 'tick' });
    expect(state.serial.at(-1)).toBe('stepping… 90');
    state = run(state, { type: 'pressPart', part: 'limit', pressed: true });
    expect(state.behavior.homed).toBe(true);
    expect(state.behavior.pos).toBe(0);
    expect(state.serial.at(-1)).toBe('Home found. pos = 0');
    expect(state.log.at(-1)?.kind).toBe('success');
  });

  it('fails homing when the switch never trips', () => {
    let state = start(GOOD);
    for (let i = 0; i < 11; i += 1) state = run(state, { type: 'tick' });
    expect(state.behavior.failed).toBe(true);
    expect(state.serial.at(-1)).toBe('Homing FAILED: never saw the limit switch.');
    expect(state.log.some((line) => line.kind === 'error' && line.text.startsWith('Homing failed'))).toBe(true);
  });
});

describe('Lab 11 guide steps', () => {
  it('ticks off signals, ground, switch, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB11, b, running).map((s) => s.done);
    expect(done(bench({}))).toEqual([false, false, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true]);
  });
});
