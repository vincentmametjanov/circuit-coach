// Every lab in the course, grouped by phase. Ready labs open; the rest show
// what they will teach and where that circuit is used in industry.

import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LABS, PHASES, type LabSummary } from '../../lab/catalog';
import { colors, fonts } from '../../theme';
import { Band, Button, Card, Grid, SectionTitle, SitePage, text, useScreen } from './ui';

export function LabListScreen() {
  const { columns } = useScreen();
  return (
    <SitePage>
      <Band>
        <SectionTitle
          eyebrow="Labs"
          title="Ten labs, one skill at a time"
          intro="Work through them in order: each lab reuses what the one before taught. Lab 01 is ready now."
        />
        <View style={styles.phases}>
          {PHASES.map((phase, index) => (
            <View key={phase} style={styles.phase}>
              <Text style={styles.phaseTitle} accessibilityRole="header">{`${index + 1}. ${phase}`}</Text>
              <Grid columns={columns}>
                {LABS.filter((lab) => lab.phase === phase).map((lab) => (
                  <LabCard key={lab.id} lab={lab} />
                ))}
              </Grid>
            </View>
          ))}
        </View>
      </Band>
    </SitePage>
  );
}

function LabCard({ lab }: { lab: LabSummary }) {
  return (
    <Card style={[styles.card, !lab.ready && styles.cardLater]}>
      <View style={styles.cardTop}>
        <Text style={styles.number}>{lab.number}</Text>
        {lab.ready ? null : <Text style={styles.soon}>Coming soon</Text>}
      </View>
      <Text style={text.h3}>{lab.title}</Text>
      <Text style={text.body}>{lab.concept}</Text>
      <View style={styles.meta}>
        <Text style={text.small}>
          <Text style={styles.metaLabel}>Parts: </Text>
          {lab.part}
        </Text>
        <Text style={text.small}>
          <Text style={styles.metaLabel}>In industry: </Text>
          {lab.factory}
        </Text>
      </View>
      {lab.ready ? (
        <View style={styles.action}>
          <Button label={`Start Lab ${lab.number}`} onPress={() => router.navigate(`/labs/${lab.id}`)} small />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  phases: { gap: 40 },
  phase: { gap: 16 },
  phaseTitle: { color: colors.titleBar, fontFamily: fonts.ui, fontSize: 20, fontWeight: '700' },
  card: { gap: 8 },
  cardLater: { backgroundColor: colors.panel },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { color: colors.teal, fontFamily: fonts.mono, fontSize: 22, fontWeight: '700' },
  soon: {
    color: colors.textMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  meta: { gap: 4, marginTop: 4 },
  metaLabel: { color: colors.text, fontWeight: '700' },
  action: { marginTop: 8, alignItems: 'flex-start' },
});
