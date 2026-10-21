// Lab 10 tests: two switches with pull-downs, the run light's interlock, the
// E-stop edge, and a bouncing limit switch double-counting a cycle.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB10 } from '../labs/lab10';
import { type BenchState, type RuntimeState, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

type Ids = 'limit' | 'estop' | 'pullLimit' | 'pullEstop' | 'led' | 'resistor';

function bench(parts: Partial<Record<Ids, Hole | null>>, wires: [pin: string, hole: Hole][] = []): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB10.parts) all[spec.id] = parts[spec.id as Ids] ?? null;
  return { parts: all, flipped: [], burnt: [], pressed: [], wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })) };
}

// Limit across the gap at cols 3/6: 5V → a3, pin 2 → j3, pull-down f3–f6, GND → g6.
// E-stop across cols 8/11: IOREF (5V) → a8, pin 3 → j8, pull-down i5–i8, GND → j5.
// Run light: 220 Ω a12–a15, LED c15(+)–c16(−): pin 7 → b12, GND → e16.
const GOOD = bench(
  { limit: at(3, 2), estop: at(8, 2), pullLimit: at(3, 5), pullEstop: at(5, 8), resistor: at(12, 0), led: at(15, 2) },
  [
    ['5V', at(3, 0)],
    ['D2', at(3, 9)],
    ['GND_T', at(6, 6)],
    ['IOREF', at(8, 0)],
    ['D3', at(8, 9)],
    ['GND_P1', at(5, 9)],
    ['D7', at(12, 1)],
    ['GND_P2', at(16, 4)],
  ],
);

const verdict = (b: BenchState) => judge(LAB10, b);

describe('Lab 10 verdicts', () => {
  it('passes the interlocked line', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('names pin 2 when the limit switch floats', () => {
    const v = verdict(
      bench(
        { limit: at(3, 2), estop: at(8, 2), pullEstop: at(5, 8), resistor: at(12, 0), led: at(15, 2) },
        [
          ['5V', at(3, 0)],
          ['D2', at(3, 9)],
          ['IOREF', at(8, 0)],
          ['D3', at(8, 9)],
          ['GND_P1', at(5, 9)],
          ['D7', at(12, 1)],
          ['GND_P2', at(16, 4)],
        ],
      ),
    );
    expect(v.code).toBe('floatingLimit');
    expect(v.title).toBe('pin 2 is floating');
  });

  it('names pin 3 when the E-stop floats', () => {
    const v = verdict(
      bench(
        { limit: at(3, 2), estop: at(8, 2), pullLimit: at(3, 5), resistor: at(12, 0), led: at(15, 2) },
        [
          ['5V', at(3, 0)],
          ['D2', at(3, 9)],
          ['GND_T', at(6, 6)],
          ['IOREF', at(8, 0)],
          ['D3', at(8, 9)],
          ['D7', at(12, 1)],
          ['GND_P2', at(16, 4)],
        ],
      ),
    );
    expect(v.code).toBe('floatingEstop');
  });

  it('flags a pin tied straight to 5V as always pressed', () => {
    // Pin 2's jumper lands in the same strip as the 5V jumper.
    const v = verdict(bench({ limit: at(3, 2), estop: at(8, 2) }, [['5V', at(3, 0)], ['D2', at(3, 1)]]));
    expect(v.code).toBe('alwaysPressed');
  });
});

describe('Lab 10 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB10, s, a), state);
  const start = (b: BenchState) => run({ ...createLabStore(LAB10).state, ...b }, { type: 'uploadDone' });
  const outputs = (state: RuntimeState) => LAB10.behavior.outputs!(LAB10, { lab: LAB10, state });

  it('runs the light while both switches are clear', () => {
    const state = start(GOOD);
    expect(state.log.at(-1)?.kind).toBe('success');
    expect(outputs(state)).toEqual(['D7']);
  });

  it('drops the line on the E-stop edge and restores it on release', () => {
    let state = start(GOOD);
    state = run(state, { type: 'pressPart', part: 'estop', pressed: true });
    expect(state.log.some((line) => line.kind === 'error' && line.text.startsWith('E-STOP pressed'))).toBe(true);
    expect(outputs(state)).toEqual([]);
    state = run(state, { type: 'pressPart', part: 'estop', pressed: false });
    expect(state.log.some((line) => line.text.startsWith('E-stop released'))).toBe(true);
    expect(outputs(state)).toEqual(['D7']);
  });

  it('counts a bounced press twice and explains why', () => {
    // The runtime's seeded random bounces on the first press.
    let state = start(GOOD);
    state = run(state, { type: 'pressPart', part: 'limit', pressed: true });
    expect(state.behavior.cycles).toBe(2);
    expect(state.serial).toEqual(['Serial Monitor open at 9600 baud.', 'Cycle 1', 'Cycle 2']);
    expect(state.log.some((line) => line.text.includes('bounced'))).toBe(true);
  });
});

describe('Lab 10 guide steps', () => {
  it('ticks off limit, E-stop, light, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB10, b, running).map((s) => s.done);
    expect(done(bench({}))).toEqual([false, false, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true]);
  });
});
