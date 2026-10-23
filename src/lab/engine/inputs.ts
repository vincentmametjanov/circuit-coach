// Generic digital-input questions for labs with buttons on any pin: what a
// pin reads at rest (HIGH / LOW / floating), and whether pressing a given
// button really takes its pin HIGH. Lab 02's helpers are the pin-2-specific
// version of these; Labs 09–12 use these with their own pins and pull-downs.

import { type Circuit, buildCircuit } from './circuit';

/**
 * What the pin reads with buttons as they are now: HIGH when its net reaches
 * 5V (through a pressed button, or wired straight to it), LOW when one of the
 * pull-down resistors or a jumper holds it at GND, floating when nothing
 * settles it, and disconnected when no jumper reaches the pin.
 */
export function inputPinState(c: Circuit, node: string, pullDowns: string[]): 'high' | 'low' | 'floating' | 'disconnected' {
  if (!c.wired(node)) return 'disconnected';
  const pin = c.net(node);
  if (c.wired('5V') && pin === c.net('5V')) return 'high';
  if (c.wired('GND') && pin === c.net('GND')) return 'low';
  for (const id of pullDowns) {
    const pull = c.legNets(id);
    if (c.wired('GND') && pull && pull.includes(pin) && pull.includes(c.net('GND'))) return 'low';
  }
  return 'floating';
}

/** The same circuit with one button held down. */
export function withPressed(c: Circuit, part: string): Circuit {
  return c.board.pressed.includes(part) ? c : buildCircuit({ ...c.board, pressed: [...c.board.pressed, part] });
}

/** True when pressing `part` takes the pin HIGH: 5V on one side, the pin on the other. */
export function pressReaches(c: Circuit, part: string, node: string, pullDowns: string[]): boolean {
  return inputPinState(withPressed(c, part), node, pullDowns) === 'high';
}

/** True when a four-leg button has two legs above the center gap and two below it. */
export function straddlesGap(c: Circuit, part: string): boolean {
  const placed = c.part(part);
  if (!placed) return false;
  return placed.legs.some((leg) => leg.row < 5) && placed.legs.some((leg) => leg.row >= 5);
}
