import { Circle, Ellipse, G, Line, Path, Rect, Text } from 'react-native-svg';

import { BB_SCALE, type BoardPin, type Point } from '../../lab/geometry';
import { fonts } from '../../theme';

export type LedGlow = 'off' | 'dim' | 'on';

const LEAD = '#9AA3A7';

export function Resistor({ at, lifted = false, bands }: { at: Point; lifted?: boolean; bands?: [string, string, string, string] }) {
  const [a, b, c, d] = bands ?? ['#C0392B', '#C0392B', '#7B4A2A', '#C9A227'];
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={18} ry={3} fill="#000" opacity={0.15} /> : null}
      <Line x1={-15} y1={0} x2={15} y2={0} stroke={LEAD} strokeWidth={1.4} strokeLinecap="round" />
      <Rect x={-9} y={-3.8} width={18} height={7.6} rx={3.6} fill="#E3C99B" stroke="#C2A77A" strokeWidth={0.6} />
      <Rect x={-6.4} y={-3.7} width={1.9} height={7.4} fill={a} />
      <Rect x={-2.8} y={-3.7} width={1.9} height={7.4} fill={b} />
      <Rect x={0.8} y={-3.7} width={1.9} height={7.4} fill={c} />
      <Rect x={5} y={-3.7} width={1.9} height={7.4} fill={d} />
      <Rect x={-8} y={-3} width={16} height={1.6} rx={0.8} fill="#FFFFFF" opacity={0.35} />
      <Circle cx={-15} cy={0} r={1.5} fill="#6F787C" />
      <Circle cx={15} cy={0} r={1.5} fill="#6F787C" />
    </G>
  );
}

/**
 * A 10 kΩ potentiometer seen from above: round body, three legs into the
 * holes, and a knob whose pointer turns with the set value (0–1).
 */
export function Pot({ at, value = 0.5, lifted = false }: { at: Point; value?: number; lifted?: boolean }) {
  const angle = -135 + value * 270;
  const rad = (angle * Math.PI) / 180;
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={16} ry={3} fill="#000" opacity={0.15} /> : null}
      {[-14, 0, 14].map((dx) => (
        <Line key={dx} x1={dx} y1={-2} x2={dx} y2={2} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      ))}
      <Circle cx={0} cy={-12} r={13} fill="#2471A3" stroke="#1A5276" strokeWidth={1} />
      <Circle cx={0} cy={-12} r={9.5} fill="#D6DBDF" stroke="#AAB4BA" strokeWidth={0.6} />
      <Line
        x1={0}
        y1={-12}
        x2={Math.sin(rad) * 8}
        y2={-12 - Math.cos(rad) * 8}
        stroke="#1B4F72"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <Circle cx={0} cy={-12} r={2} fill="#1B4F72" />
    </G>
  );
}

/** 10 kΩ: brown, black, orange, gold. */
export const BANDS_10K: [string, string, string, string] = ['#7B4A2A', '#2D3436', '#E67E22', '#C9A227'];

/**
 * A 6 mm tactile pushbutton seen from above: square body, round plunger that
 * sinks while pressed. Its four legs drop into the holes around it.
 */
export function Pushbutton({ at, pressed = false, lifted = false }: { at: Point; pressed?: boolean; lifted?: boolean }) {
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={10} rx={16} ry={3} fill="#000" opacity={0.15} /> : null}
      {/* Four legs into the holes. */}
      {[-11, 11].map((dx) =>
        [-16, 16].map((dy) => (
          <Line key={`${dx}:${dy}`} x1={dx} y1={dy * 0.55} x2={dx} y2={dy} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
        )),
      )}
      <Rect x={-13} y={-11} width={26} height={22} rx={2.4} fill="#2D3436" stroke="#1B1F20" strokeWidth={0.8} />
      <Rect x={-11} y={-9} width={22} height={4} rx={2} fill="#3F4A4E" />
      <Circle cx={0} cy={0} r={6.6} fill={pressed ? '#5A4416' : '#B8860B'} stroke="#8A6508" strokeWidth={0.8} />
      <Circle cx={0} cy={pressed ? 0.8 : 0} r={4.6} fill={pressed ? '#8A6508' : '#E5A812'} />
      {pressed ? <Circle cx={0} cy={0.8} r={4.6} fill="#000" opacity={0.18} /> : null}
    </G>
  );
}

export type LedColor = 'red' | 'green' | 'yellow';

const LED_PALETTE: Record<LedColor, { dome: string; domeLit: string; rim: string; glow: string }> = {
  red: { dome: '#D63A2F', domeLit: '#FF4B39', rim: '#A82A20', glow: 'url(#ledGlow)' },
  green: { dome: '#27AE60', domeLit: '#3BE36B', rim: '#1E8449', glow: 'url(#ledGlowGreen)' },
  yellow: { dome: '#B7950B', domeLit: '#F4D03F', rim: '#9A7D0A', glow: 'url(#ledGlowYellow)' },
};

/**
 * A 5 mm LED seen from above and slightly in front. The legs go into the holes
 * at x = ±5; the dome sits above them. The flat edge of the rim marks the − leg.
 */
export function Led({
  at,
  flipped,
  glow,
  burnt,
  lifted = false,
  color = 'red',
}: {
  at: Point;
  flipped: boolean;
  glow: LedGlow;
  burnt: boolean;
  lifted?: boolean;
  color?: LedColor;
}) {
  const palette = LED_PALETTE[color];
  const dome = burnt ? '#5C3B35' : glow === 'off' ? palette.dome : palette.domeLit;
  const anodeX = flipped ? 5 : -5;
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={12} ry={3} fill="#000" opacity={0.15} /> : null}
      {glow !== 'off' && !burnt ? (
        <Circle cx={0} cy={-14} r={glow === 'on' ? 26 : 15} fill={palette.glow} opacity={glow === 'on' ? 1 : 0.55} />
      ) : null}
      <G transform={flipped ? 'scale(-1 1)' : undefined}>
        {/* Anode (+) is the longer, bent leg on the left; cathode (−) is straight. */}
        <Path d="M-5 0 V-4 L-2.4 -7 V-10" stroke={LEAD} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        <Path d="M5 0 V-10" stroke={LEAD} strokeWidth={1.3} fill="none" strokeLinecap="round" />
        <Path d="M 6.6 -19 A 8 8 0 1 0 6.6 -9 Z" fill={dome} stroke={burnt ? '#3B2420' : palette.rim} strokeWidth={0.8} />
        <Path d="M 6.6 -19 V -9" stroke="#7E1F18" strokeWidth={1.2} />
        {!burnt && glow === 'off' ? <Ellipse cx={-2.6} cy={-17.2} rx={2.4} ry={1.5} fill="#FFFFFF" opacity={0.45} /> : null}
        {glow !== 'off' && !burnt ? <Circle cx={0} cy={-14} r={4.5} fill="#FFD9CC" opacity={glow === 'on' ? 0.8 : 0.45} /> : null}
      </G>
      {burnt ? (
        <G>
          <Path d="M-3 -18 L0 -14 L-1 -11 M1 -16 L3 -13" stroke="#1F1412" strokeWidth={0.8} fill="none" />
          <Circle cx={-3} cy={-27} r={3} fill="#8A8F91" opacity={0.35} />
          <Circle cx={1} cy={-31} r={4} fill="#8A8F91" opacity={0.25} />
        </G>
      ) : null}
      <Circle cx={-5} cy={0} r={1.5} fill="#6F787C" />
      <Circle cx={5} cy={0} r={1.5} fill="#6F787C" />
      <Text x={anodeX * 1.9} y={5.5} fontSize={7} fontWeight="700" fill="#C0392B" textAnchor="middle" fontFamily={fonts.svg}>
        +
      </Text>
      <Text x={-anodeX * 1.9} y={5.5} fontSize={7} fontWeight="700" fill="#2D3436" textAnchor="middle" fontFamily={fonts.svg}>
        −
      </Text>
    </G>
  );
}

export function wireColor(pin: BoardPin) {
  switch (pin.kind) {
    case 'ground':
      return '#2D3436';
    case 'power':
      return pin.node === '3V3' ? '#E67E22' : '#E74C3C';
    case 'digital':
      return '#F39C12';
    case 'analog':
      return '#27AE60';
    default:
      return '#8E44AD';
  }
}

function wirePath(a: Point, b: Point) {
  const dx = b.x - a.x;
  const lift = Math.min(60, 16 + Math.hypot(dx, b.y - a.y) * 0.28);
  const c1 = { x: a.x + dx * 0.08, y: a.y - lift };
  const c2 = { x: b.x - dx * 0.08, y: b.y < a.y - 20 ? b.y + lift * 0.6 : b.y - lift };
  return `M${a.x} ${a.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
}

/** A jumper wire from a header pin to a breadboard hole (or to the pointer while dragging). */
export function JumperWire({ from, to, color, faded = false }: { from: Point; to: Point; color: string; faded?: boolean }) {
  const d = wirePath(from, to);
  return (
    <G opacity={faded ? 0.75 : 1}>
      <Path d={d} stroke="#000" strokeOpacity={0.22} strokeWidth={4.6} fill="none" strokeLinecap="round" transform="translate(0.8 1.4)" />
      <Path d={d} stroke={color} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      <Path d={d} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      {[from, to].map((p, i) => (
        <Rect key={i} x={p.x - 2.4} y={p.y - 3.4} width={4.8} height={6.8} rx={1} fill="#1E1E1E" stroke={color} strokeWidth={0.8} />
      ))}
    </G>
  );
}

/** Jumper wire color before its first end reaches a pin. */
export const LOOSE_WIRE = '#3D8BD3';

/** A small bundle of jumper wires, drawn in the parts bin. */
export function BinJumpers({ at }: { at: Point }) {
  const wires = [
    { color: '#E74C3C', dy: -8 },
    { color: '#2D3436', dy: 0 },
    { color: '#F39C12', dy: 8 },
  ];
  return (
    <G transform={`translate(${at.x} ${at.y})`}>
      {wires.map(({ color, dy }) => {
        const d = `M-16 ${dy + 3} C-8 ${dy - 9} 8 ${dy + 9} 16 ${dy - 3}`;
        return (
          <G key={color}>
            <Path d={d} stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" />
            <Rect x={-18.4} y={dy + 0.2} width={4.8} height={5.6} rx={1} fill="#1E1E1E" />
            <Rect x={13.6} y={dy - 5.8} width={4.8} height={5.6} rx={1} fill="#1E1E1E" />
          </G>
        );
      })}
    </G>
  );
}

/** Dashed ring that marks a jumper's loose end, waiting to be plugged in. */
export function LooseEnd({ at }: { at: Point }) {
  return <Circle cx={at.x} cy={at.y} r={7} fill="none" stroke={LOOSE_WIRE} strokeWidth={1.2} strokeDasharray="2.5 2" />;
}

/** Small rounded label used for drag feedback. */
export function Tag({ at, text, tone }: { at: Point; text: string; tone: string }) {
  const width = 8 + text.length * 4.1;
  return (
    <G>
      <Rect x={at.x - width / 2} y={at.y - 6} width={width} height={12} rx={6} fill={tone} />
      <Text x={at.x} y={at.y + 2.4} fontSize={7} fontWeight="700" fill="#FFFFFF" textAnchor="middle" fontFamily={fonts.svg}>
        {text}
      </Text>
    </G>
  );
}
