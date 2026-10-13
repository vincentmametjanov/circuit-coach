// Tests for the lab-independent parts of the checker: building nets and
// finding series paths.

import { describe, expect, it } from 'vitest';

import { type Board, buildNetlist, seriesPath } from '../engine/netlist';
import type { Hole } from '../geometry';

const hole = (col: number, row = 0): Hole => ({ row, col: col - 1 });

function board(parts: Board['parts'], wires: [string, Hole][] = []): Board {
  return { parts, wires: wires.map(([pin, h], i) => ({ id: `w${i}`, pin, hole: h })), burnt: [] };
}

const resistor = (from: number, to: number): Board['parts'][number] => ({
  id: 'resistor',
  polarized: false,
  legs: [hole(from), hole(to)],
});
const led = (plus: number, minus: number): Board['parts'][number] => ({
  id: 'led',
  polarized: true,
  legs: [hole(plus), hole(minus)],
});

describe('buildNetlist', () => {
  it('connects holes in the same column strip', () => {
    const n = buildNetlist(board([resistor(3, 6), led(6, 7)]));
    expect(n.legs('resistor')![1]).toBe(n.legs('led')![0]);
  });

  it('keeps the top and bottom halves of a column apart', () => {
    const n = buildNetlist(board([{ id: 'led', polarized: true, legs: [hole(4, 0), hole(4, 7)] }]));
    const [plus, minus] = n.legs('led')!;
    expect(plus).not.toBe(minus);
  });

  it('joins a pin to the strip its jumper lands in', () => {
    const n = buildNetlist(board([resistor(3, 6)], [['D7', hole(3, 1)]]));
    expect(n.net('D7')).toBe(n.legs('resistor')![0]);
    expect(n.wired('D7')).toBe(true);
    expect(n.wired('D8')).toBe(false);
  });

  it('treats GND pins as one node', () => {
    const n = buildNetlist(board([], [['GND_T', hole(3)], ['GND_P2', hole(9)]]));
    expect(n.net('GND')).toBe(n.net('strip:2:top'));
    expect(n.net('GND')).toBe(n.net('strip:8:top'));
  });

  it('reports parts in the bin as having no legs', () => {
    expect(buildNetlist(board([])).legs('led')).toBeNull();
  });
});

describe('seriesPath', () => {
  const wired = (parts: Board['parts']) =>
    buildNetlist(board(parts, [['D7', hole(3, 1)], ['GND_T', hole(7, 1)]]));

  it('finds a path and reports the order current takes', () => {
    expect(seriesPath(wired([resistor(3, 6), led(6, 7)]), 'D7', 'GND', ['resistor', 'led'])).toEqual([
      'resistor',
      'led',
    ]);
    expect(seriesPath(wired([led(3, 4), resistor(4, 7)]), 'D7', 'GND', ['resistor', 'led'])).toEqual([
      'led',
      'resistor',
    ]);
  });

  it('lets current through a resistor either way round', () => {
    expect(seriesPath(wired([resistor(6, 3), led(6, 7)]), 'D7', 'GND', ['resistor', 'led'])).not.toBeNull();
  });

  it('blocks a backwards LED unless polarity is ignored', () => {
    const n = wired([resistor(3, 6), led(7, 6)]);
    expect(seriesPath(n, 'D7', 'GND', ['resistor', 'led'])).toBeNull();
    expect(seriesPath(n, 'D7', 'GND', ['resistor', 'led'], 'any')).toEqual(['resistor', 'led']);
  });

  it('requires every listed part to be in the path', () => {
    const n = wired([resistor(3, 6), led(6, 7)]);
    expect(seriesPath(n, 'D7', 'GND', ['led'])).toBeNull();
  });

  it('skips a part whose legs share a net', () => {
    const n = buildNetlist(board([resistor(3, 6), led(3, 7)], [['D7', hole(3, 1)], ['D7', hole(6, 1)], ['GND_T', hole(7, 1)]]));
    expect(seriesPath(n, 'D7', 'GND', ['resistor', 'led'])).toBeNull();
    expect(seriesPath(n, 'D7', 'GND', ['led'])).toEqual(['led']);
  });

  it('fails when the path does not end on the target', () => {
    const n = buildNetlist(board([resistor(3, 6), led(6, 7)], [['D7', hole(3, 1)]]));
    expect(seriesPath(n, 'D7', 'GND', ['resistor', 'led'])).toBeNull();
  });
});
