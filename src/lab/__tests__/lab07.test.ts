// Lab 07 tests: the TMP36 in real °C, the backwards-sensor warning, the
// buzzer loop, and the alarm's hysteresis.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { LAB07, tempOf, tmp36Reading } from '../labs/lab07';
import { type BenchState, type RuntimeState, circuitOf, createLabStore, judge, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });

type Ids = 'tmp36' | 'buzzer' | 'led' | 'resistor';

function bench(parts: Partial<Record<Ids, Hole | null>>, wires: [pin: string, hole: Hole][] = [], flipped: Ids[] = []): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of LAB07.parts) all[spec.id] = parts[spec.id as Ids] ?? null;
  return { parts: all, flipped, burnt: [], pressed: [], wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })) };
}

// TMP36 at a3: +VS a3, VOUT a5, GND a7 → 5V → b3, A0 → b5, GND → b7.
// Buzzer a9–a11 (+ on a9): pin 8 → b9, GND → b11.
// Red LED: 220 Ω a13–a16, LED c16(+)–c17(−): pin 7 → b13, GND → e17.
const GOOD = bench(
  { tmp36: at(3, 0), buzzer: at(9, 0), resistor: at(13, 0), led: at(16, 2) },
  [
    ['5V', at(3, 1)],
    ['A0', at(5, 1)],
    ['GND_T', at(7, 1)],
    ['D8', at(9, 1)],
    ['GND_P1', at(11, 1)],
    ['D7', at(13, 1)],
    ['GND_P2', at(17, 4)],
  ],
);

const verdict = (b: BenchState) => judge(LAB07, b);

describe('Lab 07 verdicts', () => {
  it('passes the alarm circuit', () => {
    expect(verdict(GOOD).code).toBe('pass');
  });

  it('flags the TMP36 in backwards', () => {
    const v = verdict(
      bench(
        { tmp36: at(3, 0), buzzer: at(9, 0), resistor: at(13, 0), led: at(16, 2) },
        [
          ['GND_T', at(3, 1)],
          ['A0', at(5, 1)],
          ['5V', at(7, 1)],
          ['D8', at(9, 1)],
          ['GND_P1', at(11, 1)],
          ['D7', at(13, 1)],
          ['GND_P2', at(17, 4)],
        ],
      ),
    );
    expect(v.code).toBe('tmp36Backwards');
    expect(v.detail).toContain('gets hot');
  });

  it('names the pin when the sensor output is on a digital pin', () => {
    const v = verdict(
      bench(
        { tmp36: at(3, 0), buzzer: at(9, 0), resistor: at(13, 0), led: at(16, 2) },
        [
          ['5V', at(3, 1)],
          ['D12', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['D8', at(9, 1)],
          ['GND_P1', at(11, 1)],
          ['D7', at(13, 1)],
          ['GND_P2', at(17, 4)],
        ],
      ),
    );
    expect(v.code).toBe('sensorWiring');
    expect(v.title).toBe('The sensor’s output is on pin 12, not A0');
  });

  it('flags a buzzer in backwards', () => {
    const v = verdict({ ...GOOD, flipped: ['buzzer'] });
    expect(v.code).toBe('buzzerLoop');
    expect(v.title).toBe('The buzzer is in backwards');
  });

  it('spots a buzzer with no ground return', () => {
    const v = verdict(
      bench(
        { tmp36: at(3, 0), buzzer: at(9, 0), resistor: at(13, 0), led: at(16, 2) },
        [
          ['5V', at(3, 1)],
          ['A0', at(5, 1)],
          ['GND_T', at(7, 1)],
          ['D8', at(9, 1)],
          ['D7', at(13, 1)],
          ['GND_P2', at(17, 4)],
        ],
      ),
    );
    expect(v.code).toBe('buzzerLoop');
    expect(v.title).toBe('The buzzer has no path back to GND');
  });
});

describe('Lab 07 readings', () => {
  it('converts the slider temperature to the TMP36’s 10 mV/°C', () => {
    // 26 °C → 0.76 V → 155 of 1023.
    expect(tmp36Reading(circuitOf(LAB07, GOOD), 26)).toBe(155);
  });

  it('maps the slider across 10–50 °C', () => {
    expect(tempOf({ behavior: {} })).toBe(26);
    expect(tempOf({ behavior: { temp: 0 } })).toBe(10);
    expect(tempOf({ behavior: { temp: 1 } })).toBe(50);
  });
});

describe('Lab 07 while running', () => {
  const run = (state: RuntimeState, ...actions: Parameters<typeof runtimeReducer>[2][]) =>
    actions.reduce((s, a) => runtimeReducer(LAB07, s, a), state);
  const start = (b: BenchState) => run({ ...createLabStore(LAB07).state, ...b }, { type: 'uploadDone' });

  it('trips the alarm over 30 °C and holds it until 28 °C', () => {
    let state = start(GOOD);
    expect(state.log.at(-1)?.kind).toBe('success');
    state = run(state, { type: 'control', id: 'temp', value: 0.6 }); // 34 °C
    expect(state.behavior.alarm).toBe(true);
    expect(state.log.some((line) => line.text.startsWith('ALARM: 34.0 °C'))).toBe(true);
    state = run(state, { type: 'control', id: 'temp', value: 0.475 }); // 29 °C, still in the band
    expect(state.behavior.alarm).toBe(true);
    state = run(state, { type: 'control', id: 'temp', value: 0.4 }); // 26 °C, clears
    expect(state.behavior.alarm).toBe(false);
    expect(state.log.some((line) => line.text.startsWith('Alarm cleared'))).toBe(true);
  });

  it('drives the LED and buzzer only while the alarm is on', () => {
    let state = start(GOOD);
    expect(LAB07.behavior.outputs!(LAB07, { lab: LAB07, state })).toEqual([]);
    state = run(state, { type: 'control', id: 'temp', value: 1 });
    expect(LAB07.behavior.outputs!(LAB07, { lab: LAB07, state })).toEqual(['D7', 'D8']);
    expect(state.behavior.buzzer).toBe(true);
  });

  it('warns once about a backwards TMP36 getting hot', () => {
    const backwards = bench(
      { tmp36: at(3, 0), buzzer: at(9, 0), resistor: at(13, 0), led: at(16, 2) },
      [
        ['GND_T', at(3, 1)],
        ['A0', at(5, 1)],
        ['5V', at(7, 1)],
        ['D8', at(9, 1)],
        ['GND_P1', at(11, 1)],
        ['D7', at(13, 1)],
        ['GND_P2', at(17, 4)],
      ],
    );
    let state = start(backwards);
    const warnings = state.log.filter((line) => line.text.includes('getting hot'));
    expect(warnings).toHaveLength(1);
    state = run(state, { type: 'tick' });
    expect(state.log.filter((line) => line.text.includes('getting hot'))).toHaveLength(1);
  });
});

describe('Lab 07 guide steps', () => {
  it('ticks off sensor, output, buzzer, light, then upload', () => {
    const done = (b: BenchState, running = false) => runtimeSteps(LAB07, b, running).map((s) => s.done);
    expect(done(bench({}))).toEqual([false, false, false, false, false]);
    expect(done(GOOD)).toEqual([true, true, true, true, false]);
    expect(done(GOOD, true)).toEqual([true, true, true, true, true]);
  });
});
