// Lab 09: Conveyor motor. A pin can't power a motor, so pin 9 drives a
// transistor and the transistor switches a separate 9 V battery. The flyback
// diode absorbs the motor's switch-off spike. This is a contactor in a motor
// control cabinet, at breadboard scale.

import { type Circuit } from '../engine/circuit';
import { inputPinState, pressReaches } from '../engine/inputs';
import { findShort } from '../engine/ledLoop';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { type LabStore, type RuntimeState, appendLog, circuitOf } from '../runtime';

const BASE_PIN = { node: 'D9', name: 'pin 9' };
const BUTTON = { node: 'D2', name: 'pin 2', part: 'button', pullDowns: ['resistor10k'] };

/** PN2222 legs, flat side facing you: emitter, base, collector. */
const LEG = { emitter: 0, base: 1, collector: 2 };

const SKETCH = `// conveyor_motor.ino — Lab 09
// Pin 9 drives a transistor; the transistor switches the motor's own 9 V
// battery. Hold the start button on pin 2 to run the conveyor.

const int MOTOR_PIN = 9;      // to the transistor's base
const int BUTTON_PIN = 2;     // 10 kΩ pull-down to GND

void setup() {
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  // The pin supplies a few mA to the base; the transistor passes the
  // battery's current through the motor. Control and power stay separate.
  digitalWrite(MOTOR_PIN, digitalRead(BUTTON_PIN));
}`;

/** The battery's + and − nets, when it's on the board. */
function batteryNets(c: Circuit): { plus: string; minus: string } | null {
  const legs = c.legNets('battery');
  return legs ? { plus: legs[0], minus: legs[1] } : null;
}

/** Which motor leg is on the battery's + net ('high'), and which is left for the collector ('low'). */
function motorSides(c: Circuit): { high: string; low: string } | null {
  const battery = batteryNets(c);
  const legs = c.legNets('motor');
  if (!battery || !legs) return null;
  if (legs[0] === battery.plus) return { high: legs[0], low: legs[1] };
  if (legs[1] === battery.plus) return { high: legs[1], low: legs[0] };
  return null;
}

/** True when the battery's − leg shares the Arduino's ground — without it the transistor never switches. */
function commonGround(c: Circuit): boolean {
  const battery = batteryNets(c);
  return !!battery && c.wired('GND') && battery.minus === c.net('GND');
}

/** The full power path: battery+ → motor → collector, emitter → GND, base ← pin 9, battery− → GND. */
function powerPathOk(c: Circuit): boolean {
  const legs = c.legNets('transistor');
  const sides = motorSides(c);
  if (!legs || !sides || !commonGround(c)) return false;
  return legs[LEG.collector] === sides.low && legs[LEG.emitter] === c.net('GND') && c.wired(BASE_PIN.node) && legs[LEG.base] === c.net(BASE_PIN.node);
}

/** The flyback diode across the motor, band (cathode) toward battery +. */
function diodeOk(c: Circuit): boolean {
  const legs = c.legNets('diode');
  const sides = motorSides(c);
  if (!legs || !sides) return false;
  return legs[0] === sides.low && legs[1] === sides.high;
}

/** The diode reversed across the motor: it shorts the battery the moment the transistor switches on. */
function diodeBackwards(c: Circuit): boolean {
  const legs = c.legNets('diode');
  const sides = motorSides(c);
  if (!legs || !sides) return false;
  return legs[1] === sides.low && legs[0] === sides.high;
}

/** The motor wired straight onto a digital pin — the pin can't supply it and gets damaged. */
function motorOnPin(c: Circuit): string | null {
  const legs = c.legNets('motor');
  if (!legs) return null;
  const wire = c.board.wires.find((w) => {
    const pin = PIN_BY_ID[w.pin];
    return (pin.kind === 'digital' || pin.kind === 'analog') && legs.includes(c.net(pin.node));
  });
  return wire ? PIN_BY_ID[wire.pin].name : null;
}

function buttonState(c: Circuit): 'high' | 'low' | 'floating' | 'disconnected' {
  return inputPinState(c, BUTTON.node, BUTTON.pullDowns);
}

function motorRunning(lab: LabDef, store: LabStore): boolean {
  const { state } = store;
  if (!powerPathOk(circuitOf(lab, state))) return false;
  return state.pressed.includes(BUTTON.part);
}

function runLoop(lab: LabDef, store: LabStore): LabStore {
  const running = motorRunning(lab, store);
  const was = store.state.behavior.motorWas === true;
  let state: RuntimeState = { ...store.state, behavior: { ...store.state.behavior, motor: running ? 1 : 0, motorWas: running } };
  if (running && !was) {
    state = appendLog(state, ['info', 'Motor running: the pin drives the base, the transistor delivers the battery’s current.']);
  } else if (!running && was) {
    state = appendLog(state, ['info', 'Motor stopped. The inductive kick hit the flyback diode, not the transistor.']);
  }
  return { lab, state };
}

export const LAB09: LabDef = {
  id: 'lab09',
  title: 'Lab 09 · Conveyor motor',
  sketch: { name: 'conveyor_motor', code: SKETCH, highlightLine: 13 },
  parts: [
    { def: 'motor', id: 'motor' },
    { def: 'transistor', id: 'transistor' },
    { def: 'diode', id: 'diode' },
    { def: 'battery', id: 'battery' },
    { def: 'button', id: 'button' },
    { def: 'resistor10k', id: 'resistor10k' },
  ],

  verdict: {
    mistakes: ['short', 'motorOnPin', 'diodeBackwards', 'alwaysPressed'],
    order: [
      'short',
      'motorOnPin',
      'diodeBackwards',
      'pass',
      'transistorSwapped',
      'noCommonGround',
      'baseWrongPin',
      'floating',
      'buttonOpen',
      'powerOpen',
      'missingParts',
      'open',
    ],
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
        case 'motorOnPin': {
          const pin = motorOnPin(c);
          if (!pin) return null;
          return {
            title: `The motor is wired straight to ${pin}`,
            detail:
              'A motor draws hundreds of milliamps; a pin is rated for 20 mA and will be damaged trying. The pin drives the transistor’s base — the battery drives the motor.',
          };
        }
        case 'diodeBackwards': {
          if (!diodeBackwards(c)) return null;
          return {
            title: 'The diode is backwards — it shorts the battery',
            detail:
              'With the band away from +, the diode conducts from the battery straight through the transistor to GND the moment the motor starts. The band (cathode) points toward battery +. Tap the diode to flip it.',
          };
        }
        case 'pass': {
          if (!powerPathOk(c)) return null;
          if (buttonState(c) !== 'low' || !pressReaches(c, BUTTON.part, BUTTON.node, BUTTON.pullDowns)) return null;
          return {
            title: 'Circuit check passed',
            detail: diodeOk(c)
              ? 'Battery + → motor → collector, emitter → GND, base on pin 9, battery − joined to the Arduino’s GND, and the diode’s band toward +. Hold the button to run the conveyor.'
              : 'The power path is right and the button works. One thing missing: the flyback diode across the motor — it runs without it, but add the diode (band toward +) before the motor’s switch-off spike wears out the transistor.',
          };
        }
        case 'transistorSwapped': {
          const legs = c.legNets('transistor');
          const sides = motorSides(c);
          if (!legs || !sides || !c.wired('GND')) return null;
          if (legs[LEG.emitter] === sides.low && legs[LEG.collector] === c.net('GND')) {
            return {
              title: 'The transistor’s emitter and collector are swapped',
              detail:
                'A reversed transistor barely conducts — the motor may crawl or stay dead. Flat side facing you, the legs are E, B, C: emitter to GND, collector up to the motor.',
            };
          }
          return null;
        }
        case 'noCommonGround': {
          const battery = batteryNets(c);
          if (!battery || commonGround(c) || !motorSides(c)) return null;
          return {
            title: 'The battery’s − isn’t joined to the Arduino’s GND',
            detail:
              'The transistor’s base current returns through ground. With the battery’s − floating, the pin can’t switch anything and the motor never starts. Wire the battery’s − leg to the same GND as the Arduino.',
          };
        }
        case 'baseWrongPin': {
          const legs = c.legNets('transistor');
          if (!legs || c.wired(BASE_PIN.node)) return null;
          const wire = c.board.wires.find((w) => {
            const pin = PIN_BY_ID[w.pin];
            return pin.kind === 'digital' && legs[LEG.base] === c.net(pin.node);
          });
          if (!wire) return null;
          return {
            title: `The transistor’s base is on ${PIN_BY_ID[wire.pin].name}, not pin 9`,
            detail: 'The sketch switches pin 9 (const int MOTOR_PIN = 9). Move that jumper’s header end to pin 9.',
          };
        }
        case 'floating': {
          if (!c.part('button') || buttonState(c) !== 'floating') return null;
          return {
            title: 'Pin 2 is floating',
            detail: 'Add the 10 kΩ pull-down from pin 2’s column to GND so the motor stays off until you press the button.',
          };
        }
        case 'alwaysPressed': {
          if (!c.part('button') || !c.wired('5V')) return null;
          const fiveV = c.net('5V');
          const fed = c.board.wires.some((wire) => {
            const pin = PIN_BY_ID[wire.pin];
            return (pin.kind === 'digital' || pin.kind === 'analog') && c.net(pin.node) === fiveV;
          });
          return fed
            ? {
                title: 'The button reads “always pressed”',
                detail: 'Pin 2 is tied straight to 5V. Wire 5V to one side of the button and pin 2 to the other side, across the center gap.',
              }
            : null;
        }
        case 'buttonOpen':
          return c.part('button') && buttonState(c) === 'low' && !pressReaches(c, BUTTON.part, BUTTON.node, BUTTON.pullDowns)
            ? {
                title: 'Pressing the button doesn’t reach pin 2',
                detail: 'Wire 5V to one side of the button and pin 2 to the other side, across the center gap.',
              }
            : null;
        case 'powerOpen': {
          if (!c.part('motor') || !c.part('transistor') || powerPathOk(c) || !commonGround(c)) return null;
          return {
            title: 'The motor’s power path isn’t closed yet',
            detail: 'Trace it: battery + → motor → collector, emitter → GND. The pin only touches the base.',
          };
        }
        case 'missingParts': {
          const missing = [
            ['motor', 'the DC motor'],
            ['transistor', 'the transistor'],
            ['diode', 'the diode'],
            ['battery', 'the 9 V battery'],
            ['button', 'the button'],
            ['resistor10k', 'the 10 kΩ resistor'],
          ]
            .filter(([id]) => !c.part(id))
            .map(([, name]) => name);
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'The drive needs the motor, transistor, diode and battery, plus the start button with its pull-down.',
          };
        }
        case 'open':
          return {
            title: 'The motor drive isn’t wired yet',
            detail:
              'Two circuits: control (pin 9 → base, emitter → GND, button → pin 2 with its pull-down) and power (battery + → motor → collector; battery − joined to Arduino GND; diode across the motor, band toward +).',
          };
        default:
          return null;
      }
    },
  },

  physics(lab, store) {
    // A motor with no flyback diode works — and slowly kills the transistor.
    const { state } = store;
    if (!state.running || state.behavior.diodeWarned === true) return null;
    const c = circuitOf(lab, state);
    if (!powerPathOk(c) || diodeOk(c)) return null;
    store.state = { ...state, behavior: { ...state.behavior, diodeWarned: true } };
    return [
      ['warn', 'The motor runs, but there’s no flyback diode across it.'],
      ['hint', 'Hint: A spinning motor is an inductor; switched off, it kicks back a voltage spike. Wire the 1N4007 across the motor with the band toward battery + to absorb it.'],
    ];
  },

  behavior: {
    tickMs: 200,
    onTick: runLoop,
    onPress: (lab, store) => runLoop(lab, store),
    runningNote() {
      return { title: 'The sketch is running, but the motor doesn’t turn when you hold the button', detail: '' };
    },
    success: 'Hold the button: the conveyor motor runs on the battery’s power, switched by the pin. Lab 09 complete!',
  },

  steps: [
    {
      id: 'transistor',
      title: 'Wire the transistor’s control side',
      detail: 'Pin 9 → base (middle leg), emitter (leg E) → GND. Flat side facing you: E, B, C.',
      built: (q) => {
        const legs = q.legNets('transistor');
        return !!legs && q.wired('D9') && legs[LEG.base] === q.net('D9') && q.wired('GND') && legs[LEG.emitter] === q.net('GND');
      },
    },
    {
      id: 'power',
      title: 'Run the motor on the battery',
      detail: 'Battery + → motor → collector. The motor’s current never touches the Arduino.',
      built: (q) => {
        const sides = motorSides(q);
        const legs = q.legNets('transistor');
        return !!sides && !!legs && legs[LEG.collector] === sides.low;
      },
    },
    {
      id: 'ground',
      title: 'Join battery − to the Arduino’s GND',
      detail: 'Without a common ground the base current has no return path and the motor never starts.',
      built: (q) => commonGround(q),
    },
    {
      id: 'diode',
      title: 'Add the flyback diode, band toward +',
      detail: 'Across the motor’s two legs, with the banded end (cathode) on the battery + side. Tap the diode to flip it.',
      built: (q) => diodeOk(q),
    },
    {
      id: 'button',
      title: 'Wire the start button to pin 2',
      detail: 'Like Lab 02: 5V → button → pin 2, and the 10 kΩ pull-down from pin 2’s column to GND.',
      built: (q) => buttonState(q) === 'low' && pressReaches(q, BUTTON.part, BUTTON.node, BUTTON.pullDowns),
    },
    {
      id: 'upload',
      title: 'Upload and hold the button',
      detail: 'The motor runs while you hold it — the pin switches, the battery powers.',
    },
  ],

  guide: {
    intro:
      'A motor control cabinet, in miniature: a tiny signal from the controller switches a separate, bigger power circuit. The Arduino never powers the motor — it commands it.',
    explainers: [
      {
        title: 'Why not just use a pin?',
        body: 'A pin is rated for 20 mA; even a toy motor wants ten times that, and a conveyor motor a hundred times. The transistor is a current amplifier: a few mA into the base switches the battery’s current through the motor.',
      },
      {
        title: 'The flyback diode',
        body: 'A spinning motor stores energy in its coils. The instant the switch opens, that energy appears as a voltage spike pointed at the transistor. The diode — backwards across the motor in normal operation — gives the spike a safe loop. Band toward +.',
      },
      {
        title: 'Common ground',
        body: 'Two circuits share this bench: control (pin 9, button) and power (battery, motor). The transistor’s base current flows from the Arduino and returns through ground — so the battery’s − must join the Arduino’s GND. Every real drive cabinet does the same.',
      },
      {
        title: 'On the factory floor',
        body: 'The contactor in a motor starter is this exact idea scaled up: a small control voltage energizes a coil, and the coil’s contacts switch the motor’s three-phase power.',
      },
    ],
    proTip: {
      title: 'Pro tip: MOSFETs',
      body: 'Bigger motors use a MOSFET instead of a bipolar transistor: the gate needs almost no current at all, and it wastes less power as heat. Same circuit shape — pin drives the gate, supply drives the load.',
    },
  },
  next: { id: 'lab10', title: 'Lab 10 · Limit switches & debounce' },
};
