import { memo, useRef, useState } from 'react';
import { type GestureResponderEvent, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  BB_SCALE,
  BOARD_LEDS,
  BREADBOARD,
  HOLE_PITCH,
  type CanvasLayout,
  type Hole,
  PART_BOX,
  PART_NAME,
  PART_SPAN,
  PIN_BY_ID,
  type PartId,
  type Point,
  headerRegions,
  holeKey,
  holeName,
  holePoint,
  insideBreadboard,
  leadHoles,
  nearestHole,
  nearestPin,
  partCenter,
  pinPoint,
  sameHole,
} from '../../lab/geometry';
import type { LabAction, LabState } from '../../lab/state';
import { colors } from '../../theme';
import { ArduinoUno } from './ArduinoUno';
import { Breadboard, PartsBin } from './Breadboard';
import { JumperWire, Led, type LedGlow, Resistor, Tag, wireColor } from './Parts';

type Props = {
  layout: CanvasLayout;
  scale: number;
  lab: LabState;
  ledGlow: LedGlow;
  dispatch: (action: LabAction) => void;
  onDraggingChange?: (dragging: boolean) => void;
};

type Drag =
  | { kind: 'part'; part: PartId; origin: Point; at: Point }
  | { kind: 'newWire'; pin: string; origin: Point; at: Point }
  | { kind: 'wirePin'; wireId: string; origin: Point; at: Point }
  | { kind: 'wireHole'; wireId: string; origin: Point; at: Point };

const TAP_SLOP = 4;
const OK = colors.teal;
const BAD = colors.danger;

/** Which holes are in use, and by what, optionally ignoring the item being dragged. */
function occupancy(lab: LabState, ignore: { part?: PartId; wireId?: string } = {}) {
  const used = new Map<string, string>();
  (['resistor', 'led'] as const).forEach((part) => {
    const left = lab.parts[part];
    if (!left || part === ignore.part) return;
    leadHoles(part, left).forEach((hole) => used.set(holeKey(hole), `the ${PART_NAME[part]}`));
  });
  lab.wires.forEach((wire) => {
    if (wire.id !== ignore.wireId) used.set(holeKey(wire.hole), `the ${PIN_BY_ID[wire.pin].name} jumper`);
  });
  return used;
}

function partDrop(layout: CanvasLayout, lab: LabState, part: PartId, center: Point) {
  const span = PART_SPAN[part];
  const left = nearestHole(layout, { x: center.x - (span * HOLE_PITCH) / 2, y: center.y });
  if (!left || left.col + span >= BREADBOARD.cols) return null;
  const leads = leadHoles(part, left);
  const used = occupancy(lab, { part });
  const blockedBy = leads.map((hole) => used.get(holeKey(hole))).find(Boolean) ?? null;
  return { left, leads, blockedBy };
}

export function Workbench({ layout, scale, lab, ledGlow, dispatch, onDraggingChange }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const log = (kind: 'info' | 'warn', text: string) => dispatch({ type: 'log', kind, text });

  const startDrag = (next: Drag) => {
    setDrag(next);
    onDraggingChange?.(true);
  };
  const moveDrag = (dx: number, dy: number) =>
    setDrag((current) =>
      current ? { ...current, at: { x: current.origin.x + dx / scale, y: current.origin.y + dy / scale } } : current,
    );
  const endDrag = () => {
    setDrag(null);
    onDraggingChange?.(false);
  };

  const currentCenter = (part: PartId) => {
    const left = lab.parts[part];
    return left ? partCenter(layout, part, left) : layout.binSlots[part];
  };

  // ---- drop handlers -------------------------------------------------------

  const dropPart = (part: PartId, at: Point, tapped: boolean) => {
    if (tapped) {
      if (part === 'led') dispatch({ type: 'flipLed' });
      return;
    }
    const target = partDrop(layout, lab, part, at);
    if (target && !target.blockedBy) {
      const current = lab.parts[part];
      if (!current || !sameHole(current, target.left)) dispatch({ type: 'placePart', part, hole: target.left });
    } else if (target?.blockedBy) {
      log('warn', `That spot is taken by ${target.blockedBy}. Each hole holds one leg or wire.`);
    } else if (insideBreadboard(layout, at)) {
      log('warn', `Line the ${PART_NAME[part]}’s legs up with a row of holes (not the center gap).`);
    } else if (lab.parts[part]) {
      dispatch({ type: 'placePart', part, hole: null });
    }
  };

  const dropNewWire = (pinId: string, at: Point, tapped: boolean) => {
    const pin = PIN_BY_ID[pinId];
    if (tapped) {
      log('info', `To wire ${pin.name}, drag from it to a hole on the breadboard.`);
      return;
    }
    const hole = nearestHole(layout, at);
    if (!hole) return;
    const usedBy = occupancy(lab).get(holeKey(hole));
    if (usedBy) log('warn', `Hole ${holeName(hole)} already holds ${usedBy}.`);
    else dispatch({ type: 'addWire', pin: pinId, hole });
  };

  const dropWirePin = (wireId: string, at: Point, tapped: boolean) => {
    const wire = lab.wires.find((w) => w.id === wireId);
    if (!wire || tapped) return;
    const pin = nearestPin(layout, at, 9);
    if (!pin) {
      dispatch({ type: 'removeWire', id: wireId });
    } else if (pin.id !== wire.pin) {
      const taken = lab.wires.find((w) => w.pin === pin.id);
      if (taken) log('warn', `${pin.name} already has a jumper in it.`);
      else dispatch({ type: 'moveWire', id: wireId, pin: pin.id });
    }
  };

  const dropWireHole = (wireId: string, at: Point, tapped: boolean) => {
    const wire = lab.wires.find((w) => w.id === wireId);
    if (!wire || tapped) return;
    const hole = nearestHole(layout, at);
    if (!hole) {
      dispatch({ type: 'removeWire', id: wireId });
    } else if (!sameHole(hole, wire.hole)) {
      const usedBy = occupancy(lab, { wireId }).get(holeKey(hole));
      if (usedBy) log('warn', `Hole ${holeName(hole)} already holds ${usedBy}.`);
      else dispatch({ type: 'moveWire', id: wireId, hole });
    }
  };

  const finish = (dx: number, dy: number, cancelled: boolean) => {
    const current = drag;
    endDrag();
    if (!current || cancelled) return;
    const tapped = Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP;
    const at = { x: current.origin.x + dx / scale, y: current.origin.y + dy / scale };
    if (current.kind === 'part') dropPart(current.part, at, tapped);
    else if (current.kind === 'newWire') dropNewWire(current.pin, at, tapped);
    else if (current.kind === 'wirePin') dropWirePin(current.wireId, at, tapped);
    else dropWireHole(current.wireId, at, tapped);
  };

  // ---- rendering -------------------------------------------------------------

  const width = layout.width * scale;
  const height = layout.height * scale;
  const frame = (x: number, y: number, w: number, h: number) => ({
    left: x * scale,
    top: y * scale,
    width: w * scale,
    height: h * scale,
  });

  const parts = (['resistor', 'led'] as const).map((part) => {
    const dragging = drag?.kind === 'part' && drag.part === part;
    return { part, center: dragging ? drag.at : currentCenter(part), dragging, home: currentCenter(part) };
  });

  const wires = lab.wires.map((wire) => {
    const pin = PIN_BY_ID[wire.pin];
    const movingPin = drag?.kind === 'wirePin' && drag.wireId === wire.id;
    const movingHole = drag?.kind === 'wireHole' && drag.wireId === wire.id;
    return {
      wire,
      color: wireColor(pin),
      from: movingPin ? drag.at : pinPoint(layout, pin),
      to: movingHole ? drag.at : holePoint(layout, wire.hole),
      moving: movingPin || movingHole,
    };
  });

  const boardLed = (id: keyof typeof BOARD_LEDS) => ({
    x: layout.board.x + BOARD_LEDS[id].x,
    y: layout.board.y + BOARD_LEDS[id].y,
  });
  const uploading = lab.busy === 'uploading';

  return (
    <View style={[styles.canvas, { width, height }, webNoSelect]}>
      <Svg width={width} height={height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
        <Defs>
          <Pattern id="mat" width={20} height={20} patternUnits="userSpaceOnUse">
            <Circle cx={2} cy={2} r={0.9} fill={colors.canvasDot} />
          </Pattern>
          <RadialGradient id="ledGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFB199" stopOpacity={0.95} />
            <Stop offset="0.35" stopColor="#FF5A3D" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#FF3B2F" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="smdGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <StaticScene layout={layout} />

        {/* Board status LEDs */}
        <BoardLight at={boardLed('on')} color="#3BE36B" />
        {uploading ? <BoardLight at={boardLed('tx')} color="#FFD34D" /> : null}
        {uploading ? <BoardLight at={boardLed('rx')} color="#FFD34D" /> : null}
        {uploading ? <BoardLight at={boardLed('l')} color="#FFD34D" /> : null}

        <DropPreview drag={drag} layout={layout} lab={lab} />

        {/* Wires first so the parts they run past stay readable. */}
        {wires
          .filter((w) => !w.moving)
          .map(({ wire, color, from, to }) => (
            <JumperWire key={wire.id} from={from} to={to} color={color} />
          ))}

        {parts
          .filter((p) => !p.dragging)
          .map(({ part, center }) =>
            part === 'resistor' ? (
              <Resistor key={part} at={center} />
            ) : (
              <Led key={part} at={center} flipped={lab.ledFlipped} glow={lab.parts.led ? ledGlow : 'off'} burnt={lab.ledBurnt} />
            ),
          )}

        {wires
          .filter((w) => w.moving)
          .map(({ wire, color, from, to }) => (
            <JumperWire key={wire.id} from={from} to={to} color={color} faded />
          ))}

        {drag?.kind === 'newWire' ? (
          <JumperWire from={pinPoint(layout, PIN_BY_ID[drag.pin])} to={drag.at} color={wireColor(PIN_BY_ID[drag.pin])} faded />
        ) : null}

        {parts
          .filter((p) => p.dragging)
          .map(({ part, center }) =>
            part === 'resistor' ? (
              <Resistor key={part} at={center} lifted />
            ) : (
              <Led key={part} at={center} flipped={lab.ledFlipped} glow="off" burnt={lab.ledBurnt} lifted />
            ),
          )}

        <DragTag drag={drag} layout={layout} lab={lab} />
      </Svg>

      {/* Touch targets, drawn above the artwork. */}
      {headerRegions(layout).map((region) => (
        <DragHandle
          key={region.header}
          label={`Arduino ${region.header} header pins`}
          style={frame(region.x, region.y, region.width, region.height)}
          onStart={(local) => {
            // Pick the pin by horizontal position so the whole strip is easy to grab.
            const pin = nearestPin(layout, { x: region.x + local.x / scale, y: region.pinY }, 8, region.header);
            if (!pin) return;
            const origin = pinPoint(layout, pin);
            const wire = lab.wires.find((w) => w.pin === pin.id);
            startDrag(
              wire
                ? { kind: 'wirePin', wireId: wire.id, origin, at: origin }
                : { kind: 'newWire', pin: pin.id, origin, at: origin },
            );
          }}
          onMove={moveDrag}
          onEnd={finish}
        />
      ))}

      {parts.map(({ part, home }) => {
        const box = PART_BOX[part];
        return (
          <DragHandle
            key={part}
            label={part === 'led' ? 'LED: drag to place, tap to flip' : 'Resistor: drag to place'}
            style={frame(home.x + box.left, home.y + box.top, box.right - box.left, box.bottom - box.top)}
            onStart={() => startDrag({ kind: 'part', part, origin: home, at: home })}
            onMove={moveDrag}
            onEnd={finish}
          />
        );
      })}

      {lab.wires.map((wire) => {
        const end = holePoint(layout, wire.hole);
        return (
          <DragHandle
            key={wire.id}
            label={`${PIN_BY_ID[wire.pin].name} jumper end in ${holeName(wire.hole)}`}
            style={frame(end.x - 9, end.y - 9, 18, 18)}
            onStart={() => startDrag({ kind: 'wireHole', wireId: wire.id, origin: end, at: end })}
            onMove={moveDrag}
            onEnd={finish}
          />
        );
      })}
    </View>
  );
}

const StaticScene = memo(function StaticScene({ layout }: { layout: CanvasLayout }) {
  return (
    <G>
      <Rect x={0} y={0} width={layout.width} height={layout.height} fill={colors.canvas} />
      <Rect x={0} y={0} width={layout.width} height={layout.height} fill="url(#mat)" />
      <PartsBin layout={layout} />
      <Breadboard origin={layout.breadboard} />
      <ArduinoUno origin={layout.board} />
    </G>
  );
});

function BoardLight({ at, color }: { at: Point; color: string }) {
  return (
    <G>
      <Circle cx={at.x} cy={at.y} r={6} fill="url(#smdGlow)" opacity={0.7} />
      <Rect x={at.x - 3} y={at.y - 1.8} width={6} height={3.6} rx={0.6} fill={color} />
    </G>
  );
}

/** Highlights the strips and holes a dragged item would connect to. */
function DropPreview({ drag, layout, lab }: { drag: Drag | null; layout: CanvasLayout; lab: LabState }) {
  if (!drag) return null;

  if (drag.kind === 'wirePin') {
    const pin = nearestPin(layout, drag.at, 9);
    if (!pin) return null;
    const at = pinPoint(layout, pin);
    return <Circle cx={at.x} cy={at.y} r={5.5} fill="none" stroke={OK} strokeWidth={1.6} />;
  }

  let holes: Hole[] = [];
  let ok = true;
  if (drag.kind === 'part') {
    const target = partDrop(layout, lab, drag.part, drag.at);
    if (!target) return null;
    holes = target.leads;
    ok = !target.blockedBy;
  } else {
    const hole = nearestHole(layout, drag.at);
    if (!hole) return null;
    holes = [hole];
    ok = !occupancy(lab, { wireId: drag.kind === 'wireHole' ? drag.wireId : undefined }).has(holeKey(hole));
  }

  const tone = ok ? OK : BAD;
  return (
    <G>
      {holes.map((hole) => {
        const top = holePoint(layout, { row: hole.row < 5 ? 0 : 5, col: hole.col });
        const at = holePoint(layout, hole);
        return (
          <G key={holeKey(hole)}>
            <Rect
              x={top.x - 4.6 * BB_SCALE}
              y={top.y - 4.6 * BB_SCALE}
              width={9.2 * BB_SCALE}
              height={49.2 * BB_SCALE}
              rx={4.6 * BB_SCALE}
              fill={tone}
              fillOpacity={0.16}
              stroke={tone}
              strokeOpacity={0.55}
              strokeWidth={1}
            />
            <Circle cx={at.x} cy={at.y} r={3.8 * BB_SCALE} fill="none" stroke={tone} strokeWidth={1.6} />
          </G>
        );
      })}
    </G>
  );
}

/** Floating label that names what the drag will connect. */
function DragTag({ drag, layout, lab }: { drag: Drag | null; layout: CanvasLayout; lab: LabState }) {
  if (!drag) return null;
  const above = { x: drag.at.x, y: drag.at.y - (drag.kind === 'part' ? 44 : 18) };

  if (drag.kind === 'part') {
    const target = partDrop(layout, lab, drag.part, drag.at);
    if (!target) return <Tag at={above} text={insideBreadboard(layout, drag.at) ? 'line up with a row' : 'back to bin'} tone="#7F8C8D" />;
    const [a, b] = target.leads;
    const tone = target.blockedBy ? BAD : OK;
    if (drag.part === 'led') {
      const [anode, cathode] = lab.ledFlipped ? [b, a] : [a, b];
      return <Tag at={above} text={`+ ${holeName(anode)} · − ${holeName(cathode)}`} tone={tone} />;
    }
    return <Tag at={above} text={`${holeName(a)} – ${holeName(b)}`} tone={tone} />;
  }

  if (drag.kind === 'wirePin') {
    const pin = nearestPin(layout, drag.at, 9);
    return <Tag at={above} text={pin ? pin.name : 'release to remove'} tone={pin ? OK : BAD} />;
  }

  const wire = drag.kind === 'wireHole' ? lab.wires.find((w) => w.id === drag.wireId) : null;
  const pinId = drag.kind === 'newWire' ? drag.pin : wire?.pin;
  const pinName = pinId ? PIN_BY_ID[pinId].name : '';
  const hole = nearestHole(layout, drag.at);
  if (!hole) {
    return <Tag at={above} text={drag.kind === 'wireHole' ? 'release to remove' : pinName} tone={drag.kind === 'wireHole' ? BAD : '#7F8C8D'} />;
  }
  return <Tag at={above} text={`${pinName} → ${holeName(hole)}`} tone={OK} />;
}

// ---- gesture plumbing ----------------------------------------------------------

type DragHandleProps = {
  label: string;
  style: ViewStyle;
  onStart: (local: Point) => void;
  onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number, cancelled: boolean) => void;
};

/**
 * Transparent touch target built on the responder system, which behaves the
 * same for mouse and touch on web and for touch on iOS.
 */
function DragHandle({ label, style, onStart, onMove, onEnd }: DragHandleProps) {
  const start = useRef({ x: 0, y: 0 });
  const delta = (event: GestureResponderEvent): [number, number] => [
    event.nativeEvent.pageX - start.current.x,
    event.nativeEvent.pageY - start.current.y,
  ];
  return (
    <View
      accessibilityLabel={label}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => {
        start.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        onStart({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY });
      }}
      onResponderMove={(event) => onMove(...delta(event))}
      onResponderRelease={(event) => onEnd(...delta(event), false)}
      onResponderTerminate={(event) => onEnd(...delta(event), true)}
      style={[styles.handle, webGrab, style]}
    />
  );
}

const webGrab = Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none' } as object as ViewStyle) : null;
const webNoSelect = Platform.OS === 'web' ? ({ userSelect: 'none' } as ViewStyle) : null;

const styles = StyleSheet.create({
  canvas: {
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
  },
  handle: {
    position: 'absolute',
  },
});
