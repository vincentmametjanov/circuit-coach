import { memo } from 'react';
import { Circle, G, Line, Path, Rect, Text } from 'react-native-svg';

import { BOARD_LEDS, BOARD_PINS, HEADER_STRIPS, type Point } from '../../lab/geometry';
import { fonts } from '../../theme';

const PCB = '#00878F';
const PCB_EDGE = '#00666C';
const TRACE = '#007A82';
const SILK = '#F2FBFB';
const METAL = '#C5CCCF';
const METAL_DARK = '#8E979B';
const GOLD = '#D8B24A';

const OUTLINE = 'M6 0 H258 L270 12 V198 L258 210 H6 Q0 210 0 204 V6 Q0 0 6 0 Z';

const TRACES = [
  'M40 92 H66 L76 102 H104',
  'M88 86 V62 L96 54',
  'M112 120 H150 L160 130',
  'M210 120 H236 L244 112 V96',
  'M30 118 V128 L40 138',
  'M200 44 L214 30',
  'M130 46 L140 30',
];

const LABEL_SIZE = 5.4;

/** A photo-realistic-enough top view of an Arduino Uno R3. Static, so memoized. */
export const ArduinoUno = memo(function ArduinoUno({ origin }: { origin: Point }) {
  return (
    <G transform={`translate(${origin.x} ${origin.y})`}>
      <Path d={OUTLINE} fill="#000" opacity={0.16} transform="translate(2.5 3.5)" />
      <Path d={OUTLINE} fill={PCB} stroke={PCB_EDGE} strokeWidth={1.4} />
      {TRACES.map((d) => (
        <Path key={d} d={d} stroke={TRACE} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      ))}

      {/* Mounting holes */}
      {[
        [58, 12],
        [55, 198],
        [262, 72],
        [263, 180],
      ].map(([cx, cy]) => (
        <G key={`${cx}-${cy}`}>
          <Circle cx={cx} cy={cy} r={5} fill={GOLD} />
          <Circle cx={cx} cy={cy} r={3.2} fill="#EEF3F3" />
        </G>
      ))}

      {/* USB-B connector */}
      <Rect x={-22} y={28} width={62} height={52} rx={2} fill={METAL} stroke={METAL_DARK} strokeWidth={1} />
      <Rect x={-22} y={36} width={12} height={36} fill="#5B6266" />
      <Rect x={-20} y={46} width={8} height={16} fill="#E8EAEA" />
      {[38, 48, 58, 68].map((y) => (
        <Line key={y} x1={0} y1={y} x2={36} y2={y} stroke={METAL_DARK} strokeWidth={0.6} opacity={0.6} />
      ))}

      {/* Barrel jack */}
      <Rect x={-8} y={136} width={54} height={42} rx={2} fill="#1E1F20" />
      <Rect x={-8} y={140} width={6} height={34} fill="#0D0D0D" />
      <Line x1={4} y1={142} x2={42} y2={142} stroke="#3A3C3E" strokeWidth={1} />
      <Line x1={4} y1={172} x2={42} y2={172} stroke="#3A3C3E" strokeWidth={1} />

      {/* Voltage regulator and capacitors */}
      <Rect x={56} y={126} width={12} height={4} fill={METAL} />
      <Rect x={54} y={130} width={16} height={12} rx={1} fill="#222" />
      {[64, 84].map((cx) => (
        <G key={cx}>
          <Circle cx={cx} cy={160} r={7} fill="#D5DADC" stroke={METAL_DARK} strokeWidth={0.8} />
          <Path d={`M${cx - 4} ${156} A 6 6 0 0 1 ${cx + 4} ${156}`} stroke="#33393B" strokeWidth={2} fill="none" />
        </G>
      ))}

      {/* Reset button */}
      <Rect x={44} y={24} width={16} height={16} rx={1.5} fill="#D5DADC" stroke={METAL_DARK} strokeWidth={0.6} />
      <Circle cx={52} cy={32} r={4.6} fill="#C0392B" />
      <Text x={52} y={48} fontSize={4.6} fill={SILK} textAnchor="middle" fontFamily={fonts.svg}>
        RESET
      </Text>

      {/* USB-to-serial chip and crystal */}
      <Rect x={58} y={58} width={20} height={20} rx={1} fill="#1A1A1A" />
      <Circle cx={61.5} cy={61.5} r={1} fill="#3A3A3A" />
      <Rect x={74} y={106} width={26} height={11} rx={5.5} fill="#D9DEE0" stroke={METAL_DARK} strokeWidth={0.6} />
      <Text x={87} y={113.4} fontSize={4} fill="#4E5B61" textAnchor="middle" fontFamily={fonts.svg}>
        16.000
      </Text>

      {/* ICSP header */}
      <Rect x={248} y={88} width={20} height={32} rx={1} fill="#1C1C1C" />
      {[94, 104, 114].map((y) =>
        [253, 263].map((x) => <Rect key={`${x}-${y}`} x={x - 2} y={y - 2} width={4} height={4} fill={GOLD} />),
      )}
      <Text x={258} y={128} fontSize={4.6} fill={SILK} textAnchor="middle" fontFamily={fonts.svg}>
        ICSP
      </Text>

      {/* ATmega328P in its socket */}
      <Rect x={110} y={131} width={148} height={38} rx={2} fill="#2A2A2A" />
      {Array.from({ length: 14 }, (_, i) => (
        <G key={i}>
          <Rect x={118 + i * 10} y={132} width={4} height={4} fill={METAL} />
          <Rect x={118 + i * 10} y={164} width={4} height={4} fill={METAL} />
        </G>
      ))}
      <Rect x={113} y={136} width={142} height={28} rx={1.5} fill="#141414" />
      <Path d="M113 145 A 5 5 0 0 1 113 155 Z" fill="#2A2A2A" />
      <Circle cx={120} cy={159} r={1.6} fill="#333" />
      <Text x={186} y={152.5} fontSize={6.5} fill="#6B7377" textAnchor="middle" fontFamily={fonts.svg} letterSpacing={0.8}>
        ATMEGA328P-PU
      </Text>

      {/* Board label */}
      <Text
        x={184}
        y={104}
        fontSize={30}
        fontWeight="800"
        fontStyle="italic"
        fill="#FFFFFF"
        textAnchor="middle"
        fontFamily={fonts.svg}
      >
        UNO
      </Text>
      <Text x={184} y={118} fontSize={7.5} fill={SILK} textAnchor="middle" fontFamily={fonts.svg} letterSpacing={2.4}>
        ARDUINO
      </Text>
      <Text x={166} y={46} fontSize={5.6} fill={SILK} textAnchor="middle" fontFamily={fonts.svg} letterSpacing={0.6}>
        DIGITAL (PWM ~)
      </Text>

      {/* Status LED pads (their glow is drawn by the workbench) */}
      {(['l', 'tx', 'rx', 'on'] as const).map((id) => {
        const { x, y } = BOARD_LEDS[id];
        return (
          <G key={id}>
            <Rect x={x - 3} y={y - 1.8} width={6} height={3.6} rx={0.6} fill="#E9E5CF" />
            <Text x={x - 5} y={y + 1.8} fontSize={4.8} fill={SILK} textAnchor="end" fontFamily={fonts.svg}>
              {id.toUpperCase()}
            </Text>
          </G>
        );
      })}

      {/* Female headers */}
      {HEADER_STRIPS.map(([first, last, y]) => (
        <Rect key={`${first}-${y}`} x={first - 5} y={y - 6} width={last - first + 10} height={12} rx={1} fill="#1B1B1B" />
      ))}
      {[...BOARD_PINS, { id: 'NC', x: 110, y: 200, label: '', header: 'bottom' as const }].map((pin) => (
        <G key={pin.id}>
          <Rect x={pin.x - 2.6} y={pin.y - 2.6} width={5.2} height={5.2} fill="#3D3D3D" />
          <Rect x={pin.x - 1.5} y={pin.y - 1.5} width={3} height={3} fill="#050505" />
          {pin.label ? <PinLabel x={pin.x} header={pin.header} text={pin.label} /> : null}
        </G>
      ))}
    </G>
  );
});

/** Vertical silkscreen label, like the ones printed beside the Uno's headers. */
function PinLabel({ x, header, text }: { x: number; header: 'top' | 'bottom'; text: string }) {
  const cx = x + LABEL_SIZE * 0.36;
  const cy = header === 'top' ? 19 : 191;
  return (
    <Text
      x={cx}
      y={cy}
      fontSize={LABEL_SIZE}
      fontWeight="600"
      fill={SILK}
      textAnchor={header === 'top' ? 'end' : 'start'}
      fontFamily={fonts.svg}
      transform={`rotate(-90 ${cx} ${cy})`}
    >
      {text}
    </Text>
  );
}
