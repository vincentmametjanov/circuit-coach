// Lab 03: Machine stack light. Three LED loops on pins 5/6/7 (green = run,
// yellow = warn, red = stop) share the − rail, and the Lab 02 button steps the
// line through RUN → WARN → STOP on each press. Teaches several outputs, a
// state machine, and edge detection.

import { type LedLoop, findLoop, findShort } from '../engine/ledLoop';
import type { LabDef } from '../lab';
import { PIN_BY_ID } from '../geometry';
import { circuitOf } from '../runtime';
import { inputState } from './lab02';

type Channel = { color: string; led: string; resistor: string; signal: LedLoop['signal']; state: string };

const CHANNELS: Channel[] = [
  { color: 'green', led: 'ledGreen', resistor: 'resistorG', signal: { node: 'D5', name: 'pin 5' }, state: 'RUN' },
  { color: 'yellow', led: 'ledYellow', resistor: 'resistorY', signal: { node: 'D6', name: 'pin 6' }, state: 'WARN' },
  { color: 'red', led: 'ledRed', resistor: 'resistorR', signal: { node: 'D7', name: 'pin 7' }, state: 'STOP' },
];

const loopOf = (ch: Channel): LedLoop => ({ signal: ch.signal, led: ch.led, resistor: ch.resistor });

const SKETCH = `// stack_light.ino — Lab 03
// An andon stack light: green = running, yellow = attention, red = stopped.
// The button on pin 2 steps RUN → WARN → STOP → RUN.

const int PINS[3] = {5, 6, 7};       // green, yellow, red
const int BUTTON_PIN = 2;
int state = 0;                        // 0 = RUN, 1 = WARN, 2 = STOP
int lastReading = LOW;

void setup() {
  for (int i = 0; i < 3; i++) pinMode(PINS[i], OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading == HIGH && lastReading == LOW) {
    state = (state + 1) % 3;          // one step per press
  }
  lastReading = reading;
  for (int i = 0; i < 3; i++) {
    digitalWrite(PINS[i], i == state ? HIGH : LOW);
  }
}`;

/** True when one resistor's legs are shared by two different LEDs. */
function sharedResistor(c: Parameters<typeof findLoop>[0]): Channel[] | null {
  const shared = CHANNELS.map((ch) => ch.resistor).filter((id) => {
    const legs = c.legNets(id);
    if (!legs) return false;
    const touches = CHANNELS.filter((ch) => {
      const ledLegs = c.legNets(ch.led);
      return ledLegs && ledLegs.some((n) => legs.includes(n));
    });
    return touches.length > 1;
  });
  return shared.length > 0 ? CHANNELS.filter((ch) => shared.includes(ch.resistor)) : null;
}

export const LAB03: LabDef = {
  id: 'lab03',
  title: 'Lab 03 · Machine stack light',
  sketch: { name: 'stack_light', code: SKETCH, highlightLine: 16 },
  parts: [
    { def: 'led', id: 'ledGreen', name: 'Green LED', color: 'green' },
    { def: 'led', id: 'ledYellow', name: 'Yellow LED', color: 'yellow' },
    { def: 'led', id: 'ledRed', name: 'Red LED', color: 'red' },
    { def: 'resistor', id: 'resistorG', name: '220 Ω resistor' },
    { def: 'resistor', id: 'resistorY', name: '220 Ω resistor' },
    { def: 'resistor', id: 'resistorR', name: '220 Ω resistor' },
    { def: 'button', id: 'button' },
    { def: 'resistor10k', id: 'resistor10k' },
  ],

  verdict: {
    mistakes: ['short', 'reversed', 'noResistor', 'ledShorted', 'sharedResistor', 'wrongChannel', 'alwaysPressed', 'floating'],
    order: [
      'short',
      'burnt',
      'pass',
      'sharedResistor',
      'ledLoops',
      'alwaysPressed',
      'floating',
      'missingParts',
      'open',
    ],
    check(code, c) {
      switch (code) {
        case 'short': {
          const short = findShort(c, CHANNELS.map((ch) => ch.signal));
          if (!short) return null;
          return {
            title: `Short circuit: ${short.a.name} is wired straight to ${short.b.name}`,
            detail: 'Two supply nodes are joined with nothing between them. Give each one its own strip.',
          };
        }
        case 'burnt': {
          const dead = CHANNELS.find((ch) => c.board.burnt.includes(ch.led));
          return dead
            ? {
                title: `The ${dead.color} LED is burned out`,
                detail: 'Drag it back to the parts bin for a fresh one, and keep its 220 Ω resistor in the loop this time.',
              }
            : null;
        }
        case 'pass': {
          const loopsOk = CHANNELS.every((ch) => {
            const found = findLoop(c, loopOf(ch));
            return found?.kind === 'ok' && found.source.node === ch.signal.node;
          });
          if (!loopsOk || sharedResistor(c) || inputState(c) !== 'low') return null;
          return {
            title: 'Circuit check passed',
            detail: 'Three loops — pin 5 → green, pin 6 → yellow, pin 7 → red — each with its own 220 Ω resistor, and the button reads LOW at rest.',
          };
        }
        case 'sharedResistor': {
          const shared = sharedResistor(c);
          if (!shared) return null;
          return {
            title: 'One resistor is shared by more than one LED',
            detail: `It works, but the brightness changes depending on how many lamps are on — a stack light must read the same at a glance. Give each LED its own 220 Ω resistor.`,
          };
        }
        case 'ledLoops': {
          for (const ch of CHANNELS) {
            const found = findLoop(c, loopOf(ch));
            if (!found) continue;
            if (found.kind === 'ok' && found.source.node !== ch.signal.node) {
              const other = CHANNELS.find((o) => o.signal.node === found.source.node);
              return {
                title: `The ${ch.color} LED is on ${found.source.name}`,
                detail: other
                  ? `The sketch lights ${ch.color} for ${ch.state} on ${ch.signal.name} — right now ${found.source.name} drives it, so ${ch.state} would light the wrong color. Move the signal jumper.`
                  : `It glows, but ${found.source.name} never switches from the sketch. The ${ch.color} LED belongs on ${ch.signal.name}.`,
              };
            }
            if (found.kind === 'bypassed') {
              return {
                title: `Both legs of the ${ch.color} LED share one strip`,
                detail: 'Current skips the LED. Put its two legs in different numbered columns.',
              };
            }
            if (found.kind === 'noResistor') {
              return {
                title: `No resistor in the ${ch.color} LED’s loop`,
                detail: `${found.source.name} connects straight to the LED. Nothing limits the current — put a 220 Ω resistor in series with it.`,
              };
            }
            if (found.kind === 'reversed' && found.source.node === ch.signal.node) {
              return {
                title: `The ${ch.color} LED is in backwards`,
                detail: `Current only flows into the + (long) leg. Tap the ${ch.color} LED to flip it so + faces ${ch.signal.name}.`,
              };
            }
            if (found.kind === 'wrongPin') {
              return {
                title: `The ${ch.color} LED’s signal jumper is on ${found.pinName}`,
                detail: `The sketch drives ${ch.signal.name} for ${ch.state}, so ${found.pinName} never lights it. Move that jumper to ${ch.signal.name}.`,
              };
            }
          }
          return null;
        }
        case 'alwaysPressed': {
          // Same-side wiring: 5V's net reaches a digital pin directly.
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
        case 'floating': {
          if (!c.part('button') || inputState(c) !== 'floating') return null;
          return {
            title: 'Pin 2 is floating',
            detail: 'Add the 10 kΩ pull-down from pin 2’s column to GND so the button reads LOW until it is pressed.',
          };
        }
        case 'missingParts': {
          const names: [string, string][] = [
            ['ledGreen', 'the green LED'],
            ['ledYellow', 'the yellow LED'],
            ['ledRed', 'the red LED'],
            ['resistorG', 'a 220 Ω resistor'],
            ['resistorY', 'a 220 Ω resistor'],
            ['resistorR', 'a 220 Ω resistor'],
            ['button', 'the button'],
            ['resistor10k', 'the 10 kΩ resistor'],
          ];
          const missing = [...new Set(names.filter(([id]) => !c.part(id)).map(([, name]) => name))];
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'Each LED needs its own 220 Ω resistor; the button needs the 10 kΩ pull-down.',
          };
        }
        case 'open':
          return {
            title: 'The circuit isn’t finished yet',
            detail:
              'Trace each loop: pin 5 → resistor → green LED → GND, and the same for 6 (yellow) and 7 (red). The − rail is handy: wire it to GND once, then land every LED’s − leg on it.',
          };
        default:
          return null;
      }
    },
  },

  physics(lab, store) {
    const { state } = store;
    for (const ch of CHANNELS) {
      if (state.burnt.includes(ch.led) || !state.parts[ch.led]) continue;
      const found = findLoop(circuitOf(lab, state), loopOf(ch));
      if (found?.kind !== 'noResistor') continue;
      const lit = (state.behavior.lit as string[] | undefined) ?? [];
      // A wrong-supply loop is always powered; the sketch's own pin only burns
      // the LED while the state machine has it lit.
      const powered = found.source.node !== ch.signal.node || (state.running && lit.includes(ch.led));
      if (!powered) continue;
      store.state = { ...state, burnt: [...state.burnt, ch.led] };
      return [
        ['error', `Pop! The ${ch.color} LED burned out: with no resistor in its loop, nothing limited the current.`],
        ['hint', `Hint: Swap in a fresh ${ch.color} LED and put its own 220 Ω resistor in series with it.`],
      ];
    }
    return null;
  },

  behavior: {
    tickMs: 120,
    onTick(lab, store) {
      const { state } = store;
      const stage = (state.behavior.stage as number | undefined) ?? 0;
      const lit = CHANNELS.filter((_, i) => i === stage).map((ch) => ch.led);
      return { lab, state: { ...state, behavior: { ...state.behavior, stage, lit } } };
    },
    onPress(lab, store, part, pressed) {
      if (part !== 'button') return store;
      const { state } = store;
      // Edge detection: one step per press, counted when the button goes down.
      const was = state.behavior.wasPressed === true;
      if (pressed && !was) {
        const stage = (((state.behavior.stage as number | undefined) ?? 0) + 1) % 3;
        const lit = CHANNELS.filter((_, i) => i === stage).map((ch) => ch.led);
        return { lab, state: { ...state, behavior: { ...state.behavior, stage, lit, wasPressed: true } } };
      }
      return { lab, state: { ...state, behavior: { ...state.behavior, wasPressed: pressed } } };
    },
    runningNote(lab, store) {
      const input = inputState(circuitOf(lab, store.state));
      if (input === 'floating') {
        return { title: 'The sketch is running, but pin 2 is floating — the light may step on its own', detail: '' };
      }
      return { title: 'The sketch is running, but the stack light doesn’t match the steps', detail: '' };
    },
    success: 'The stack light steps RUN → WARN → STOP with each press. Lab 03 complete!',
  },

  steps: [
    {
      id: 'green',
      title: 'Build the green loop on pin 5',
      detail: 'A 220 Ω resistor and the green LED in series from pin 5 to GND — exactly like Lab 01.',
      built: (q) => {
        const found = findLoop(q, loopOf(CHANNELS[0]));
        return found?.kind === 'ok' && found.source.node === 'D5';
      },
    },
    {
      id: 'yellow',
      title: 'Add the yellow loop on pin 6',
      detail: 'Its own resistor and LED. The − rail makes this easy: wire it to GND once and land every − leg on it.',
      built: (q) => {
        const found = findLoop(q, loopOf(CHANNELS[1]));
        return found?.kind === 'ok' && found.source.node === 'D6';
      },
    },
    {
      id: 'red',
      title: 'Add the red loop on pin 7',
      detail: 'The third loop, again with its own resistor.',
      built: (q) => {
        const found = findLoop(q, loopOf(CHANNELS[2]));
        return found?.kind === 'ok' && found.source.node === 'D7';
      },
    },
    {
      id: 'button',
      title: 'Wire the button to pin 2 with its pull-down',
      detail: 'Same circuit as Lab 02: 5V → button → pin 2, and the 10 kΩ resistor from pin 2’s net to GND.',
      built: (q) => inputState(q) === 'low',
    },
    {
      id: 'upload',
      title: 'Upload and press to step through the states',
      detail: 'Each press advances RUN → WARN → STOP. Notice it counts one press once, not every loop.',
    },
  ],

  guide: {
    intro:
      'Three LEDs, one button: a stack light like the one above every machine on a line. Green means running, yellow needs attention, red means stopped.',
    explainers: [
      {
        title: 'One resistor per LED',
        body: 'Sharing one resistor between LEDs makes the brightness change depending on how many are lit — the current splits differently. A status light must read the same at a glance, so each lamp gets its own resistor.',
      },
      {
        title: 'Counting presses, not loops',
        body: 'The loop() runs thousands of times per second. The sketch remembers the last reading and only counts when it changes from LOW to HIGH — an edge. Otherwise one press would advance the state a hundred times.',
      },
      {
        title: 'The power rails',
        body: 'The red (+) and blue (−) strips along the breadboard edges are each connected end to end. Wire the − rail to GND once and every LED’s short leg can land on it — how real control panels use a common ground bus.',
      },
      {
        title: 'On the factory floor',
        body: 'An andon stack light shows a whole line’s status from across the shop floor. Operators and supervisors read it without walking over — green run, yellow attention, red stopped.',
      },
    ],
    proTip: {
      title: 'Pro tip: real stack lights',
      body: 'Industrial stack lights run on 24 V and the lamp modules have the resistor built in — you wire 24 V and a switched output, exactly like your pin 5 loop but bigger.',
    },
  },
  next: { id: 'lab04', title: 'Lab 04 · Speed dial' },
};
