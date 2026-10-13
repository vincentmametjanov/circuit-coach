import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LabStep } from '../../lab/circuit';
import { colors, fonts } from '../../theme';
import { Icon } from './Icons';

/** Side panel with the lab's steps and short explanations. */
export function GuidePanel({ steps, scrollable = true }: { steps: LabStep[]; scrollable?: boolean }) {
  const current = steps.findIndex((step) => !step.done);
  const content = (
    <View style={styles.content}>
      <Text style={styles.panelTitle}>LAB GUIDE</Text>
      <Text style={styles.labTitle}>Lab 01 · Blink an LED on pin 7</Text>
      <Text style={styles.body}>
        Build the circuit on the breadboard, then upload the sketch. Press Verify (✓) any time to have the checker trace your
        wiring.
      </Text>

      <View style={styles.steps}>
        {steps.map((step, index) => (
          <View key={step.id} style={[styles.step, index === current && styles.stepCurrent]}>
            <View style={[styles.stepBadge, step.done && styles.stepBadgeDone]}>
              {step.done ? (
                <Icon name="check" size={13} color="#FFFFFF" />
              ) : (
                <Text style={styles.stepNumber}>{index + 1}</Text>
              )}
            </View>
            <View style={styles.stepCopy}>
              <Text style={[styles.stepTitle, step.done && styles.stepTitleDone]}>{step.title}</Text>
              {index === current ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
            </View>
          </View>
        ))}
      </View>

      <Explainer title="How a breadboard connects">
        Each numbered column of five holes (a–e) is one metal strip underneath, and f–j is another. Two legs in the same
        strip are connected; the center gap separates the halves.
      </Explainer>
      <Explainer title="LED polarity">
        Current enters the + leg (anode, the longer bent one) and leaves the − leg (cathode, by the flat edge of the rim).
        Backwards, it stays dark.
      </Explainer>
      <Explainer title="Why 220 Ω?">
        An LED drops about 2 V. The resistor limits the rest: (5 V − 2 V) ÷ 220 Ω ≈ 14 mA, bright but under the LED’s 20 mA
        limit.
      </Explainer>

      <Explainer title="On the factory floor">
        Machines show their state with indicator lights. A factory controller switches an output on to light a
        “running” lamp, the same job your sketch does when it sets pin 7 HIGH.
      </Explainer>

      <View style={styles.nextCard}>
        <Text style={styles.nextLabel}>UP NEXT</Text>
        <Text style={styles.nextTitle}>Lab 02 · Button input and pull-up resistors</Text>
      </View>
    </View>
  );

  return scrollable ? <ScrollView style={styles.panel}>{content}</ScrollView> : <View style={styles.panel}>{content}</View>;
}

function Explainer({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.explainer}>
      <Text style={styles.explainerTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

/** One-line version of the current step, shown above the canvas on phones. */
export function NextStepBanner({ steps }: { steps: LabStep[] }) {
  const index = steps.findIndex((step) => !step.done);
  const done = index === -1;
  const step = done ? null : steps[index];
  return (
    <View style={[styles.banner, done && styles.bannerDone]}>
      <Text style={styles.bannerLabel}>{done ? 'LAB COMPLETE' : `STEP ${index + 1} OF ${steps.length}`}</Text>
      <Text style={styles.bannerTitle}>{step ? step.title : 'Your LED is blinking on pin 7.'}</Text>
      {step ? <Text style={styles.bannerDetail}>{step.detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: colors.panel,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  panelTitle: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  labTitle: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
  },
  steps: {
    gap: 4,
    marginTop: 4,
  },
  step: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  stepCurrent: {
    backgroundColor: colors.tealPale,
    borderLeftColor: colors.teal,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.editor,
  },
  stepBadgeDone: {
    backgroundColor: colors.teal,
  },
  stepNumber: {
    color: colors.teal,
    fontFamily: fonts.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  stepCopy: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
  },
  stepTitleDone: {
    color: colors.textMuted,
  },
  stepDetail: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
  },
  explainer: {
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.panelBorder,
  },
  explainerTitle: {
    color: colors.tealDark,
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  nextCard: {
    marginTop: 4,
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    backgroundColor: colors.editor,
    gap: 4,
  },
  nextLabel: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  nextTitle: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 13,
    fontWeight: '600',
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.tealPale,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
    borderRadius: 4,
    gap: 2,
  },
  bannerDone: {
    backgroundColor: '#E3F5EA',
    borderLeftColor: colors.success,
  },
  bannerLabel: {
    color: colors.tealDark,
    fontFamily: fonts.ui,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  bannerTitle: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 15,
    fontWeight: '700',
  },
  bannerDetail: {
    color: colors.text,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
  },
});
