// The landing page: what Circuit Coach is, why Arduino is worth learning, how
// the labs connect to manufacturing and engineering, and where to start.

import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

import { LABS, PHASES, labById } from '../../lab/catalog';
import { colors, fonts } from '../../theme';
import { ArduinoUno } from '../workbench/ArduinoUno';
import { Band, Button, Card, Grid, SectionTitle, SitePage, text, useScreen } from './ui';

const WORKFORCE_SOURCE =
  'https://www.deloitte.com/us/en/insights/industry/manufacturing-industrial-products/supporting-us-manufacturing-growth-amid-workforce-challenges.html';

/** The board drawing, sized from the space it gets so it renders the same on web, iPad and iPhone. */
function BoardPicture() {
  const [width, setWidth] = useState(0);
  const box = { x: -14, y: -6, w: 294, h: 226 };
  return (
    <View style={styles.board} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg
          width={width}
          height={(width * box.h) / box.w}
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          accessibilityLabel="Arduino Uno board"
        >
          <ArduinoUno origin={{ x: 0, y: 0 }} />
        </Svg>
      ) : null}
    </View>
  );
}

const startLab = () => router.navigate('/labs/lab01');
const allLabs = () => router.navigate('/labs');

const WHY = [
  {
    title: 'Code that moves things',
    body: 'An Arduino is a small computer that reads buttons and sensors and switches lights, buzzers and motors. Your code does something you can see.',
  },
  {
    title: 'The ideas behind every machine',
    body: 'Inputs, outputs, sensors and control logic run cars, robots, medical devices and factory lines. Arduino is the friendliest place to learn them.',
  },
  {
    title: 'A first step into engineering',
    body: 'Electrical, mechanical and computer engineering all start here: circuits, Ohm’s law, and programs that react to the real world.',
  },
];

const FACTORY_LABS = ['lab02', 'lab03', 'lab04', 'lab06', 'lab08', 'lab09'];

const CAREERS = [
  'Electrical engineering',
  'Mechatronics technician',
  'Industrial automation and PLCs',
  'Robotics',
  'Embedded software',
  'Maintenance and controls',
];

const ACCESS = [
  { title: 'Nothing to buy', body: 'No board, no parts, no lab room. Mistakes cost nothing, even a burned-out LED.' },
  { title: 'Runs on what schools have', body: 'Open it in a browser on a school Chromebook or laptop, or use it on an iPad or iPhone.' },
  { title: 'Real kit, real skills', body: 'Every lab uses the parts in standard Arduino starter kits, so the circuits work the same on a real board.' },
];

const STEPS = [
  { title: 'Build', body: 'Drag a resistor, an LED and jumper wires onto a breadboard next to an Arduino Uno.' },
  { title: 'Check', body: 'Press Verify. The coach traces your wiring and explains any mistake in plain words.' },
  { title: 'Upload', body: 'Send the sketch to the simulated board and watch your circuit come to life.' },
  { title: 'Connect', body: 'See where the same circuit runs on a real factory floor, then try it on real hardware.' },
];

export function HomeScreen() {
  const screen = useScreen();
  const { phone, columns } = screen;

  return (
    <SitePage>
      {/* Hero */}
      <Band style={[styles.hero, !screen.wide && styles.heroStacked]}>
        <View style={[styles.heroText, screen.wide && styles.half]}>
          <Text style={text.label}>FREE · IN ANY BROWSER · ON IPAD AND IPHONE</Text>
          <Text style={[styles.h1, phone && styles.h1Phone]} accessibilityRole="header">
            Learn Arduino without a lab.
          </Text>
          <Text style={styles.lead}>
            Build real circuits on a virtual Arduino and breadboard. A coach checks your wiring, explains every mistake,
            and shows how each circuit is used in engineering and manufacturing.
          </Text>
          <View style={[styles.actions, phone && styles.actionsPhone]}>
            <Button label="Start Lab 01" onPress={startLab} />
            <Button label="See all labs" onPress={allLabs} kind="secondary" />
          </View>
        </View>
        <View style={[styles.heroArt, screen.wide ? styles.half : styles.heroArtStacked]}>
          <BoardPicture />
          <Text style={[text.small, styles.center]}>The Arduino Uno, the board at the heart of most starter kits.</Text>
        </View>
      </Band>

      {/* Why Arduino */}
      <Band tint>
        <SectionTitle
          eyebrow="Why learn Arduino"
          title="The smallest computer that can run a machine"
          intro="Arduino is how millions of students, makers and engineers learn electronics. It connects code to the physical world."
        />
        <Grid columns={columns}>
          {WHY.map((item) => (
            <Card key={item.title}>
              <Text style={text.h3}>{item.title}</Text>
              <Text style={text.body}>{item.body}</Text>
            </Card>
          ))}
        </Grid>
      </Band>

      {/* Manufacturing */}
      <Band>
        <SectionTitle
          eyebrow="From breadboard to factory floor"
          title="Every lab is a small version of a real machine"
          intro="Factories run on the same building blocks you wire up here: buttons and switches, status lights, sensors, motors, and a controller deciding what to do."
        />
        <View style={styles.stat}>
          <Text style={[styles.statNumber, phone && styles.statNumberPhone]}>3.8 million</Text>
          <View style={styles.statCopy}>
            <Text style={text.body}>
              U.S. manufacturing jobs to fill between 2024 and 2033. About half could go unfilled without enough skilled
              workers, as factories add sensors, robots and automated controls.
            </Text>
            <Text style={[text.small, styles.link]} accessibilityRole="link" onPress={() => Linking.openURL(WORKFORCE_SOURCE)}>
              Deloitte and The Manufacturing Institute, 2024
            </Text>
          </View>
        </View>
        <Grid columns={columns}>
          {FACTORY_LABS.map((id) => {
            const lab = labById(id)!;
            return (
              <Card key={id} style={styles.pairCard}>
                <Text style={text.label}>{`LAB ${lab.number} · ${lab.part.toUpperCase()}`}</Text>
                <Text style={text.h3}>{lab.factory}</Text>
                <Text style={text.small}>{lab.concept}</Text>
              </Card>
            );
          })}
        </Grid>
        <View style={styles.careers}>
          <Text style={[text.h3, styles.careersTitle]}>Where these skills lead</Text>
          <View style={styles.chips}>
            {CAREERS.map((career) => (
              <View key={career} style={styles.chip}>
                <Text style={styles.chipText}>{career}</Text>
              </View>
            ))}
          </View>
        </View>
      </Band>

      {/* Access */}
      <Band tint>
        <SectionTitle
          eyebrow="Made for students without a lab"
          title="Your school doesn’t need an electronics class"
          intro="Many schools, especially in small and rural towns, don’t teach electronics or engineering, and kits and lab equipment cost money. Circuit Coach gives every student a place to start."
        />
        <Grid columns={columns}>
          {ACCESS.map((item) => (
            <Card key={item.title}>
              <Text style={text.h3}>{item.title}</Text>
              <Text style={text.body}>{item.body}</Text>
            </Card>
          ))}
        </Grid>
      </Band>

      {/* How it works */}
      <Band>
        <SectionTitle eyebrow="How it works" title="Build, check, upload, connect" />
        <Grid columns={phone ? 1 : columns === 2 ? 2 : 4}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={text.h3}>{step.title}</Text>
              <Text style={text.body}>{step.body}</Text>
            </View>
          ))}
        </Grid>
      </Band>

      {/* Course outline */}
      <Band tint>
        <SectionTitle
          eyebrow="The course"
          title="Ten labs, from one LED to a sorting line"
          intro="Each lab builds on the last and follows what Arduino starter kits teach. Lab 01 is ready now; the rest are on the way."
        />
        <Grid columns={columns}>
          {PHASES.map((phase) => (
            <Card key={phase}>
              <Text style={text.label}>{phase.toUpperCase()}</Text>
              {LABS.filter((lab) => lab.phase === phase).map((lab) => (
                <View key={lab.id} style={styles.outlineRow}>
                  <Text style={styles.outlineNumber}>{lab.number}</Text>
                  <Text style={[text.body, styles.flex]}>{lab.title}</Text>
                  {lab.ready ? <Text style={styles.ready}>Ready</Text> : null}
                </View>
              ))}
            </Card>
          ))}
        </Grid>
        <View style={[styles.actions, styles.outlineActions, phone && styles.actionsPhone]}>
          <Button label="See all labs" onPress={allLabs} kind="secondary" />
        </View>
      </Band>

      {/* Closing call to action */}
      <View style={styles.cta}>
        <Text style={[styles.ctaTitle, phone && styles.h1Phone]}>Ready to build your first circuit?</Text>
        <Text style={styles.ctaBody}>Lab 01 walks you through blinking an LED on pin 7, step by step.</Text>
        <Button label="Start Lab 01" onPress={startLab} />
      </View>
    </SitePage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  heroStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 32 },
  half: { flex: 1 },
  heroText: { gap: 18 },
  heroArt: { gap: 10 },
  heroArtStacked: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  board: { width: '100%', aspectRatio: 294 / 226 },
  h1: { color: colors.titleBar, fontFamily: fonts.ui, fontSize: 46, lineHeight: 54, fontWeight: '800' },
  h1Phone: { fontSize: 32, lineHeight: 39 },
  lead: { color: colors.text, fontFamily: fonts.ui, fontSize: 19, lineHeight: 29 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 6, flexWrap: 'wrap' },
  actionsPhone: { flexDirection: 'column', alignItems: 'stretch' },
  stat: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 20,
    backgroundColor: colors.tealPale,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  statNumber: { color: colors.tealDark, fontFamily: fonts.ui, fontSize: 40, fontWeight: '800' },
  statNumberPhone: { fontSize: 32 },
  statCopy: { flex: 1, minWidth: 240, gap: 6 },
  link: { color: colors.tealDark, textDecorationLine: 'underline' },
  pairCard: { gap: 6 },
  careers: { marginTop: 32, gap: 12 },
  careersTitle: { fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.panelBorder, paddingHorizontal: 14, paddingVertical: 7 },
  chipText: { color: colors.text, fontFamily: fonts.ui, fontSize: 14 },
  step: { gap: 8 },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepNumberText: { color: '#FFFFFF', fontFamily: fonts.ui, fontSize: 16, fontWeight: '700' },
  outlineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  outlineNumber: { width: 24, color: colors.textMuted, fontFamily: fonts.mono, fontSize: 14 },
  ready: {
    color: '#FFFFFF',
    backgroundColor: colors.success,
    fontFamily: fonts.ui,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  outlineActions: { marginTop: 24 },
  cta: { backgroundColor: colors.titleBar, paddingVertical: 56, paddingHorizontal: 20, alignItems: 'center', gap: 14 },
  ctaTitle: { color: '#FFFFFF', fontFamily: fonts.ui, fontSize: 32, lineHeight: 40, fontWeight: '800', textAlign: 'center' },
  ctaBody: { color: colors.tealPale, fontFamily: fonts.ui, fontSize: 17, lineHeight: 25, textAlign: 'center', marginBottom: 8 },
});
