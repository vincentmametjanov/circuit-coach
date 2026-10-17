// Lab 03 checker and behavior tests: three LED loops on pins 5/6/7 sharing the
// − rail, the shared-resistor warning, per-color mistakes, and the
// press-stepped state machine. Every layout here can be built on the
// workbench: one jumper per Arduino pin, breadboard jumpers to the rail.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB03 } from '../labs/lab03';
import {
  type BenchState,
  type RuntimeState,
  createLabStore,
  judge,
  ledGlowFor,
  runtimeReducer,
  runtimeSteps,
} from '../runtime';

/** Column 1-based like the breadboard labels; rows a–e are 0–4, f–j are 5–9. */
const at = (col: number, row: number): Hole => ({ row, col: col - 1 });
const RAIL = (col: number): Hole => ({ row: 10, col: col - 1 });

type Ids = 'ledGreen' | 'ledYellow' | 'ledRed' | 'resistorG' | 'resistorY' | 'resistorR' | 'button' | 'resistor10k';
type Layout = {
  parts?: Partial<Record<Ids, Hole>>;
  wires?: [pin: string, hole: Hole][];
  /** Breadboard jumpers between two holes. */
  links?: [Hole, Hole][];
  flipped?: Ids[];
};

function bench({ parts = {}, wires = [], links = [], flipped = [] }: Layout): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB03.parts) all[spec.id] = parts[spec.id as Ids] ?? null;
  return {
    parts: all,
    flipped,
    burnt: [],
    pressed: [],
    wires: [
      ...wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })),
      ...links.map(([a, b], i) => ({ id: `l${i}`, pin: null, hole: a, hole2: b })),
    ],
  };
}

const verdict = (layout: Layout) => judge(LAB03, bench(layout));

// The textbook build.
//   Green:  220 Ω a1–a4, LED c4(+)–c5(−), pin 5 → b1, e5 → − rail
//   Yellow: 220 Ω a6–a9, LED c9(+)–c10(−), pin 6 → b6, e10 → − rail
//   Red:    220 Ω f1–f4, LED h4(+)–h5(−), pin 7 → g1, j5 → − rail
//   Button: across the gap in cols 12/15 (c12, c15, h12, h15); 5V → a12;
//           pin 2 → j12; 10 kΩ pull-down i9–i12; j9 → − rail
//   GND → the − rail once.
const LOOPS: Layout = {
  parts: {
    resistorG: at(1, 0),
    ledGreen: at(4, 2),
    resistorY: at(6, 0),
    ledYellow: at(9, 2),
    resistorR: at(1, 5),
    ledRed: at(4, 7),
  },
  wires: [
    ['D5', at(1, 1)],
    ['D6', at(6, 1)],
    ['D7', at(1, 6)],
    ['GND_T', RAIL(17)],
  ],
  links: [
    [at(5, 4), RAIL(5)],
    [at(10, 4), RAIL(10)],
    [at(5, 9), RAIL(6)],
  ],
};

const GOOD: Layout = {
  parts: { ...LOOPS.parts, button: at(12, 2), resistor10k: at(9, 8) },
  wires: [...LOOPS.wires!, ['5V', at(12, 0)], ['D2', at(12, 9)]],
  links: [...LOOPS.links!, [at(9, 9), RAIL(9)]],
};

const withWires = (layout: Layout, change: (wires: [string, Hole][]) => [string, Hole][]): Layout => ({
  ...layout,
  wires: change(layout.wires!),
});

describe('Lab 03 verdicts', () => {
  it('passes the textbook circuit, grounded through the − rail', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('names the color when an LED is on a pin the sketch never drives', () => {
    const v = verdict(withWires(GOOD, (w) => w.map(([pin, hole]) => [pin === 'D5' ? 'D4' : pin, hole])));
    expect(v.code).toBe('ledLoops');
    expect(v.title).toBe('The green LED’s signal jumper is on pin 4');
  });

  it('explains when two colors are swapped', () => {
    // Green loop on pin 6, yellow loop on pin 5.
    const v = verdict(
      withWires(GOOD, (w) => w.map(([pin, hole]) => [pin === 'D5' ? 'D6' : pin === 'D6' ? 'D5' : pin, hole])),
    );
    expect(v.code).toBe('ledLoops');
    expect(v.title).toBe('The green LED is on pin 6');
  });

  it('spots a backwards LED by color, as soon as it happens', () => {
    expect(verdict({ ...GOOD, flipped: ['ledRed'] }).title).toBe('The red LED is in backwards');
    expect(LAB03.verdict.mistakes).toContain('ledLoops');
  });

  it('warns when one resistor serves two LEDs', () => {
    // Yellow LED moved so its + leg shares the green resistor's column (a4).
    const v = verdict({ ...GOOD, parts: { ...GOOD.parts, ledYellow: at(4, 3), resistorY: undefined } });
    expect(v.code).toBe('sharedResistor');
  });

  it('reports a burned-out LED by color', () => {
    const v = judge(LAB03, { ...bench(GOOD), burnt: ['ledYellow'] });
    expect(v.code).toBe('burnt');
    expect(v.title).toBe('The yellow LED is burned out');
  });

  it('spots a floating button input', () => {
    const { resistor10k: _, ...parts } = GOOD.parts!;
    expect(verdict({ ...GOOD, parts }).code).toBe('floating');
  });

  it('catches a button that can never take pin 2 HIGH', () => {
    // 5V lands in a column the button doesn't reach.
    const v = verdict(withWires(GOOD, (w) => w.map(([pin, hole]) => [pin, pin === '5V' ? at(16, 0) : hole])));
    expect(v.code).toBe('buttonOpen');
  });

  it('lists missing parts first', () => {
    expect(verdict({}).code).toBe('missingParts');
  });
});

describe('Lab 03 state machine', () => {
  const build = (layout: Layout): RuntimeState => ({ ...createLabStore(LAB03).state, ...bench(layout) });
  const step = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB03, s, a), state);
  const press = { type: 'pressPart', part: 'button', pressed: true } as const;
  const release = { type: 'pressPart', part: 'button', pressed: false } as const;
  const tick = { type: 'tick' } as const;
  const lit = (state: RuntimeState) =>
    Object.entries(ledGlowFor(LAB03, state))
      .filter(([, glow]) => glow !== 'off')
      .map(([id]) => id);

  it('steps RUN → WARN → STOP → RUN, one step per press', () => {
    let state = step(build(GOOD), { type: 'uploadDone' }, tick);
    expect(lit(state)).toEqual(['ledGreen']);

    // A press is an edge: holding it through many loops still counts once.
    state = step(state, press, tick, tick, tick);
    expect(lit(state)).toEqual(['ledYellow']);

    state = step(state, release, press);
    expect(lit(state)).toEqual(['ledRed']);

    state = step(state, release, press);
    expect(lit(state)).toEqual(['ledGreen']);
  });

  it('does not step when the button isn’t wired to pin 2', () => {
    const broken = withWires(GOOD, (w) => w.map(([pin, hole]) => [pin, pin === '5V' ? at(16, 0) : hole]));
    const state = step(build(broken), { type: 'uploadDone' }, press, tick, release, press);
    expect(lit(state)).toEqual(['ledGreen']);
  });

  it('steps by itself when pin 2 floats, and says why once', () => {
    const { resistor10k: _, ...parts } = GOOD.parts!;
    const state = step(build({ ...GOOD, parts }), { type: 'uploadDone' }, ...Array(30).fill(tick));
    expect(state.behavior.stage).not.toBe(undefined);
    expect(state.log.filter((line) => line.text.startsWith('Pin 2 is floating'))).toHaveLength(1);
  });

  it('lights only the LEDs that are actually wired to their pins', () => {
    // Red loop's pin 7 jumper removed: STOP drives pin 7, but nothing lights.
    const noRed = withWires(GOOD, (w) => w.filter(([pin]) => pin !== 'D7'));
    const state = step(build(noRed), { type: 'uploadDone' }, press, release, press);
    expect(lit(state)).toEqual([]);
  });

  it('logs success on upload of the correct circuit', () => {
    const state = step(build(GOOD), { type: 'uploadDone' });
    expect(state.log.at(-1)).toEqual(
      expect.objectContaining({ kind: 'success', text: 'The stack light steps RUN → WARN → STOP with each press. Lab 03 complete!' }),
    );
  });

  it('burns an LED that has no resistor once its pin goes HIGH', () => {
    // Green LED moved so it sits straight across pin 5 and the rail jumper.
    const noResistor: Layout = {
      ...GOOD,
      parts: { ...GOOD.parts, resistorG: undefined, ledGreen: at(1, 2) },
      links: [...GOOD.links!.slice(1), [at(2, 4), RAIL(2)]],
    };
    const state = step(build(noResistor), { type: 'uploadDone' });
    expect(state.burnt).toContain('ledGreen');
    expect(state.log.some((line) => line.text.startsWith('Pop! The green LED burned out'))).toBe(true);
  });
});

describe('Lab 03 guide steps', () => {
  const done = (layout: Layout, running = false) => runtimeSteps(LAB03, bench(layout), running).map((s) => s.done);

  it('ticks off each loop as it is wired', () => {
    expect(done({})).toEqual([false, false, false, false, false]);
    expect(
      done({
        parts: { resistorG: at(1, 0), ledGreen: at(4, 2) },
        wires: [['D5', at(1, 1)], ['GND_T', RAIL(17)]],
        links: [[at(5, 4), RAIL(5)]],
      }),
    ).toEqual([true, false, false, false, false]);
    expect(done(LOOPS)).toEqual([true, true, true, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true, true]);
  });
});
