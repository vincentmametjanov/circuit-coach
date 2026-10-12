import { StatusBar } from 'expo-status-bar';
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useState } from 'react';

type LabStepId = 'resistor' | 'anode' | 'ground';

type LabStep = {
  id: LabStepId;
  eyebrow: string;
  title: string;
  detail: string;
  action: string;
  doneMessage: string;
};

const labSteps: LabStep[] = [
  {
    id: 'resistor',
    eyebrow: 'Step 1',
    title: 'Limit the current',
    detail: 'Place a 220 ohm resistor between D7 and the LED anode.',
    action: 'Place 220 ohm resistor',
    doneMessage: 'The resistor protects the LED and the Arduino pin.',
  },
  {
    id: 'anode',
    eyebrow: 'Step 2',
    title: 'Choose the signal path',
    detail: 'Connect the long LED leg (anode) to the resistor output.',
    action: 'Connect LED anode',
    doneMessage: 'The anode now has a controlled path from D7.',
  },
  {
    id: 'ground',
    eyebrow: 'Step 3',
    title: 'Close the circuit',
    detail: 'Connect the short LED leg (cathode) to GND.',
    action: 'Connect cathode to GND',
    doneMessage: 'The return path to ground is complete.',
  },
];

const headingFont =
  Platform.select({ ios: 'Avenir Next', web: 'Trebuchet MS', default: 'sans-serif' }) ??
  'sans-serif';
const bodyFont = Platform.select({ ios: 'Avenir Next', web: 'Arial', default: 'sans-serif' }) ?? 'sans-serif';
const monoFont = Platform.select({ ios: 'Menlo', web: 'Courier New', default: 'monospace' }) ?? 'monospace';

export default function App() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [connections, setConnections] = useState<Record<LabStepId, boolean>>({
    resistor: false,
    anode: false,
    ground: false,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback] = useState('Start with the resistor. A safe circuit always limits current.');

  const completeCount = labSteps.filter((step) => connections[step.id]).length;
  const isComplete = completeCount === labSteps.length;
  const progress = `${completeCount} of ${labSteps.length}`;

  function completeStep(step: LabStep) {
    setIsTesting(false);

    if (connections[step.id]) {
      setFeedback(step.doneMessage);
      return;
    }

    setConnections({ ...connections, [step.id]: true });
    setFeedback(step.doneMessage);
  }

  function testCircuit() {
    setIsTesting(true);

    if (isComplete) {
      setFeedback('Circuit check passed. D7 can safely blink the LED.');
      return;
    }

    const nextStep = labSteps.find((step) => !connections[step.id]);
    setFeedback(`Circuit check paused: ${nextStep?.detail}`);
  }

  function resetLab() {
    setConnections({ resistor: false, anode: false, ground: false });
    setIsTesting(false);
    setFeedback('Lab reset. Build the circuit one safe connection at a time.');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, isWide && styles.pageWide]}>
          <View style={styles.topBar}>
            <View>
              <Text style={styles.brand}>Circuit Coach</Text>
              <Text style={styles.brandSubhead}>BUILD IT. CHECK IT. UNDERSTAND IT.</Text>
            </View>
            <View style={styles.lessonBadge}>
              <Text style={styles.lessonBadgeText}>LAB 01</Text>
            </View>
          </View>

          <View style={[styles.hero, isWide && styles.heroWide]}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>LED STARTER LAB</Text>
              <Text style={styles.heroTitle}>Make your first circuit glow safely.</Text>
              <Text style={styles.heroDescription}>
                Build an Arduino LED circuit, then let the rule checker explain what is ready and what still needs attention.
              </Text>
              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(completeCount / labSteps.length) * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress} connected</Text>
              </View>
            </View>
            <View style={styles.miniCurriculum}>
              <Text style={styles.miniCurriculumLabel}>YOU WILL PRACTICE</Text>
              <Text style={styles.miniCurriculumItem}>Current limiting</Text>
              <Text style={styles.miniCurriculumItem}>Polarity</Text>
              <Text style={styles.miniCurriculumItem}>Common ground</Text>
            </View>
          </View>

          <View style={[styles.workspace, isWide && styles.workspaceWide]}>
            <View style={styles.labColumn}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.eyebrow}>SIMULATED WORKBENCH</Text>
                  <Text style={styles.sectionTitle}>Arduino LED circuit</Text>
                </View>
                <View style={[styles.statusPill, isComplete ? styles.statusReady : styles.statusBuilding]}>
                  <Text style={[styles.statusPillText, isComplete ? styles.statusReadyText : styles.statusBuildingText]}>
                    {isComplete ? 'READY TO TEST' : 'IN PROGRESS'}
                  </Text>
                </View>
              </View>

              <View style={styles.workbench}>
                <View style={styles.arduinoCard}>
                  <View style={styles.arduinoHeader}>
                    <Text style={styles.arduinoName}>ARDUINO UNO</Text>
                    <View style={styles.arduinoLight} />
                  </View>
                  <View style={styles.pinRow}>
                    <View style={styles.pinGroup}>
                      <Text style={styles.pinLabel}>D7</Text>
                      <Text style={styles.pinCaption}>OUTPUT</Text>
                    </View>
                    <View style={styles.pinGroup}>
                      <Text style={styles.pinLabel}>GND</Text>
                      <Text style={styles.pinCaption}>RETURN</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.connectionStack}>
                  <ConnectionPath label="D7" active={connections.resistor} tone="coral" />
                  <ConnectionPath label="220 ohm" active={connections.resistor && connections.anode} tone="gold" />
                  <ConnectionPath label="LED" active={connections.anode && connections.ground} tone="green" />
                  <ConnectionPath label="GND" active={connections.ground} tone="ink" />
                </View>

                <View style={styles.breadboard}>
                  <View style={styles.powerRail}>
                    <Text style={styles.railPlus}>+</Text>
                    <View style={styles.railLine} />
                    <Text style={styles.railMinus}>-</Text>
                  </View>
                  <View style={styles.breadboardBody}>
                    <View style={styles.holeGrid}>
                      {Array.from({ length: 48 }, (_, index) => (
                        <View key={index} style={styles.hole} />
                      ))}
                    </View>
                    <View style={styles.centerGap} />
                    <View style={styles.holeGrid}>
                      {Array.from({ length: 48 }, (_, index) => (
                        <View key={index} style={styles.hole} />
                      ))}
                    </View>
                  </View>
                  <View style={styles.circuitParts}>
                    <View style={[styles.resistor, connections.resistor && styles.resistorActive]}>
                      <View style={styles.resistorWire} />
                      <View style={styles.resistorBody}>
                        <View style={styles.resistorBandOne} />
                        <View style={styles.resistorBandTwo} />
                        <View style={styles.resistorBandThree} />
                      </View>
                      <View style={styles.resistorWire} />
                    </View>
                    <View style={styles.ledAssembly}>
                      <View style={[styles.ledDome, isTesting && isComplete && styles.ledDomeLit]} />
                      <View style={styles.ledLegs}>
                        <View style={[styles.ledLeg, connections.anode && styles.ledLegActive]} />
                        <View style={[styles.ledLeg, connections.ground && styles.ledLegGrounded]} />
                      </View>
                      <Text style={styles.componentCaption}>LED</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.feedbackPanel, isComplete ? styles.feedbackReady : styles.feedbackNeutral]}>
                  <Text style={styles.feedbackLabel}>{isComplete ? 'CIRCUIT CHECK' : 'COACH NOTE'}</Text>
                  <Text style={styles.feedbackText}>{feedback}</Text>
                </View>

                <View style={styles.workbenchActions}>
                  <Pressable
                    accessibilityLabel="Test the LED circuit"
                    accessibilityRole="button"
                    onPress={testCircuit}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.primaryButtonText}>Test circuit</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Reset the lab"
                    accessibilityRole="button"
                    onPress={resetLab}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.secondaryButtonText}>Reset</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.stepsColumn}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.eyebrow}>GUIDED WIRING</Text>
                  <Text style={styles.sectionTitle}>Build sequence</Text>
                </View>
                <Text style={styles.stepCount}>{progress}</Text>
              </View>

              <View style={styles.stepList}>
                {labSteps.map((step) => {
                  const isDone = connections[step.id];

                  return (
                    <View key={step.id} style={[styles.stepCard, isDone && styles.stepCardDone]}>
                      <View style={[styles.stepNumber, isDone && styles.stepNumberDone]}>
                        <Text style={[styles.stepNumberText, isDone && styles.stepNumberTextDone]}>
                          {isDone ? 'OK' : step.eyebrow.replace('Step ', '')}
                        </Text>
                      </View>
                      <View style={styles.stepCopy}>
                        <Text style={styles.stepEyebrow}>{step.eyebrow}</Text>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepDetail}>{step.detail}</Text>
                        <Pressable
                          accessibilityLabel={step.action}
                          accessibilityRole="button"
                          onPress={() => completeStep(step)}
                          style={({ pressed }) => [
                            styles.stepButton,
                            isDone && styles.stepButtonDone,
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <Text style={[styles.stepButtonText, isDone && styles.stepButtonTextDone]}>
                            {isDone ? 'Connection placed' : step.action}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.safetyCard}>
                <Text style={styles.safetyEyebrow}>WHY 220 OHMS?</Text>
                <Text style={styles.safetyText}>
                  The resistor reduces current so the LED and microcontroller pin stay within a safe operating range.
                </Text>
                <Text style={styles.safetyFormula}>CURRENT = (5 V - LED DROP) / RESISTANCE</Text>
              </View>
            </View>
          </View>

          <View style={styles.courseStrip}>
            <View>
              <Text style={styles.eyebrow}>NEXT IN CIRCUIT COACH</Text>
              <Text style={styles.courseTitle}>Button input and pull-up resistors</Text>
            </View>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>UP NEXT</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ConnectionPath({ label, active, tone }: { label: string; active: boolean; tone: 'coral' | 'gold' | 'green' | 'ink' }) {
  const activeStyle =
    tone === 'coral'
      ? styles.pathCoral
      : tone === 'gold'
        ? styles.pathGold
        : tone === 'green'
          ? styles.pathGreen
          : styles.pathInk;

  return (
    <View style={styles.pathRow}>
      <Text style={styles.pathLabel}>{label}</Text>
      <View style={[styles.pathLine, active && activeStyle]} />
      <View style={[styles.pathNode, active && activeStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F6F0',
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingBottom: 34,
  },
  pageWide: {
    paddingHorizontal: 32,
  },
  topBar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: '#172B3A',
    fontFamily: headingFont,
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: 0,
  },
  brandSubhead: {
    color: '#56706B',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  lessonBadge: {
    backgroundColor: '#172B3A',
    borderRadius: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  lessonBadgeText: {
    color: '#FFFFFF',
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  hero: {
    backgroundColor: '#D9EED1',
    borderColor: '#BDDAB1',
    borderRadius: 8,
    borderWidth: 1,
    gap: 24,
    marginTop: 6,
    overflow: 'hidden',
    padding: 24,
  },
  heroWide: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
    paddingVertical: 28,
  },
  heroCopy: {
    flex: 1,
    maxWidth: 700,
  },
  eyebrow: {
    color: '#557169',
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: '#172B3A',
    fontFamily: headingFont,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 39,
    marginTop: 6,
  },
  heroDescription: {
    color: '#38534F',
    fontFamily: bodyFont,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 9,
    maxWidth: 610,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  progressTrack: {
    backgroundColor: '#B6D7AE',
    borderRadius: 3,
    flex: 1,
    height: 8,
    maxWidth: 410,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#F25A41',
    borderRadius: 3,
    height: '100%',
  },
  progressText: {
    color: '#38534F',
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: '700',
  },
  miniCurriculum: {
    backgroundColor: '#F8FBF6',
    borderColor: '#BDDAB1',
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 196,
    padding: 16,
  },
  miniCurriculumLabel: {
    color: '#557169',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  miniCurriculumItem: {
    color: '#172B3A',
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
  },
  workspace: {
    gap: 22,
    marginTop: 22,
  },
  workspaceWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  labColumn: {
    flex: 1.25,
    minWidth: 0,
  },
  stepsColumn: {
    flex: 0.75,
    minWidth: 0,
  },
  sectionHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  sectionTitle: {
    color: '#172B3A',
    fontFamily: headingFont,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusBuilding: {
    backgroundColor: '#FDE4AA',
  },
  statusReady: {
    backgroundColor: '#CDE8C5',
  },
  statusPillText: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.55,
  },
  statusBuildingText: {
    color: '#805D12',
  },
  statusReadyText: {
    color: '#37663A',
  },
  workbench: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E3DC',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  arduinoCard: {
    backgroundColor: '#CCEAF2',
    borderColor: '#8EC8D7',
    borderRadius: 6,
    borderWidth: 1,
    padding: 14,
  },
  arduinoHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  arduinoName: {
    color: '#1B5061',
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.75,
  },
  arduinoLight: {
    backgroundColor: '#66B37C',
    borderColor: '#3F8A59',
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  pinRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  pinGroup: {
    backgroundColor: '#F7FCFD',
    borderColor: '#A8D5DF',
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  pinLabel: {
    color: '#172B3A',
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: '700',
  },
  pinCaption: {
    color: '#547178',
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.55,
    marginTop: 2,
  },
  connectionStack: {
    gap: 5,
    marginLeft: 28,
    marginVertical: 12,
  },
  pathRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pathLabel: {
    color: '#60736E',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    width: 58,
  },
  pathLine: {
    backgroundColor: '#D9E3DC',
    flex: 1,
    height: 4,
  },
  pathNode: {
    backgroundColor: '#D9E3DC',
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  pathCoral: {
    backgroundColor: '#F25A41',
  },
  pathGold: {
    backgroundColor: '#E8B33E',
  },
  pathGreen: {
    backgroundColor: '#64A66F',
  },
  pathInk: {
    backgroundColor: '#49636C',
  },
  breadboard: {
    backgroundColor: '#FCFDFB',
    borderColor: '#D7E0D9',
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 230,
    overflow: 'hidden',
    padding: 13,
    position: 'relative',
  },
  powerRail: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 11,
  },
  railPlus: {
    color: '#F25A41',
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: '700',
  },
  railLine: {
    backgroundColor: '#F8C9BF',
    flex: 1,
    height: 2,
  },
  railMinus: {
    color: '#49636C',
    fontFamily: monoFont,
    fontSize: 16,
    fontWeight: '700',
  },
  breadboardBody: {
    flexDirection: 'row',
    gap: 10,
    opacity: 0.85,
  },
  holeGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-around',
  },
  hole: {
    backgroundColor: '#B9C8BF',
    borderColor: '#E7ECE8',
    borderRadius: 3,
    borderWidth: 1,
    height: 7,
    width: 7,
  },
  centerGap: {
    backgroundColor: '#E3EAE4',
    width: 8,
  },
  circuitParts: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    left: 20,
    position: 'absolute',
    right: 20,
    top: 81,
  },
  resistor: {
    alignItems: 'center',
    flexDirection: 'row',
    opacity: 0.35,
  },
  resistorActive: {
    opacity: 1,
  },
  resistorWire: {
    backgroundColor: '#A5B1AA',
    height: 2,
    width: 22,
  },
  resistorBody: {
    alignItems: 'center',
    backgroundColor: '#E9C98B',
    borderColor: '#BA9855',
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: 'row',
    height: 20,
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    width: 62,
  },
  resistorBandOne: {
    backgroundColor: '#CC5B42',
    height: '100%',
    width: 5,
  },
  resistorBandTwo: {
    backgroundColor: '#6B5C46',
    height: '100%',
    width: 5,
  },
  resistorBandThree: {
    backgroundColor: '#BB8A22',
    height: '100%',
    width: 5,
  },
  ledAssembly: {
    alignItems: 'center',
    marginTop: 9,
  },
  ledDome: {
    backgroundColor: '#C7DBCF',
    borderColor: '#789B86',
    borderRadius: 22,
    borderWidth: 2,
    height: 43,
    width: 43,
  },
  ledDomeLit: {
    backgroundColor: '#FFE484',
    borderColor: '#E3A739',
  },
  ledLegs: {
    flexDirection: 'row',
    gap: 16,
  },
  ledLeg: {
    backgroundColor: '#A5B1AA',
    height: 35,
    width: 2,
  },
  ledLegActive: {
    backgroundColor: '#F25A41',
  },
  ledLegGrounded: {
    backgroundColor: '#49636C',
  },
  componentCaption: {
    color: '#60736E',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  feedbackPanel: {
    borderLeftWidth: 4,
    borderRadius: 4,
    marginTop: 14,
    padding: 12,
  },
  feedbackNeutral: {
    backgroundColor: '#F2F6F0',
    borderLeftColor: '#86A49B',
  },
  feedbackReady: {
    backgroundColor: '#E5F3DF',
    borderLeftColor: '#63A66E',
  },
  feedbackLabel: {
    color: '#557169',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.65,
  },
  feedbackText: {
    color: '#29453F',
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 3,
  },
  workbenchActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#F25A41',
    borderRadius: 5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: headingFont,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#AFC2B7',
    borderRadius: 5,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#476059',
    fontFamily: headingFont,
    fontSize: 14,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  stepCount: {
    color: '#557169',
    fontFamily: monoFont,
    fontSize: 11,
    fontWeight: '700',
  },
  stepList: {
    gap: 10,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D9E3DC',
    borderRadius: 7,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  stepCardDone: {
    backgroundColor: '#F7FCF5',
    borderColor: '#B5D8AE',
  },
  stepNumber: {
    alignItems: 'center',
    backgroundColor: '#FDE4AA',
    borderRadius: 5,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepNumberDone: {
    backgroundColor: '#75B26F',
  },
  stepNumberText: {
    color: '#805D12',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
  },
  stepNumberTextDone: {
    color: '#FFFFFF',
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepEyebrow: {
    color: '#758881',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.55,
  },
  stepTitle: {
    color: '#172B3A',
    fontFamily: headingFont,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  stepDetail: {
    color: '#536964',
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  stepButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#172B3A',
    borderRadius: 4,
    marginTop: 10,
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepButtonDone: {
    backgroundColor: '#D9EED1',
  },
  stepButtonText: {
    color: '#FFFFFF',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
  },
  stepButtonTextDone: {
    color: '#38623A',
  },
  safetyCard: {
    backgroundColor: '#FFF6D9',
    borderColor: '#F0D68A',
    borderRadius: 7,
    borderWidth: 1,
    marginTop: 13,
    padding: 15,
  },
  safetyEyebrow: {
    color: '#805D12',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.75,
  },
  safetyText: {
    color: '#624E27',
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  safetyFormula: {
    color: '#805D12',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 10,
  },
  courseStrip: {
    alignItems: 'center',
    borderTopColor: '#CCD9D0',
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 26,
    paddingTop: 18,
  },
  courseTitle: {
    color: '#172B3A',
    fontFamily: headingFont,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 3,
  },
  nextBadge: {
    backgroundColor: '#CCEAF2',
    borderRadius: 5,
    marginLeft: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nextBadgeText: {
    color: '#1B5061',
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.55,
  },
});
