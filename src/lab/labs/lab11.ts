// Lab 11: Stepper homing. A stepper moves in exact steps and has no idea
// where it is at power-up — so every CNC and pick-and-place machine runs the
// same homing routine: step toward the limit switch until it trips, back off,
// call that position zero. Here you are the limit switch.

import type { Circuit } from '../engine/circuit';
import { inputPinState, pressReaches } from '../engine/inputs';
import { findShort } from '../engine/ledLoop';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { type LabStore, type RuntimeState, appendLog, printSerial } from '../runtime';

const STEP = { node: 'D3', name: 'pin ~3' };
const DIR = { node: 'D4', name: 'pin 4' };
const LIMIT = { node: 'D2', name: 'pin 2', part: 'limit', pullDowns: ['resistor10k'] };

/** Stepper driver legs: step pulse, direction, ground. */
const LEG = { step: 0, dir: 1, gnd: 2 };

/** Steps from the power-up position to (past) home. */
const START_POS = 120;
const STEPS_PER_TICK = 15;
const OVERTRAVEL = -45;

const SKETCH = `// stepper_homing.ino — Lab 11
// Homes the axis: step toward the limit switch until it trips,
// back off a few steps, and call that position zero.

const int STEP_PIN = 3;
const int DIR_PIN = 4;
const int LIMIT_PIN = 2;      // 10 kΩ pull-down
long pos = 0;                 // unknown at power-up!

void setup() {
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(LIMIT_PIN, INPUT);
  Serial.begin(9600);
  Serial.println("Homing…");
  digitalWrite(DIR_PIN, LOW);            // toward the switch
  while (digitalRead(LIMIT_PIN) == LOW) {
    digitalWrite(STEP_PIN, HIGH);        // one step per pulse
    digitalWrite(STEP_PIN, LOW);
    delay(5);
  }
  digitalWrite(DIR_PIN, HIGH);           // back off
  for (int i = 0; i < 10; i++) {
    digitalWrite(STEP_PIN, HIGH);
    digitalWrite(STEP_PIN, LOW);
    delay(5);
  }
  pos = 0;                               // this point is home now
  Serial.println("Home found.");
}

void loop() {
  // The machine can finally trust its position: every move counts from 0.
}`;

/** True when step and direction land on pins 3 and 4 the right way round. */
function signalsOk(c: Circuit): boolean {
  const legs = c.legNets('stepper');
  return !!legs && c.wired(STEP.node) && c.wired(DIR.node) && legs[LEG.step] === c.net(STEP.node) && legs[LEG.dir] === c.net(DIR.node);
}

function driverGrounded(c: Circuit): boolean {
  const legs = c.legNets('stepper');
  return !!legs && c.wired('GND') && legs[LEG.gnd] === c.net('GND');
}

function limitOk(c: Circuit): boolean {
  return inputPinState(c, LIMIT.node, LIMIT.pullDowns) === 'low' && pressReaches(c, LIMIT.part, LIMIT.node, LIMIT.pullDowns);
}

/** Which digital pin (if any) a stepper leg is wired to, for wrong-pin messages. */
function legPinName(c: Circuit, leg: number): string | null {
  const legs = c.legNets('stepper');
  if (!legs) return null;
  const wire = c.board.wires.find((w) => {
    const pin = PIN_BY_ID[w.pin];
    return (pin.kind === 'digital' || pin.kind === 'analog') && legs[leg] === c.net(pin.node);
  });
  return wire ? PIN_BY_ID[wire.pin].name : null;
}

function runLoop(lab: LabDef, store: LabStore): LabStore {
  const { state } = store;
  if (state.behavior.homed === true || state.behavior.failed === true) return store;
  const pos = (typeof state.behavior.pos === 'number' ? state.behavior.pos : START_POS) - STEPS_PER_TICK;
  let next: RuntimeState = { ...state, behavior: { ...state.behavior, pos } };
  if (pos <= OVERTRAVEL) {
    next = printSerial(next, 'Homing FAILED: never saw the limit switch.');
    return {
      lab,
      state: appendLog({ ...next, behavior: { ...next.behavior, failed: true } }, [
        'error',
        'Homing failed: the axis ran past where the switch should be. On a real machine this is a crash — the carriage hits the end stop.',
      ]),
    };
  }
  return { lab, state: printSerial(next, `stepping… ${pos}`) };
}

export const LAB11: LabDef = {
  id: 'lab11',
  title: 'Lab 11 · Stepper homing',
  sketch: { name: 'stepper_homing', code: SKETCH, highlightLine: 16 },
  parts: [
    { def: 'stepper', id: 'stepper' },
    { def: 'button', id: 'limit', name: 'Limit switch (button)' },
    { def: 'resistor10k', id: 'resistor10k' },
  ],

  verdict: {
    mistakes: ['short', 'alwaysPressed'],
    order: ['short', 'pass', 'stepDirSwapped', 'signalPins', 'gndMissing', 'floating', 'switchOpen', 'missingParts', 'open'],
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
          if (!signalsOk(c) || !driverGrounded(c) || !limitOk(c)) return null;
          return {
            title: 'Circuit check passed',
            detail: 'Step on pin ~3, direction on pin 4, driver grounded — and the limit switch reads LOW at rest on pin 2. Upload, then press the switch when the axis should trip it.',
          };
        }
        case 'stepDirSwapped': {
          const legs = c.legNets('stepper');
          if (!legs || !c.wired(STEP.node) || !c.wired(DIR.node)) return null;
          if (legs[LEG.step] === c.net(DIR.node) && legs[LEG.dir] === c.net(STEP.node)) {
            return {
              title: 'Step and direction are swapped',
              detail:
                'The direction leg gets the step pulses and the step leg sits at one level, so the driver chatters in place instead of homing. Step → pin ~3, direction → pin 4.',
            };
          }
          return null;
        }
        case 'signalPins': {
          const legs = c.legNets('stepper');
          if (!legs || signalsOk(c)) return null;
          const stepPin = legPinName(c, LEG.step);
          const dirPin = legPinName(c, LEG.dir);
          if (stepPin && stepPin !== STEP.name) {
            return {
              title: `The step leg is on ${stepPin}, not pin ~3`,
              detail: 'The sketch pulses pin 3 (const int STEP_PIN = 3). Move that jumper to pin ~3.',
            };
          }
          if (dirPin && dirPin !== DIR.name) {
            return {
              title: `The direction leg is on ${dirPin}, not pin 4`,
              detail: 'The sketch sets pin 4 (const int DIR_PIN = 4). Move that jumper to pin 4.',
            };
          }
          return null;
        }
        case 'gndMissing': {
          const legs = c.legNets('stepper');
          if (!legs || !signalsOk(c) || driverGrounded(c)) return null;
          return {
            title: 'The driver’s ground isn’t connected',
            detail: 'The step and direction pulses are measured against ground. Wire the driver’s GND leg to the Arduino’s GND.',
          };
        }
        case 'floating': {
          if (!c.part(LIMIT.part) || inputPinState(c, LIMIT.node, LIMIT.pullDowns) !== 'floating') return null;
          return {
            title: 'Pin 2 is floating',
            detail: 'The homing loop reads the limit switch constantly — a floating input can “trip” on its own. Add the 10 kΩ pull-down to GND.',
          };
        }
        case 'alwaysPressed': {
          if (!c.wired('5V')) return null;
          const fiveV = c.net('5V');
          const fed = c.board.wires.some((wire) => {
            const pin = PIN_BY_ID[wire.pin];
            return (pin.kind === 'digital' || pin.kind === 'analog') && c.net(pin.node) === fiveV;
          });
          return fed
            ? {
                title: 'The limit switch reads “always tripped”',
                detail: 'Pin 2 is tied straight to 5V, so homing finishes instantly at a random spot. Wire 5V to one side of the switch and pin 2 to the other.',
              }
            : null;
        }
        case 'switchOpen':
          return c.part(LIMIT.part) && inputPinState(c, LIMIT.node, LIMIT.pullDowns) === 'low' && !pressReaches(c, LIMIT.part, LIMIT.node, LIMIT.pullDowns)
            ? {
                title: 'Pressing the limit switch doesn’t reach pin 2',
                detail: 'Wire 5V to one side of the switch and pin 2 to the other side, across the center gap.',
              }
            : null;
        case 'missingParts': {
          const missing = [
            ['stepper', 'the stepper + driver'],
            ['limit', 'the limit switch'],
            ['resistor10k', 'the 10 kΩ resistor'],
          ]
            .filter(([id]) => !c.part(id))
            .map(([, name]) => name);
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'The axis needs its driver and its limit switch with a pull-down.',
          };
        }
        case 'open':
          return {
            title: 'The axis isn’t wired yet',
            detail: 'Driver: step → pin ~3, dir → pin 4, GND → GND. Switch: 5V → limit → pin 2, with the 10 kΩ pull-down to GND.',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 250,
    onUpload(lab, store) {
      return {
        lab,
        state: printSerial(
          { ...store.state, behavior: { ...store.state.behavior, pos: START_POS, homed: false, failed: false } },
          'Homing…',
        ),
      };
    },
    onTick: runLoop,
    onPress(lab, store, part, pressed) {
      const { state } = store;
      if (part !== LIMIT.part || !pressed || state.behavior.homed === true || state.behavior.failed === true) return store;
      // The switch trips: back off, then call it zero.
      let next = printSerial(state, 'Limit switch tripped — backing off 10 steps.');
      next = printSerial(next, 'Home found. pos = 0');
      return {
        lab,
        state: appendLog({ ...next, behavior: { ...next.behavior, homed: true, pos: 0 } }, [
          'success',
          'Homed. Every move from here counts from a known zero — that’s the whole point of the routine.',
        ]),
      };
    },
    runningNote(lab, store) {
      if (store.state.behavior.homed === true) return null;
      return { title: 'The sketch is running, but homing never finishes', detail: '' };
    },
    success: 'The axis steps toward the switch. Press the limit switch when it should trip — that’s homing. Lab 11 complete!',
  },

  steps: [
    {
      id: 'signals',
      title: 'Wire step and direction',
      detail: 'Step leg → pin ~3, direction leg → pin 4. Each pulse on step moves the axis one step.',
      built: (q) => signalsOk(q),
    },
    {
      id: 'ground',
      title: 'Ground the driver',
      detail: 'The driver’s GND leg shares the Arduino’s GND so the pulses have a reference.',
      built: (q) => driverGrounded(q),
    },
    {
      id: 'limit',
      title: 'Wire the limit switch to pin 2',
      detail: '5V → switch → pin 2, with the 10 kΩ pull-down to GND.',
      built: (q) => limitOk(q),
    },
    {
      id: 'upload',
      title: 'Upload and home the axis',
      detail: 'The axis steps toward the switch on its own. Press the limit switch to trip it — home is where it stops.',
    },
  ],

  guide: {
    intro:
      'The first thing every CNC does at power-up, in miniature: a stepper can count its own steps, but it powers up not knowing where it is. Homing fixes that.',
    explainers: [
      {
        title: 'Step and direction',
        body: 'The driver takes two signals: a level on direction says which way, and each pulse on step moves the shaft one exact step — 1.8° on a common motor. No feedback, just counting.',
      },
      {
        title: 'Why machines home',
        body: 'Counting steps only works from a known start. Power-cycle the machine and the count is gone, but the carriage is wherever it is. So the controller steps slowly toward a limit switch until it trips, backs off, and declares that point zero.',
      },
      {
        title: 'On the factory floor',
        body: 'CNC mills, 3D printers and pick-and-place machines all run this routine. “Home” is the reference every later coordinate is measured from.',
      },
    ],
    proTip: {
      title: 'Pro tip: back off slowly',
      body: 'Real homing trips the switch fast, then backs off and re-approaches slowly for an accurate zero. The fast pass finds the neighborhood; the slow pass finds the edge.',
    },
  },
  next: { id: 'lab12', title: 'Lab 12 · Mini sorting line' },
};
