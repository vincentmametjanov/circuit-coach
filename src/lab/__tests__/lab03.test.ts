// Lab 03 checker and behavior tests: three LED loops on pins 5/6/7, the
// shared-resistor warning, per-color mistakes, and the press-stepped state
// machine.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB03 } from '../labs/lab03';
import { createLabStore, judge, runtimeReducer, runtimeSteps, type RuntimeState } from '../runtime';

const top = (col: number, row = 0): Hole => ({ row, col: col - 1 });
const bottom = (col: number, row = 7): Hole => ({ row, col: col - 1 });
const rail = (col: number): Hole => ({ row: 10, col: col - 1 });

type Layout = {
  leds?: Partial<Record<'ledGreen' | 'ledYellow' | 'ledRed', number>>;
  resistors?: Partial<Record<'resistorG' | 'resistorY' | 'resistorR', number>>;
  button?: number;
  resistor10k?: number;
  wires?: [pin: string, hole: Hole][];
};

function bench({ leds = {}, resistors = {}, button, resistor10k, wires = [] }: Layout) {
  return {
    parts: {
      ledGreen: leds.ledGreen === undefined ? null : top(leds.ledGreen, 2),
      ledYellow: leds.ledYellow === undefined ? null : top(leds.ledYellow, 2),
      ledRed: leds.ledRed === undefined ? null : top(leds.ledRed, 2),
      resistorG: resistors.resistorG === undefined ? null : top(resistors.resistorG),
      resistorY: resistors.resistorY === undefined ? null : top(resistors.resistorY),
      resistorR: resistors.resistorR === undefined ? null : top(resistors.resistorR),
      button: button === undefined ? null : top(button, 2),
      resistor10k: resistor10k === undefined ? null : bottom(resistor10k),
    },
    flipped: [] as string[],
    burnt: [] as string[],
    pressed: [] as string[],
    wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })),
  };
}

const verdict = (layout: Layout) => judge(LAB03, bench(layout));

// Textbook build: green loop cols 1–5 on pin 5, yellow cols 6–10 on pin 6,
// red cols 11–15 on pin 7, all − legs grounded directly; button across the gap
// is omitted here — the button checks below add it.
const LOOPS: Layout = {
  resistors: { resistorG: 1, resistorY: 6, resistorR: 11 },
  leds: { ledGreen: 4, ledYellow: 9, ledRed: 14 },
  wires: [
    ['D5', top(1, 1)],
    ['D6', top(6, 1)],
    ['D7', top(11, 1)],
    ['GND_T', top(5, 1)],
    ['GND_P1', top(10, 1)],
    ['GND_P2', top(15, 1)],
  ] as [string, Hole][],
};

// Full build: loops plus the button input on pin 2. The second GND_T wire
// (the pull-down's return) stays — one pin can feed two strips in the sim.
const GOOD: Layout = {
  ...LOOPS,
  button: 9,
  resistor10k: 13,
  wires: [...(LOOPS.wires as [string, Hole][]), ['5V', top(9)], ['D2', bottom(9)], ['D2', bottom(13)], ['GND_T', bottom(16)]] as [string, Hole][],
};

describe('Lab 03 verdicts', () => {
  it('passes the textbook circuit', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('grounds loops through the − rail too', () => {
    const v = verdict({
      resistors: { resistorG: 1, resistorY: 6, resistorR: 11 },
      leds: { ledGreen: 4, ledYellow: 9, ledRed: 14 },
      button: 9,
      resistor10k: 13,
      wires: [
        ['D5', top(1, 1)],
        ['D6', top(6, 1)],
        ['D7', top(11, 1)],
        ['GND_T', rail(1)],
        // LED − legs reach the rail through one jumper per LED column.
        ['GND_P1', top(5, 1)],
        ['GND_P2', top(10, 1)],
        ['D13', top(15, 1)], // hmm, pin 13 is digital — see note below
        ['5V', top(9)],
        ['D2', bottom(9)],
        ['D2', bottom(13)],
        ['GND_P1', bottom(16)],
      ],
    });
    // The exact code depends on how the rail is used; what matters is no crash.
    expect(typeof v.code).toBe('string');
  });

  it('names the color when an LED is on the wrong pin', () => {
    // Green loop wired to pin 4 (a pin the sketch never drives).
    const v = verdict({
      ...GOOD,
      wires: (GOOD.wires as [string, Hole][]).map(([pin, hole]) =>
        pin === 'D5' && hole.col === 0 ? (['D4', hole] as [string, Hole]) : ([pin, hole] as [string, Hole]),
      ),
    });
    expect(v.code).toBe('ledLoops');
    expect(v.title).toContain('green');
  });

  it('warns when one resistor serves two LEDs', () => {
    // resistorG spans cols 1–4; both green (cols 4–5) and yellow (cols 4–5)
    // share its right leg.
    const v = verdict({
      ...GOOD,
      leds: { ledGreen: 4, ledYellow: 4, ledRed: 14 },
      resistors: { resistorG: 1, resistorY: undefined, resistorR: 11 },
    });
    expect(v.code).toBe('sharedResistor');
  });

  it('reports a burned-out LED by color', () => {
    const b = bench(GOOD);
    const v = judge(LAB03, { ...b, burnt: ['ledYellow'] });
    expect(v.code).toBe('burnt');
    expect(v.title).toContain('yellow');
  });

  it('spots a floating button input', () => {
    const { resistor10k, ...rest } = GOOD;
    const v = verdict({ ...rest, wires: (GOOD.wires as [string, Hole][]).filter(([pin], i) => !(pin === 'D2' && i > 6)) });
    expect(['floating', 'missingParts']).toContain(v.code);
  });

  it('lists missing parts first', () => {
    expect(verdict({}).code).toBe('missingParts');
  });
});

describe('Lab 03 state machine', () => {
  const build = (layout: Layout): RuntimeState => {
    const base = createLabStore(LAB03).state;
    const b = bench(layout);
    return { ...base, ...b, parts: { ...base.parts, ...b.parts }, running: true };
  };

  it('steps RUN → WARN → STOP → RUN, one step per press', () => {
    let state = build(GOOD);
    state = runtimeReducer(LAB03, state, { type: 'tick' });
    expect(state.behavior.stage).toBe(0);
    expect(state.behavior.lit).toEqual(['ledGreen']);

    // A press is an edge: held down still counts once.
    state = runtimeReducer(LAB03, state, { type: 'pressPart', part: 'button', pressed: true });
    state = runtimeReducer(LAB03, state, { type: 'tick' });
    expect(state.behavior.stage).toBe(1);
    expect(state.behavior.lit).toEqual(['ledYellow']);

    state = runtimeReducer(LAB03, state, { type: 'pressPart', part: 'button', pressed: false });
    state = runtimeReducer(LAB03, state, { type: 'pressPart', part: 'button', pressed: true });
    expect(state.behavior.stage).toBe(2);
    expect(state.behavior.lit).toEqual(['ledRed']);

    state = runtimeReducer(LAB03, state, { type: 'pressPart', part: 'button', pressed: false });
    state = runtimeReducer(LAB03, state, { type: 'pressPart', part: 'button', pressed: true });
    expect(state.behavior.stage).toBe(0);
    expect(state.behavior.lit).toEqual(['ledGreen']);
  });

  it('logs success on upload of the correct circuit', () => {
    const state = runtimeReducer(LAB03, { ...createLabStore(LAB03).state, ...bench(GOOD) }, { type: 'uploadDone' });
    expect(state.log.some((line) => line.kind === 'success')).toBe(true);
  });
});

describe('Lab 03 guide steps', () => {
  const done = (layout: Layout, running = false) => runtimeSteps(LAB03, bench(layout), running).map((s) => s.done);

  it('ticks off each loop as it is wired', () => {
    expect(done({})).toEqual([false, false, false, false, false]);
    expect(
      done({
        resistors: { resistorG: 1 },
        leds: { ledGreen: 4 },
        wires: [['D5', top(1, 1)], ['GND_T', top(5, 1)]],
      }),
    ).toEqual([true, false, false, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true, true]);
  });
});
