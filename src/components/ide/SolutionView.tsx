import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { fitCanvas } from '../../lab/geometry';
import type { LabDef } from '../../lab/lab';
import { benchFromSolution, createLabStore, describePlacement, describeWire, ledGlowFor } from '../../lab/runtime';
import { colors, fonts } from '../../theme';
import { Workbench } from '../workbench/Workbench';

type Props = {
  lab: LabDef;
  onClose: () => void;
  /** Puts the solution on the student's own bench. */
  onLoad: () => void;
};

/** A popup with one correct build of the lab: a picture of the bench and the list of connections. */
export function SolutionView({ lab, onClose, onLoad }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const solution = lab.solution;
  const state = useMemo(() => (solution ? benchFromSolution(createLabStore(lab).state, solution) : null), [lab, solution]);
  if (!solution || !state) return null;

  const benchWidth = Math.min(windowWidth - 48, 720);
  const { layout, scale } = fitCanvas(benchWidth, null);
  const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
  const lines = [
    ...lab.parts.map((spec) => sentence(describePlacement(lab, state, spec.id, solution.parts[spec.id]).replace(/^Placed the /, ''))),
    ...state.wires.map((wire) => sentence(describeWire(wire).replace(/^Connected /, 'Jumper from ').replace(/ with a jumper\.$/, '.'))),
  ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: benchWidth + 32 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Solution: {lab.title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close the solution" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.scroll}>
            {/* The picture does not react to touches: it is only there to look at. */}
            <View pointerEvents="none" style={styles.bench}>
              <Workbench layout={layout} scale={scale} lab={lab} state={state} ledGlow={ledGlowFor(lab, state)} dispatch={() => {}} />
            </View>
            <View style={styles.list}>
              {lines.map((line, i) => (
                <Text key={i} style={styles.line}>
                  {`${i + 1}. ${line}`}
                </Text>
              ))}
            </View>
          </ScrollView>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={onLoad} style={styles.primary}>
              <Text style={styles.primaryText}>Put it on my bench</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
              <Text style={styles.secondaryText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 40, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    maxHeight: '92%',
    backgroundColor: colors.editor,
    borderRadius: 10,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.toolbar,
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontFamily: fonts.ui,
    fontSize: 15,
    fontWeight: '700',
  },
  close: { padding: 6 },
  closeText: { color: colors.tealPale, fontSize: 16, fontWeight: '700' },
  scroll: { flexGrow: 0 },
  bench: { padding: 16, alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  line: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  primary: {
    backgroundColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryText: { color: '#FFFFFF', fontFamily: fonts.ui, fontSize: 14, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryText: { color: colors.text, fontFamily: fonts.ui, fontSize: 14, fontWeight: '600' },
});
