// Pure helpers behind the workbench: what a drag is, where parts anchor,
// which holes are taken, and where a dropped part would land. No React here.
import {
  BREADBOARD,
  HOLE_PITCH,
  type CanvasLayout,
  type Hole,
  PIN_BY_ID,
  railAt,
  holeKey,
  holePoint,
  nearestHole,
  pinPoint,
  type Point,
} from '../../lab/geometry';
import type { LabDef } from '../../lab/lab';
import { PART_DEFS, partLegs, type PartSpec } from '../../lab/parts';
import type { RuntimeState } from '../../lab/runtime';
import { LOOSE_WIRE } from './Parts';

export type Drag =
  | { kind: 'part'; part: string; origin: Point; at: Point }
  | { kind: 'binWire'; origin: Point; at: Point }
  | { kind: 'newWire'; pin: string; origin: Point; at: Point }
  | { kind: 'wirePin'; wireId: string; origin: Point; at: Point }
  | { kind: 'wireHole'; wireId: string; origin: Point; at: Point }
  /** The second end of a breadboard-to-breadboard jumper. */
  | { kind: 'wireHole2'; wireId: string; origin: Point; at: Point }
  /** Turning the potentiometer's knob while the sketch runs. */
  | { kind: 'knob'; part: string; start: number; origin: Point; at: Point };

export const specOf = (lab: LabDef, id: string): PartSpec => lab.parts.find((p) => p.id === id)!;
export const defOf = (lab: LabDef, id: string) => PART_DEFS[specOf(lab, id).def];
export const displayName = (lab: LabDef, id: string) => specOf(lab, id).name ?? defOf(lab, id).name;

/** Where a part's artwork is anchored: the midpoint of its outermost legs. */
export function anchorFor(layout: CanvasLayout, lab: LabDef, id: string, start: Hole): Point {
  const legs = partLegs(specOf(lab, id).def, start);
  const points = legs.map((hole) => holePoint(layout, hole));
  const x = (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2;
  const y = (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2;
  // Resistors and LEDs anchor on their row; the button centers over its legs.
  return defOf(lab, id).pressable ? { x, y } : { x, y: points[0].y };
}

/** Which holes are in use, and by what, optionally ignoring the item being dragged. */
export function occupancy(lab: LabDef, state: RuntimeState, ignore: { part?: string; wireId?: string } = {}) {
  const used = new Map<string, string>();
  for (const spec of lab.parts) {
    const start = state.parts[spec.id];
    if (!start || spec.id === ignore.part) continue;
    for (const hole of partLegs(spec.def, start)) {
      used.set(holeKey(hole), `the ${displayName(lab, spec.id)}`);
    }
  }
  state.wires.forEach((wire) => {
    if (wire.id === ignore.wireId) return;
    const name = wire.pin ? `the ${PIN_BY_ID[wire.pin].name} jumper` : 'a jumper';
    if (wire.hole) used.set(holeKey(wire.hole), name);
    if (wire.hole2) used.set(holeKey(wire.hole2), name);
  });
  return used;
}

export function partDrop(layout: CanvasLayout, lab: LabDef, state: RuntimeState, part: string, center: Point) {
  const def = defOf(lab, part);
  const legs = partLegs(specOf(lab, part).def, { row: 0, col: 0 });
  const spanX = Math.max(...legs.map((l) => l.col)) * HOLE_PITCH;
  const first = nearestHole(layout, { x: center.x - spanX / 2, y: center.y });
  if (!first) return null;
  const holes = partLegs(specOf(lab, part).def, first);
  // Parts sit in the a–j grid; the power rails take jumpers only.
  if (holes.some((h) => h.col >= BREADBOARD.cols || h.row < 0 || h.row > 9)) return null;
  const used = occupancy(lab, state, { part });
  const blockedBy = holes.map((hole) => used.get(holeKey(hole))).find(Boolean) ?? null;
  return { left: first, leads: holes, blockedBy, def };
}

/** Breadboard jumpers take the color of the rail they reach: black for −, red for +, blue otherwise. */
export function breadboardWireColor(a: Hole | null, b: Hole | null): string {
  const signs = [a, b].map((hole) => (hole ? railAt(hole.row)?.sign : undefined));
  if (signs.includes('−')) return '#2D3436';
  if (signs.includes('+')) return '#E74C3C';
  return LOOSE_WIRE;
}

/** Where a jumper's unplugged end dangles: just off the end that is plugged in. */
export function loosePoint(layout: CanvasLayout, wire: RuntimeState['wires'][number]): Point {
  const clamp = (y: number) => Math.max(8, Math.min(layout.height - 8, y));
  if (wire.hole) {
    const at = holePoint(layout, wire.hole);
    return { x: at.x, y: clamp(at.y - 26) };
  }
  const pin = PIN_BY_ID[wire.pin!];
  const at = pinPoint(layout, pin);
  return { x: at.x, y: clamp(at.y + (pin.header === 'top' ? -28 : 20)) };
}
