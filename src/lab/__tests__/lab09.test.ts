// Lab 09 tests: the transistor-switched motor on its own battery. The pin
// damage mistake, the backwards diode, the common ground, and the flyback
// warning for a motor with no diode.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB09 } from '../labs/lab09';
import { type BenchState, type RuntimeState, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

type Ids = 'motor' | 'transistor' | 'diode' | 'battery' | 'button' | 'resistor10k';
type Layout = { parts?: Partial<Record<Ids, Hole | null>>; wires?: [pin: string, hole: Hole][]; links?: [Hole, Hole][]; flipped?: Ids[] };

function bench({ parts = {}, wires = [], links = [], flipped = [] }: Layout): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB09.parts) all[spec.id] = spec.id in parts ? (parts[spec.id as Ids] ?? null) : null;
  return {
    parts: all,
    flipped,
    burnt: [],
    pressed: [],
    wires: [...wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })), ...links.map(([a, b], i) => ({ id: `l${i}`, pin: null, hole: a, hole2: b }))],
  };
}

// Transistor at a3 (E, B, C): pin 9 → b5 (base), GND → b3 (emitter).
// Battery at a9 (+ a9, − a13); motor c9–c12: + side shares the battery's column,
// low side (c12) joins the collector through e7–b12. Diode b9–b12 flipped:
// band (cathode) on the + side. Battery − → GND at b13.
// Button across the gap at cols 14/17: 5V → a14, pin 2 → j14, 10 kΩ i11–i14,
// GND → j11.
const CONTROL: [string, Hole][] = [
  ['D9', at(5, 1)],
  ['GND_P1', at(3, 1)],
  ['5V', at(14, 0)],
  ['D2', at(14, 9)],
  ['GND_P2', at(13, 1)],
  ['GND_T', at(11, 9)],
];
const GOOD = bench({
  parts: { transistor: at(3, 0), battery: at(9, 0), motor: at(9, 2), diode: at(9, 1), button: at(14, 2), resistor10k: at(11, 8) },
  wires: CONTROL,
  links: [[at(7, 4), at(12, 1)]],
  flipped: ['diode'],
});

const verdict = (b: BenchState) => judge(LAB09, b);

describe('Lab 09 verdicts', () => {
  it('passes the full motor drive', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('passes without the diode, with a warning in the wording', () => {
    const v = verdict(bench({ parts: { ...GOOD.parts, diode: null }, wires: CONTROL, links: [[at(7, 4), at(12, 1)]] }));
    expect(v.code).toBe('pass');
    expect(v.detail).toContain('flyback diode');
  });

  it('flags a motor wired straight to a pin', () => {
    const v = verdict(
      bench({
        parts: { motor: at(9, 2), transistor: at(3, 0), button: at(14, 2), resistor10k: at(11, 8) },
        wires: [
          ['D8', at(9, 3)],
          ['GND_P1', at(12, 3)],
          ...CONTROL.slice(2),
        ],
      }),
    );
    expect(v.code).toBe('motorOnPin');
    expect(v.title).toBe('The motor is wired straight to pin 8');
  });

  it('flags the diode backwards as a battery short', () => {
    const v = verdict(bench({ parts: GOOD.parts, wires: CONTROL, links: [[at(7, 4), at(12, 1)]] }));
    expect(v.code).toBe('diodeBackwards');
  });

  it('flags emitter and collector swapped', () => {
    const v = verdict(
      bench({
        parts: { ...GOOD.parts, diode: null },
        wires: CONTROL.map(([pin, hole]) => (pin === 'GND_P1' ? (['GND_P1', at(7, 1)] as [string, Hole]) : [pin, hole])),
        links: [[at(3, 4), at(12, 1)]],
      }),
    );
    expect(v.code).toBe('transistorSwapped');
  });

  it('flags the missing common ground', () => {
    const v = verdict(
      bench({
        parts: { ...GOOD.parts, diode: null },
        wires: CONTROL.filter(([pin]) => pin !== 'GND_P2'),
        links: [[at(7, 4), at(12, 1)]],
      }),
    );
    expect(v.code).toBe('noCommonGround');
  });

  it('flags a floating button input', () => {
    const v = verdict(
      bench({
        parts: { ...GOOD.parts, diode: null, resistor10k: null },
        wires: CONTROL.filter(([pin]) => pin !== 'GND_T'),
        links: [[at(7, 4), at(12, 1)]],
      }),
    );
    expect(v.code).toBe('floating');
  });

  it('asks for the parts first', () => {
    expect(verdict(bench({})).code).toBe('missingParts');
  });
});

describe('Lab 09 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB09, s, a), state);
  const start = (b: BenchState) => run({ ...createLabStore(LAB09).state, ...b }, { type: 'uploadDone' });

  it('spins the motor only while the button is held', () => {
    let state = start(GOOD);
    expect(state.log.at(-1)?.kind).toBe('success');
    expect(state.behavior.motor ?? 0).toBe(0);
    state = run(state, { type: 'pressPart', part: 'button', pressed: true });
    expect(state.behavior.motor).toBe(1);
    expect(state.log.some((line) => line.text.startsWith('Motor running'))).toBe(true);
    state = run(state, { type: 'pressPart', part: 'button', pressed: false });
    expect(state.behavior.motor).toBe(0);
    expect(state.log.some((line) => line.text.startsWith('Motor stopped'))).toBe(true);
  });

  it('warns about the missing flyback diode once it runs', () => {
    const noDiode = bench({ parts: { ...GOOD.parts, diode: null }, wires: CONTROL, links: [[at(7, 4), at(12, 1)]] });
    let state = start(noDiode);
    expect(state.log.some((line) => line.text.includes('no flyback diode'))).toBe(true);
    state = run(state, { type: 'tick' });
    expect(state.log.filter((line) => line.text.includes('no flyback diode'))).toHaveLength(1);
  });
});

describe('Lab 09 guide steps', () => {
  it('ticks off each power-path step, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB09, b, running).map((s) => s.done);
    expect(done(bench({}))).toEqual([false, false, false, false, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true, true, true]);
  });
});
