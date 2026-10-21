import { memo } from 'react';
import { G, Rect, Text } from 'react-native-svg';

import { BB_SCALE, BREADBOARD, type CanvasLayout, PITCH, RAIL_BOTTOM_Y, RAIL_TOP_Y, ROW_LETTERS, type Point } from '../../lab/geometry';
import { fonts } from '../../theme';

const { cols, firstColX, rowY, width, height } = BREADBOARD;
const colX = (col: number) => firstColX + col * PITCH;

/** A 170-point mini breadboard. Static, so memoized. */
export const Breadboard = memo(function Breadboard({ origin }: { origin: Point }) {
  const columns = Array.from({ length: cols }, (_, col) => col);
  return (
    <G transform={`translate(${origin.x} ${origin.y}) scale(${BB_SCALE})`}>
      <Rect x={2.5} y={3.5} width={width} height={height} rx={6} fill="#000" opacity={0.12} />
      <Rect x={0} y={0} width={width} height={height} rx={6} fill="#F8F6F0" stroke="#D9D3C4" strokeWidth={1} />
      <Rect x={5} y={69} width={width - 10} height={6} rx={2} fill="#E3DED0" />

      {/* Power rails: every hole in the red (+) or blue (−) row is connected. */}
      {(
        [
          { y: RAIL_TOP_Y, color: '#C0392B', sign: '+' },
          { y: RAIL_BOTTOM_Y, color: '#2471A3', sign: '−' },
        ] as const
      ).map((rail) => (
        <G key={rail.sign}>
          <Rect x={colX(0) - 4} y={rail.y - 2.4} width={colX(cols - 1) - colX(0) + 8} height={4.8} rx={2.4} fill="#EFEBE1" />
          {columns.map((col) => (
            <Rect key={col} x={colX(col) - 1.9} y={rail.y - 1.9} width={3.8} height={3.8} rx={0.6} fill="#4A4744" />
          ))}
          <Rect x={colX(0) - 4} y={rail.y + (rail.sign === '+' ? 3.6 : -5.6)} width={colX(cols - 1) - colX(0) + 8} height={2} fill={rail.color} />
          <Text x={8} y={rail.y + 2.2} fontSize={6} fontWeight="700" fill={rail.color} textAnchor="middle" fontFamily={fonts.svg}>
            {rail.sign}
          </Text>
        </G>
      ))}

      {/* Faint strip outlines: each column of five holes is connected underneath. */}
      {columns.map((col) => (
        <G key={`strip-${col}`}>
          <Rect x={colX(col) - 3.4} y={rowY[0] - 4.2} width={6.8} height={48.4} rx={3.4} fill="#EFEBE1" />
          <Rect x={colX(col) - 3.4} y={rowY[5] - 4.2} width={6.8} height={48.4} rx={3.4} fill="#EFEBE1" />
        </G>
      ))}

      {columns.map((col) =>
        rowY.map((y) => (
          <Rect
            key={`${col}-${y}`}
            x={colX(col) - 2.1}
            y={y - 2.1}
            width={4.2}
            height={4.2}
            rx={0.7}
            fill="#4A4744"
          />
        )),
      )}

      {columns.map((col) => (
        <G key={`num-${col}`}>
          <Text x={colX(col)} y={12} fontSize={5} fill="#8C8577" textAnchor="middle" fontFamily={fonts.svg}>
            {col + 1}
          </Text>
          <Text x={colX(col)} y={133.5} fontSize={5} fill="#8C8577" textAnchor="middle" fontFamily={fonts.svg}>
            {col + 1}
          </Text>
        </G>
      ))}
      {rowY.map((y, row) => (
        <G key={`row-${row}`}>
          <Text x={9} y={y + 1.8} fontSize={5} fill="#8C8577" textAnchor="middle" fontFamily={fonts.svg}>
            {ROW_LETTERS[row]}
          </Text>
          <Text x={width - 9} y={y + 1.8} fontSize={5} fill="#8C8577" textAnchor="middle" fontFamily={fonts.svg}>
            {ROW_LETTERS[row]}
          </Text>
        </G>
      ))}
    </G>
  );
});

/** Tray that holds parts that are not on the breadboard. */
export const PartsBin = memo(function PartsBin({
  layout,
  slots,
  title,
}: {
  layout: CanvasLayout;
  /** One entry per bin slot: its label and where it sits. */
  slots: { key: string; label: string; labelY: number; at: Point }[];
  /** Category name when the bin is filtered (free play). */
  title?: string;
}) {
  const { bin, binJumper } = layout;
  return (
    <G>
      <Rect
        x={bin.x}
        y={bin.y}
        width={bin.width}
        height={bin.height}
        rx={8}
        fill="#FFFFFF"
        fillOpacity={0.7}
        stroke="#9FB8B9"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <Text x={bin.x + 10} y={bin.y + 13} fontSize={6.5} fontWeight="700" fill="#5B7173" letterSpacing={1.2} fontFamily={fonts.svg}>
        {title ? `PARTS BIN · ${title.toUpperCase()}` : 'PARTS BIN'}
      </Text>
      {slots.map((slot) => (
        <Text key={slot.key} x={slot.at.x} y={slot.labelY} fontSize={6} fill="#5B7173" textAnchor="middle" fontFamily={fonts.svg}>
          {slot.label}
        </Text>
      ))}
      <Text x={binJumper.x} y={binJumper.y + 24} fontSize={6} fill="#5B7173" textAnchor="middle" fontFamily={fonts.svg}>
        Jumper wires
      </Text>
      <Text x={bin.x + 10} y={bin.y + bin.height - 7} fontSize={5.6} fill="#7F8C8D" fontFamily={fonts.svg}>
        Drag a part onto the breadboard · tap any part to learn what it is
      </Text>
    </G>
  );
});
