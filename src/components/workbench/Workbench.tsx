import { memo, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  BB_SCALE,
  BIN_JUMPER_BOX,
  BOARD_LEDS,
  BOARD_SIZE,
  BREADBOARD,
  HOLE_PITCH,
  type CanvasLayout,
  type Hole,
  PIN_BY_ID,
  RAIL_BOTTOM,
  RAIL_TOP,
  binSlotPoints,
  headerRegions,
  holeKey,
  holeName,
  holePoint,
  insideBreadboard,
  nearestHole,
  nearestPin,
  pinPoint,
  sameHole,
  type Point,
} from '../../lab/geometry';
import type { LabDef } from '../../lab/lab';
import { PART_DEFS, binGroups, partLegs, type PartSpec } from '../../lab/parts';
import type { RuntimeAction, RuntimeState } from '../../lab/runtime';
import type { ComponentId } from '../../lab/components';
import { colors } from '../../theme';
import { ArduinoUno } from './ArduinoUno';
import { Breadboard, PartsBin } from './Breadboard';
import {
  BANDS_10K,
  Battery,
  BinJumpers,
  Buzzer,
  Diode,
  JumperWire,
  LOOSE_WIRE,
  Led,
  type LedGlow,
  Ldr,
  LooseEnd,
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
  wireColor,
} from './Parts';

type Props = {
  layout: CanvasLayout;
  scale: number;
  lab: LabDef;
  state: RuntimeState;
  /** LED glow per instance id, computed from the behavior model. */
  ledGlow: Record<string, LedGlow>;
  /** PWM brightness (0–1) per LED instance id; overrides glow when present. */
  ledLevels?: Record<string, number>;
  dispatch: (action: RuntimeAction) => void;
  onDraggingChange?: (dragging: boolean) => void;
  /** Called when the student taps a component to learn what it is. */
  onInspect?: (id: ComponentId) => void;
};

type Drag =
  | { kind: 'part'; part: string; origin: Point; at: Point }
  | { kind: 'binWire'; origin: Point; at: Point }
  | { kind: 'newWire'; pin: string; origin: Point; at: Point }
  | { kind: 'wirePin'; wireId: string; origin: Point; at: Point }
  | { kind: 'wireHole'; wireId: string; origin: Point; at: Point }
  /** The second end of a breadboard-to-breadboard jumper. */
  | { kind: 'wireHole2'; wireId: string; origin: Point; at: Point }
  /** Turning the potentiometer's knob while the sketch runs. */
  | { kind: 'knob'; part: string; start: number; origin: Point; at: Point };

const TAP_SLOP = 4;
const OK = colors.teal;
const BAD = colors.danger;

const specOf = (lab: LabDef, id: string): PartSpec => lab.parts.find((p) => p.id === id)!;
const defOf = (lab: LabDef, id: string) => PART_DEFS[specOf(lab, id).def];
const displayName = (lab: LabDef, id: string) => specOf(lab, id).name ?? defOf(lab, id).name;

/** Where a part's artwork is anchored: the midpoint of its outermost legs. */
function anchorFor(layout: CanvasLayout, lab: LabDef, id: string, start: Hole): Point {
  const legs = partLegs(specOf(lab, id).def, start);
  const points = legs.map((hole) => holePoint(layout, hole));
  const x = (Math.min(...points.map((p) => p.x)) + Math.max(...points.map((p) => p.x))) / 2;
  const y = (Math.min(...points.map((p) => p.y)) + Math.max(...points.map((p) => p.y))) / 2;
  // Resistors and LEDs anchor on their row; the button centers over its legs.
  return defOf(lab, id).pressable ? { x, y } : { x, y: points[0].y };
}

/** Which holes are in use, and by what, optionally ignoring the item being dragged. */
function occupancy(lab: LabDef, state: RuntimeState, ignore: { part?: string; wireId?: string } = {}) {
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

function partDrop(layout: CanvasLayout, lab: LabDef, state: RuntimeState, part: string, center: Point) {
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
function breadboardWireColor(a: Hole | null, b: Hole | null): string {
  const rows = [a?.row, b?.row];
  if (rows.includes(RAIL_BOTTOM)) return '#2D3436';
  if (rows.includes(RAIL_TOP)) return '#E74C3C';
  return LOOSE_WIRE;
}

/** Where a jumper's unplugged end dangles: just off the end that is plugged in. */
function loosePoint(layout: CanvasLayout, wire: RuntimeState['wires'][number]): Point {
  const clamp = (y: number) => Math.max(8, Math.min(layout.height - 8, y));
  if (wire.hole) {
    const at = holePoint(layout, wire.hole);
    return { x: at.x, y: clamp(at.y - 26) };
  }
  const pin = PIN_BY_ID[wire.pin!];
  const at = pinPoint(layout, pin);
  return { x: at.x, y: clamp(at.y + (pin.header === 'top' ? -28 : 20)) };
}

export function Workbench({ layout, scale, lab, state, ledGlow, ledLevels, dispatch, onDraggingChange, onInspect }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  // A categorized bin (free play) stocks one category at a time, picked from a dropdown.
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const spec of lab.parts) if (spec.category && !seen.includes(spec.category)) seen.push(spec.category);
    return seen;
  }, [lab]);
  const [category, setCategory] = useState<string | null>(categories[0] ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const binParts = useMemo(
    () => (categories.length > 0 && category ? lab.parts.filter((p) => p.category === category) : lab.parts),
    [lab, categories, category],
  );
  // Identical parts share one bin slot; only the next one still in the bin is shown there.
  const groups = useMemo(() => binGroups(binParts), [binParts]);
  const binSlots = useMemo(() => {
    const points = binSlotPoints(layout, groups.length);
    return groups.map((g, i) => ({ key: g.key, label: g.label, ids: g.ids, ...points[i] }));
  }, [layout, groups]);
  const slots: Record<string, Point> = {};
  for (const slot of binSlots) for (const id of slot.ids) slots[id] = slot.at;
  const nextInBin = new Set(binSlots.map((slot) => slot.ids.find((id) => !state.parts[id])).filter(Boolean) as string[]);
  const mistake = (title: string, hint: string) => dispatch({ type: 'mistake', title, hint });
  const holeTaken = (hole: Hole, usedBy: string) =>
    mistake(
      `Hole ${holeName(hole)} already holds ${usedBy}.`,
      'Each hole holds one leg or wire. Any other hole in the same column connects the same way.',
    );
  const pinTaken = (name: string) =>
    mistake(`${name} already has a jumper in it.`, 'Each Arduino pin holds one jumper. Pick another pin, or move that jumper first.');

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

  const currentAnchor = (part: string) => {
    const start = state.parts[part];
    return start ? anchorFor(layout, lab, part, start) : slots[part];
  };

  // ---- drop handlers -------------------------------------------------------

  const dropPart = (part: string, at: Point, tapped: boolean) => {
    const def = defOf(lab, part);
    if (tapped) {
      if (def.flippable && state.parts[part]) dispatch({ type: 'flipPart', part });
      else onInspect?.(def.id as ComponentId);
      return;
    }
    const target = partDrop(layout, lab, state, part, at);
    if (target && !target.blockedBy) {
      const current = state.parts[part];
      if (!current || !sameHole(current, target.left)) dispatch({ type: 'placePart', part, hole: target.left });
    } else if (target?.blockedBy) {
      mistake(`That spot is taken by ${target.blockedBy}.`, 'Each hole holds one leg or wire. Move the part to an empty spot.');
    } else if (insideBreadboard(layout, at)) {
      mistake(
        `The ${displayName(lab, part)} didn’t line up with the holes.`,
        def.pressable
          ? 'Drop it so its four legs straddle the center gap, two legs on each side.'
          : 'Drop it so both legs land in one lettered row, with room for both legs and away from the center gap.',
      );
    } else if (state.parts[part]) {
      dispatch({ type: 'placePart', part, hole: null });
    }
  };

  const dropNewWire = (pinId: string, at: Point, tapped: boolean) => {
    const pin = PIN_BY_ID[pinId];
    if (tapped) {
      onInspect?.('arduino');
      return;
    }
    const hole = nearestHole(layout, at);
    if (!hole) return;
    const usedBy = occupancy(lab, state).get(holeKey(hole));
    if (usedBy) holeTaken(hole, usedBy);
    else dispatch({ type: 'addWire', pin: pin.id, hole });
  };

  /** A jumper taken from the bin plugs one end in where it is dropped; the other end stays loose. */
  const dropBinWire = (at: Point, tapped: boolean) => {
    if (tapped) {
      onInspect?.('jumper');
      return;
    }
    const pin = nearestPin(layout, at, 9);
    if (pin) {
      if (state.wires.some((w) => w.pin === pin.id)) pinTaken(pin.name);
      else dispatch({ type: 'addWire', pin: pin.id, hole: null });
      return;
    }
    const hole = nearestHole(layout, at);
    if (!hole) return;
    const usedBy = occupancy(lab, state).get(holeKey(hole));
    if (usedBy) holeTaken(hole, usedBy);
    else dispatch({ type: 'addWire', pin: null, hole });
  };

  const dropWirePin = (wireId: string, at: Point, tapped: boolean) => {
    const wire = state.wires.find((w) => w.id === wireId);
    if (!wire || tapped) return;
    const pin = nearestPin(layout, at, 9);
    if (!pin) {
      if (wire.pin) {
        dispatch({ type: 'removeWire', id: wireId });
        return;
      }
      // A jumper with its first end in the breadboard can finish in another
      // hole: a breadboard jumper, e.g. from a column to the − rail.
      const hole = nearestHole(layout, at);
      if (!hole || (wire.hole && sameHole(hole, wire.hole))) return;
      const usedBy = occupancy(lab, state, { wireId }).get(holeKey(hole));
      if (usedBy) holeTaken(hole, usedBy);
      else dispatch({ type: 'moveWire', id: wireId, hole2: hole });
    } else if (pin.id !== wire.pin) {
      if (state.wires.some((w) => w.pin === pin.id && w.id !== wireId)) pinTaken(pin.name);
      else dispatch({ type: 'moveWire', id: wireId, pin: pin.id });
    }
  };

  const dropWireHole = (wireId: string, at: Point, tapped: boolean) => {
    const wire = state.wires.find((w) => w.id === wireId);
    if (!wire || tapped) return;
    const hole = nearestHole(layout, at);
    if (!hole) {
      if (wire.hole) dispatch({ type: 'removeWire', id: wireId });
      else if (nearestPin(layout, at, 9)) {
        mistake(
          'This jumper already has one end in an Arduino pin.',
          'Every jumper runs from an Arduino pin to the breadboard. Drag the loose end into a breadboard hole.',
        );
      }
    } else if (!wire.hole || !sameHole(hole, wire.hole)) {
      const usedBy = occupancy(lab, state, { wireId }).get(holeKey(hole));
      if (usedBy) holeTaken(hole, usedBy);
      else dispatch({ type: 'moveWire', id: wireId, hole });
    }
  };

  /** Moving the second end of a breadboard jumper; dropped off the board, the jumper is removed. */
  const dropWireHole2 = (wireId: string, at: Point, tapped: boolean) => {
    const wire = state.wires.find((w) => w.id === wireId);
    if (!wire || tapped) return;
    const hole = nearestHole(layout, at);
    if (!hole) {
      dispatch({ type: 'removeWire', id: wireId });
    } else if (!wire.hole2 || !sameHole(hole, wire.hole2)) {
      const usedBy = occupancy(lab, state, { wireId }).get(holeKey(hole));
      if (usedBy) holeTaken(hole, usedBy);
      else dispatch({ type: 'moveWire', id: wireId, hole2: hole });
    }
  };

  const finish = (dx: number, dy: number, cancelled: boolean) => {
    const current = drag;
    endDrag();
    if (!current || cancelled) return;
    const tapped = Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP;
    const at = { x: current.origin.x + dx / scale, y: current.origin.y + dy / scale };
    if (current.kind === 'part') dropPart(current.part, at, tapped);
    else if (current.kind === 'binWire') dropBinWire(at, tapped);
    else if (current.kind === 'newWire') dropNewWire(current.pin, at, tapped);
    else if (current.kind === 'wirePin') dropWirePin(current.wireId, at, tapped);
    else if (current.kind === 'wireHole2') dropWireHole2(current.wireId, at, tapped);
    else if (current.kind === 'wireHole') dropWireHole(current.wireId, at, tapped);
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

  const parts = lab.parts
    .filter((spec) => state.parts[spec.id] || nextInBin.has(spec.id))
    .map((spec) => {
      const dragging = drag?.kind === 'part' && drag.part === spec.id;
      return { spec, center: dragging ? drag.at : currentAnchor(spec.id), dragging, home: currentAnchor(spec.id) };
    });

  const wires = state.wires.map((wire) => {
    const pin = wire.pin ? PIN_BY_ID[wire.pin] : null;
    // End A is the pin, or for a breadboard jumper its second hole.
    const movingA = (drag?.kind === 'wirePin' || drag?.kind === 'wireHole2') && drag.wireId === wire.id;
    const movingHole = drag?.kind === 'wireHole' && drag.wireId === wire.id;
    const plugged = (pin || wire.hole2) && wire.hole;
    const loose = plugged ? null : loosePoint(layout, wire);
    const endA = pin ? pinPoint(layout, pin) : wire.hole2 ? holePoint(layout, wire.hole2) : loose!;
    return {
      wire,
      color: pin ? wireColor(pin) : wire.hole2 ? breadboardWireColor(wire.hole, wire.hole2) : LOOSE_WIRE,
      from: movingA && drag ? drag.at : endA,
      to: movingHole && drag ? drag.at : wire.hole ? holePoint(layout, wire.hole) : loose!,
      loose: movingA || movingHole ? null : loose,
      moving: movingA || movingHole,
    };
  });

  const boardLed = (id: keyof typeof BOARD_LEDS) => ({
    x: layout.board.x + BOARD_LEDS[id].x,
    y: layout.board.y + BOARD_LEDS[id].y,
  });
  const uploading = state.busy === 'uploading';

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
          <RadialGradient id="ledGlowGreen" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#D5F5E3" stopOpacity={0.95} />
            <Stop offset="0.35" stopColor="#3BE36B" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#2ECC71" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ledGlowYellow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FCF3CF" stopOpacity={0.95} />
            <Stop offset="0.35" stopColor="#F4D03F" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#F1C40F" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="smdGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.9} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>

        <StaticScene layout={layout} slots={binSlots} binTitle={categories.length > 0 && category ? category : undefined} />

        {/* Board status LEDs */}
        <BoardLight at={boardLed('on')} color="#3BE36B" />
        {uploading ? <BoardLight at={boardLed('tx')} color="#FFD34D" /> : null}
        {uploading ? <BoardLight at={boardLed('rx')} color="#FFD34D" /> : null}
        {uploading ? <BoardLight at={boardLed('l')} color="#FFD34D" /> : null}

        <DropPreview drag={drag} layout={layout} lab={lab} state={state} />

        {/* Wires first so the parts they run past stay readable. */}
        {wires
          .filter((w) => !w.moving)
          .map(({ wire, color, from, to, loose }) => (
            <G key={wire.id}>
              <JumperWire from={from} to={to} color={color} />
              {loose ? <LooseEnd at={loose} /> : null}
            </G>
          ))}

        {parts
          .filter((p) => !p.dragging)
          .map(({ spec, center }) => (
            <PartView key={spec.id} spec={spec} at={center} state={state} glow={ledGlow[spec.id] ?? 'off'} level={ledLevels?.[spec.id]} />
          ))}

        {wires
          .filter((w) => w.moving)
          .map(({ wire, color, from, to }) => (
            <JumperWire key={wire.id} from={from} to={to} color={color} faded />
          ))}

        {drag?.kind === 'binWire' ? (
          <JumperWire from={{ x: drag.at.x - 12, y: drag.at.y + 16 }} to={drag.at} color={LOOSE_WIRE} faded />
        ) : null}

        {drag?.kind === 'newWire' ? (
          <JumperWire from={pinPoint(layout, PIN_BY_ID[drag.pin])} to={drag.at} color={wireColor(PIN_BY_ID[drag.pin])} faded />
        ) : null}

        {parts
          .filter((p) => p.dragging)
          .map(({ spec, center }) => (
            <PartView key={spec.id} spec={spec} at={center} state={state} glow="off" lifted />
          ))}

        <DragTag drag={drag} layout={layout} lab={lab} state={state} />
      </Svg>

      {/* Tap the board or the breadboard to learn what it is. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Arduino Uno: tap to learn what it is"
        onPress={() => onInspect?.('arduino')}
        style={[styles.handle, frame(layout.board.x, layout.board.y, BOARD_SIZE.width, BOARD_SIZE.height)]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Breadboard: tap to learn what it is"
        onPress={() => onInspect?.('breadboard')}
        style={[
          styles.handle,
          frame(layout.breadboard.x, layout.breadboard.y, BREADBOARD.width * BB_SCALE, BREADBOARD.height * BB_SCALE),
        ]}
      />

      {/* Touch targets, drawn above the artwork. */}
      <DragHandle
        label="Jumper wires: drag one to a pin or hole, tap to learn what it is"
        style={frame(
          layout.binJumper.x + BIN_JUMPER_BOX.left,
          layout.binJumper.y + BIN_JUMPER_BOX.top,
          BIN_JUMPER_BOX.right - BIN_JUMPER_BOX.left,
          BIN_JUMPER_BOX.bottom - BIN_JUMPER_BOX.top,
        )}
        onStart={() => startDrag({ kind: 'binWire', origin: layout.binJumper, at: layout.binJumper })}
        onMove={moveDrag}
        onEnd={finish}
      />
      {headerRegions(layout).map((region) => (
        <DragHandle
          key={region.header}
          label={`Arduino ${region.header} header pins`}
          style={frame(region.x, region.y, region.width, region.height)}
          onStart={(local) => {
            const pin = nearestPin(layout, { x: region.x + local.x / scale, y: region.pinY }, 8, region.header);
            if (!pin) return;
            const origin = pinPoint(layout, pin);
            const wire = state.wires.find((w) => w.pin === pin.id);
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

      {parts.map(({ spec, home }) => {
        const def = PART_DEFS[spec.def];
        const box = def.box;
        const name = displayName(lab, spec.id);
        const placed = state.parts[spec.id] != null;
        const pressable = !!def.pressable && placed && state.running;
        const adjustable = !!def.adjustable && placed && state.running;
        const label = pressable
          ? `${name}: press and hold to close the contact`
          : adjustable
            ? `${name}: drag left or right to adjust it, tap to learn what it is`
            : def.flippable
              ? `${name}: drag to place, tap to learn or flip`
              : `${name}: drag to place, tap to learn what it is`;
        return (
          <DragHandle
            key={spec.id}
            label={label}
            style={frame(home.x + box.left, home.y + box.top, box.right - box.left, box.bottom - box.top)}
            onStart={() => {
              if (pressable) {
                dispatch({ type: 'pressPart', part: spec.id, pressed: true });
                return;
              }
              if (adjustable) {
                // While the sketch runs, a placed adjustable part (the knob, a sensor) turns instead of moving.
                const control = def.adjustable!.control;
                const start = typeof state.behavior[control] === 'number' ? (state.behavior[control] as number) : 0.5;
                startDrag({ kind: 'knob', part: spec.id, start, origin: home, at: home });
                return;
              }
              startDrag({ kind: 'part', part: spec.id, origin: home, at: home });
            }}
            onMove={(dx, dy) => {
              if (adjustable) {
                // A full sweep is about 120 canvas units of drag, measured from where the turn started.
                const value = Math.max(0, Math.min(1, (drag?.kind === 'knob' ? drag.start : 0.5) + dx / (scale * 120)));
                dispatch({ type: 'control', id: def.adjustable!.control, value });
                return;
              }
              moveDrag(dx, dy);
            }}
            onEnd={(dx, dy, cancelled) => {
              if (pressable) {
                dispatch({ type: 'pressPart', part: spec.id, pressed: false });
                return;
              }
              if (adjustable) {
                endDrag();
                if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) onInspect?.(def.id as ComponentId);
                return;
              }
              finish(dx, dy, cancelled);
            }}
          />
        );
      })}

      {state.wires.flatMap((wire) => {
        // Every breadboard end can be dragged; a loose end waits to be plugged in.
        const ends: { key: string; kind: 'wirePin' | 'wireHole' | 'wireHole2'; at: Point; label: string }[] = [];
        if (wire.pin && wire.hole) {
          ends.push({ key: 'b', kind: 'wireHole', at: holePoint(layout, wire.hole), label: `${PIN_BY_ID[wire.pin].name} jumper end in ${holeName(wire.hole)}` });
        } else if (!wire.pin && wire.hole && wire.hole2) {
          ends.push({ key: 'b', kind: 'wireHole', at: holePoint(layout, wire.hole), label: `Jumper end in ${holeName(wire.hole)}` });
          ends.push({ key: 'a', kind: 'wireHole2', at: holePoint(layout, wire.hole2), label: `Jumper end in ${holeName(wire.hole2)}` });
        } else {
          ends.push({
            key: 'loose',
            kind: wire.pin === null ? 'wirePin' : 'wireHole',
            at: loosePoint(layout, wire),
            label: 'Loose jumper end: drag it to a pin or a hole to plug it in',
          });
        }
        return ends.map((end) => (
          <DragHandle
            key={`${wire.id}-${end.key}`}
            label={end.label}
            style={frame(end.at.x - 9, end.at.y - 9, 18, 18)}
            onStart={() => startDrag({ kind: end.kind, wireId: wire.id, origin: end.at, at: end.at })}
            onMove={moveDrag}
            onEnd={finish}
          />
        ));
      })}

      {/* Bin category picker, above everything else in the bin corner. */}
      {categories.length > 1 && category ? (
        <View style={[styles.picker, frame(layout.bin.x + 6, layout.bin.y + 4, 128, 24)]}>
          {pickerOpen ? (
            <Pressable
              accessibilityLabel="Close the category picker"
              style={{
                position: 'absolute',
                left: -(layout.bin.x + 6) * scale,
                top: -(layout.bin.y + 4) * scale,
                width: layout.width * scale,
                height: layout.height * scale,
              }}
              onPress={() => setPickerOpen(false)}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Parts bin: showing ${category}. Tap to choose another category.`}
            onPress={() => setPickerOpen((open) => !open)}
            style={styles.pickerButton}
          >
            <Text style={styles.pickerText} numberOfLines={1}>
              {category} ▾
            </Text>
          </Pressable>
          {pickerOpen ? (
            <View style={[styles.pickerMenu, layout.id === 'landscape' ? styles.pickerMenuUp : styles.pickerMenuDown]}>
              {categories.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${c}`}
                  onPress={() => {
                    setCategory(c);
                    setPickerOpen(false);
                  }}
                  style={[styles.pickerItem, c === category && styles.pickerItemActive]}
                >
                  <Text style={[styles.pickerItemText, c === category && styles.pickerItemTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** One placed or binned part, drawn from its definition. */
function PartView({
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

const StaticScene = memo(function StaticScene({
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

function BoardLight({ at, color }: { at: Point; color: string }) {
  return (
    <G>
      <Circle cx={at.x} cy={at.y} r={6} fill="url(#smdGlow)" opacity={0.7} />
      <Rect x={at.x - 3} y={at.y - 1.8} width={6} height={3.6} rx={0.6} fill={color} />
    </G>
  );
}

/** Highlights the strips and holes a dragged item would connect to. */
function DropPreview({
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
        const topOf = holePoint(layout, { row: hole.row < 5 ? 0 : 5, col: hole.col });
        const at = holePoint(layout, hole);
        return (
          <G key={holeKey(hole)}>
            <Rect
              x={topOf.x - 4.6 * BB_SCALE}
              y={topOf.y - 4.6 * BB_SCALE}
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
function DragTag({ drag, layout, lab, state }: { drag: Drag | null; layout: CanvasLayout; lab: LabDef; state: RuntimeState }) {
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
  picker: {
    position: 'absolute',
    zIndex: 20,
  },
  pickerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pickerText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  pickerMenu: {
    position: 'absolute',
    left: 0,
    backgroundColor: colors.panel,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    minWidth: 128,
    overflow: 'hidden',
    zIndex: 21,
  },
  // The bin sits at the top of the canvas on phones and at the bottom on wide screens.
  pickerMenuDown: {
    top: 26,
  },
  pickerMenuUp: {
    bottom: 26,
  },
  pickerItem: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pickerItemActive: {
    backgroundColor: colors.teal,
  },
  pickerItemText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: '#FFFFFF',
  },
});
