// Lab 12: Mini sorting line (capstone). Every idea from the course on one
// bench: a light sensor reads each box, the sketch decides, a servo gate
// diverts the dark ones, and the stack light plus Serial show the line's
// status. A button pauses the line. This is the logic a PLC runs.

import type { Circuit } from '../engine/circuit';
import { inputPinState, pressReaches } from '../engine/inputs';
import { type LedLoop, findLoop, findShort } from '../engine/ledLoop';
import type { LabDef } from '../lab';
import { type LabStore, type RuntimeState, appendLog, circuitOf, nextRandom, printSerial } from '../runtime';
import { ldrReading, sensorDivider } from './lab06';
import { servoStatus } from './lab08';

const SENSOR = { node: 'A0', name: 'A0', ldr: 'ldr', fixed: 'pullSensor' };
const SERVO = { node: 'D9', name: 'pin ~9', part: 'servo' };
const PAUSE = { node: 'D2', name: 'pin 2', part: 'button', pullDowns: ['pullButton'] };

const CHANNELS: { color: string; loop: LedLoop; meaning: string }[] = [
  { color: 'green', loop: { signal: { node: 'D5', name: 'pin 5' }, led: 'ledGreen', resistor: 'resistorG' }, meaning: 'running' },
  { color: 'yellow', loop: { signal: { node: 'D6', name: 'pin 6' }, led: 'ledYellow', resistor: 'resistorY' }, meaning: 'paused' },
  { color: 'red', loop: { signal: { node: 'D7', name: 'pin 7' }, led: 'ledRed', resistor: 'resistorR' }, meaning: 'gate open' },
];

/** One box per cycle; the box sits in the beam at these phases. */
const CYCLE = 10;
const IN_BEAM = [5, 6];
const DECIDE_AT = 6;
const DARK_CHANCE = 0.4;

const SKETCH = `// mini_sorting_line.ino: Lab 12 (capstone)
// Sense → decide → actuate → indicate: the loop a PLC runs.
// Dark boxes break the beam hard; the gate diverts them.

const int SENSOR_PIN = A0;
const int GATE_PIN = 9;        // servo: 0° pass, 90° divert
const int PAUSE_PIN = 2;       // 10 kΩ pull-down
const int GREEN = 5, YELLOW = 6, RED = 7;
const int THRESHOLD = 400;     // tune for your lighting
int sorted = 0, passed = 0;
bool paused = false;

void setup() {
  pinMode(GREEN, OUTPUT);
  pinMode(YELLOW, OUTPUT);
  pinMode(RED, OUTPUT);
  pinMode(PAUSE_PIN, INPUT);
  Serial.begin(9600);
}

void loop() {
  // … pause toggle on a button edge …
  if (paused) return;                        // yellow lamp on
  int reading = analogRead(SENSOR_PIN);      // SENSE
  bool dark = reading < THRESHOLD;           // DECIDE
  // servo.write(dark ? 90 : 0);             // ACTUATE
  if (dark) sorted++; else passed++;         // COUNT
  Serial.print("Sorted ");
  Serial.print(sorted);
  Serial.print(" dark, ");
  Serial.print(passed);
  Serial.println(" light.");
}`;

function sensorOk(c: Circuit): boolean {
  return sensorDivider(c, SENSOR.ldr, SENSOR.fixed, SENSOR.node) !== null;
}

function buttonOk(c: Circuit): boolean {
  return inputPinState(c, PAUSE.node, PAUSE.pullDowns) === 'low' && pressReaches(c, PAUSE.part, PAUSE.node, PAUSE.pullDowns);
}

function loopsOk(c: Circuit): boolean {
  return CHANNELS.every((ch) => {
    const found = findLoop(c, ch.loop);
    return found?.kind === 'ok' && found.source.node === ch.loop.signal.node;
  });
}

function runLoop(lab: LabDef, store: LabStore): LabStore {
  const { state } = store;
  const button = inputPinState(circuitOf(lab, state), PAUSE.node, PAUSE.pullDowns) === 'high';
  const wasButton = state.behavior.lastButton === true;
  let paused = state.behavior.paused === true;
  let next: RuntimeState = { ...state, behavior: { ...state.behavior, lastButton: button } };

  if (button && !wasButton) {
    paused = !paused;
    next = { ...next, behavior: { ...next.behavior, paused } };
    next = appendLog(next, ['info', paused ? 'Line paused. The yellow lamp is on; boxes hold where they are.' : 'Line running.']);
    return { lab, state: next };
  }
  if (paused) return { lab, state: next };

  const c = circuitOf(lab, next);
  const phase = ((typeof next.behavior.phase === 'number' ? next.behavior.phase : 0) + 1) % CYCLE;
  let boxDark = next.behavior.boxDark === true;
  let seed = next.seed;
  if (phase === 0) {
    const drawn = nextRandom(seed);
    seed = drawn.seed;
    boxDark = drawn.value < DARK_CHANCE;
  }
  const gate = boxDark && phase >= DECIDE_AT && phase <= CYCLE - 1;
  next = { ...next, seed, behavior: { ...next.behavior, phase, boxDark, ldr: IN_BEAM.includes(phase) && boxDark, servo: gate ? 90 : 0 } };

  if (phase === DECIDE_AT && sensorOk(c)) {
    const sorted = (typeof state.behavior.sorted === 'number' ? state.behavior.sorted : 0) + (boxDark ? 1 : 0);
    const passed = (typeof state.behavior.passed === 'number' ? state.behavior.passed : 0) + (boxDark ? 0 : 1);
    const total = sorted + passed;
    next = { ...next, behavior: { ...next.behavior, sorted, passed } };
    next = printSerial(next, `Box ${total}: ${boxDark ? 'dark, gate opens' : 'light, passes'}  (sorted ${sorted} dark, ${passed} light)`);
  }
  return { lab, state: next };
}

export const LAB12: LabDef = {
  id: 'lab12',
  title: 'Lab 12: Mini sorting line',
  sketch: { name: 'mini_sorting_line', code: SKETCH, highlightLine: 27 },
  parts: [
    { def: 'ldr', id: 'ldr' },
    { def: 'resistor10k', id: 'pullSensor', name: '10 kΩ resistor (sensor)' },
    { def: 'servo', id: 'servo' },
    { def: 'led', id: 'ledGreen', name: 'Green LED', color: 'green' },
    { def: 'resistor', id: 'resistorG', name: '220 Ω resistor' },
    { def: 'led', id: 'ledYellow', name: 'Yellow LED', color: 'yellow' },
    { def: 'resistor', id: 'resistorY', name: '220 Ω resistor' },
    { def: 'led', id: 'ledRed', name: 'Red LED', color: 'red' },
    { def: 'resistor', id: 'resistorR', name: '220 Ω resistor' },
    { def: 'button', id: 'button' },
    { def: 'resistor10k', id: 'pullButton', name: '10 kΩ resistor (button)' },
  ],

  verdict: {
    mistakes: ['short'],
    order: ['short', 'burnt', 'pass', 'ledLoops', 'servo', 'sensor', 'floating', 'buttonOpen', 'missingParts', 'open'],
    check(code, c) {
      switch (code) {
        case 'short': {
          const short = findShort(c);
          if (!short) return null;
          return {
            title: `Short circuit: ${short.a.name} is wired straight to ${short.b.name}`,
            detail: 'Two supply nodes are joined with nothing between them. Give each one its own strip.',
          };
        }
        case 'burnt': {
          const dead = CHANNELS.find((ch) => c.board.burnt.includes(ch.loop.led));
          return dead
            ? {
                title: `The ${dead.color} LED is burned out`,
                detail: 'Drag it back to the parts bin for a fresh one, and keep its 220 Ω resistor in the loop this time.',
              }
            : null;
        }
        case 'pass': {
          if (!sensorOk(c) || servoStatus(c, SERVO.part, SERVO.node) !== 'ok' || !loopsOk(c) || !buttonOk(c)) return null;
          return {
            title: 'Circuit check passed',
            detail:
              'Sensor divider into A0, servo gate on pin ~9, stack light on 5/6/7, pause button on pin 2 with its pull-down. The cell is ready to run.',
          };
        }
        case 'ledLoops': {
          for (const ch of CHANNELS) {
            const found = findLoop(c, ch.loop);
            if (!found) continue;
            if (found.kind === 'ok' && found.source.node !== ch.loop.signal.node) {
              const other = CHANNELS.find((o) => o.loop.signal.node === found.source.node);
              return {
                title: `The ${ch.color} LED is on ${found.source.name}`,
                detail: other
                  ? `The sketch lights ${ch.color} for “${ch.meaning}” on ${ch.loop.signal.name}. Right now ${found.source.name} drives it. Move the signal jumper.`
                  : `It glows, but ${found.source.name} never switches from the sketch. The ${ch.color} lamp belongs on ${ch.loop.signal.name}.`,
              };
            }
            if (found.kind === 'bypassed') {
              return { title: `Both legs of the ${ch.color} LED share one strip`, detail: 'Current skips the LED. Put its two legs in different numbered columns.' };
            }
            if (found.kind === 'noResistor') {
              return {
                title: `No resistor in the ${ch.color} LED’s loop`,
                detail: `${found.source.name} connects straight to the LED. Put its 220 Ω resistor in series.`,
              };
            }
            if (found.kind === 'wrongPin') {
              const other = CHANNELS.find((o) => o.loop.signal.name === found.pinName);
              return {
                title: `The ${ch.color} LED is on ${found.pinName}`,
                detail: other
                  ? `The sketch lights ${ch.color} for “${ch.meaning}” on ${ch.loop.signal.name}, but ${other.loop.signal.name} drives it, so “${other.meaning}” would light the ${ch.color} lamp. Move its signal jumper to ${ch.loop.signal.name}.`
                  : `The sketch drives ${ch.loop.signal.name} for “${ch.meaning}”, so ${found.pinName} never lights it. Move that jumper to ${ch.loop.signal.name}.`,
              };
            }
            if (found.kind === 'reversed' && found.source.node === ch.loop.signal.node) {
              return {
                title: `The ${ch.color} LED is in backwards`,
                detail: `Tap the ${ch.color} LED to flip it so + faces ${ch.loop.signal.name}.`,
              };
            }
          }
          return null;
        }
        case 'servo': {
          const status = servoStatus(c, SERVO.part, SERVO.node);
          if (status === 'unplaced' || status === 'ok') return null;
          const detail =
            status === 'swapped'
              ? 'Power and signal are crossed: brown → GND, red → 5V, orange → pin ~9.'
              : status === 'on33'
                ? 'The gate servo is on 3.3V, so it will jitter and stall. Move the red leg’s jumper to 5V.'
                : status === 'gndMissing'
                  ? 'The servo’s brown leg doesn’t reach GND; the signal pulses have no reference.'
                  : 'Three jumpers: brown leg to GND, red leg to 5V, orange (signal) leg to pin ~9.';
          return { title: 'The gate servo isn’t wired right', detail };
        }
        case 'sensor': {
          if (!c.part(SENSOR.ldr) || sensorOk(c)) return null;
          return {
            title: 'The box sensor isn’t wired yet',
            detail: 'Like Lab 06: 5V → photoresistor → A0 → 10 kΩ → GND. Dark boxes pull the reading below the 400 threshold.',
          };
        }
        case 'floating': {
          if (!c.part(PAUSE.part) || inputPinState(c, PAUSE.node, PAUSE.pullDowns) !== 'floating') return null;
          return {
            title: 'Pin 2 is floating',
            detail: 'The pause button can trip on its own. Add its 10 kΩ pull-down from pin 2’s column to GND.',
          };
        }
        case 'buttonOpen':
          return c.part(PAUSE.part) && inputPinState(c, PAUSE.node, PAUSE.pullDowns) === 'low' && !pressReaches(c, PAUSE.part, PAUSE.node, PAUSE.pullDowns)
            ? {
                title: 'Pressing the button doesn’t reach pin 2',
                detail: 'Wire 5V to one side of the button and pin 2 to the other side, across the center gap.',
              }
            : null;
        case 'missingParts': {
          const missing = [
            ['ldr', 'the photoresistor'],
            ['pullSensor', 'the sensor’s 10 kΩ resistor'],
            ['servo', 'the servo'],
            ['ledGreen', 'the green LED'],
            ['ledYellow', 'the yellow LED'],
            ['ledRed', 'the red LED'],
            ['button', 'the pause button'],
            ['pullButton', 'the button’s 10 kΩ resistor'],
          ]
            .filter(([id]) => !c.part(id))
            .map(([, name]) => name);
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'The line needs its sensor divider, the gate servo, three stack-light loops, and the pause button.',
          };
        }
        case 'open':
          return {
            title: 'The sorting line isn’t wired yet',
            detail:
              'Four subsystems, all from earlier labs: sensor divider (Lab 06), servo gate (Lab 08), stack light (Lab 03), pause button (Lab 02).',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 400,
    onUpload(lab, store) {
      return { lab, state: printSerial(store.state, 'Serial Monitor open at 9600 baud. Line running.') };
    },
    onTick: runLoop,
    onPress: (lab, store) => runLoop(lab, store),
    analogReads(lab, store): Record<string, number> {
      const { state } = store;
      const c = circuitOf(lab, state);
      const phase = typeof state.behavior.phase === 'number' ? state.behavior.phase : 0;
      const light = IN_BEAM.includes(phase) && state.behavior.boxDark === true ? 0 : 1;
      const reading = ldrReading(c, light, SENSOR.ldr, SENSOR.fixed, SENSOR.node);
      return reading === null ? {} : { A0: reading };
    },
    outputs(lab, store) {
      const { state } = store;
      if (state.behavior.paused === true) return ['D6'];
      const phase = typeof state.behavior.phase === 'number' ? state.behavior.phase : 0;
      const gate = state.behavior.boxDark === true && phase >= DECIDE_AT;
      return gate ? ['D5', 'D7'] : ['D5'];
    },
    runningNote(lab, store) {
      const c = circuitOf(lab, store.state);
      if (!sensorOk(c)) return { title: 'The line is running, but the sensor never sees a box', detail: '' };
      if (servoStatus(c, SERVO.part, SERVO.node) !== 'ok') return { title: 'The line is running, but the gate never moves', detail: '' };
      return { title: 'The line is running, but the stack light doesn’t show its status', detail: '' };
    },
    success: 'Boxes pass, dark ones divert, the stack light tells the story. That is a work cell. Lab 12 complete, and the course is complete!',
  },

  // One correct build, shown by "Show solution" in the lab guide.
  solution: {
    parts: { ldr: { row: 0, col: 0 }, pullSensor: { row: 2, col: 3 }, servo: { row: 0, col: 8 }, ledGreen: { row: 7, col: 3 }, resistorG: { row: 5, col: 0 }, ledYellow: { row: 7, col: 9 }, resistorY: { row: 5, col: 6 }, ledRed: { row: 7, col: 14 }, resistorR: { row: 5, col: 11 }, button: { row: 2, col: 13 }, pullButton: { row: 8, col: 13 } },
    wires: [['5V', { row: -1, col: 0 }], ['IOREF', { row: 1, col: 10 }], ['D5', { row: 6, col: 0 }], ['D6', { row: 6, col: 6 }], ['D7', { row: 6, col: 11 }], ['D9', { row: 1, col: 12 }], ['A0', { row: 1, col: 3 }], ['D2', { row: 9, col: 13 }], ['GND_T', { row: 10, col: 16 }]],
    links: [[{ row: -1, col: 2 }, { row: 1, col: 0 }], [{ row: -1, col: 8 }, { row: 1, col: 13 }], [{ row: 1, col: 8 }, { row: 10, col: 8 }], [{ row: 1, col: 6 }, { row: 10, col: 6 }], [{ row: 5, col: 16 }, { row: 10, col: 12 }], [{ row: 9, col: 4 }, { row: 10, col: 4 }], [{ row: 9, col: 10 }, { row: 10, col: 10 }], [{ row: 9, col: 15 }, { row: 10, col: 15 }]],
  },

  steps: [
    {
      id: 'sensor',
      title: 'Wire the box sensor (Lab 06)',
      detail: 'Photoresistor and 10 kΩ as a divider into A0: 5V → LDR → A0 → 10 kΩ → GND.',
      built: (q) => sensorOk(q),
    },
    {
      id: 'gate',
      title: 'Wire the gate servo (Lab 08)',
      detail: 'Brown leg to GND, red to 5V, orange (signal) to pin ~9.',
      built: (q) => servoStatus(q, SERVO.part, SERVO.node) === 'ok',
    },
    {
      id: 'stack',
      title: 'Build the stack light on pins 5/6/7 (Lab 03)',
      detail: 'Green, yellow, red: each LED with its own 220 Ω resistor to GND.',
      built: (q) => loopsOk(q),
    },
    {
      id: 'pause',
      title: 'Wire the pause button (Lab 02)',
      detail: '5V → button → pin 2, with the 10 kΩ pull-down to GND.',
      built: (q) => buttonOk(q),
    },
    {
      id: 'upload',
      title: 'Upload and run the line',
      detail: 'Boxes slide past; dark ones open the gate. The button pauses the line. Try tuning THRESHOLD in the sketch.',
    },
  ],

  guide: {
    intro:
      'The capstone: a whole automated work cell on one breadboard. Nothing here is new. That is the point. Sense, decide, actuate, indicate, all running the same loop a PLC runs.',
    explainers: [
      {
        title: 'Sense → decide → actuate → indicate',
        body: 'Every automated cell is this loop: read a sensor, apply a rule, move an actuator, show the state. Your sketch reads the beam, compares it to a threshold, swings the gate, and lights the stack.',
      },
      {
        title: 'What a PLC is',
        body: 'A programmable logic controller is an industrial computer that runs exactly this loop, thousands of times a second, reading factory inputs and driving outputs. It’s rugged, certified, and programmed in ladder logic, but the decisions are the ones you just wrote.',
      },
      {
        title: 'The same logic as a ladder diagram',
        body: 'Drawn as a ladder: the pause contact and the beam contact feed the gate coil, with the lamps in parallel rungs. Contacts are inputs, coils are outputs. If you can read this sketch, you can read a ladder rung.',
      },
    ],
    proTip: {
      title: 'Where next',
      body: 'Tune THRESHOLD and the gate timing, and try to raise your sorting score. Then look up “ladder diagram” and redraw this line as rungs. You already know what every symbol does.',
    },
  },
};
