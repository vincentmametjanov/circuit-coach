import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Pattern, RadialGradient, Stop } from 'react-native-svg';

import {
  BB_SCALE,
  BIN_JUMPER_BOX,
  BOARD_LEDS,
  BOARD_SIZE,
  BREADBOARD,
  type Hole,
  PIN_BY_ID,
  BIN_PART_SCALE,
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
  type CanvasLayout,
  type Point,
} from '../../lab/geometry';
import type { LabDef } from '../../lab/lab';
import { PART_DEFS, binGroups } from '../../lab/parts';
import type { RuntimeAction, RuntimeState } from '../../lab/runtime';
import type { ComponentId } from '../../lab/components';
import { colors } from '../../theme';
import { BinPicker } from './BinPicker';
import { DragHandle, webNoSelect } from './DragHandle';
import { type Drag, anchorFor, breadboardWireColor, defOf, displayName, loosePoint, occupancy, partDrop } from './dragging';
import { BoardLight, DragTag, DropPreview, PartView, StaticScene } from './overlays';
import { JumperWire, LOOSE_WIRE, type LedGlow, LooseEnd, wireColor } from './Parts';

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

const TAP_SLOP = 4;

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
  const { binSlots, sceneLayout } = useMemo(() => {
    const points = binSlotPoints(layout, groups.length);
    return {
      binSlots: groups.map((g, i) => ({ key: g.key, label: g.label, ids: g.ids, ...points.slots[i] })),
      // The jumper bundle takes the bin's last slot.
      sceneLayout: { ...layout, binJumper: points.jumper },
    };
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

        <StaticScene layout={sceneLayout} slots={binSlots} binTitle={categories.length > 0 && category ? category : undefined} />

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
          .map(({ spec, center }) =>
            state.parts[spec.id] ? (
              <PartView key={spec.id} spec={spec} at={center} state={state} glow={ledGlow[spec.id] ?? 'off'} level={ledLevels?.[spec.id]} />
            ) : (
              // Waiting in the bin: drawn smaller so a full bin stays readable.
              <G key={spec.id} transform={`translate(${center.x} ${center.y}) scale(${BIN_PART_SCALE}) translate(${-center.x} ${-center.y})`}>
                <PartView spec={spec} at={center} state={state} glow="off" />
              </G>
            ),
          )}

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
          sceneLayout.binJumper.x + BIN_JUMPER_BOX.left,
          sceneLayout.binJumper.y + BIN_JUMPER_BOX.top,
          BIN_JUMPER_BOX.right - BIN_JUMPER_BOX.left,
          BIN_JUMPER_BOX.bottom - BIN_JUMPER_BOX.top,
        )}
        onStart={() => startDrag({ kind: 'binWire', origin: sceneLayout.binJumper, at: sceneLayout.binJumper })}
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
            style={(() => {
              const k = placed ? 1 : BIN_PART_SCALE;
              return frame(home.x + box.left * k, home.y + box.top * k, (box.right - box.left) * k, (box.bottom - box.top) * k);
            })()}
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

      {categories.length > 1 && category ? (
        <BinPicker
          layout={layout}
          scale={scale}
          categories={categories}
          category={category}
          onChange={setCategory}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        />
      ) : null}
    </View>
  );
}

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
