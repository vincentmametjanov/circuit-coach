import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'verify' | 'upload' | 'reset' | 'guide' | 'board' | 'file' | 'usb' | 'clear' | 'check';

type Props = { name: IconName; size?: number; color: string };

/** Line icons in the style of the Arduino IDE toolbar and activity bar. */
export function Icon({ name, size = 20, color }: Props) {
  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'verify' || name === 'check' ? <Path d="M5 12.5l4.5 4.5L19 7.5" {...stroke} strokeWidth={name === 'verify' ? 2.8 : 2.4} /> : null}
      {name === 'upload' ? <Path d="M4.5 12h14M12.5 6l6 6-6 6" {...stroke} strokeWidth={2.8} /> : null}
      {name === 'reset' ? <Path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5" {...stroke} /> : null}
      {name === 'guide' ? (
        <>
          <Path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5C4.7 20 4 19.3 4 18.5z" {...stroke} strokeWidth={1.8} />
          <Path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z" {...stroke} strokeWidth={1.8} />
        </>
      ) : null}
      {name === 'board' ? (
        <>
          <Rect x={4} y={6} width={16} height={12} rx={2} {...stroke} strokeWidth={1.8} />
          <Path d="M8 3v3M12 3v3M16 3v3M8 18v3M12 18v3M16 18v3" {...stroke} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={2} fill={color} />
        </>
      ) : null}
      {name === 'file' ? (
        <>
          <Path d="M6 3h8l4 4v14H6z" {...stroke} strokeWidth={1.8} />
          <Path d="M14 3v4h4M9 12h6M9 16h6" {...stroke} strokeWidth={1.8} />
        </>
      ) : null}
      {name === 'usb' ? (
        <>
          <Path d="M12 3v14M8 7l4-4 4 4M7 11v2l5 3M17 10v3l-5 3" {...stroke} strokeWidth={1.8} />
          <Circle cx={12} cy={19} r={2} fill={color} />
        </>
      ) : null}
      {name === 'clear' ? <Path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" {...stroke} strokeWidth={1.8} /> : null}
    </Svg>
  );
}
