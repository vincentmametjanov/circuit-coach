// Tests for the lab-independent circuit engine: building nets from parts and
// jumpers, and finding series paths through parts.

import { describe, expect, it } from 'vitest';

import { type CircuitBoard, type PlacedPart, buildCircuit, pathThrough } from '../engine/circuit';
import type { Hole } from '../geometry';

const hole = (col: number, row = 0): Hole => ({ row, col: col - 1 });

function board(parts: PlacedPart[], wires: [string, Hole][] = [], pressed: string[] = []): CircuitBoard {
  return { parts, wires: wires.map(([pin, h], i) => ({ id: `w${i}`, pin, hole: h })), links: [], burnt: [], pressed };
}

const resistor = (from: number, to: number): PlacedPart => ({ id: 'resistor', def: 'resistor', legs: [hole(from), hole(to)] });
/** An LED whose + leg is in `plus` and − leg in `minus`. */
const led = (plus: number, minus: number): PlacedPart => ({ id: 'led', def: 'led', legs: [hole(plus), hole(minus)] });

describe('buildCircuit', () => {
  it('connects holes in the same column strip', () => {
    const c = buildCircuit(board([resistor(3, 6), led(6, 7)]));
    expect(c.legNet('resistor', 1)).toBe(c.legNet('led', 0));
  });

  it('keeps the top and bottom halves of a column apart', () => {
    const c = buildCircuit(board([{ id: 'led', def: 'led', legs: [hole(4, 0), hole(4, 7)] }]));
    expect(c.legNet('led', 0)).not.toBe(c.legNet('led', 1));
  });

  it('joins a pin to the strip its jumper lands in', () => {
    const c = buildCircuit(board([resistor(3, 6)], [['D7', hole(3, 1)]]));
    expect(c.net('D7')).toBe(c.legNet('resistor', 0));
    expect(c.wired('D7')).toBe(true);
    expect(c.wired('D8')).toBe(false);
  });

  it('treats GND pins as one node', () => {
    const c = buildCircuit(board([], [['GND_T', hole(3)], ['GND_P2', hole(9)]]));
    expect(c.net('GND')).toBe(c.net('strip:2:top'));
    expect(c.net('GND')).toBe(c.net('strip:8:top'));
  });

  it('joins every hole of a power rail into one net', () => {
    const c = buildCircuit(board([], [['GND_T', { row: 10, col: 0 }]]));
    expect(c.net('rail:bottom')).toBe(c.net('GND'));
  });

  it('connects two holes joined by a breadboard jumper', () => {
    const b = board([resistor(3, 6)]);
    b.links = [[hole(6, 1), { row: 10, col: 12 }]];
    const c = buildCircuit(b);
    expect(c.legNet('resistor', 1)).toBe(c.net('rail:bottom'));
  });

  it('swaps the + leg of a flipped LED', () => {
    const c = buildCircuit(board([{ ...led(6, 7), flipped: true }]));
    expect(c.legNet('led', 0)).toBe(c.net('strip:6:top'));
  });

  it('joins a button’s sides only while it is pressed', () => {
    const button: PlacedPart = { id: 'button', def: 'button', legs: [hole(5, 2), hole(8, 2), hole(5, 7), hole(8, 7)] };
    const up = buildCircuit(board([button]));
    expect(up.legNet('button', 0)).toBe(up.legNet('button', 1));
    expect(up.legNet('button', 0)).not.toBe(up.legNet('button', 2));
    const down = buildCircuit(board([button], [], ['button']));
    expect(down.legNet('button', 0)).toBe(down.legNet('button', 2));
  });

  it('reports parts in the bin as having no legs', () => {
    expect(buildCircuit(board([])).legNets('led')).toBeNull();
  });
});

describe('pathThrough', () => {
  const wired = (parts: PlacedPart[]) => buildCircuit(board(parts, [['D7', hole(3, 1)], ['GND_T', hole(7, 1)]]));

  it('finds a path and reports the order current takes', () => {
    expect(pathThrough(wired([resistor(3, 6), led(6, 7)]), 'D7', 'GND', ['resistor', 'led'])).toEqual(['resistor', 'led']);
    expect(pathThrough(wired([led(3, 4), resistor(4, 7)]), 'D7', 'GND', ['resistor', 'led'])).toEqual(['led', 'resistor']);
  });

  it('lets current through a resistor either way round', () => {
    expect(pathThrough(wired([resistor(6, 3), led(6, 7)]), 'D7', 'GND', ['resistor', 'led'])).not.toBeNull();
  });

  it('blocks a backwards LED unless polarity is ignored', () => {
    const c = wired([resistor(3, 6), led(7, 6)]);
    expect(pathThrough(c, 'D7', 'GND', ['resistor', 'led'])).toBeNull();
    expect(pathThrough(c, 'D7', 'GND', ['resistor', 'led'], 'any')).toEqual(['resistor', 'led']);
  });

  it('requires every listed part to be in the path', () => {
    expect(pathThrough(wired([resistor(3, 6), led(6, 7)]), 'D7', 'GND', ['led'])).toBeNull();
  });

  it('fails when the path does not end on the target', () => {
    const c = buildCircuit(board([resistor(3, 6), led(6, 7)], [['D7', hole(3, 1)]]));
    expect(pathThrough(c, 'D7', 'GND', ['resistor', 'led'])).toBeNull();
  });
});
