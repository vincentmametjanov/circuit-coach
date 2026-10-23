// The landing page: what Circuit Coach is, why Arduino is worth learning, how
// the labs connect to manufacturing and engineering, and where to start.

import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';

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
    body: 'Read buttons and sensors, switch lights and motors. Programs you can see working.',
  },
  {
    title: 'The ideas behind every machine',
    body: 'Inputs, outputs and control logic run cars, robots and factory lines. Arduino is the friendliest way in.',
  },
  {
    title: 'A first step into engineering',
    body: 'Circuits, Ohm’s law and code that reacts to the world. It is where electrical, mechanical and software engineering meet.',
  },
];

const ACCESS = [
  { title: 'Nothing to buy', body: 'No board, no parts, no lab room. Mistakes cost nothing, even a burned-out LED.' },
  { title: 'Runs on what you have', body: 'Works in a browser on a laptop, iPad or iPhone.' },
  { title: 'Real kit, real skills', body: 'The same parts as standard Arduino starter kits, so your circuits work on real hardware.' },
];

const STEPS = [
  { title: 'Build', body: 'Drag parts and jumper wires onto the breadboard.' },
  { title: 'Check', body: 'The coach traces your wiring and explains mistakes in plain words.' },
  { title: 'Upload', body: 'Run the sketch on the simulated board and watch the circuit work.' },
  { title: 'Connect', body: 'See where the same circuit runs in a real factory.' },
];

export function HomeScreen() {
  const screen = useScreen();
  const { phone, columns } = screen;

  return (
    <SitePage>
      {/* Hero */}
      <Band style={[styles.hero, !screen.wide && styles.heroStacked]}>
        <View style={[styles.heroText, screen.wide && styles.half]}>
          <Text style={text.label}>Free. Works in any browser, and on iPad and iPhone.</Text>
          <Text style={[styles.h1, phone && styles.h1Phone]} accessibilityRole="header">
            Learn Arduino without a lab.
          </Text>
          <Text style={styles.lead}>
            Build real circuits on a virtual Arduino and breadboard. A coach checks your wiring and explains every
            mistake.
          </Text>
          <View style={[styles.actions, phone && styles.actionsPhone]}>
            <Button label="Start Lab 01" onPress={startLab} />
            <Button label="See all labs" onPress={allLabs} kind="secondary" />
            <Button label="Open bench (free play)" onPress={() => router.navigate('/play')} kind="secondary" />
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
          intro="Arduino connects code to the physical world. It is a practical way to learn electronics, inputs, outputs and control."
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
          intro="Factories run on the same building blocks you wire up here: buttons, status lights, sensors, motors and a controller."
        />
        <View style={styles.stat}>
          <Text style={[styles.statNumber, phone && styles.statNumberPhone]}>3.8 million</Text>
          <View style={styles.statCopy}>
            <Text style={text.body}>
              U.S. manufacturing jobs to fill by 2033, and factories keep adding the sensors, robots and controls these
              labs teach.
            </Text>
            <Text style={[text.small, styles.link]} accessibilityRole="link" onPress={() => Linking.openURL(WORKFORCE_SOURCE)}>
              Deloitte and The Manufacturing Institute, 2024
            </Text>
          </View>
        </View>
      </Band>

      {/* Access */}
      <Band tint>
        <SectionTitle
          eyebrow="Learn without a lab"
          title="Nothing to buy, nothing to break"
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

      <Band style={styles.developer}>
        <Text style={[text.small, styles.center]}>Circuit Coach is developed by Vincent Mametjanov.</Text>
      </Band>
    </SitePage>
  );
}

const styles = StyleSheet.create({
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
  },
  statNumber: { color: colors.tealDark, fontFamily: fonts.ui, fontSize: 40, fontWeight: '800' },
  statNumberPhone: { fontSize: 32 },
  statCopy: { flex: 1, minWidth: 240, gap: 6 },
  link: { color: colors.tealDark, textDecorationLine: 'underline' },
  step: { gap: 8 },
  developer: { paddingVertical: 24 },
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
});
