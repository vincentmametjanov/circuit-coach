// What is drawn on top of the bench: each part, the drop preview and the
// floating tag that names what a drag will connect.
import { memo } from 'react';
import { Circle, G, Rect } from 'react-native-svg';

import {
  BB_SCALE,
  BREADBOARD,
  HOLE_PITCH,
  type CanvasLayout,
  type Hole,
  PIN_BY_ID,
  holeKey,
  holeName,
  holePoint,
  insideBreadboard,
  isRail,
  nearestHole,
  nearestPin,
  pinPoint,
  type Point,
} from '../../lab/geometry';
import type { LabDef } from '../../lab/lab';
import { PART_DEFS, type PartSpec } from '../../lab/parts';
import type { RuntimeState } from '../../lab/runtime';
import { colors } from '../../theme';
import { ArduinoUno } from './ArduinoUno';
import { Breadboard, PartsBin } from './Breadboard';
import { type Drag, occupancy, partDrop, specOf } from './dragging';
import {
  BANDS_10K,
  Battery,
  BinJumpers,
  Buzzer,
  Diode,
  Led,
  type LedGlow,
  Ldr,
  Motor,
  Pot,
  Pushbutton,
  Resistor,
  RgbLed,
  Servo,
  Stepper,
  Tag,
  Tmp36,
  Transistor,
} from './Parts';

const OK = colors.teal;
const BAD = colors.danger;

/** One placed or binned part, drawn from its definition. */
export function PartView({
  spec,
  at,
  state,
  glow,
  level,
  lifted = false,
}: {
  spec: PartSpec;
  at: Point;
  state: RuntimeState;
  glow: LedGlow;
  level?: number;
  lifted?: boolean;
}) {
  const flipped = state.flipped.includes(spec.id);
  const burnt = state.burnt.includes(spec.id);
  const pressed = state.pressed.includes(spec.id);
  // Behavior-driven visual state for animated parts (servo angle, motor spinning…).
  const dyn = state.behavior[spec.id];
  switch (spec.def) {
    case 'resistor':
      return <Resistor at={at} lifted={lifted} />;
    case 'resistor10k':
      return <Resistor at={at} lifted={lifted} bands={BANDS_10K} />;
    case 'led':
      return (
        <Led
          at={at}
          flipped={flipped}
          glow={lifted ? 'off' : glow}
          burnt={burnt}
          lifted={lifted}
          color={(spec.color as 'red' | 'green' | 'yellow') ?? 'red'}
          level={lifted ? undefined : level}
        />
      );
    case 'button':
      return <Pushbutton at={at} pressed={pressed} lifted={lifted} />;
    case 'pot':
      return <Pot at={at} value={typeof state.behavior.knob === 'number' ? state.behavior.knob : 0.5} lifted={lifted} />;
    case 'rgbLed':
      return <RgbLed at={at} levels={dyn as { r: number; g: number; b: number } | undefined} lifted={lifted} />;
    case 'ldr':
      return <Ldr at={at} blocked={dyn === true} lifted={lifted} />;
    case 'tmp36':
      return <Tmp36 at={at} lifted={lifted} />;
    case 'buzzer':
      return <Buzzer at={at} flipped={flipped} beep={dyn === true} lifted={lifted} />;
    case 'servo':
      return <Servo at={at} angle={typeof dyn === 'number' ? dyn : 0} lifted={lifted} />;
    case 'motor':
      return <Motor at={at} spinning={typeof dyn === 'number' && dyn > 0} lifted={lifted} />;
    case 'transistor':
      return <Transistor at={at} lifted={lifted} />;
    case 'diode':
      return <Diode at={at} flipped={flipped} lifted={lifted} />;
    case 'battery':
      return <Battery at={at} flipped={flipped} lifted={lifted} />;
    case 'stepper':
      return <Stepper at={at} lifted={lifted} />;
  }
}

export const StaticScene = memo(function StaticScene({
  layout,
  slots,
  binTitle,
}: {
  layout: CanvasLayout;
  slots: { key: string; label: string; labelY: number; at: Point }[];
  /** Category name for a filtered bin (free play). */
  binTitle?: string;
}) {
  return (
    <G>
      <Rect x={0} y={0} width={layout.width} height={layout.height} fill={colors.canvas} />
      <Rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#mat)" />
      <PartsBin layout={layout} slots={slots} title={binTitle} />
      <BinJumpers at={layout.binJumper} />
      <Breadboard origin={layout.breadboard} />
      <ArduinoUno origin={layout.board} />
    </G>
  );
});

export function BoardLight({ at, color }: { at: Point; color: string }) {
  return (
    <G>
      <Circle cx={at.x} cy={at.y} r={6} fill="url(#smdGlow)" opacity={0.7} />
      <Rect x={at.x - 3} y={at.y - 1.8} width={6} height={3.6} rx={0.6} fill={color} />
    </G>
  );
}

/** Highlights the strips and holes a dragged item would connect to. */
export function DropPreview({
  drag,
  layout,
  lab,
  state,
}: {
  drag: Drag | null;
  layout: CanvasLayout;
  lab: LabDef;
  state: RuntimeState;
}) {
  if (!drag) return null;

  if (drag.kind === 'knob') return null;
  const pinTarget = drag.kind === 'wirePin' || drag.kind === 'binWire' ? nearestPin(layout, drag.at, 9) : null;
  if (pinTarget) {
    const at = pinPoint(layout, pinTarget);
    return <Circle cx={at.x} cy={at.y} r={5.5} fill="none" stroke={OK} strokeWidth={1.6} />;
  }
  // A pin jumper's pin end only goes to a pin; a breadboard jumper's loose end can take a hole.
  if (drag.kind === 'wirePin' && state.wires.find((w) => w.id === drag.wireId)?.pin) return null;

  let holes: Hole[] = [];
  let ok = true;
  if (drag.kind === 'part') {
    const target = partDrop(layout, lab, state, drag.part, drag.at);
    if (!target) return null;
    holes = target.leads;
    ok = !target.blockedBy;
  } else {
    const hole = nearestHole(layout, drag.at);
    if (!hole) return null;
    holes = [hole];
    ok = !occupancy(lab, state, { wireId: 'wireId' in drag ? drag.wireId : undefined }).has(holeKey(hole));
  }

  const tone = ok ? OK : BAD;
  return (
    <G>
      {holes.map((hole) => {
        const at = holePoint(layout, hole);
        // The whole connected strip lights up: a column of five holes, or a rail across the board.
        const strip = isRail(hole)
          ? { x: holePoint(layout, { row: hole.row, col: 0 }).x - 4.6 * BB_SCALE, y: at.y - 4.6 * BB_SCALE, w: (BREADBOARD.cols - 1) * HOLE_PITCH + 9.2 * BB_SCALE, h: 9.2 * BB_SCALE }
          : { x: at.x - 4.6 * BB_SCALE, y: holePoint(layout, { row: hole.row < 5 ? 0 : 5, col: hole.col }).y - 4.6 * BB_SCALE, w: 9.2 * BB_SCALE, h: 49.2 * BB_SCALE };
        return (
          <G key={holeKey(hole)}>
            <Rect x={strip.x} y={strip.y} width={strip.w} height={strip.h} rx={4.6 * BB_SCALE} fill={tone} fillOpacity={0.16} stroke={tone} strokeOpacity={0.55} strokeWidth={1} />
            <Circle cx={at.x} cy={at.y} r={3.8 * BB_SCALE} fill="none" stroke={tone} strokeWidth={1.6} />
          </G>
        );
      })}
    </G>
  );
}

/** Floating label that names what the drag will connect. */
export function DragTag({ drag, layout, lab, state }: { drag: Drag | null; layout: CanvasLayout; lab: LabDef; state: RuntimeState }) {
  if (!drag || drag.kind === 'knob') return null;
  const above = { x: drag.at.x, y: drag.at.y - (drag.kind === 'part' ? 44 : 18) };

  if (drag.kind === 'part') {
    const target = partDrop(layout, lab, state, drag.part, drag.at);
    if (!target)
      return <Tag at={above} text={insideBreadboard(layout, drag.at) ? 'line up with the holes' : 'back to bin'} tone="#7F8C8D" />;
    const tone = target.blockedBy ? BAD : OK;
    const [a, b] = [target.leads[0], target.leads[target.leads.length - 1]];
    const spec = specOf(lab, drag.part);
    if (PART_DEFS[spec.def].polarized) {
      const [anode, cathode] = state.flipped.includes(drag.part) ? [b, a] : [a, b];
      return <Tag at={above} text={`+ ${holeName(anode)} · − ${holeName(cathode)}`} tone={tone} />;
    }
    return <Tag at={above} text={`${holeName(a)} – ${holeName(b)}`} tone={tone} />;
  }

  if (drag.kind === 'binWire') {
    const pin = nearestPin(layout, drag.at, 9);
    const hole = pin ? null : nearestHole(layout, drag.at);
    const text = pin ? pin.name : hole ? holeName(hole) : 'jumper wire';
    return <Tag at={above} text={text} tone={pin || hole ? OK : '#7F8C8D'} />;
  }

  const wire = drag.kind === 'newWire' ? null : state.wires.find((w) => w.id === drag.wireId);

  if (drag.kind === 'wirePin') {
    const pin = nearestPin(layout, drag.at, 9);
    if (pin) return <Tag at={above} text={pin.name} tone={OK} />;
    if (wire?.pin) return <Tag at={above} text="release to remove" tone={BAD} />;
    const hole = nearestHole(layout, drag.at);
    return hole ? (
      <Tag at={above} text={`${wire?.hole ? holeName(wire.hole) : ''} → ${holeName(hole)}`} tone={OK} />
    ) : (
      <Tag at={above} text="pick a pin or hole" tone="#7F8C8D" />
    );
  }

  if (drag.kind === 'wireHole2') {
    const hole = nearestHole(layout, drag.at);
    return hole ? <Tag at={above} text={holeName(hole)} tone={OK} /> : <Tag at={above} text="release to remove" tone={BAD} />;
  }

  const pinId = drag.kind === 'newWire' ? drag.pin : wire?.pin;
  if (drag.kind === 'wireHole' && wire && !wire.pin && wire.hole2) {
    const hole = nearestHole(layout, drag.at);
    return hole ? <Tag at={above} text={holeName(hole)} tone={OK} /> : <Tag at={above} text="release to remove" tone={BAD} />;
  }
  const pinName = pinId ? PIN_BY_ID[pinId].name : '';
  const hole = nearestHole(layout, drag.at);
  if (!hole) {
    if (drag.kind === 'wireHole' && wire?.hole) return <Tag at={above} text="release to remove" tone={BAD} />;
    return <Tag at={above} text={drag.kind === 'wireHole' ? 'pick a hole' : pinName} tone="#7F8C8D" />;
  }
  return <Tag at={above} text={pinName ? `${pinName} → ${holeName(hole)}` : holeName(hole)} tone={OK} />;
}
