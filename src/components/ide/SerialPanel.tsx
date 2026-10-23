import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../theme';

/** The Serial Monitor: what the running sketch prints, one line per reading. */
export function SerialPanel({ lines, height }: { lines: string[]; height: number }) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: false });
  }, [lines.length]);
  return (
    <View style={[styles.panel, { height }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Serial Monitor at 9600 baud</Text>
      </View>
      <ScrollView ref={scroll} style={styles.body} contentContainerStyle={styles.bodyContent}>
        {lines.length === 0 ? (
          <Text style={[styles.line, styles.placeholder]}>Upload a sketch that prints to Serial and readings appear here.</Text>
        ) : null}
        {lines.map((line, index) => (
          <Text key={index} style={styles.line} selectable>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  header: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.panelBorder,
  },
  title: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 12, paddingVertical: 8 },
  line: {
    color: colors.text,
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  placeholder: {
    color: colors.textMuted,
  },
});
