// Lab 02 checker and behavior tests. The LED loop is Lab 01's; the new checks
// are the button short, "always pressed", the floating pin, the wrong input
// pin, and the 220 Ω pull-down warning.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB02, inputState } from '../labs/lab02';
import { circuitOf, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const top = (col: number, row = 0): Hole => ({ row, col: col - 1 });
const bottom = (col: number, row = 7): Hole => ({ row, col: col - 1 });

type Layout = {
  resistor?: number;
  /** Place the 220 Ω in the bottom half (used by the pull-down swap test). */
  resistorBottom?: boolean;
  led?: number;
  flipped?: boolean;
  /** First-leg column; straddles the gap. buttonFlat lies along one row instead. */
  button?: number;
  buttonFlat?: number;
  /** The pull-down sits in the BOTTOM half so it can bridge pin 2's net to GND. */
  resistor10k?: number;
  wires?: [pin: string, hole: Hole][];
};

function bench({ resistor, resistorBottom = false, led, flipped = false, button, buttonFlat, resistor10k, wires = [] }: Layout) {
  const buttonStart = button !== undefined ? top(button, 2) : buttonFlat !== undefined ? bottom(buttonFlat, 8) : null;
  return {
    parts: {
      resistor: resistor === undefined ? null : resistorBottom ? bottom(resistor) : top(resistor),
      led: led === undefined ? null : top(led, 2),
      button: buttonStart,
      resistor10k: resistor10k === undefined ? null : bottom(resistor10k),
    },
    flipped: flipped ? ['led'] : [],
    burnt: [] as string[],
    pressed: [] as string[],
    wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })),
  };
}

const verdict = (layout: Layout) => judge(LAB02, bench(layout));

// The textbook build: LED loop on pin 7 (resistor cols 3–6, LED 6–7, GND on
// the LED's own strip), button across the gap in cols 9/12 with 5V on the top
// side and pin 2 on the bottom; the 10 kΩ pull-down bridges from pin 2's
// column (bottom 13, jumpered to pin 2) across to GND at bottom 16.
const GOOD: Layout = {
  resistor: 3,
  led: 6,
  button: 9,
  resistor10k: 13,
  wires: [
    ['D7', top(3, 1)],
    ['GND_T', top(7, 1)],
    ['5V', top(9)],
    ['D2', bottom(12)],
    ['D2', bottom(13)],
    ['GND_P1', bottom(16)],
  ],
};

describe('Lab 02 verdicts', () => {
  it('passes the textbook circuit', () => {
    const v = verdict(GOOD);
    expect(v.code).toBe('pass');
    expect(v.title).toBe('Circuit check passed');
  });

  it('flags a button that shorts 5V to GND when pressed', () => {
    // 5V on one side of the button, GND straight onto the other side.
    const v = verdict({
      button: 9,
      resistor: 3,
      led: 6,
      wires: [
        ['5V', top(9)],
        ['GND_P1', bottom(12)],
        ['D7', top(3, 1)],
        ['GND_T', top(7, 1)],
      ],
    });
    expect(v.code).toBe('buttonShort');
    expect(v.title).toContain('button joins 5V to GND');
  });

  it('warns when pin 2 floats (no pull-down)', () => {
    const v = verdict({
      resistor: 3,
      led: 6,
      button: 9,
      wires: [
        ['D7', top(3, 1)],
        ['GND_T', top(7, 1)],
        ['5V', top(9)],
        ['D2', bottom(12)],
      ],
    });
    expect(['floating', 'missingParts']).toContain(v.code);
    if (v.code === 'floating') expect(v.title).toBe('Pin 2 is floating');
  });

  it('reads LOW at rest and HIGH while pressed when wired right', () => {
    const b = bench(GOOD);
    expect(inputStateFor(b)).toBe('low');
    expect(inputStateFor({ ...b, pressed: ['button'] })).toBe('high');
  });

  it('spots a button wired to 5V and pin 2 on the same side (always pressed)', () => {
    // The button straddles the gap correctly, but both jumpers land on its top
    // side — the internal link ties pin 2 to 5V whatever the button does.
    const v = verdict({
      resistor: 3,
      led: 6,
      button: 9,
      resistor10k: 14,
      wires: [
        ['D7', top(3, 1)],
        ['GND_T', top(7, 1)],
        ['5V', top(9)],
        ['D2', top(12)],
        ['GND_P1', bottom(16)],
      ],
    });
    expect(v.code).toBe('alwaysPressed');
  });

  it('notices when the button’s input jumper is on the wrong pin', () => {
    const v = verdict({
      ...GOOD,
      wires: GOOD.wires!.map(([pin, hole]) => (pin === 'D2' ? (['D4', hole] as [string, Hole]) : ([pin, hole] as [string, Hole]))),
    });
    expect(v.code).toBe('buttonWrongPin');
  });

  it('warns when the 220 Ω resistor is used as the pull-down', () => {
    // LED loop uses the 10 kΩ; the 220 Ω ends up bridging pin 2 to GND.
    const v = verdict({
      resistor: 13,
      resistorBottom: true,
      led: 6,
      button: 9,
      resistor10k: 3,
      wires: [
        ['D7', top(3, 1)],
        ['GND_T', top(7, 1)],
        ['5V', top(9)],
        ['D2', bottom(12)],
        ['D2', bottom(13)],
        ['GND_P1', bottom(16)],
      ],
    });
    expect(v.code).toBe('weakPullDown');
  });

  it('still catches Lab 01 mistakes in the LED loop', () => {
    expect(verdict({ ...GOOD, flipped: true }).code).toBe('ledLoop');
    expect(verdict({ ...GOOD, flipped: true }).title).toBe('The LED is in backwards');
    expect(verdict({ ...GOOD, resistor: undefined }).code).not.toBe('pass');
  });

  it('lists missing parts before any wiring advice', () => {
    expect(verdict({}).code).toBe('missingParts');
  });
});

function inputStateFor(b: ReturnType<typeof bench>) {
  return inputState(circuitOf(LAB02, b));
}

describe('Lab 02 guide steps', () => {
  const done = (layout: Layout, running = false) => runtimeSteps(LAB02, bench(layout), running).map((s) => s.done);

  it('ticks off steps as the circuit comes together', () => {
    expect(done({})).toEqual([false, false, false, false, false, false]);
    expect(done({ resistor: 3, led: 6, wires: [['D7', top(3, 1)], ['GND_T', top(7, 1)]] })).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(done(GOOD)).toEqual([true, true, true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true, true, true]);
  });
});

describe('Lab 02 behavior while running', () => {
  const build = (layout: Layout): Parameters<typeof runtimeReducer>[1] => ({
    ...createLabStore(LAB02).state,
    ...bench(layout),
    running: true,
  });

  it('lights the LED only while the button is held', () => {
    let state = build(GOOD);
    state = runtimeReducer(LAB02, state, { type: 'tick' });
    expect(state.behavior.ledOn).toBe(false);
    state = runtimeReducer(LAB02, state, { type: 'pressPart', part: 'button', pressed: true });
    expect(state.behavior.ledOn).toBe(true);
    state = runtimeReducer(LAB02, state, { type: 'pressPart', part: 'button', pressed: false });
    state = runtimeReducer(LAB02, state, { type: 'tick' });
    expect(state.behavior.ledOn).toBe(false);
  });

  it('flickers deterministically when pin 2 floats', () => {
    const floating: Layout = {
      resistor: 3,
      led: 6,
      button: 9,
      wires: [
        ['D7', top(3, 1)],
        ['GND_T', top(7, 1)],
        ['5V', top(9)],
        ['D2', bottom(12)],
      ],
    };
    const a = [1, 2, 3, 4, 5].reduce((s) => runtimeReducer(LAB02, s, { type: 'tick' }), build(floating));
    const b = [1, 2, 3, 4, 5].reduce((s) => runtimeReducer(LAB02, s, { type: 'tick' }), build(floating));
    expect(a.behavior.ledOn).toBe(b.behavior.ledOn);
    expect(a.seed).toBe(b.seed);
    expect(a.log.some((line) => line.text.includes('floating'))).toBe(true);
  });

  it('logs success on upload of the correct circuit', () => {
    const state = runtimeReducer(LAB02, { ...createLabStore(LAB02).state, ...bench(GOOD) }, { type: 'uploadDone' });
    expect(state.log.some((line) => line.kind === 'success')).toBe(true);
  });

  it('keeps Lab 01 burn-out physics: no resistor, powered, burns the LED', () => {
    let state = build({ led: 6, wires: [['5V', top(6, 1)], ['GND_T', top(7, 1)]] });
    state = runtimeReducer(LAB02, state, { type: 'tick' });
    expect(state.burnt).toContain('led');
  });
});
