// A general netlist over the workbench: parts of any leg count, several
// instances of one part kind, and parts (like a pushbutton) that join some of
// their own legs together. Lab checkers ask questions in terms of part
// instance ids ('led', 'led:green') and board nodes ('D7', 'GND', '5V').

import { PIN_BY_ID, type Hole, stripId } from '../geometry';
import { PART_DEFS, type PartDefId } from '../parts';

/** A jumper with both ends plugged in. */
export type WireEnd = { pin: string; hole: Hole };

/** A placed part: which definition, its instance id, and the hole each leg sits in. */
export type PlacedPart = {
  id: string;
  def: PartDefId;
  /** Leg holes in definition order; for a polarized part, leg 0 is + unless flipped. */
  legs: Hole[];
  flipped?: boolean;
};

/** Everything on the bench, in lab-independent terms. */
export type CircuitBoard = {
  parts: PlacedPart[];
  wires: (WireEnd & { id: string })[];
  /** Instance ids of parts that have burned out. */
  burnt: string[];
  /** Instance ids of buttons currently held down. */
  pressed: string[];
};

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

export type Circuit = {
  board: CircuitBoard;
  /** The net a board node or leg node belongs to. */
  net(node: string): string;
  /** Whether any jumper starts at a pin on this board node. */
  wired(node: string): boolean;
  /** The placed part with this instance id, if it is on the breadboard. */
  part(id: string): PlacedPart | undefined;
  /** The net of one leg of a placed part. For polarized parts, leg 0 is the + side. */
  legNet(id: string, leg: number): string | null;
  /** Nets of all of a placed part's legs, in order. */
  legNets(id: string): string[] | null;
};

const legNode = (id: string, leg: number) => `part:${id}:${leg}`;

export function buildCircuit(board: CircuitBoard): Circuit {
  const nets = new Nets();

  for (const wire of board.wires) nets.union(PIN_BY_ID[wire.pin].node, stripId(wire.hole));

  for (const part of board.parts) {
    const def = PART_DEFS[part.def];
    part.legs.forEach((hole, leg) => nets.union(legNode(part.id, leg), stripId(hole)));
    const links = [...(def.internalLinks ?? []), ...(board.pressed.includes(part.id) ? (def.pressLinks ?? []) : [])];
    for (const [a, b] of links) {
      if (part.legs[a] && part.legs[b]) nets.union(legNode(part.id, a), legNode(part.id, b));
    }
  }

  const wiredNodes = new Set(board.wires.map((wire) => PIN_BY_ID[wire.pin].node));
  const net = (node: string) => nets.find(node);
  const part = (id: string) => board.parts.find((p) => p.id === id);

  return {
    board,
    net,
    wired: (node) => wiredNodes.has(node),
    part,
    legNet(id, leg) {
      const placed = part(id);
      if (!placed || !placed.legs[leg]) return null;
      // A polarized part that is flipped swaps which physical leg is +.
      const index = placed.flipped && PART_DEFS[placed.def].polarized ? (leg === 0 ? 1 : leg === 1 ? 0 : leg) : leg;
      return net(legNode(id, index));
    },
    legNets(id) {
      const placed = part(id);
      return placed ? placed.legs.map((_, leg) => this.legNet(id, leg)!) : null;
    },
  };
}

/**
 * Walks a series path from the net of `from` to the net of `to`, passing
 * through every listed two-legged part instance exactly once, in any order.
 * Polarized parts must be entered by their + leg unless polarity is 'any'.
 * Returns the instance ids in the order current meets them, or null.
 */
export function pathThrough(
  circuit: Circuit,
  from: string,
  to: string,
  ids: string[],
  polarity: 'forward' | 'any' = 'forward',
): string[] | null {
  const end = circuit.net(to);

  const walk = (at: string, left: string[], order: string[]): string[] | null => {
    if (left.length === 0) return at === end ? order : null;
    for (const id of left) {
      const legs = circuit.legNets(id);
      const placed = circuit.part(id);
      // A part with both legs on one net is bypassed: current skips it.
      if (!legs || !placed || legs.length !== 2 || legs[0] === legs[1]) continue;
      const reversible = !PART_DEFS[placed.def].polarized || polarity === 'any';
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

  return walk(circuit.net(from), ids, []);
}
