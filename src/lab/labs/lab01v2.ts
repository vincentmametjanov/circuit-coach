// Lab 01: Blink an LED on pin 7. The complete lab as data for the generic
// runtime — its parts, sketch, mistake wording, guide steps, and the behavior
// (blink every 500 ms; a resistor-less LED burns out as soon as it is powered).

import { type LedLoop, findLoop, findShort, landingStrip, ledLoopMessages, wrongPinUsed } from '../engine/ledLoop';
import type { LabDef } from '../lab';
import { circuitOf } from '../runtime';

const LOOP: LedLoop = { signal: { node: 'D7', name: 'pin 7' }, led: 'led', resistor: 'resistor' };

const LED_CURRENT = 'About 14 mA flows — (5 V − 2 V LED drop) ÷ 220 Ω — bright, and safely under the LED’s 20 mA limit.';

export const SKETCH01 = `// blink_d7.ino — Lab 01
// Blinks an LED wired to digital pin 7.

const int LED_PIN = 7;   // must match your jumper wire

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);  // LED on
  delay(500);
  digitalWrite(LED_PIN, LOW);   // LED off
  delay(500);
}`;

export const LAB01: LabDef = {
  id: 'lab01',
  title: 'Lab 01 · Blink an LED on pin 7',
  sketch: { name: 'blink_d7', code: SKETCH01, highlightLine: 4 },
  parts: [
    { def: 'resistor', id: 'resistor' },
    { def: 'led', id: 'led' },
  ],

  verdict: {
    mistakes: ['short', 'reversed', 'noResistor', 'alwaysOn', 'ledShorted', 'wrongPin'],
    order: [
      'short',
      'burnt',
      'pass',
      'alwaysOn',
      'ledShorted',
      'noResistor',
      'reversed',
      'missingParts',
      'wrongPin',
      'signalUnwired',
      'groundUnwired',
      'signalLandsNowhere',
      'groundLandsNowhere',
      'partsDisconnected',
      'loopOpen',
    ],
    check(code, c) {
      const say = ledLoopMessages(LAB01, LOOP);
      switch (code) {
        case 'short': {
          const short = findShort(c, [LOOP.signal]);
          if (!short) return null;
          const { a, b } = short;
          if (b.node === 'GND' && a.node === LOOP.signal.node) {
            return {
              title: 'Short circuit: pin 7 is wired straight to GND',
              detail:
                'With nothing in between, pin 7 would dump as much current as it can into ground — enough to damage the pin. Current has to pass through the resistor and LED on its way to GND.',
            };
          }
          if (b.node !== 'GND') {
            return {
              title: `Short circuit: ${a.name} is tied to ${b.name}`,
              detail: `When the sketch sets ${a.name} LOW it would fight the ${b.name} supply. Give each one its own column strip.`,
            };
          }
          return {
            title: `Short circuit: ${a.name} is wired straight to GND`,
            detail: `That connects the ${a.name} supply directly to ground. On a real board the USB fuse trips and the Arduino shuts off. Remove one of those jumpers.`,
          };
        }
        case 'burnt':
          return c.board.burnt.includes('led')
            ? {
                title: 'This LED is burned out',
                detail: 'Drag it back to the parts bin to swap in a fresh one, and keep the 220 Ω resistor in the loop this time.',
              }
            : null;
        case 'pass': {
          const found = findLoop(c, LOOP);
          if (found?.kind !== 'ok' || found.source.node !== LOOP.signal.node) return null;
          return {
            title: 'Circuit check passed',
            source: found.source.node,
            detail:
              found.order[0] === 'resistor'
                ? `Pin 7 → 220 Ω resistor → LED (+ to −) → GND. ${LED_CURRENT}`
                : `Pin 7 → LED (+ to −) → 220 Ω resistor → GND. A resistor works on either side of the LED. ${LED_CURRENT}`,
          };
        }
        case 'alwaysOn': {
          const found = findLoop(c, LOOP);
          return found?.kind === 'ok' ? { ...say.wrongSource(found.source), source: found.source.node } : null;
        }
        case 'ledShorted': {
          return findLoop(c, LOOP)?.kind === 'bypassed'
            ? {
                title: 'Both LED legs share one strip',
                detail:
                  'Current takes the shortcut through the breadboard strip and skips the LED. Put its two legs in different numbered columns.',
              }
            : null;
        }
        case 'noResistor': {
          const found = findLoop(c, LOOP);
          return found?.kind === 'noResistor' ? { ...say.noLimiter(found.source), source: found.source.node } : null;
        }
        case 'reversed': {
          const found = findLoop(c, LOOP);
          return found?.kind === 'reversed' ? { ...say.reversed(found.source), source: found.source.node } : null;
        }
        case 'missingParts': {
          const missing = ['resistor', 'led'].filter((id) => !c.part(id));
          if (missing.length === 0) return null;
          return {
            title: `${
              missing.length > 1 ? 'The resistor and LED are' : missing[0] === 'resistor' ? 'The 220 Ω resistor is' : 'The LED is'
            } still in the parts bin`,
            detail: 'Drag each part onto the breadboard so its legs drop into two different numbered columns.',
          };
        }
        case 'wrongPin': {
          if (c.wired(LOOP.signal.node)) return null;
          const pinName = wrongPinUsed(c, LOOP.signal);
          return pinName
            ? {
                title: `Your signal jumper is on ${pinName}`,
                detail: `The sketch drives pin 7 (const int LED_PIN = 7), so ${pinName} never switches on. Drag that jumper’s header end over to pin 7.`,
              }
            : null;
        }
        case 'signalUnwired':
          return c.wired(LOOP.signal.node)
            ? null
            : {
                title: 'Pin 7 isn’t wired yet',
                detail: 'Drag from pin 7 on the Arduino’s top header to the resistor’s free column on the breadboard.',
              };
        case 'groundUnwired':
          return c.wired('GND')
            ? null
            : {
                title: 'Nothing returns to GND',
                detail: 'Current needs a path back to the Arduino. Drag from a GND pin to the column holding the LED’s − (short) leg.',
              };
        case 'signalLandsNowhere':
        case 'groundLandsNowhere': {
          const node = code === 'signalLandsNowhere' ? LOOP.signal.node : 'GND';
          const who = code === 'signalLandsNowhere' ? 'Pin 7’s jumper' : 'The GND jumper';
          const legNets = ['resistor', 'led'].map((id) => c.legNets(id)!);
          if (legNets.some((legs) => legs.includes(c.net(node)))) return null;
          return {
            title: `${who} doesn’t reach a part`,
            detail: `It lands in ${landingStrip(c, node)}, but no resistor or LED leg is in that strip. Move the jumper or a part so they share a column.`,
          };
        }
        case 'partsDisconnected': {
          const legNets = ['resistor', 'led'].map((id) => c.legNets(id)!);
          const isolated = legNets.some((legs, i) =>
            legNets.every((other, j) => i === j || !legs.some((n: string) => other.includes(n))),
          );
          return isolated
            ? {
                title: 'The resistor and LED don’t connect',
                detail:
                  'Current has to pass from one to the other, so a resistor leg and an LED leg must share a numbered column.',
              }
            : null;
        }
        case 'loopOpen':
          return {
            title: 'The loop isn’t closed yet',
            detail:
              'Trace it: pin 7 → resistor → LED + leg → LED − leg → GND. Each step must share a column strip with the next.',
          };
        default:
          return null;
      }
    },
  },

  physics(lab, store) {
    const { state } = store;
    if (state.burnt.includes('led') || !state.parts.led) return null;
    const found = findLoop(circuitOf(lab, state), LOOP);
    if (found?.kind !== 'noResistor') return null;
    const powered = found.source.node !== LOOP.signal.node || (state.running && state.behavior.pinHigh === true);
    if (!powered) return null;
    store.state = { ...state, burnt: [...state.burnt, 'led'] };
    return [
      ['error', 'Pop! The LED burned out: with no resistor in the loop, nothing limited the current.'],
      ['hint', 'Hint: Drag the dead LED back to the parts bin for a fresh one, then put the 220 Ω resistor in series with it.'],
    ];
  },

  behavior: {
    tickMs: 500,
    onUpload(lab, store) {
      return { lab, state: { ...store.state, behavior: { ...store.state.behavior, pinHigh: true } } };
    },
    onTick(lab, store) {
      const { state } = store;
      return { lab, state: { ...state, behavior: { ...state.behavior, pinHigh: state.behavior.pinHigh !== true } } };
    },
    runningNote() {
      return { title: 'The sketch is running, but the LED isn’t blinking', detail: '' };
    },
    success: 'Your LED is blinking on pin 7. Lab 01 complete!',
  },

  steps: [
    {
      id: 'resistor',
      title: 'Place the 220 Ω resistor',
      detail: 'Drag it from the parts bin onto the breadboard. Its legs land 3 columns apart, in two different strips.',
      built: (q) => q.part('resistor') !== undefined,
    },
    {
      id: 'led',
      title: 'Add the LED, + leg first',
      detail: 'Put the LED’s + (long) leg in the same column as one resistor leg. Tap the LED to flip it.',
      built: (q) => q.part('led') !== undefined && q.legNets('resistor')!.includes(q.legNets('led')![0]),
    },
    {
      id: 'signal',
      title: 'Wire pin 7 to the resistor',
      detail: 'Drag from pin 7 on the top header to the resistor’s other column.',
      built: (q) => q.wired('D7') && q.legNets('resistor')!.includes(q.net('D7')) && q.net('D7') !== q.legNets('led')![0],
    },
    {
      id: 'ground',
      title: 'Wire GND to the LED’s − leg',
      detail: 'Drag from any GND pin to the column holding the LED’s − (short) leg.',
      built: (q) => q.part('led') !== undefined && q.wired('GND') && q.legNets('led')![1] === q.net('GND'),
    },
    {
      id: 'upload',
      title: 'Upload and watch it blink',
      detail: 'Press Upload (→) in the toolbar. The sketch switches pin 7 on and off every 500 ms.',
    },
  ],

  guide: {
    intro:
      'Build the circuit on the breadboard, then upload the sketch. Press Verify (✓) any time to have the checker trace your wiring.',
    explainers: [
      {
        title: 'How a breadboard connects',
        body: 'Each numbered column of five holes (a–e) is one metal strip underneath, and f–j is another. Two legs in the same strip are connected; the center gap separates the halves.',
      },
      {
        title: 'LED polarity',
        body: 'Current enters the + leg (anode, the longer bent one) and leaves the − leg (cathode, by the flat edge of the rim). Backwards, it stays dark.',
      },
      {
        title: 'Why 220 Ω?',
        body: 'An LED drops about 2 V. The resistor limits the rest: (5 V − 2 V) ÷ 220 Ω ≈ 14 mA, bright but under the LED’s 20 mA limit.',
      },
      {
        title: 'On the factory floor',
        body: 'Machines show their state with indicator lights. A factory controller switches an output on to light a “running” lamp, the same job your sketch does when it sets pin 7 HIGH.',
      },
    ],
  },
  next: { id: 'lab02', title: 'Lab 02 · Start button and pull-down resistors' },
};
