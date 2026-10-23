// Lab 08: Sorting gate. The Lab 04 knob drives a servo's angle through map():
// position control, the same motion a diverter gate or a robot joint makes.
// The servo's three legs wire like a plug: GND, 5V, and a signal pin.

import { type Circuit } from '../engine/circuit';
import { findShort } from '../engine/ledLoop';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { circuitOf } from '../runtime';
import { dividerWired } from './lab04';

const SIGNAL = { node: 'D9', name: 'pin ~9' };

/** Servo legs, in plug order: GND (brown), 5V (red), signal (orange). */
const LEG = { gnd: 0, vcc: 1, sig: 2 };

const SKETCH = `// sorting_gate.ino: Lab 08
// The knob on A0 sets the gate's angle: 0–1023 mapped to 0–180°.

const int DIAL_PIN = A0;
const int SERVO_PIN = 9;      // signal leg (orange)

int angle = 0;

void setup() {
  pinMode(SERVO_PIN, OUTPUT); // a real sketch uses Servo.attach(9)
}

void loop() {
  int reading = analogRead(DIAL_PIN);
  angle = map(reading, 0, 1023, 0, 180);   // 0–1023 in, 0–180° out
  // servo.write(angle);  the driver pulses pin 9 to hold that angle
  delay(15);
}`;

export type ServoStatus = 'unplaced' | 'ok' | 'swapped' | 'on33' | 'sigWrongPin' | 'gndMissing' | 'incomplete';

/**
 * How the servo's plug is wired: GND leg to GND, 5V leg to 5V, signal leg to
 * the signal pin. 'swapped' is power and signal crossed; 'on33' feeds it 3.3V.
 */
export function servoStatus(c: Circuit, servoId = 'servo', signalNode = SIGNAL.node): ServoStatus {
  const legs = c.legNets(servoId);
  if (!legs) return 'unplaced';
  const on = (node: string, leg: number) => c.wired(node) && legs[leg] === c.net(node);
  // Power and signal crossed: the signal leg sits on 5V and the red leg on a pin.
  if (on('5V', LEG.sig)) {
    const pinFed = c.board.wires.some((w) => {
      const pin = PIN_BY_ID[w.pin];
      return pin.kind === 'digital' && legs[LEG.vcc] === c.net(pin.node);
    });
    if (pinFed) return 'swapped';
  }
  if (on('3V3', LEG.vcc)) return 'on33';
  const sigOn = (node: string) => c.wired(node) && legs[LEG.sig] === c.net(node);
  if (on('5V', LEG.vcc) && !sigOn(signalNode)) {
    const other = c.board.wires.find((w) => {
      const pin = PIN_BY_ID[w.pin];
      return (pin.kind === 'digital' || pin.kind === 'analog') && legs[LEG.sig] === c.net(pin.node);
    });
    if (other) return 'sigWrongPin';
  }
  if (on('5V', LEG.vcc) && sigOn(signalNode) && !on('GND', LEG.gnd)) return 'gndMissing';
  return on('5V', LEG.vcc) && sigOn(signalNode) && on('GND', LEG.gnd) ? 'ok' : 'incomplete';
}

/** The gate's angle in degrees from the knob, when the servo is wired to move. */
export function gateAngle(c: Circuit, knob: number): number | null {
  if (servoStatus(c) !== 'ok') return null;
  return Math.round(knob * 180);
}

export const LAB08: LabDef = {
  id: 'lab08',
  title: 'Lab 08: Sorting gate',
  sketch: { name: 'sorting_gate', code: SKETCH, highlightLine: 13 },
  parts: [
    { def: 'pot', id: 'pot', name: '10 kΩ potentiometer' },
    { def: 'servo', id: 'servo' },
  ],

  verdict: {
    mistakes: ['short', 'swapped'],
    order: ['short', 'pass', 'swapped', 'on33', 'sigWrongPin', 'gndMissing', 'servoOpen', 'dial', 'missingParts', 'open'],
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
        case 'pass': {
          if (servoStatus(c) !== 'ok' || !dividerWired(c)) return null;
          return {
            title: 'Circuit check passed',
            detail: 'Servo: brown leg to GND, red to 5V, orange (signal) to pin ~9, and the dial divides 0 to 5 V into A0. Turn the knob to swing the gate.',
          };
        }
        case 'swapped': {
          if (servoStatus(c) !== 'swapped') return null;
          return {
            title: 'The servo’s power and signal are swapped',
            detail:
              'The orange signal leg is sitting on 5V and the red power leg on a pin. The servo reads pulses on its signal leg. Fed a steady 5V it just sits at one end. Brown → GND, red → 5V, orange → pin ~9.',
          };
        }
        case 'on33': {
          if (servoStatus(c) !== 'on33') return null;
          return {
            title: 'The servo is powered from 3.3V',
            detail:
              'A servo’s motor wants 5 V. On 3.3V it jitters and stalls under load, the classic “servo twitches but won’t move” problem. Move the red leg’s jumper from 3.3V to 5V.',
          };
        }
        case 'sigWrongPin': {
          if (servoStatus(c) !== 'sigWrongPin') return null;
          const legs = c.legNets('servo')!;
          const wire = c.board.wires.find((w) => {
            const pin = PIN_BY_ID[w.pin];
            return (pin.kind === 'digital' || pin.kind === 'analog') && legs[LEG.sig] === c.net(pin.node);
          });
          const name = wire ? PIN_BY_ID[wire.pin].name : 'another pin';
          return {
            title: `The signal leg is on ${name}, not pin ~9`,
            detail: `The sketch sends the angle pulses to pin 9 (const int SERVO_PIN = 9), so ${name} never moves the gate. Move that jumper to pin ~9.`,
          };
        }
        case 'gndMissing': {
          if (servoStatus(c) !== 'gndMissing') return null;
          return {
            title: 'The servo’s ground isn’t connected',
            detail:
              'Signal and power are wired, but the brown leg doesn’t reach GND. The signal’s pulses are measured against ground. With no shared ground they mean nothing. Wire the brown leg’s column to GND.',
          };
        }
        case 'servoOpen': {
          const status = servoStatus(c);
          if (status === 'unplaced' || status === 'ok') return null;
          return {
            title: 'The servo’s plug isn’t fully wired',
            detail: 'Three jumpers: brown leg to GND, red leg to 5V, orange (signal) leg to pin ~9.',
          };
        }
        case 'dial': {
          if (!c.part('pot') || dividerWired(c)) return null;
          return {
            title: 'The dial isn’t wired yet',
            detail: 'Same as Lab 04: pot outer legs to 5V and GND, the middle leg (wiper) to A0.',
          };
        }
        case 'missingParts': {
          const missing = [
            ['pot', 'the potentiometer'],
            ['servo', 'the servo'],
          ]
            .filter(([id]) => !c.part(id))
            .map(([, name]) => name);
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'Drag the pot and the servo onto the breadboard, each leg in its own column.',
          };
        }
        case 'open':
          return {
            title: 'The gate isn’t wired yet',
            detail: 'The dial (pot → A0) sets the angle; the servo (GND, 5V, signal → pin ~9) moves to it.',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 150,
    onTick(lab, store) {
      const angle = gateAngle(circuitOf(lab, store.state), knobOf(store.state));
      return { lab, state: { ...store.state, behavior: { ...store.state.behavior, servo: angle ?? 0 } } };
    },
    runningNote(lab, store) {
      const c = circuitOf(lab, store.state);
      if (servoStatus(c) !== 'ok') return { title: 'The sketch is running, but the gate doesn’t move', detail: '' };
      return { title: 'The sketch is running, but the gate ignores the knob', detail: '' };
    },
    success: 'Turn the knob: the gate swings through its 0–180° throw. Lab 08 complete!',
  },

  // One correct build, shown by "Show solution" in the lab guide.
  solution: {
    parts: { pot: { row: 0, col: 2 }, servo: { row: 0, col: 8 } },
    wires: [['5V', { row: 1, col: 2 }], ['A0', { row: 1, col: 4 }], ['GND_T', { row: 1, col: 6 }], ['GND_P1', { row: 1, col: 8 }], ['IOREF', { row: 1, col: 10 }], ['D9', { row: 1, col: 12 }]],
  },

  steps: [
    {
      id: 'dial',
      title: 'Wire the dial from Lab 04',
      detail: 'Pot outer legs to 5V and GND, wiper to A0.',
      built: (q) => dividerWired(q),
    },
    {
      id: 'servo',
      title: 'Plug in the servo: GND, 5V, signal',
      detail: 'Brown leg to GND, red leg to 5V, orange (signal) leg to pin ~9.',
      built: (q) => servoStatus(q) === 'ok',
    },
    {
      id: 'upload',
      title: 'Upload and swing the gate',
      detail: 'The knob maps 0–1023 to 0–180°. Watch the horn follow.',
    },
  ],

  guide: {
    intro: 'A diverter gate, in miniature: instead of a conveyor knob setting speed, here it sets a position. The servo turns to the angle you ask for and holds it.',
    explainers: [
      {
        title: 'Position, not speed',
        body: 'A servo listens for a pulse every 20 ms; the pulse’s width (about 1–2 ms) says which angle to hold. Inside, a small motor and a sensor close the loop, so it fights to stay at the commanded position.',
      },
      {
        title: 'map() rescales a range',
        body: 'map(reading, 0, 1023, 0, 180) turns the dial’s 0–1023 into 0–180°. Same function the HMI uses to show a valve’s percent-open as degrees of travel.',
      },
      {
        title: 'On the factory floor',
        body: 'Sorting lines use position-controlled gates to divert boxes; robot arms are stacks of position-controlled joints. The control idea (command a position, let the drive close the loop) is the same from a $3 servo to a factory axis.',
      },
    ],
    proTip: {
      title: 'Pro tip: the Servo library',
      body: 'Real sketches don’t pulse the pin by hand: Servo.attach(9) takes over the timer and servo.write(angle) holds the angle. The commented lines in this sketch are what production code does.',
    },
  },
  next: { id: 'lab09', title: 'Lab 09: Conveyor motor' },
};

function knobOf(state: { behavior: Record<string, unknown> }): number {
  return typeof state.behavior.knob === 'number' ? state.behavior.knob : 0.5;
}
