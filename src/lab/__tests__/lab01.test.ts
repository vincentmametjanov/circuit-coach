// Lab 01 checker tests. Each case builds a breadboard layout the way a student
// would and checks what the coach says about it.

import { describe, expect, it } from 'vitest';

import { type CircuitState, analyzeCircuit, labSteps } from '../circuit';
import type { Hole } from '../geometry';
import { createLab, labReducer } from '../state';

/** A hole in the top half (rows a–e) of the given 1-based column. */
const top = (col: number, row = 0): Hole => ({ row, col: col - 1 });

type Layout = {
  resistor?: number;
  led?: number;
  flipped?: boolean;
  burnt?: boolean;
  wires?: [pin: string, col: number][];
};

/** Columns are 1-based like the breadboard labels. The resistor spans 3 columns, the LED 1. */
function circuit({ resistor, led, flipped = false, burnt = false, wires = [] }: Layout): CircuitState {
  return {
    parts: {
      resistor: resistor === undefined ? null : top(resistor),
      led: led === undefined ? null : top(led, 2),
    },
    ledFlipped: flipped,
    ledBurnt: burnt,
    // Wires land in row b so they never share a hole with a part leg.
    wires: wires.map(([pin, col], i) => ({ id: `w${i}`, pin, hole: top(col, 1) })),
  };
}

const verdict = (layout: Layout) => analyzeCircuit(circuit(layout)).verdict;

// The textbook build: pin 7 → resistor (cols 3–6) → LED + (6) → LED − (7) → GND.
const GOOD: Layout = { resistor: 3, led: 6, wires: [['D7', 3], ['GND_T', 7]] };

describe('Lab 01 verdicts', () => {
  it('passes the textbook circuit and explains the current', () => {
    const v = verdict(GOOD);
    expect(v.code).toBe('pass');
    expect(v.source).toBe('D7');
    expect(v.detail).toMatch(/^Pin 7 → 220 Ω resistor → LED/);
    expect(v.detail).toContain('14 mA');
  });

  it('passes with the resistor on the ground side of the LED', () => {
    const v = verdict({ led: 3, resistor: 4, wires: [['D7', 3], ['GND_T', 7]] });
    expect(v.code).toBe('pass');
    expect(v.detail).toContain('A resistor works on either side of the LED');
  });

  it('accepts any of the three GND pins', () => {
    for (const gnd of ['GND_T', 'GND_P1', 'GND_P2']) {
      expect(verdict({ ...GOOD, wires: [['D7', 3], [gnd, 7]] }).code).toBe('pass');
    }
  });

  it('spots a backwards LED', () => {
    const v = verdict({ ...GOOD, flipped: true });
    expect(v.code).toBe('reversed');
    expect(v.title).toBe('The LED is in backwards');
  });

  it('spots a missing resistor', () => {
    const v = verdict({ led: 6, wires: [['D7', 6], ['GND_T', 7]] });
    expect(v.code).toBe('noResistor');
    expect(v.source).toBe('D7');
  });

  it('notices the LED is powered from 5V instead of pin 7', () => {
    const v = verdict({ ...GOOD, wires: [['5V', 3], ['GND_T', 7]] });
    expect(v.code).toBe('alwaysOn');
    expect(v.source).toBe('5V');
    expect(v.title).toBe('The LED runs from 5V, not pin 7');
  });

  it('reports a 3.3V supply as the source so the LED can glow dimly', () => {
    expect(verdict({ ...GOOD, wires: [['3V3', 3], ['GND_T', 7]] }).source).toBe('3V3');
  });

  it('flags pin 7 wired straight to GND', () => {
    const v = verdict({ ...GOOD, wires: [['D7', 10], ['GND_T', 10]] });
    expect(v.code).toBe('short');
    expect(v.title).toBe('Short circuit: pin 7 is wired straight to GND');
  });

  it('flags 5V wired straight to GND', () => {
    const v = verdict({ wires: [['5V', 10], ['GND_P1', 10]] });
    expect(v.code).toBe('short');
    expect(v.detail).toContain('USB fuse');
  });

  it('flags two supplies tied together', () => {
    expect(verdict({ wires: [['D7', 10], ['5V', 10]] }).title).toBe('Short circuit: pin 7 is tied to 5V');
  });

  it('checks for shorts before anything else', () => {
    expect(verdict({ ...GOOD, burnt: true, wires: [...GOOD.wires!, ['5V', 7]] }).code).toBe('short');
  });

  it('notices when both LED legs end up on one net', () => {
    expect(verdict({ led: 6, wires: [['GND_T', 6], ['GND_P1', 7]] }).code).toBe('ledShorted');
  });

  it('reports a burned-out LED', () => {
    expect(verdict({ ...GOOD, burnt: true }).code).toBe('burnt');
  });

  it('says which parts are still in the bin', () => {
    expect(verdict({}).title).toBe('The resistor and LED are still in the parts bin');
    expect(verdict({ led: 6 }).title).toBe('The 220 Ω resistor is still in the parts bin');
    expect(verdict({ resistor: 3 }).title).toBe('The LED is still in the parts bin');
  });

  it('names the wrong signal pin', () => {
    const v = verdict({ ...GOOD, wires: [['D8', 3], ['GND_T', 7]] });
    expect(v.code).toBe('wrongPin');
    expect(v.title).toBe('Your signal jumper is on pin 8');
  });

  it('treats an analog pin as a wrong signal pin too', () => {
    expect(verdict({ ...GOOD, wires: [['A0', 3], ['GND_T', 7]] }).title).toBe('Your signal jumper is on A0');
  });

  it('asks for the pin 7 jumper first', () => {
    expect(verdict({ resistor: 3, led: 6 }).title).toBe('Pin 7 isn’t wired yet');
  });

  it('asks for a ground return', () => {
    expect(verdict({ resistor: 3, led: 6, wires: [['D7', 3]] }).title).toBe('Nothing returns to GND');
  });

  it('points out a pin 7 jumper that lands in an empty column', () => {
    const v = verdict({ resistor: 3, led: 6, wires: [['D7', 12], ['GND_T', 7]] });
    expect(v.title).toBe('Pin 7’s jumper doesn’t reach a part');
    expect(v.detail).toContain('column 12 (rows a–e)');
  });

  it('points out a GND jumper that lands in an empty column', () => {
    const v = verdict({ resistor: 3, led: 6, wires: [['D7', 3], ['GND_T', 14]] });
    expect(v.title).toBe('The GND jumper doesn’t reach a part');
    expect(v.detail).toContain('column 14');
  });

  it('notices a resistor and LED that never meet', () => {
    expect(verdict({ resistor: 1, led: 9, wires: [['D7', 1], ['GND_T', 10]] }).title).toBe(
      'The resistor and LED don’t connect',
    );
  });

  it('falls back to tracing the loop when nothing else fits', () => {
    // GND lands on the resistor–LED junction, so the LED's − leg goes nowhere.
    expect(verdict({ resistor: 3, led: 6, wires: [['D7', 3], ['GND_T', 6]] }).title).toBe('The loop isn’t closed yet');
  });
});

describe('Lab 01 guide steps', () => {
  const done = (layout: Layout, running = false) =>
    labSteps(analyzeCircuit(circuit(layout)), running).map((step) => step.done);

  it('ticks off each step as the circuit comes together', () => {
    expect(done({})).toEqual([false, false, false, false, false]);
    expect(done({ resistor: 3 })).toEqual([true, false, false, false, false]);
    expect(done({ resistor: 3, led: 6 })).toEqual([true, true, false, false, false]);
    expect(done({ resistor: 3, led: 6, wires: [['D7', 3]] })).toEqual([true, true, true, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true, true]);
  });

  it('does not count the LED as connected when its − leg meets the resistor', () => {
    expect(done({ resistor: 3, led: 6, flipped: true })).toEqual([true, false, false, false, false]);
  });

  it('marks every build step done once the check passes', () => {
    expect(done({ led: 3, resistor: 4, wires: [['D7', 3], ['GND_T', 7]] }).slice(0, 4)).toEqual([true, true, true, true]);
  });
});

describe('Lab 01 simulation', () => {
  const build = (layout: Layout) => {
    const c = circuit(layout);
    return { ...createLab(), ...c };
  };

  it('burns out an LED wired to 5V with no resistor', () => {
    const lab = labReducer(build({ led: 6, wires: [['5V', 6]] }), { type: 'addWire', pin: 'GND_T', hole: top(7, 1) });
    expect(lab.ledBurnt).toBe(true);
    expect(lab.log.at(-2)?.text).toMatch(/^Pop!/);
  });

  it('only burns a pin 7 LED once the sketch drives the pin high', () => {
    const wired = labReducer(build({ led: 6, wires: [['D7', 6]] }), { type: 'addWire', pin: 'GND_T', hole: top(7, 1) });
    expect(wired.ledBurnt).toBe(false);
    expect(labReducer(wired, { type: 'uploadDone' }).ledBurnt).toBe(true);
  });

  it('reports success on upload of a correct circuit', () => {
    const lab = labReducer(build(GOOD), { type: 'uploadDone' });
    expect(lab.log.some((line) => line.text === 'Your LED is blinking on pin 7. Lab 01 complete!')).toBe(true);
  });
});
