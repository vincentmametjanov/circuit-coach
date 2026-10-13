// Turns what's on the workbench into electrical nets. Every breadboard strip and
// every Arduino pin starts as its own node; a jumper wire joins a pin's node to a
// strip, and two parts are connected exactly when their legs end up in one net.

import { type Hole, PIN_BY_ID, type PartId, stripId } from '../geometry';

export type Wire = { id: string; pin: string; hole: Hole };

/** A two-legged part on the breadboard. For a polarized part, legs[0] is the + leg. */
export type PlacedPart = { id: PartId; legs: [Hole, Hole]; polarized: boolean };

/** Everything the checker needs to know about the workbench, independent of any lab. */
export type Board = { parts: PlacedPart[]; wires: Wire[]; burnt: PartId[] };

/** Union-find over node names, with path compression. */
class Nets {
  private parent = new Map<string, string>();

  find(node: string): string {
    const parent = this.parent.get(node);
    if (parent === undefined || parent === node) return node;
    const root = this.find(parent);
    this.parent.set(node, root);
    return root;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export type Netlist = {
  board: Board;
  /** The net a board node ('D7', 'GND', …) or strip belongs to. */
  net(node: string): string;
  /** Whether any jumper starts at a pin on this board node. */
  wired(node: string): boolean;
  part(id: PartId): PlacedPart | undefined;
  /** Nets of a placed part's two legs, + leg first for polarized parts. */
  legs(id: PartId): [string, string] | null;
};

export function buildNetlist(board: Board): Netlist {
  const nets = new Nets();
  for (const wire of board.wires) nets.union(PIN_BY_ID[wire.pin].node, stripId(wire.hole));
  const wiredNodes = new Set(board.wires.map((wire) => PIN_BY_ID[wire.pin].node));
  const net = (node: string) => nets.find(node);
  const part = (id: PartId) => board.parts.find((p) => p.id === id);

  return {
    board,
    net,
    wired: (node) => wiredNodes.has(node),
    part,
    legs(id) {
      const placed = part(id);
      return placed ? [net(stripId(placed.legs[0])), net(stripId(placed.legs[1]))] : null;
    },
  };
}

/**
 * Looks for a series path that starts on `from`'s net, passes through every
 * listed part exactly once (in any order), and ends on `to`'s net. Polarized
 * parts must be entered by their + leg unless `polarity` is 'any'. Returns the
 * parts in the order current meets them, or null if there is no such path.
 */
export function seriesPath(
  netlist: Netlist,
  from: string,
  to: string,
  parts: PartId[],
  polarity: 'forward' | 'any' = 'forward',
): PartId[] | null {
  const end = netlist.net(to);

  const walk = (at: string, left: PartId[], order: PartId[]): PartId[] | null => {
    if (left.length === 0) return at === end ? order : null;
    for (const id of left) {
      const legs = netlist.legs(id);
      // A part with both legs on one net is bypassed: current skips it.
      if (!legs || legs[0] === legs[1]) continue;
      const reversible = !netlist.part(id)!.polarized || polarity === 'any';
      const exits = [legs[0] === at ? legs[1] : null, reversible && legs[1] === at ? legs[0] : null];
      const rest = left.filter((other) => other !== id);
      for (const exit of exits) {
        if (exit === null) continue;
        const found = walk(exit, rest, [...order, id]);
        if (found) return found;
      }
    }
    return null;
  };

  return walk(netlist.net(from), parts, []);
}
