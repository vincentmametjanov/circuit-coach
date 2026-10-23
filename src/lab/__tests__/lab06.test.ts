// Lab 06 tests: the light-beam divider into A0 (both orientations), the
// missing-fixed-resistor mistake, and the box counter's edge detection.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB06, ldrReading } from '../labs/lab06';
import { type BenchState, type RuntimeState, circuitOf, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

type Ids = 'ldr' | 'resistor10k' | 'led' | 'resistor';

function bench(parts: Partial<Record<Ids, Hole | null>>, wires: [pin: string, hole: Hole][] = []): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB06.parts) all[spec.id] = parts[spec.id as Ids] ?? null;
  return { parts: all, flipped: [], burnt: [], pressed: [], wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })) };
}

// Divider: LDR a3–a6, 10 kΩ c6–c9 (c6 shares the LDR's a6 column).
// 5V → b3, A0 → b6, GND → b9. Count light: 220 Ω a11–a14, LED c14(+)–c15(−),
// pin 7 → b11, GND → e15.
const SENSOR = [
  ['5V', at(3, 1)],
  ['A0', at(6, 1)],
  ['GND_T', at(9, 1)],
] as [string, Hole][];
const LIGHT = [
  ['D7', at(11, 1)],
  ['GND_P1', at(15, 4)],
] as [string, Hole][];

const GOOD = bench({ ldr: at(3, 0), resistor10k: at(6, 2), resistor: at(11, 0), led: at(14, 2) }, [...SENSOR, ...LIGHT]);

const verdict = (b: BenchState) => judge(LAB06, b);
const reading = (b: BenchState, light: number) => ldrReading(circuitOf(LAB06, b), light);

describe('Lab 06 verdicts', () => {
  it('passes the textbook divider, dark-on', () => {
    const v = verdict(GOOD);
    expect(v.code).toBe('pass');
    expect(v.detail).toContain('dark-on');
  });

  it('passes with sensor and fixed resistor swapped: the light-on selector', () => {
    const v = verdict(
      bench({ ldr: at(3, 0), resistor10k: at(6, 2), resistor: at(11, 0), led: at(14, 2) }, [
        ['GND_T', at(3, 1)],
        ['A0', at(6, 1)],
        ['5V', at(9, 1)],
        ...LIGHT,
      ]),
    );
    expect(v.code).toBe('pass');
    expect(v.detail).toContain('light-on / dark-on selector');
  });

  it('flags the sensor alone with no fixed resistor', () => {
    const v = verdict(bench({ ldr: at(3, 0), resistor: at(11, 0), led: at(14, 2) }, [['5V', at(3, 1)], ['A0', at(6, 1)], ...LIGHT]));
    expect(v.code).toBe('noFixedResistor');
    expect(v.detail).toContain('near 1023');
  });

  it('points at the sensor wiring when nothing reaches A0', () => {
    const v = verdict(bench({ ldr: at(3, 0), resistor10k: at(6, 2), resistor: at(11, 0), led: at(14, 2) }, LIGHT));
    expect(v.code).toBe('sensorOpen');
  });

  it('asks for the parts first', () => {
    expect(verdict(bench({})).code).toBe('missingParts');
  });
});

describe('Lab 06 readings', () => {
  it('reads high in bright light and low with the beam blocked', () => {
    expect(reading(GOOD, 1)).toBe(930);
    expect(reading(GOOD, 0)).toBe(93);
  });

  it('swings the other way when the divider is swapped', () => {
    const swapped = bench({ ldr: at(3, 0), resistor10k: at(6, 2) }, [
      ['GND_T', at(3, 1)],
      ['A0', at(6, 1)],
      ['5V', at(9, 1)],
    ]);
    expect(reading(swapped, 1)).toBe(93);
    expect(reading(swapped, 0)).toBe(930);
  });

  it('reads nothing when A0 floats', () => {
    expect(reading(bench({ ldr: at(3, 0), resistor10k: at(6, 2) }), 1)).toBeNull();
  });
});

describe('Lab 06 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB06, s, a), state);
  const start = (b: BenchState) => run({ ...createLabStore(LAB06).state, ...b }, { type: 'uploadDone' });

  it('counts each box once and flashes the LED', () => {
    let state = start(GOOD);
    expect(state.log.at(-1)?.kind).toBe('success');
    // The beam is blocked during phases 4–5; the count lands on the fourth tick.
    for (let i = 0; i < 4; i += 1) state = run(state, { type: 'tick' });
    expect(state.serial.at(-1)).toBe('Part 1 counted (1 part this run)');
    expect(LAB06.behavior.ledLevels!(LAB06, { lab: LAB06, state }).led).toBe(1);
    // Ticks 5–8: the box is still (or no longer) there, so no second count.
    for (let i = 0; i < 4; i += 1) state = run(state, { type: 'tick' });
    expect(state.serial.filter((line) => line.startsWith('Part'))).toHaveLength(1);
  });

  it('keeps counting boxes as they pass', () => {
    let state = start(GOOD);
    for (let i = 0; i < 12; i += 1) state = run(state, { type: 'tick' });
    expect(state.serial.filter((line) => line.startsWith('Part'))).toHaveLength(2);
  });
});

describe('Lab 06 guide steps', () => {
  it('ticks off sensor, divider, light, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB06, b, running).map((s) => s.done);
    expect(done(bench({}))).toEqual([false, false, false, false]);
    expect(done(bench({ ldr: at(3, 0), resistor10k: at(6, 2) }))).toEqual([true, false, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true]);
  });
});
