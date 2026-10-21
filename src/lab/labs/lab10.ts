// Lab 10: Limit switches & debounce. Two buttons stand in for a machine's
// end-of-travel limit switch and its E-stop: the line (an LED) runs only
// while the limit is clear and the E-stop is up. Limit presses count cycles —
// and a bouncing contact shows why one press must count exactly once.

import type { Circuit } from '../engine/circuit';
import { inputPinState, pressReaches } from '../engine/inputs';
import { type LedLoop, findLoop, findShort, ledLoopMessages } from '../engine/ledLoop';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { type LabStore, type RuntimeState, appendLog, circuitOf, nextRandom, printSerial } from '../runtime';

const RUN_LED: LedLoop = { signal: { node: 'D7', name: 'pin 7' }, led: 'led', resistor: 'resistor' };
const LIMIT = { node: 'D2', name: 'pin 2', part: 'limit', pullDowns: ['pullLimit'] };
const ESTOP = { node: 'D3', name: 'pin 3', part: 'estop', pullDowns: ['pullEstop'] };

/** How often the simulated switch contact bounces on a press. */
const BOUNCE_CHANCE = 0.35;

const SKETCH = `// limit_switches.ino — Lab 10
// The line runs while the limit switch (pin 2) is clear and the E-stop
// (pin 3) is not pressed. Each limit trip counts one carriage cycle.

const int LIMIT_PIN = 2;
const int ESTOP_PIN = 3;
const int RUN_PIN = 7;
int cycles = 0;
int lastLimit = LOW;

void setup() {
  pinMode(LIMIT_PIN, INPUT);    // 10 kΩ pull-down
  pinMode(ESTOP_PIN, INPUT);    // 10 kΩ pull-down
  pinMode(RUN_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  bool tripped = digitalRead(LIMIT_PIN) == HIGH;
  bool stopped = digitalRead(ESTOP_PIN) == HIGH;
  digitalWrite(RUN_PIN, !tripped && !stopped ? HIGH : LOW);
  if (tripped && lastLimit == LOW) {
    cycles++;                       // one trip, one cycle — if the switch doesn't bounce
    Serial.print("Cycle ");
    Serial.println(cycles);
  }
  lastLimit = tripped ? HIGH : LOW;
}`;

const limitReads = (c: Circuit) => inputPinState(c, LIMIT.node, LIMIT.pullDowns);
const estopReads = (c: Circuit) => inputPinState(c, ESTOP.node, ESTOP.pullDowns);

function inputOk(c: Circuit, input: typeof LIMIT): boolean {
  return inputPinState(c, input.node, input.pullDowns) === 'low' && pressReaches(c, input.part, input.node, input.pullDowns);
}

function runLoop(lab: LabDef, store: LabStore): LabStore {
  const { state } = store;
  const c = circuitOf(lab, state);
  const tripped = limitReads(c) === 'high';
  const stopped = estopReads(c) === 'high';
  const wasTripped = state.behavior.lastLimit === true;
  const wasStopped = state.behavior.lastEstop === true;
  let next: RuntimeState = {
    ...state,
    behavior: { ...state.behavior, lastLimit: tripped, lastEstop: stopped },
  };

  if (stopped && !wasStopped) {
    next = appendLog(next, ['error', 'E-STOP pressed — the line stops immediately, mid-cycle.']);
  } else if (!stopped && wasStopped) {
    next = appendLog(next, ['info', 'E-stop released. The line runs again.']);
  }

  if (tripped && !wasTripped && !stopped) {
    let cycles = (typeof state.behavior.cycles === 'number' ? state.behavior.cycles : 0) + 1;
    const { seed, value } = nextRandom(state.seed);
    next = { ...next, seed };
    if (value < BOUNCE_CHANCE) {
      // The contacts chatter: the edge the sketch counted on appears twice.
      cycles += 1;
      next = printSerial(next, `Cycle ${cycles - 1}`);
      next = printSerial(next, `Cycle ${cycles}`);
      next = appendLog(
        { ...next, behavior: { ...next.behavior, cycles } },
        ['warn', `The limit switch bounced: one carriage pass just counted as two (cycles ${cycles - 1} and ${cycles}).`],
        ['hint', 'Hint: Mechanical contacts chatter for a few milliseconds. The fix is debounce — after the first edge, ignore the input for ~20 ms (see the pro tip).'],
      );
      return { lab, state: next };
    }
    next = printSerial({ ...next, behavior: { ...next.behavior, cycles } }, `Cycle ${cycles}`);
    return { lab, state: next };
  }
  return { lab, state: { ...next, behavior: { ...next.behavior, cycles: state.behavior.cycles ?? 0 } } };
}

export const LAB10: LabDef = {
  id: 'lab10',
  title: 'Lab 10 · Limit switches & debounce',
  sketch: { name: 'limit_switches', code: SKETCH, highlightLine: 21 },
  parts: [
    { def: 'button', id: 'limit', name: 'Limit switch (button)' },
    { def: 'button', id: 'estop', name: 'E-stop (button)' },
    { def: 'resistor10k', id: 'pullLimit', name: '10 kΩ pull-down (limit)' },
    { def: 'resistor10k', id: 'pullEstop', name: '10 kΩ pull-down (E-stop)' },
    { def: 'led', id: 'led' },
    { def: 'resistor', id: 'resistor' },
  ],

  verdict: {
    mistakes: ['short', 'alwaysPressed', 'ledLoop'],
    order: ['short', 'burnt', 'pass', 'alwaysPressed', 'floatingLimit', 'floatingEstop', 'switchOpen', 'ledLoop', 'missingParts', 'open'],
    check(code, c) {
      const say = ledLoopMessages(LAB10, RUN_LED);
      switch (code) {
        case 'short': {
          const short = findShort(c);
          if (!short) return null;
          return {
            title: `Short circuit: ${short.a.name} is wired straight to ${short.b.name}`,
            detail: 'Two supply nodes are joined with nothing between them. Give each one its own strip.',
          };
        }
        case 'burnt':
          return c.board.burnt.includes('led')
            ? {
                title: 'The LED is burned out',
                detail: 'Drag it back to the parts bin for a fresh one, and keep its 220 Ω resistor in the loop this time.',
              }
            : null;
        case 'pass': {
          if (!inputOk(c, LIMIT) || !inputOk(c, ESTOP)) return null;
          const loop = findLoop(c, RUN_LED);
          if (loop?.kind !== 'ok' || loop.source.node !== RUN_LED.signal.node) return null;
          return {
            title: 'Circuit check passed',
            detail:
              'Limit switch on pin 2 and E-stop on pin 3, each reading LOW at rest through its own 10 kΩ pull-down. The run light sits on pin 7.',
          };
        }
        case 'alwaysPressed': {
          if (!c.wired('5V')) return null;
          const fiveV = c.net('5V');
          const fed = c.board.wires.find((wire) => {
            const pin = PIN_BY_ID[wire.pin];
            return (pin.kind === 'digital' || pin.kind === 'analog') && c.net(pin.node) === fiveV;
          });
          if (!fed) return null;
          return {
            title: `${PIN_BY_ID[fed.pin].name} reads “always pressed”`,
            detail: 'It’s tied straight to 5V. Each switch sits between 5V and its pin, with only the 10 kΩ pull-down going to GND.',
          };
        }
        case 'floatingLimit':
        case 'floatingEstop': {
          const input = code === 'floatingLimit' ? LIMIT : ESTOP;
          if (!c.part(input.part) || inputPinState(c, input.node, input.pullDowns) !== 'floating') return null;
          return {
            title: `${input.name} is floating`,
            detail: `Nothing holds ${input.name} LOW while its switch is up, so the line can stop — or counts can jump — on their own. Add its 10 kΩ pull-down to GND.`,
          };
        }
        case 'switchOpen': {
          for (const input of [LIMIT, ESTOP]) {
            if (c.part(input.part) && inputPinState(c, input.node, input.pullDowns) === 'low' && !pressReaches(c, input.part, input.node, input.pullDowns)) {
              return {
                title: `Pressing the ${input.part === 'limit' ? 'limit switch' : 'E-stop'} doesn’t reach ${input.name}`,
                detail: 'Wire 5V to one side of the switch and the pin to the other side, across the center gap.',
              };
            }
          }
          return null;
        }
        case 'ledLoop': {
          const loop = findLoop(c, RUN_LED);
          if (!loop) return null;
          if (loop.kind === 'ok') {
            if (loop.source.node === RUN_LED.signal.node) return null;
            return { ...say.wrongSource(loop.source), source: loop.source.node };
          }
          if (loop.kind === 'bypassed') {
            return { title: 'Both LED legs share one strip', detail: 'Current skips the LED. Put its two legs in different numbered columns.' };
          }
          if (loop.kind === 'noResistor') return { ...say.noLimiter(loop.source), source: loop.source.node };
          if (loop.kind === 'wrongPin') {
            return {
              title: `The LED’s signal jumper is on ${loop.pinName}`,
              detail: `The sketch drives pin 7 as the run light, so ${loop.pinName} never lights it. Move that jumper to pin 7.`,
            };
          }
          return { ...say.reversed(loop.source), source: loop.source.node };
        }
        case 'missingParts': {
          const missing = [
            ['limit', 'the limit switch'],
            ['estop', 'the E-stop'],
            ['pullLimit', 'a 10 kΩ pull-down'],
            ['pullEstop', 'a 10 kΩ pull-down'],
            ['led', 'the LED'],
            ['resistor', 'the 220 Ω resistor'],
          ]
            .filter(([id]) => !c.part(id))
            .map(([, name]) => name);
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'Each switch needs its own 10 kΩ pull-down; the run light needs its 220 Ω resistor.',
          };
        }
        case 'open':
          return {
            title: 'The circuit isn’t finished yet',
            detail:
              'Three loops: 5V → limit switch → pin 2 → 10 kΩ → GND; 5V → E-stop → pin 3 → 10 kΩ → GND; pin 7 → 220 Ω → LED → GND.',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 120,
    onUpload(lab, store) {
      return { lab, state: printSerial(store.state, 'Serial Monitor open at 9600 baud.') };
    },
    onTick: runLoop,
    onPress: (lab, store) => runLoop(lab, store),
    // The run light is on while the limit is clear and the E-stop is up.
    outputs: (lab, store) => {
      const c = circuitOf(lab, store.state);
      return limitReads(c) !== 'high' && estopReads(c) !== 'high' ? [RUN_LED.signal.node] : [];
    },
    runningNote() {
      return { title: 'The sketch is running, but the switches don’t control the line', detail: '' };
    },
    success: 'The line runs until the limit trips or the E-stop drops it. Watch for a bounce in the cycle count. Lab 10 complete!',
  },

  steps: [
    {
      id: 'limit',
      title: 'Wire the limit switch to pin 2',
      detail: '5V → switch → pin 2, with the 10 kΩ pull-down from pin 2’s column to GND — the Lab 02 circuit.',
      built: (q) => inputOk(q, LIMIT),
    },
    {
      id: 'estop',
      title: 'Wire the E-stop to pin 3',
      detail: 'Same pattern: 5V → E-stop → pin 3, and its own 10 kΩ pull-down to GND.',
      built: (q) => inputOk(q, ESTOP),
    },
    {
      id: 'led',
      title: 'Build the run light on pin 7',
      detail: 'Pin 7 → 220 Ω resistor → LED (+ to −) → GND.',
      built: (q) => {
        const found = findLoop(q, RUN_LED);
        return found?.kind === 'ok' && found.source.node === 'D7';
      },
    },
    {
      id: 'upload',
      title: 'Upload and run the line',
      detail: 'The light runs while both switches are clear. Trip the limit to count a cycle; press the E-stop to halt everything.',
    },
  ],

  guide: {
    intro:
      'The safety spine of every machine, in miniature: an end-of-travel limit switch and an E-stop, both read as plain digital inputs — and a look at why one press must count exactly once.',
    explainers: [
      {
        title: 'Limit switches',
        body: 'A limit switch trips when a moving part reaches the end of its travel. The controller stops the motor the moment the input changes — before anything crashes. Your run light does exactly that.',
      },
      {
        title: 'E-stop: stop first, ask later',
        body: 'An emergency stop isn’t a pause. It drops the machine wherever it is, and restart takes a deliberate action. Real E-stops are latching and wired so a broken wire also stops the machine (fail-safe).',
      },
      {
        title: 'Bounce: why one press counts twice',
        body: 'Metal contacts don’t close cleanly — they chatter for a few milliseconds, making several LOW→HIGH edges for one press. A counter that trusts every edge double-counts. You’ll see it happen here: some trips count two cycles.',
      },
      {
        title: 'On the factory floor',
        body: 'Every axis of every machine has limit switches; every machine has a latching E-stop loop. Controls engineers debounce every input that counts or steps — in code, or with hardware.',
      },
    ],
    proTip: {
      title: 'Pro tip: debounce in four lines',
      body: 'On a LOW→HIGH edge, record millis(); ignore further edges for 20 ms. One press, one count — no matter how the contacts chatter. That’s the whole fix.',
    },
  },
  next: { id: 'lab11', title: 'Lab 11 · Stepper homing' },
};
