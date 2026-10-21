// Lab 05 tests: the PWM dimmer (pot → A0, LED on ~9), the non-PWM pin mistake,
// the RGB extension's common-cathode check, and the hue mix.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB05, mixFor } from '../labs/lab05';
import { type BenchState, type RuntimeState, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

type Ids = 'pot' | 'resistor' | 'led' | 'rgbLed' | 'resistorR' | 'resistorG' | 'resistorB';
type Layout = { parts?: Partial<Record<Ids, Hole | null>>; wires?: [pin: string, hole: Hole][]; links?: [Hole, Hole][]; flipped?: Ids[] };

function bench({ parts = {}, wires = [], links = [], flipped = [] }: Layout): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB05.parts) all[spec.id] = spec.id in parts ? (parts[spec.id as Ids] ?? null) : null;
  return {
    parts: all,
    flipped,
    burnt: [],
    pressed: [],
    wires: [...wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })), ...links.map(([a, b], i) => ({ id: `l${i}`, pin: null, hole: a, hole2: b }))],
  };
}

// Pot at a3 (legs a3, a5, a7); LED loop: resistor a9–a12, LED c12(+)–c13(−),
// pin ~9 → b9, GND → e13. RGB in the bin.
const GOOD = bench({
  parts: { pot: at(3, 0), resistor: at(9, 0), led: at(12, 2) },
  wires: [
    ['5V', at(3, 1)],
    ['A0', at(5, 1)],
    ['GND_T', at(7, 1)],
    ['D9', at(9, 1)],
    ['GND_P1', at(13, 4)],
  ],
});

const verdict = (b: BenchState) => judge(LAB05, b);

describe('Lab 05 verdicts', () => {
  it('passes the dimmer circuit', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('explains that a plain digital pin can’t dim', () => {
    const v = verdict(
      bench({
        parts: { pot: at(3, 0), resistor: at(9, 0), led: at(12, 2) },
        wires: [
          ['5V', at(3, 1)],
          ['A0', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['D7', at(9, 1)],
          ['GND_P1', at(13, 4)],
        ],
      }),
    );
    expect(v.code).toBe('nonPwm');
    expect(v.title).toBe('The LED is on pin 7, which can’t dim');
  });

  it('flags the RGB common leg on 5V', () => {
    // RGB at a14: legs a14 (R), a15 (common), a16 (G), a17 (B); IOREF is 5V.
    const v = verdict(
      bench({
        parts: { pot: at(3, 0), resistor: at(9, 0), led: at(12, 2), rgbLed: at(14, 0) },
        wires: [
          ['5V', at(3, 1)],
          ['A0', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['D9', at(9, 1)],
          ['GND_P1', at(13, 4)],
          ['IOREF', at(15, 1)],
        ],
      }),
    );
    expect(v.code).toBe('rgbCommonHigh');
  });

  it('passes with the RGB mixer fully wired as the extension', () => {
    // Channels: D9 → resistorR f1–f4 → R (a14); D10 → resistorG f6–f9 → G (a16);
    // D11 → resistorB f11–f14 → B (a17); common (a15) → GND. Single LED stays in the bin.
    const v = verdict(
      bench({
        parts: { pot: at(3, 0), rgbLed: at(14, 0), resistorR: at(1, 5), resistorG: at(6, 5), resistorB: at(11, 5) },
        wires: [
          ['5V', at(3, 1)],
          ['A0', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['D9', at(1, 6)],
          ['D10', at(6, 6)],
          ['D11', at(11, 6)],
          ['GND_P1', at(15, 1)],
        ],
        links: [
          [at(4, 6), at(14, 1)],
          [at(9, 6), at(16, 1)],
          [at(14, 6), at(17, 1)],
        ],
      }),
    );
    expect(v.code).toBe('pass');
  });

  it('still requires the LED loop, not just the dial', () => {
    const v = verdict(
      bench({
        parts: { pot: at(3, 0) },
        wires: [
          ['5V', at(3, 1)],
          ['A0', at(5, 1)],
          ['GND_T', at(7, 1)],
        ],
      }),
    );
    expect(v.code).not.toBe('pass');
  });
});

describe('Lab 05 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB05, s, a), state);

  it('dims the LED with the knob', () => {
    let state = run({ ...createLabStore(LAB05).state, ...GOOD }, { type: 'uploadDone' });
    expect(state.log.at(-1)?.kind).toBe('success');
    const levels = (s: RuntimeState) => LAB05.behavior.ledLevels!(LAB05, { lab: LAB05, state: s });
    expect(levels(state).led).toBe(0.5);
    state = run(state, { type: 'control', id: 'knob', value: 0.2 });
    expect(levels(state).led).toBe(0.2);
  });

  it('mixes red at one end of the knob and blue past the middle', () => {
    expect(mixFor(0)).toEqual({ r: 1, g: 0, b: 0 });
    expect(mixFor(1 / 3).g).toBe(1);
    expect(mixFor(2 / 3).b).toBe(1);
  });
});

describe('Lab 05 guide steps', () => {
  it('ticks off dial, loop, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB05, b, running).map((s) => s.done);
    expect(done(bench({}))).toEqual([false, false, false, false]);
    expect(
      done(
        bench({
          parts: { pot: at(3, 0) },
          wires: [
            ['5V', at(3, 1)],
            ['A0', at(5, 1)],
            ['GND_T', at(7, 1)],
          ],
        }),
      ),
    ).toEqual([true, false, false, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true]);
  });
});
