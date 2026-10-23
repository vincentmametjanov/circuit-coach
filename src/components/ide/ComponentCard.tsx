import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COMPONENTS, type ComponentId } from '../../lab/components';
import { colors, fonts } from '../../theme';

/** Explains the component the student tapped: what it is, key facts, and how to use it here. */
export function ComponentCard({ id, onClose }: { id: ComponentId; onClose: () => void }) {
  const info = COMPONENTS[id];
  return (
    <View style={styles.card} accessibilityRole="summary" accessibilityLabel={`About the ${info.name}`}>
      <View style={styles.header}>
        <Text style={styles.label}>What is this?</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={10}
          style={({ hovered }) => [styles.close, hovered && styles.closeHover]}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>
      <Text style={styles.title}>{info.name}</Text>
      <Text style={styles.body}>{info.summary}</Text>
      <View style={styles.facts}>
        {info.facts.map((fact) => (
          <View key={fact} style={styles.fact}>
            <Text style={styles.bullet}>•</Text>
            <Text style={[styles.body, styles.flex]}>{fact}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.howTo}>
        <Text style={styles.howToLabel}>How to use it: </Text>
        {info.howTo}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.teal,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.teal, fontFamily: fonts.ui, fontSize: 12, fontWeight: '600' },
  close: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  closeHover: { backgroundColor: colors.tealPale },
  closeText: { color: colors.textMuted, fontSize: 20, lineHeight: 22 },
  title: { color: colors.titleBar, fontFamily: fonts.ui, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 },
  flex: { flex: 1 },
  facts: { gap: 4, marginTop: 2 },
  fact: { flexDirection: 'row', gap: 6 },
  bullet: { color: colors.teal, fontFamily: fonts.ui, fontSize: 13, lineHeight: 19 },
  howTo: { color: colors.text, fontFamily: fonts.ui, fontSize: 13, lineHeight: 19, marginTop: 4 },
  howToLabel: { fontWeight: '700' },
});
