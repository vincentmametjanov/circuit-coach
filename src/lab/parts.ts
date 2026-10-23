// The parts catalog: every component a lab can put in the parts bin, defined
// once as data. A lab lists the instances it needs (a definition id plus an
// instance id, so a lab can use three LEDs); the workbench draws each instance
// and the checker reads its legs.

import { binRowsForCount, type Hole } from './geometry';

export type PartDefId =
  | 'resistor'
  | 'resistor10k'
  | 'led'
  | 'button'
  | 'pot'
  | 'rgbLed'
  | 'ldr'
  | 'tmp36'
  | 'buzzer'
  | 'servo'
  | 'motor'
  | 'transistor'
  | 'diode'
  | 'battery'
  | 'stepper';

export type LegPattern =
  | { kind: 'span'; span: number }
  | { kind: 'span3'; span: number }
  | { kind: 'span4'; span: number }
  | { kind: 'across'; rowGap: number; colSpan: number };

/** All holes a part's legs occupy when its first leg sits in `start`. */
export function partLegs(def: PartDefId, start: Hole): Hole[] {
  const pattern = PART_DEFS[def].pattern;
  if (pattern.kind === 'span') {
    return Array.from({ length: 2 }, (_, i) => ({ row: start.row, col: start.col + i * pattern.span }));
  }
  if (pattern.kind === 'span3' || pattern.kind === 'span4') {
    const count = pattern.kind === 'span3' ? 3 : 4;
    return Array.from({ length: count }, (_, i) => ({ row: start.row, col: start.col + i * pattern.span }));
  }
  const { rowGap, colSpan } = pattern;
  // Dropped in the top half, the legs straddle the center gap. Dropped in the
  // bottom half, the button lies flat along one row — the classic mistake that
  // makes it read “always pressed”: legs 0,1 are side A, legs 2,3 side B, and
  // all four share the one strip.
  if (start.row >= 5) {
    return [
      { row: start.row, col: start.col },
      { row: start.row, col: start.col + 1 },
      { row: start.row, col: start.col + colSpan },
      { row: start.row, col: start.col + colSpan + 1 },
    ];
  }
  const lower = start.row + rowGap;
  return [
    { row: start.row, col: start.col },
    { row: start.row, col: start.col + colSpan },
    { row: lower, col: start.col },
    { row: lower, col: start.col + colSpan },
  ];
}

export type PartDef = {
  id: PartDefId;
  /** How it is named in coach messages and the parts bin. */
  name: string;
  /** Short label for tight spaces. */
  shortName: string;
  pattern: LegPattern;
  /** True when the legs have a direction the checker enforces (LED, diode). */
  polarized: boolean;
  /** Tapping a placed part of this kind flips it (LED). */
  flippable?: boolean;
  /** Press-and-hold control while the sketch runs (pushbutton). */
  pressable?: boolean;
  /**
   * Dragging this part left/right while the sketch runs adjusts a 0–1 control
   * stored under this key in the behavior state (the potentiometer's knob).
   */
  adjustable?: { control: string };
  /**
   * Nets a part shorts together by itself. A button joins the two legs on each
   * side of the center gap even while it is not pressed.
   */
  internalLinks?: [number, number][];
  /** When pressed, these extra leg pairs connect. */
  pressLinks?: [number, number][];
  /** Touch box around the part (canvas units), relative to its anchor point. */
  box: { left: number; right: number; top: number; bottom: number };
};

export const PART_DEFS: Record<PartDefId, PartDef> = {
  resistor: {
    id: 'resistor',
    name: '220 Ω resistor',
    shortName: '220 Ω',
    pattern: { kind: 'span', span: 3 },
    polarized: false,
    box: { left: -27, right: 27, top: -11, bottom: 11 },
  },
  resistor10k: {
    id: 'resistor10k',
    name: '10 kΩ resistor',
    shortName: '10 kΩ',
    pattern: { kind: 'span', span: 3 },
    polarized: false,
    box: { left: -27, right: 27, top: -11, bottom: 11 },
  },
  led: {
    id: 'led',
    name: 'LED',
    shortName: 'LED',
    pattern: { kind: 'span', span: 1 },
    polarized: true,
    flippable: true,
    box: { left: -17, right: 17, top: -32, bottom: 8 },
  },
  button: {
    id: 'button',
    name: 'pushbutton',
    shortName: 'button',
    // Four legs in a 2×2 square that straddles the breadboard's center gap.
    pattern: { kind: 'across', rowGap: 5, colSpan: 3 },
    polarized: false,
    pressable: true,
    internalLinks: [
      [0, 1],
      [2, 3],
    ],
    pressLinks: [
      [0, 2],
      [1, 3],
    ],
    box: { left: -30, right: 30, top: -16, bottom: 26 },
  },
  pot: {
    id: 'pot',
    name: 'potentiometer',
    shortName: 'pot',
    // Three legs in a row: outer (5V), wiper (middle), outer (GND).
    pattern: { kind: 'span3', span: 2 },
    polarized: false,
    adjustable: { control: 'knob' },
    box: { left: -26, right: 26, top: -24, bottom: 10 },
  },
  rgbLed: {
    id: 'rgbLed',
    name: 'RGB LED (common cathode)',
    shortName: 'RGB',
    // Four legs in a row: red, common cathode (−), green, blue.
    pattern: { kind: 'span4', span: 1 },
    polarized: false,
    box: { left: -22, right: 22, top: -30, bottom: 8 },
  },
  ldr: {
    id: 'ldr',
    name: 'photoresistor (LDR)',
    shortName: 'LDR',
    pattern: { kind: 'span', span: 3 },
    polarized: false,
    adjustable: { control: 'light' },
    box: { left: -26, right: 26, top: -16, bottom: 10 },
  },
  tmp36: {
    id: 'tmp36',
    name: 'TMP36 temperature sensor',
    shortName: 'TMP36',
    // Three legs: +VS, VOUT, GND (flat side facing you).
    pattern: { kind: 'span3', span: 2 },
    polarized: false,
    adjustable: { control: 'temp' },
    box: { left: -26, right: 26, top: -18, bottom: 10 },
  },
  buzzer: {
    id: 'buzzer',
    name: 'piezo buzzer',
    shortName: 'buzzer',
    pattern: { kind: 'span', span: 2 },
    polarized: true,
    flippable: true,
    box: { left: -18, right: 18, top: -18, bottom: 10 },
  },
  servo: {
    id: 'servo',
    name: 'servo motor',
    shortName: 'servo',
    // Three legs in plug order: GND (brown), 5V (red), signal (orange).
    pattern: { kind: 'span3', span: 2 },
    polarized: false,
    box: { left: -28, right: 28, top: -26, bottom: 10 },
  },
  motor: {
    id: 'motor',
    name: 'DC motor',
    shortName: 'motor',
    pattern: { kind: 'span', span: 3 },
    polarized: false,
    box: { left: -28, right: 28, top: -20, bottom: 10 },
  },
  transistor: {
    id: 'transistor',
    name: 'PN2222 transistor',
    shortName: 'PN2222',
    // Flat side facing you: emitter, base, collector.
    pattern: { kind: 'span3', span: 2 },
    polarized: false,
    box: { left: -26, right: 26, top: -18, bottom: 10 },
  },
  diode: {
    id: 'diode',
    name: '1N4007 diode',
    shortName: 'diode',
    pattern: { kind: 'span', span: 3 },
    polarized: true,
    flippable: true,
    box: { left: -27, right: 27, top: -11, bottom: 11 },
  },
  battery: {
    id: 'battery',
    name: '9 V battery',
    shortName: '9 V',
    // Leg 0 is + (red lead), leg 1 is − (black lead).
    pattern: { kind: 'span', span: 4 },
    polarized: true,
    flippable: true,
    box: { left: -30, right: 30, top: -18, bottom: 10 },
  },
  stepper: {
    id: 'stepper',
    name: 'stepper + driver',
    shortName: 'stepper',
    // Simplified driver: step pulse, direction, ground.
    pattern: { kind: 'span3', span: 2 },
    polarized: false,
    box: { left: -28, right: 28, top: -20, bottom: 10 },
  },
};

/** A part instance in a lab: which definition, and the id the lab uses for it. */
export type PartSpec = {
  def: PartDefId;
  id: string;
  name?: string;
  color?: string;
  /**
   * Parts-bin category. When any part in a lab has one, the bin shows a
   * category picker and stocks only the selected category (free play).
   */
  category?: string;
};

/** One slot in the parts bin: identical part instances stack into a single slot. */
export type BinGroup = { key: string; ids: string[]; def: PartDefId; label: string };

/** The parts bin's slots for a lab, in its parts-list order: "220 Ω resistor ×3" is one slot. */
export function binGroups(parts: PartSpec[]): BinGroup[] {
  const groups: BinGroup[] = [];
  for (const spec of parts) {
    const name = spec.name ?? PART_DEFS[spec.def].name;
    const key = `${spec.def}|${spec.color ?? ''}|${name}`;
    const group = groups.find((g) => g.key === key);
    if (group) group.ids.push(spec.id);
    else groups.push({ key, ids: [spec.id], def: spec.def, label: name });
  }
  return groups.map((g) => (g.ids.length > 1 ? { ...g, label: `${g.label} ×${g.ids.length}` } : g));
}

/** Labs with more than four slots get extra rows in the bin (free play uses three). */
export const binRowsFor = (parts: PartSpec[]): 1 | 2 | 3 => {
  return binRowsForCount(binGroups(parts).length);
};
