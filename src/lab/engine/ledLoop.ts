// Reusable verdict checks for labs whose visible output is an LED in series
// with a resistor on a signal pin (Labs 01, 02, 03). Each check returns the
// message to show when it applies, or null when it doesn't.

import { pathThrough, type Circuit } from '../engine/circuit';
import { PIN_BY_ID } from '../geometry';
import type { LabDef, Message } from '../lab';

export type Source = { node: string; name: string };

/** Board supplies that can power a loop besides the lab's signal pin. */
export const SUPPLIES: Source[] = [
  { node: '5V', name: '5V' },
  { node: '3V3', name: '3.3V' },
  { node: 'VIN', name: 'Vin' },
];

/** Every node that can drive or sink current, for short detection. */
export const RAILS: Source[] = [...SUPPLIES, { node: 'GND', name: 'GND' }];

export type LedLoop = {
  /** The pin the sketch drives, e.g. { node: 'D7', name: 'pin 7' }. */
  signal: Source;
  led: string;
  resistor: string;
};

/** Two supply nodes joined by jumpers alone. Checks every pair. */
export function findShort(c: Circuit, extraSignals: Source[] = []): { a: Source; b: Source } | null {
  const nodes = [...extraSignals, ...RAILS];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const [a, b] = [nodes[i], nodes[j]];
      if (!c.wired(a.node) || !c.wired(b.node)) continue;
      if (c.net(a.node) === c.net(b.node)) return { a, b };
    }
  }
  return null;
}

export type LoopFinding =
  | { kind: 'ok'; source: Source; order: string[] }
  | { kind: 'bypassed' }
  | { kind: 'noResistor'; source: Source }
  | { kind: 'reversed'; source: Source }
  | { kind: 'wrongPin'; pinName: string };

/** Traces the LED loop from any source and classifies what it found. */
export function findLoop(c: Circuit, loop: LedLoop): LoopFinding | null {
  const legs = c.legNets(loop.led);
  if (!legs) return null;
  if (legs[0] === legs[1]) return { kind: 'bypassed' };

  for (const source of [loop.signal, ...SUPPLIES]) {
    if (!c.wired(source.node)) continue;
    const path = (parts: string[], polarity?: 'any') => pathThrough(c, source.node, 'GND', parts, polarity);
    const order = path([loop.resistor, loop.led]);
    if (order) return { kind: 'ok', source, order };
    if (path([loop.led])) return { kind: 'noResistor', source };
    if (path([loop.resistor, loop.led], 'any') || path([loop.led], 'any')) return { kind: 'reversed', source };
  }

  // A complete loop driven from a pin that isn't the signal: the classic
  // "wrong pin" mistake. The pin's node still conducts through the parts.
  for (const wire of c.board.wires) {
    const pin = PIN_BY_ID[wire.pin];
    if (pin.kind !== 'digital' && pin.kind !== 'analog') continue;
    if (pin.node === loop.signal.node) continue;
    const order = pathThrough(c, pin.node, 'GND', [loop.resistor, loop.led]);
    if (order) return { kind: 'wrongPin', pinName: pin.name };
  }
  return null;
}

/** The first signal-ish pin with a jumper that isn't the lab's signal pin. */
export function wrongPinUsed(c: Circuit, signal: Source): string | null {
  const other = c.board.wires
    .map((wire) => PIN_BY_ID[wire.pin])
    .find((pin) => (pin.kind === 'digital' || pin.kind === 'analog') && pin.node !== signal.node);
  return other ? other.name : null;
}

/** Where a node's jumper lands, for "lands nowhere" messages. */
export function landingStrip(c: Circuit, node: string): string {
  const wire = c.board.wires.find((w) => PIN_BY_ID[w.pin].node === node);
  if (!wire) return 'a column';
  const { row, col } = wire.hole;
  return `column ${col + 1} (rows ${row < 5 ? 'a–e' : 'f–j'})`;
}

/** Wording helpers shared by the LED-loop labs. */
export function ledLoopMessages(lab: LabDef, loop: LedLoop) {
  return {
    wrongSource: (source: Source): Message => ({
      title: `The LED runs from ${source.name}, not ${loop.signal.name}`,
      detail: `It glows, but it is stuck on. The sketch only switches ${loop.signal.name}. Move that jumper from ${source.name} to ${loop.signal.name}.`,
    }),
    noLimiter: (source: Source): Message => ({
      title: 'No resistor in the loop',
      detail: `${source.name} connects straight to the LED. Nothing limits the current, so the LED (and the pin) can burn out. Put the 220 Ω resistor between ${source.name} and the LED’s + leg.`,
    }),
    reversed: (source: Source): Message => ({
      title: 'The LED is in backwards',
      detail: `Current only flows into the + (long) leg and out of the − (short) leg. Tap the LED to flip it so + faces ${source.name}.`,
    }),
  };
}
