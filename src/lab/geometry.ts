// Shared coordinates for the simulated workbench. One unit is 1/10 of a header
// pitch (0.254 mm), so pins and breadboard holes sit on a 10-unit grid.

export type Point = { x: number; y: number };

export const PITCH = 10;

// ---------------------------------------------------------------------------
// Arduino Uno headers (board-local coordinates, USB connector on the left)

export type PinKind = 'digital' | 'analog' | 'ground' | 'power' | 'other';

export type BoardPin = {
  id: string;
  /** Silkscreen text printed next to the header hole. */
  label: string;
  /** How the pin is named in coach messages, e.g. "pin 7". */
  name: string;
  /** Electrical node; pins that are tied together on the board share one. */
  node: string;
  kind: PinKind;
  header: 'top' | 'bottom';
  x: number;
  y: number;
};

export const BOARD_SIZE = { width: 270, height: 210 };
const TOP_Y = 10;
const BOTTOM_Y = 200;

function topPin(id: string, label: string, x: number, kind: PinKind, node = id, name = label): BoardPin {
  return { id, label, name, node, kind, header: 'top', x, y: TOP_Y };
}

function bottomPin(id: string, label: string, x: number, kind: PinKind, node = id, name = label): BoardPin {
  return { id, label, name, node, kind, header: 'bottom', x, y: BOTTOM_Y };
}

const digitalLabels = ['RX 0', 'TX 1', '2', '~3', '4', '~5', '~6', '7', '8', '~9', '~10', '~11', '12', '13'];

function digitalPin(n: number) {
  const x = n <= 7 ? 250 - n * PITCH : 164 - (n - 8) * PITCH;
  return topPin(`D${n}`, digitalLabels[n], x, 'digital', `D${n}`, `pin ${n}`);
}

export const BOARD_PINS: BoardPin[] = [
  // On the Uno R3, SDA and SCL are wired to A4 and A5.
  topPin('SCL', 'SCL', 74, 'other', 'A5'),
  topPin('SDA', 'SDA', 84, 'other', 'A4'),
  topPin('AREF', 'AREF', 94, 'other'),
  topPin('GND_T', 'GND', 104, 'ground', 'GND'),
  ...[13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(digitalPin),
  bottomPin('IOREF', 'IOREF', 120, 'power', '5V'),
  bottomPin('RESET', 'RESET', 130, 'other'),
  bottomPin('3V3', '3.3V', 140, 'power'),
  bottomPin('5V', '5V', 150, 'power'),
  bottomPin('GND_P1', 'GND', 160, 'ground', 'GND'),
  bottomPin('GND_P2', 'GND', 170, 'ground', 'GND'),
  bottomPin('VIN', 'Vin', 180, 'power'),
  ...[0, 1, 2, 3, 4, 5].map((n) => bottomPin(`A${n}`, `A${n}`, 200 + n * PITCH, 'analog')),
];

export const PIN_BY_ID: Record<string, BoardPin> = Object.fromEntries(BOARD_PINS.map((pin) => [pin.id, pin]));

/** Plastic header strips, as [firstPinX, lastPinX, y]. */
export const HEADER_STRIPS: [number, number, number][] = [
  [74, 164, TOP_Y],
  [180, 250, TOP_Y],
  [110, 180, BOTTOM_Y],
  [200, 250, BOTTOM_Y],
];

/** Board status LEDs (board-local, centers). */
export const BOARD_LEDS = {
  l: { x: 103, y: 52 },
  tx: { x: 103, y: 62 },
  rx: { x: 103, y: 72 },
  on: { x: 229, y: 64 },
};

// ---------------------------------------------------------------------------
// Mini breadboard: 17 columns, rows a–e and f–j. Each column of five holes in
// one half is a single connected strip. It and the parts on it are drawn
// BB_SCALE times larger than the board so holes are easy to hit on a phone.

export const BB_SCALE = 1.4;
export const HOLE_PITCH = PITCH * BB_SCALE;

export const BREADBOARD = {
  width: 200,
  height: 148,
  cols: 17,
  firstColX: 20,
  rowY: [22, 32, 42, 52, 62, 82, 92, 102, 112, 122],
};

export const ROW_LETTERS = 'abcdefghij';

export type Hole = { row: number; col: number };

/** Rail rows: −1 is the + rail above row a, 10 is the − rail below row j. */
export const RAIL_TOP = -1;
export const RAIL_BOTTOM = 10;

export const holeKey = (hole: Hole) => `${hole.row}:${hole.col}`;

export const holeName = (hole: Hole) =>
  hole.row === RAIL_TOP ? 'the + rail' : hole.row === RAIL_BOTTOM ? 'the − rail' : `${ROW_LETTERS[hole.row]}${hole.col + 1}`;

export const sameHole = (a: Hole, b: Hole) => a.row === b.row && a.col === b.col;

/** Every hole in one rail shares a single net; strip holes are per column. */
export const stripId = (hole: Hole) =>
  hole.row === RAIL_TOP ? 'rail:top' : hole.row === RAIL_BOTTOM ? 'rail:bottom' : `strip:${hole.col}:${hole.row < 5 ? 'top' : 'bottom'}`;

export const stripName = (hole: Hole) =>
  hole.row === RAIL_TOP ? 'the + rail' : hole.row === RAIL_BOTTOM ? 'the − rail' : `column ${hole.col + 1} (rows ${hole.row < 5 ? 'a–e' : 'f–j'})`;

// ---------------------------------------------------------------------------
// Canvas layouts: side by side on wide screens, stacked on phones.

export type CanvasLayout = {
  id: 'landscape' | 'portrait';
  width: number;
  height: number;
  board: Point;
  breadboard: Point;
  bin: { x: number; y: number; width: number; height: number };
  /** Where the stack of jumper wires sits in the bin. */
  binJumper: Point;
};

/** Touch box around the jumper wires in the bin, relative to `binJumper`. */
export const BIN_JUMPER_BOX = { left: -22, right: 22, top: -20, bottom: 14 };

export const LANDSCAPE: CanvasLayout = {
  id: 'landscape',
  width: 640,
  height: 334,
  board: { x: 40, y: 90 },
  breadboard: { x: 340, y: 18 },
  bin: { x: 340, y: 228, width: 280, height: 96 },
  binJumper: { x: 564, y: 274 },
};

// Phones: bin on top so parts only travel a short way to the breadboard, and
// the board's top header sits right under the breadboard for short jumpers.
export const PORTRAIT: CanvasLayout = {
  id: 'portrait',
  width: 300,
  height: 562,
  bin: { x: 14, y: 8, width: 272, height: 88 },
  binJumper: { x: 232, y: 44 },
  breadboard: { x: 10, y: 108 },
  board: { x: 26, y: 342 },
};

export function fitCanvas(width: number, height: number | null, binRows: 1 | 2 = 1) {
  const wide = withBinRows(LANDSCAPE, binRows);
  const tall = withBinRows(PORTRAIT, binRows);
  if (height === null) {
    const layout = width >= 600 ? wide : tall;
    return { layout, scale: width / layout.width };
  }
  const [landscape, portrait] = [wide, tall].map((layout) => ({
    layout,
    scale: Math.min(width / layout.width, height / layout.height, 2.6),
  }));
  return landscape.scale >= portrait.scale ? landscape : portrait;
}

export function pinPoint(layout: CanvasLayout, pin: BoardPin): Point {
  return { x: layout.board.x + pin.x, y: layout.board.y + pin.y };
}

export function holePoint(layout: CanvasLayout, hole: Hole): Point {
  const railY = hole.row === RAIL_TOP ? RAIL_TOP_Y : hole.row === RAIL_BOTTOM ? RAIL_BOTTOM_Y : null;
  return {
    x: layout.breadboard.x + (BREADBOARD.firstColX + hole.col * PITCH) * BB_SCALE,
    y: layout.breadboard.y + (railY ?? BREADBOARD.rowY[hole.row]) * BB_SCALE,
  };
}

/** Rail rows sit just outside the a–j grid, in breadboard units. */
export const RAIL_TOP_Y = 4;
export const RAIL_BOTTOM_Y = 142;


/** Extra height a second row of parts adds to the bin. */
export const BIN_ROW_HEIGHT = 52;

/**
 * The layout with room for `rows` rows of parts in the bin. A second row makes
 * the bin taller: on wide screens the canvas grows downward; on phones the
 * breadboard and board move down below the taller bin.
 */
export function withBinRows(base: CanvasLayout, rows: 1 | 2): CanvasLayout {
  if (rows === 1) return base;
  const extra = BIN_ROW_HEIGHT;
  const bin = { ...base.bin, height: base.bin.height + extra };
  const firstRowY = bin.y + 34;
  if (base.id === 'landscape') {
    return { ...base, height: base.height + extra, bin, binJumper: { x: base.binJumper.x, y: firstRowY } };
  }
  return {
    ...base,
    height: base.height + extra,
    bin,
    binJumper: { x: base.binJumper.x, y: firstRowY },
    breadboard: { x: base.breadboard.x, y: base.breadboard.y + extra },
    board: { x: base.board.x, y: base.board.y + extra },
  };
}

/** Where one bin slot's part sits, and where its label goes. */
export type BinSlotPoint = { at: Point; labelY: number };

/**
 * Bin slots spread evenly between the bin's left edge and the jumper bundle,
 * in one row, or two rows when there are more than four.
 */
export function binSlotPoints(layout: CanvasLayout, count: number): BinSlotPoint[] {
  const { bin, binJumper } = layout;
  const rows = count > 4 ? 2 : 1;
  const perRow = Math.ceil(count / rows);
  const left = bin.x + 42;
  const right = binJumper.x - 46;
  const rowY = rows === 1 ? [bin.y + bin.height / 2 - 4] : [bin.y + 34, bin.y + 34 + BIN_ROW_HEIGHT];
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / perRow);
    const inRow = row === rows - 1 ? count - perRow * (rows - 1) : perRow;
    const i = index - row * perRow;
    const x = inRow === 1 ? (left + right) / 2 : left + ((right - left) * i) / (perRow - 1);
    return { at: { x, y: rowY[row] }, labelY: rowY[row] + 24 };
  });
}

export function nearestHole(layout: CanvasLayout, p: Point, maxDistance = HOLE_PITCH * 0.85): Hole | null {
  const col = Math.round(((p.x - layout.breadboard.x) / BB_SCALE - BREADBOARD.firstColX) / PITCH);
  if (col < 0 || col >= BREADBOARD.cols) return null;
  const localY = (p.y - layout.breadboard.y) / BB_SCALE;
  const rows = [RAIL_TOP_Y, ...BREADBOARD.rowY, RAIL_BOTTOM_Y];
  let index = 0;
  rows.forEach((y, i) => {
    if (Math.abs(y - localY) < Math.abs(rows[index] - localY)) index = i;
  });
  const hole = { row: index - 1, col };
  const center = holePoint(layout, hole);
  return Math.hypot(center.x - p.x, center.y - p.y) <= maxDistance ? hole : null;
}

export function nearestPin(
  layout: CanvasLayout,
  p: Point,
  maxDistance = 9,
  header?: BoardPin['header'],
): BoardPin | null {
  let best: BoardPin | null = null;
  let bestDistance = maxDistance;
  for (const pin of BOARD_PINS) {
    if (header && pin.header !== header) continue;
    const at = pinPoint(layout, pin);
    const distance = Math.hypot(at.x - p.x, at.y - p.y);
    if (distance <= bestDistance) {
      best = pin;
      bestDistance = distance;
    }
  }
  return best;
}

/** Touch regions over the two header rows, where jumper wires start. */
export function headerRegions(layout: CanvasLayout) {
  const { x, y } = layout.board;
  return [
    { header: 'top' as const, pinY: y + TOP_Y, x: x + 66, y: y - 12, width: 192, height: 34 },
    { header: 'bottom' as const, pinY: y + BOTTOM_Y, x: x + 102, y: y + 186, width: 156, height: 30 },
  ];
}

export function insideBreadboard(layout: CanvasLayout, p: Point) {
  const { x, y } = layout.breadboard;
  return p.x >= x && p.x <= x + BREADBOARD.width * BB_SCALE && p.y >= y && p.y <= y + BREADBOARD.height * BB_SCALE;
}
