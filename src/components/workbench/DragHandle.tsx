import { useRef } from 'react';
import { type GestureResponderEvent, Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import type { Point } from '../../lab/geometry';

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
export function DragHandle({ label, style, onStart, onMove, onEnd }: DragHandleProps) {
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

export const webGrab = Platform.OS === 'web' ? ({ cursor: 'grab', touchAction: 'none' } as object as ViewStyle) : null;
export const webNoSelect = Platform.OS === 'web' ? ({ userSelect: 'none' } as ViewStyle) : null;

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
  },
});
