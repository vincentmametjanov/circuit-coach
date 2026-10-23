// Open bench (free play) tests: every part kind is in the bin, the bench
// passes by default, shorts are still flagged, and live supplies light (or
// burn out) LEDs exactly like a real powered board with no sketch.

import { describe, expect, it } from 'vitest';

import type { Hole } from '../geometry';
import { FREEPLAY } from '../labs/freeplay';
import { PART_DEFS, binGroups } from '../parts';
import { type BenchState, createLabStore, judge, ledGlowFor, runtimeReducer, runtimeSteps } from '../runtime';

const at = (col: number, row: number): Hole => ({ row, col: col - 1 });
const RAIL_PLUS = (col: number): Hole => ({ row: -1, col: col - 1 });

function bench(parts: Record<string, Hole | null>, wires: [pin: string | null, hole: Hole][] = []): BenchState {
  const all: Record<string, Hole | null> = {};
  for (const spec of FREEPLAY.parts) all[spec.id] = parts[spec.id] ?? null;
  return { parts: all, flipped: [], burnt: [], pressed: [], wires: wires.map(([pin, hole], i) => ({ id: `w${i}`, pin, hole })) };
}

const verdict = (b: BenchState) => judge(FREEPLAY, b);

describe('Open bench contents', () => {
  it('stocks every kind of part from the labs', () => {
    const stocked = new Set(FREEPLAY.parts.map((p) => p.def));
    for (const def of Object.keys(PART_DEFS)) expect(stocked).toContain(def);
  });

  it('assigns every part to a category that fits on one bin row', () => {
    expect(FREEPLAY.parts.every((p) => p.category)).toBe(true);
    const categories = [...new Set(FREEPLAY.parts.map((p) => p.category!))];
    expect(categories.length).toBeGreaterThan(3);
    for (const category of categories) {
      const specs = FREEPLAY.parts.filter((p) => p.category === category);
      expect(binGroups(specs).length).toBeLessThanOrEqual(4);
    }
  });
});

describe('Open bench verdicts', () => {
  it('passes an empty bench: free play has no wiring goal', () => {
    expect(verdict(bench({})).code).toBe('pass');
  });

  it('still flags a dead short across the rails', () => {
    const v = verdict(bench({}, [['5V', RAIL_PLUS(1)], ['GND_T', RAIL_PLUS(6)]]));
    expect(v.code).toBe('short');
  });
});

describe('Open bench physics', () => {
  it('lights an LED wired from 5V through its resistor', () => {
    const state = {
      ...createLabStore(FREEPLAY).state,
      ...bench({ r1: at(1, 0), ledR1: at(4, 2) }, [
        ['5V', at(1, 1)],
        ['GND_T', at(5, 4)],
      ]),
    };
    expect(ledGlowFor(FREEPLAY, state).ledR1).toBe('on');
  });

  it('burns out an LED wired straight across the supply', () => {
    let state = { ...createLabStore(FREEPLAY).state, ...bench({ ledR1: at(1, 0) }, [['5V', at(1, 1)]]) };
    state = runtimeReducer(FREEPLAY, state, { type: 'addWire', pin: 'GND_T', hole: at(2, 1) });
    expect(state.burnt).toContain('ledR1');
    expect(state.log.some((line) => line.text.includes('burned out'))).toBe(true);
  });

  it('completes its single guide step once the bench is live', () => {
    const b = bench({});
    expect(runtimeSteps(FREEPLAY, b, false).map((s) => s.done)).toEqual([false]);
    expect(runtimeSteps(FREEPLAY, b, true).map((s) => s.done)).toEqual([true]);
  });
});
