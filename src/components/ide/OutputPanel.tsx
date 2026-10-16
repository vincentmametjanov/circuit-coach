import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LogKind, LogLine } from '../../lab/state';
import { colors, fonts } from '../../theme';
import { Icon } from './Icons';

const KIND_COLOR: Record<LogKind, string> = {
  muted: colors.consoleMuted,
  info: colors.consoleText,
  success: colors.consoleSuccess,
  warn: colors.consoleWarn,
  error: colors.consoleError,
  hint: '#9FD8DB',
};

/** Black "Output" console under the editor, as in the Arduino IDE. */
export function OutputPanel({ lines, height, onClear }: { lines: LogLine[]; height: number; onClear: () => void }) {
  const scroll = useRef<ScrollView>(null);
  return (
    <View style={[styles.panel, { height }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Output</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear output"
          onPress={onClear}
          hitSlop={8}
          style={({ hovered }) => [styles.clear, hovered && styles.clearHover]}
        >
          <Icon name="clear" size={15} color={colors.consoleMuted} />
        </Pressable>
      </View>
      <ScrollView
        ref={scroll}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        accessibilityLiveRegion="polite"
        accessibilityLabel="Output console"
      >
        {lines.length === 0 ? (
          <Text style={[styles.line, styles.placeholder]}>What you do on the workbench will show up here.</Text>
        ) : null}
        {lines.map((line) => (
          <Text key={line.id} style={[styles.line, { color: KIND_COLOR[line.kind] }]} selectable>
            {line.text}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.console,
    borderTopWidth: 1,
    borderTopColor: '#2B3334',
  },
  header: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: colors.consoleHeader,
  },
  title: {
    color: colors.consoleText,
    fontFamily: fonts.ui,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  clear: {
    padding: 4,
    borderRadius: 4,
  },
  clearHover: {
    backgroundColor: '#2F3839',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
  },
  placeholder: {
    color: colors.consoleMuted,
    fontStyle: 'italic',
  },
  line: {
    fontFamily: fonts.mono,
    fontSize: 12.5,
    lineHeight: 18,
  },
});
