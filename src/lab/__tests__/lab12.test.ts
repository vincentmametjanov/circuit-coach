// Lab 12 tests (capstone): the four subsystems (sensor divider, servo gate,
// stack light, pause button) and the sense → decide → actuate loop itself.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB12 } from '../labs/lab12';
import { type BenchState, type RuntimeState, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });
const RAIL = (col: number): Hole => ({ row: 10, col: col - 1 });
const RAIL_PLUS = (col: number): Hole => ({ row: -1, col: col - 1 });

type Ids =
  | 'ldr'
  | 'pullSensor'
  | 'servo'
  | 'ledGreen'
  | 'resistorG'
  | 'ledYellow'
  | 'resistorY'
  | 'ledRed'
  | 'resistorR'
  | 'button'
  | 'pullButton';
type Layout = { parts?: Partial<Record<Ids, Hole | null>>; wires?: [pin: string, hole: Hole][]; links?: [Hole, Hole][] };

function bench({ parts = {}, wires = [], links = [] }: Layout): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB12.parts) all[spec.id] = spec.id in parts ? (parts[spec.id as Ids] ?? null) : null;
  return {
    parts: all,
    flipped: [],
    burnt: [],
    pressed: [],
    wires: [...wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })), ...links.map(([a, b], i) => ({ id: `l${i}`, pin: null, hole: a, hole2: b }))],
  };
}

// Sensor: LDR a1–a4, 10 kΩ c4–c7; + rail → b1, A0 → b4, b7 → − rail.
// Gate: servo at a9 (gnd a9, 5V a11, sig a13): b9 → − rail, IOREF (5V) → b11, ~9 → b13.
// Stack light on the bottom half, each − leg jumpered to the − rail:
//   green: 220 Ω f1–f4, LED h4(+)–h5(−), pin 5 → g1
//   yellow: 220 Ω f7–f10, LED h10(+)–h11(−), pin 6 → g7
//   red: 220 Ω f12–f15, LED h15(+)–h16(−), pin 7 → g12
// Pause button across the gap at cols 14/17: + rail → b14, pin 2 → j14,
// 10 kΩ i14–i17, i17 → − rail. GND → − rail once.
const LAYOUT: Layout = {
  parts: {
    ldr: at(1, 0),
    pullSensor: at(4, 2),
    servo: at(9, 0),
    resistorG: at(1, 5),
    ledGreen: at(4, 7),
    resistorY: at(7, 5),
    ledYellow: at(10, 7),
    resistorR: at(12, 5),
    ledRed: at(15, 7),
    button: at(14, 2),
    pullButton: at(14, 8),
  },
  wires: [
    ['5V', RAIL_PLUS(1)],
    ['IOREF', at(11, 1)],
    ['D5', at(1, 6)],
    ['D6', at(7, 6)],
    ['D7', at(12, 6)],
    ['D9', at(13, 1)],
    ['A0', at(4, 1)],
    ['D2', at(14, 9)],
    ['GND_T', RAIL(17)],
  ],
  links: [
    [RAIL_PLUS(3), at(1, 1)],
    [RAIL_PLUS(9), at(14, 1)],
    [at(9, 1), RAIL(9)],
    [at(7, 1), RAIL(7)],
    [at(17, 8), RAIL(13)],
    [at(5, 9), RAIL(5)],
    [at(11, 9), RAIL(11)],
    [at(16, 9), RAIL(16)],
  ],
};

const GOOD = bench(LAYOUT);

const verdict = (b: BenchState) => judge(LAB12, b);

describe('Lab 12 verdicts', () => {
  it('passes the complete work cell', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('reports the servo when its plug is half wired', () => {
    const v = verdict(bench({ ...LAYOUT, wires: LAYOUT.wires!.filter(([pin]) => pin !== 'D9') }));
    expect(v.code).toBe('servo');
  });

  it('reports the sensor when the divider is gone', () => {
    const v = verdict(bench({ ...LAYOUT, parts: { ...LAYOUT.parts!, pullSensor: null } }));
    expect(v.code).toBe('sensor');
  });

  it('names the color when two stack-light channels are swapped', () => {
    const v = verdict(
      bench({
        ...LAYOUT,
        wires: LAYOUT.wires!.map(([pin, hole]): [string, Hole] => [pin === 'D5' ? 'D6' : pin === 'D6' ? 'D5' : pin, hole]),
      }),
    );
    expect(v.code).toBe('ledLoops');
    expect(v.title).toBe('The green LED is on pin 6');
  });

  it('flags the pause button floating', () => {
    // No pull-down, and no dangling link from the button's far side to the rail.
    const v = verdict(
      bench({
        ...LAYOUT,
        parts: { ...LAYOUT.parts!, pullButton: null },
        links: LAYOUT.links!.filter(([a]) => !(a.row === 8 && a.col === 16)),
      }),
    );
    expect(v.code).toBe('floating');
  });

  it('asks for the parts first', () => {
    expect(verdict(bench({})).code).toBe('missingParts');
  });
});

describe('Lab 12 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB12, s, a), state);
  const start = (b: BenchState) => run({ ...createLabStore(LAB12).state, ...b }, { type: 'uploadDone' });

  it('sorts boxes: the first is light, the second dark, so the gate opens', () => {
    // The runtime's seeded random makes the second box dark. One cycle is 10
    // ticks; the decision lands on phase 6.
    let state = start(GOOD);
    expect(state.log.at(-1)?.kind).toBe('success');
    for (let i = 0; i < 6; i += 1) state = run(state, { type: 'tick' });
    expect(state.serial.at(-1)).toBe('Box 1: light, passes  (sorted 0 dark, 1 light)');
    for (let i = 0; i < 10; i += 1) state = run(state, { type: 'tick' });
    expect(state.serial.at(-1)).toBe('Box 2: dark, gate opens  (sorted 1 dark, 1 light)');
    expect(state.behavior.servo).toBe(90);
    expect(LAB12.behavior.outputs!(LAB12, { lab: LAB12, state })).toEqual(['D5', 'D7']);
  });

  it('pauses the line on the button and shows yellow', () => {
    let state = start(GOOD);
    state = run(state, { type: 'pressPart', part: 'button', pressed: true });
    expect(state.behavior.paused).toBe(true);
    expect(state.log.some((line) => line.text.startsWith('Line paused'))).toBe(true);
    expect(LAB12.behavior.outputs!(LAB12, { lab: LAB12, state })).toEqual(['D6']);
    const phase = state.behavior.phase;
    state = run(state, { type: 'pressPart', part: 'button', pressed: false }, { type: 'tick' });
    expect(state.behavior.phase).toBe(phase); // frozen while paused
    state = run(state, { type: 'pressPart', part: 'button', pressed: true });
    expect(state.log.some((line) => line.text.startsWith('Line running'))).toBe(true);
  });
});

describe('Lab 12 guide steps', () => {
  it('ticks off all four subsystems, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB12, b, running).map((s) => s.done);
    expect(done(bench({}))).toEqual([false, false, false, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true, true]);
  });
});
