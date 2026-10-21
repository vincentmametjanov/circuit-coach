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
  level,
}: {
  at: Point;
  flipped: boolean;
  glow: LedGlow;
  burnt: boolean;
  lifted?: boolean;
  color?: LedColor;
  /** PWM brightness 0–1; when set, overrides the on/dim/off glow. */
  level?: number;
}) {
  const palette = LED_PALETTE[color];
  const lit = level !== undefined ? level > 0.12 && !burnt : glow !== 'off' && !burnt;
  const dome = burnt ? '#5C3B35' : lit ? palette.domeLit : palette.dome;
  const radius = level !== undefined ? 6 + level * 20 : glow === 'on' ? 26 : 15;
  const opacity = level !== undefined ? 0.2 + level * 0.8 : glow === 'on' ? 1 : 0.55;
  const anodeX = flipped ? 5 : -5;
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={12} ry={3} fill="#000" opacity={0.15} /> : null}
      {lit ? <Circle cx={0} cy={-14} r={radius} fill={palette.glow} opacity={opacity} /> : null}
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

/** An RGB LED (common cathode): four legs R, −, G, B and one dome that mixes the channel levels (each 0–1). */
export function RgbLed({ at, levels, lifted = false }: { at: Point; levels?: { r: number; g: number; b: number }; lifted?: boolean }) {
  const { r, g, b } = levels ?? { r: 0, g: 0, b: 0 };
  const on = r > 0.06 || g > 0.06 || b > 0.06;
  const mix = (base: number, channel: number) => Math.round(base + (255 - base) * Math.min(1, channel));
  const domeColor = on ? `rgb(${mix(40, r)},${mix(40, g)},${mix(60, b)})` : '#C8D2D6';
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={16} ry={3} fill="#000" opacity={0.15} /> : null}
      {on ? <Circle cx={0} cy={-14} r={24} fill={domeColor} opacity={0.45} /> : null}
      {[-15, -5, 5, 15].map((dx) => (
        <Line key={dx} x1={dx} y1={0} x2={dx} y2={-8} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      ))}
      <Path d="M 7 -25 A 9 9 0 1 0 7 -7 Z" fill={domeColor} stroke="#8E9BA1" strokeWidth={0.8} opacity={on ? 1 : 0.9} />
      <Path d="M 7 -25 V -7" stroke="#8E9BA1" strokeWidth={1.1} />
      {[-15, -5, 5, 15].map((dx) => (
        <Circle key={dx} cx={dx} cy={0} r={1.5} fill="#6F787C" />
      ))}
      <Text x={-15} y={6} fontSize={6} fontWeight="700" fill="#C0392B" textAnchor="middle" fontFamily={fonts.svg}>R</Text>
      <Text x={-5} y={6} fontSize={6} fontWeight="700" fill="#2D3436" textAnchor="middle" fontFamily={fonts.svg}>−</Text>
      <Text x={5} y={6} fontSize={6} fontWeight="700" fill="#1E8449" textAnchor="middle" fontFamily={fonts.svg}>G</Text>
      <Text x={15} y={6} fontSize={6} fontWeight="700" fill="#2471A3" textAnchor="middle" fontFamily={fonts.svg}>B</Text>
    </G>
  );
}

/** A photoresistor seen from above: a disc with the zigzag track, shaded while a box blocks the beam. */
export function Ldr({ at, blocked = false, lifted = false }: { at: Point; blocked?: boolean; lifted?: boolean }) {
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={16} ry={3} fill="#000" opacity={0.15} /> : null}
      <Line x1={-15} y1={0} x2={-8} y2={-6} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={15} y1={0} x2={8} y2={-6} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={0} cy={-8} r={9.5} fill={blocked ? '#5D4A2F' : '#C68A3C'} stroke="#8A5A22" strokeWidth={0.8} />
      <Path d="M-5.5 -11 L-2.5 -5.5 L0.5 -11 L3.5 -5.5 L6 -10" stroke="#F5D6A0" strokeWidth={1} fill="none" strokeLinecap="round" />
      {blocked ? <Circle cx={0} cy={-8} r={9.5} fill="#1B1F20" opacity={0.45} /> : null}
      <Circle cx={-15} cy={0} r={1.5} fill="#6F787C" />
      <Circle cx={15} cy={0} r={1.5} fill="#6F787C" />
    </G>
  );
}

/** A TMP36 temperature sensor: black TO-92 body, flat face forward, legs +VS, VOUT, GND. */
export function Tmp36({ at, lifted = false }: { at: Point; lifted?: boolean }) {
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={16} ry={3} fill="#000" opacity={0.15} /> : null}
      {[-14, 0, 14].map((dx) => (
        <Line key={dx} x1={dx} y1={0} x2={dx} y2={-6} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      ))}
      <Path d="M -10 -6 L -10 -14 A 10 10 0 0 1 10 -14 L 10 -6 Z" fill="#2D3436" stroke="#1B1F20" strokeWidth={0.8} />
      <Rect x={-10} y={-10} width={20} height={2.4} fill="#3F4A4E" />
      <Text x={0} y={-16} fontSize={5.4} fontWeight="700" fill="#7F8C8D" textAnchor="middle" fontFamily={fonts.svg}>
        TMP36
      </Text>
      <Text x={-14} y={5.5} fontSize={6} fontWeight="700" fill="#C0392B" textAnchor="middle" fontFamily={fonts.svg}>+</Text>
      <Text x={0} y={5.5} fontSize={5.4} fontWeight="700" fill="#7F8C8D" textAnchor="middle" fontFamily={fonts.svg}>out</Text>
      <Text x={14} y={5.5} fontSize={6} fontWeight="700" fill="#2D3436" textAnchor="middle" fontFamily={fonts.svg}>−</Text>
    </G>
  );
}

/** A piezo buzzer: dark cylinder with a + mark; sound arcs while it beeps. */
export function Buzzer({ at, flipped, beep = false, lifted = false }: { at: Point; flipped: boolean; beep?: boolean; lifted?: boolean }) {
  const plusX = flipped ? 10 : -10;
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={14} ry={3} fill="#000" opacity={0.15} /> : null}
      {beep ? (
        <G stroke="#5A8AC0" strokeWidth={1.2} fill="none" strokeLinecap="round">
          <Path d="M 8 -18 A 12 12 0 0 1 8 2" />
          <Path d="M 12 -22 A 19 19 0 0 1 12 6" opacity={0.6} />
        </G>
      ) : null}
      <Line x1={-10} y1={0} x2={-10} y2={-4} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={10} y1={0} x2={10} y2={-4} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      <Circle cx={0} cy={-8} r={11} fill="#2D3436" stroke="#1B1F20" strokeWidth={0.8} />
      <Circle cx={0} cy={-8} r={3.2} fill="#10141A" />
      <Circle cx={-10} cy={0} r={1.5} fill="#6F787C" />
      <Circle cx={10} cy={0} r={1.5} fill="#6F787C" />
      <Text x={plusX} y={6} fontSize={7} fontWeight="700" fill="#C0392B" textAnchor="middle" fontFamily={fonts.svg}>
        +
      </Text>
    </G>
  );
}

/** A hobby servo: body, mounting ears, and a horn that turns to `angle` degrees (0–180). */
export function Servo({ at, angle = 0, lifted = false }: { at: Point; angle?: number; lifted?: boolean }) {
  const rad = ((-90 + angle - 90) * Math.PI) / 180;
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={20} ry={3} fill="#000" opacity={0.15} /> : null}
      {[-14, 0, 14].map((dx) => (
        <Line key={dx} x1={dx} y1={0} x2={dx} y2={-3} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      ))}
      <Rect x={-19} y={-16} width={38} height={14} rx={2} fill="#1F618D" stroke="#154360" strokeWidth={0.8} />
      <Rect x={-24} y={-9} width={48} height={4} rx={1.6} fill="#1A5276" />
      <Circle cx={0} cy={-18} r={5.5} fill="#D6DBDF" stroke="#AAB4BA" strokeWidth={0.7} />
      <Line
        x1={0}
        y1={-18}
        x2={Math.sin(rad) * 13}
        y2={-18 - Math.cos(rad) * 13}
        stroke="#FDFEFE"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Circle cx={0} cy={-18} r={2} fill="#839192" />
      <Text x={-14} y={5.5} fontSize={5.4} fontWeight="700" fill="#5D4037" textAnchor="middle" fontFamily={fonts.svg}>gnd</Text>
      <Text x={0} y={5.5} fontSize={6} fontWeight="700" fill="#C0392B" textAnchor="middle" fontFamily={fonts.svg}>5V</Text>
      <Text x={14} y={5.5} fontSize={5.4} fontWeight="700" fill="#B9770E" textAnchor="middle" fontFamily={fonts.svg}>sig</Text>
    </G>
  );
}

/** A small DC motor: can body and shaft, with motion arcs while it spins. */
export function Motor({ at, spinning = false, lifted = false }: { at: Point; spinning?: boolean; lifted?: boolean }) {
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={18} ry={3} fill="#000" opacity={0.15} /> : null}
      <Line x1={-15} y1={0} x2={-9} y2={-5} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={15} y1={0} x2={9} y2={-5} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      <Rect x={-12} y={-16} width={24} height={13} rx={5} fill="#AAB4BA" stroke="#7F8C8D" strokeWidth={0.8} />
      <Rect x={12} y={-12} width={5} height={5} rx={1} fill="#7F8C8D" />
      <Circle cx={-3} cy={-9.5} r={3.4} fill="#5D6D7E" />
      {spinning ? (
        <G stroke="#5A8AC0" strokeWidth={1.2} fill="none" strokeLinecap="round">
          <Path d="M -22 -16 A 9 9 0 0 1 -22 -2" />
          <Path d="M -26 -19 A 13 13 0 0 1 -26 1" opacity={0.6} />
        </G>
      ) : null}
      <Circle cx={-15} cy={0} r={1.5} fill="#6F787C" />
      <Circle cx={15} cy={0} r={1.5} fill="#6F787C" />
    </G>
  );
}

/** A PN2222 transistor (TO-92): flat face forward, legs emitter, base, collector. */
export function Transistor({ at, lifted = false }: { at: Point; lifted?: boolean }) {
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={16} ry={3} fill="#000" opacity={0.15} /> : null}
      {[-14, 0, 14].map((dx) => (
        <Line key={dx} x1={dx} y1={0} x2={dx} y2={-7} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      ))}
      <Path d="M -9 -7 L -9 -15 A 9 9 0 0 1 9 -15 L 9 -7 Z" fill="#1B1F20" stroke="#000" strokeWidth={0.8} />
      <Text x={0} y={-17} fontSize={5.4} fontWeight="700" fill="#5D6D7E" textAnchor="middle" fontFamily={fonts.svg}>
        PN2222
      </Text>
      <Text x={-14} y={5.5} fontSize={5.4} fontWeight="700" fill="#7F8C8D" textAnchor="middle" fontFamily={fonts.svg}>E</Text>
      <Text x={0} y={5.5} fontSize={5.4} fontWeight="700" fill="#B9770E" textAnchor="middle" fontFamily={fonts.svg}>B</Text>
      <Text x={14} y={5.5} fontSize={5.4} fontWeight="700" fill="#7F8C8D" textAnchor="middle" fontFamily={fonts.svg}>C</Text>
    </G>
  );
}

/** A 1N4007 diode: dark body, silver band on the cathode (−) end. */
export function Diode({ at, flipped, lifted = false }: { at: Point; flipped: boolean; lifted?: boolean }) {
  const bandX = flipped ? -6.4 : 4.6;
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={18} ry={3} fill="#000" opacity={0.15} /> : null}
      <Line x1={-15} y1={0} x2={15} y2={0} stroke={LEAD} strokeWidth={1.4} strokeLinecap="round" />
      <Rect x={-8} y={-3.2} width={16} height={6.4} rx={3} fill="#2D3436" stroke="#1B1F20" strokeWidth={0.6} />
      <Rect x={bandX} y={-3.1} width={2.6} height={6.2} fill="#D6DBDF" />
      <Circle cx={-15} cy={0} r={1.5} fill="#6F787C" />
      <Circle cx={15} cy={0} r={1.5} fill="#6F787C" />
    </G>
  );
}

/** A 9 V battery with snap leads: leg 0 is + (red), leg 1 is − (black). */
export function Battery({ at, flipped, lifted = false }: { at: Point; flipped: boolean; lifted?: boolean }) {
  const plusX = flipped ? 20 : -20;
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={22} ry={3} fill="#000" opacity={0.15} /> : null}
      <Line x1={-20} y1={0} x2={-13} y2={-8} stroke="#C0392B" strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={20} y1={0} x2={13} y2={-8} stroke="#2D3436" strokeWidth={1.6} strokeLinecap="round" />
      <Rect x={-13} y={-20} width={26} height={16} rx={2.4} fill="#1B4F72" stroke="#154360" strokeWidth={0.8} />
      <Rect x={-13} y={-20} width={26} height={4.5} rx={2.2} fill="#C0392B" />
      <Text x={0} y={-7.4} fontSize={6.4} fontWeight="700" fill="#FDFEFE" textAnchor="middle" fontFamily={fonts.svg}>
        9V
      </Text>
      <Circle cx={-20} cy={0} r={1.5} fill="#6F787C" />
      <Circle cx={20} cy={0} r={1.5} fill="#6F787C" />
      <Text x={plusX} y={6} fontSize={7} fontWeight="700" fill="#C0392B" textAnchor="middle" fontFamily={fonts.svg}>
        +
      </Text>
      <Text x={-plusX} y={6} fontSize={7} fontWeight="700" fill="#2D3436" textAnchor="middle" fontFamily={fonts.svg}>
        −
      </Text>
    </G>
  );
}

/** A stepper motor with a simplified 3-wire driver: step, direction, ground. */
export function Stepper({ at, lifted = false }: { at: Point; lifted?: boolean }) {
  return (
    <G transform={`translate(${at.x} ${at.y}) scale(${BB_SCALE})`}>
      {lifted ? <Ellipse cx={1} cy={6} rx={20} ry={3} fill="#000" opacity={0.15} /> : null}
      {[-14, 0, 14].map((dx) => (
        <Line key={dx} x1={dx} y1={0} x2={dx} y2={-4} stroke={LEAD} strokeWidth={1.3} strokeLinecap="round" />
      ))}
      <Rect x={-15} y={-18} width={30} height={15} rx={2.4} fill="#6E2C00" stroke="#4E1F00" strokeWidth={0.8} />
      <Circle cx={0} cy={-10.5} r={5} fill="#D6DBDF" stroke="#AAB4BA" strokeWidth={0.7} />
      <Line x1={0} y1={-10.5} x2={3.4} y2={-13.4} stroke="#5D6D7E" strokeWidth={1.6} strokeLinecap="round" />
      <Text x={-14} y={5.5} fontSize={5} fontWeight="700" fill="#B9770E" textAnchor="middle" fontFamily={fonts.svg}>step</Text>
      <Text x={0} y={5.5} fontSize={5} fontWeight="700" fill="#2471A3" textAnchor="middle" fontFamily={fonts.svg}>dir</Text>
      <Text x={14} y={5.5} fontSize={5.4} fontWeight="700" fill="#2D3436" textAnchor="middle" fontFamily={fonts.svg}>gnd</Text>
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
