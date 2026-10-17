import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { LabDef } from '../../lab/lab';
import type { RuntimeStep as LabStep } from '../../lab/runtime';
import { colors, fonts } from '../../theme';
import { Icon } from './Icons';

/** Side panel with the lab's steps and short explanations. */
export function GuidePanel({
  lab,
  steps,
  passed,
  scrollable = true,
}: {
  lab: LabDef;
  steps: LabStep[];
  passed: boolean;
  scrollable?: boolean;
}) {
  const current = steps.findIndex((step) => !step.done);
  const content = (
    <View style={styles.content}>
      <Text style={styles.panelTitle}>LAB GUIDE</Text>
      <Text style={styles.labTitle}>{lab.title}</Text>
      <Text style={styles.body}>{lab.guide.intro}</Text>

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

      {passed && lab.guide.proTip ? (
        <View style={styles.proTip}>
          <Text style={styles.proTipTitle}>{lab.guide.proTip.title}</Text>
          <Text style={styles.body}>{lab.guide.proTip.body}</Text>
        </View>
      ) : null}

      {lab.guide.explainers.map((item) => (
        <Explainer key={item.title} title={item.title}>
          {item.body}
        </Explainer>
      ))}

      {lab.next ? (
        <View style={styles.nextCard}>
          <Text style={styles.nextLabel}>UP NEXT</Text>
          <Text style={styles.nextTitle}>{lab.next.title}</Text>
        </View>
      ) : null}
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
export function NextStepBanner({ steps, doneText }: { steps: LabStep[]; /** Shown once every step is done. */ doneText: string }) {
  const index = steps.findIndex((step) => !step.done);
  const done = index === -1;
  const step = done ? null : steps[index];
  return (
    <View style={[styles.banner, done && styles.bannerDone]}>
      <Text style={styles.bannerLabel}>{done ? 'LAB COMPLETE' : `STEP ${index + 1} OF ${steps.length}`}</Text>
      <Text style={styles.bannerTitle}>{step ? step.title : doneText}</Text>
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
  proTip: {
    gap: 4,
    padding: 12,
    borderRadius: 6,
    backgroundColor: colors.tealPale,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  proTipTitle: {
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
