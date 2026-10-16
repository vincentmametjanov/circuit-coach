// Lab 02: Start button. The Lab 01 LED loop stays, and a pushbutton on pin 2
// with a 10 kΩ pull-down decides whether the LED lights. While the sketch
// runs, holding the button lights the LED; a floating pin 2 flickers at
// random — the exact reason real machines never leave an input floating.

import { type LedLoop, findLoop, findShort, ledLoopMessages } from '../engine/ledLoop';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { appendLog, circuitOf, nextRandom } from '../runtime';
import { LAB01 } from './lab01v2';

const LOOP: LedLoop = { signal: { node: 'D7', name: 'pin 7' }, led: 'led', resistor: 'resistor' };
const INPUT: LedLoop['signal'] = { node: 'D2', name: 'pin 2' };

const SKETCH = `// start_button.ino — Lab 02
// Lights the LED on pin 7 while the button on pin 2 is held.

const int LED_PIN = 7;
const int BUTTON_PIN = 2;   // needs the 10 kΩ pull-down to GND

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT);
}

void loop() {
  if (digitalRead(BUTTON_PIN) == HIGH) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }
}`;

/** The two legs of the button on the pin-2 side and the 5V side. */
function buttonSides(c: Parameters<typeof findLoop>[0]) {
  const nets = c.legNets('button');
  if (!nets) return null;
  // internalLinks join legs 0–1 (one side) and 2–3 (the other side).
  return { sideA: c.net(`part:button:0`), sideB: c.net(`part:button:2`) };
}

/**
 * pin 2's net: HIGH (button pressed to 5V), LOW (held down by the 10 kΩ
 * pull-down), floating (wired but nothing settles it), or disconnected.
 */
export function inputState(c: Parameters<typeof findLoop>[0]): 'high' | 'low' | 'floating' | 'disconnected' {
  if (!c.wired(INPUT.node)) return 'disconnected';
  const pin = c.net(INPUT.node);
  const sides = buttonSides(c);
  if (sides) {
    const buttonNet = sides.sideA === pin || sides.sideB === pin ? (sides.sideA === pin ? sides.sideB : sides.sideA) : null;
    const pressed = c.board.pressed.includes('button') || sides.sideA === sides.sideB;
    if (buttonNet && pressed && c.wired('5V') && buttonNet === c.net('5V')) return 'high';
  }
  // Any resistor bridging pin 2 to GND holds it LOW — the 10 kΩ is the right
  // one; a 220 Ω doing the same job is reported separately as wasteful.
  for (const id of ['resistor10k', 'resistor']) {
    const pull = c.legNets(id);
    if (pull && pull.includes(pin) && pull.includes(c.net('GND'))) return 'low';
  }
  return 'floating';
}

// Lab 01's burn-out physics apply unchanged: the LED loop is identical.
export const LAB02: LabDef = {
  id: 'lab02',
  title: 'Lab 02 · Start button',
  sketch: { name: 'start_button', code: SKETCH, highlightLine: 12 },
  parts: [
    { def: 'resistor', id: 'resistor' },
    { def: 'led', id: 'led' },
    { def: 'button', id: 'button' },
    { def: 'resistor10k', id: 'resistor10k' },
  ],

  verdict: {
    mistakes: ['short', 'reversed', 'noResistor', 'alwaysOn', 'ledShorted', 'wrongPin', 'buttonShort', 'alwaysPressed', 'floating', 'buttonWrongPin', 'weakPullDown'],
    order: [
      'short',
      'buttonShort',
      'burnt',
      'ledLoop',
      'pass',
      'alwaysPressed',
      'floating',
      'buttonWrongPin',
      'weakPullDown',
      'missingParts',
      'open',
    ],
    check(code, c) {
      const say = ledLoopMessages(LAB02, LOOP);
      switch (code) {
        // Shorts on the supply rails (not the button — that is buttonShort).
        case 'short': {
          const short = findShort(c);
          if (!short) return null;
          return {
            title: `Short circuit: ${short.a.name} is wired straight to ${short.b.name}`,
            detail: 'That connects a supply directly to ground. On a real board the USB fuse trips and the Arduino shuts off. Remove one of those jumpers.',
          };
        }
        // The button connects 5V straight to GND when pressed.
        case 'buttonShort': {
          const sides = buttonSides(c);
          if (!sides || !c.wired('5V') || !c.wired('GND')) return null;
          const aOn5V = sides.sideA === c.net('5V');
          const bOn5V = sides.sideB === c.net('5V');
          const aOnGnd = sides.sideA === c.net('GND');
          const bOnGnd = sides.sideB === c.net('GND');
          if ((aOn5V && bOnGnd) || (bOn5V && aOnGnd)) {
            return {
              title: 'Short circuit: the button joins 5V to GND when pressed',
              detail:
                'The button should sit between 5V and pin 2, with only the 10 kΩ pull-down going to GND. As wired, pressing it connects the supply straight to ground — on a real machine that is how fuses blow.',
            };
          }
          return null;
        }
        case 'burnt':
          return c.board.burnt.includes('led')
            ? {
                title: 'This LED is burned out',
                detail: 'Drag it back to the parts bin to swap in a fresh one, and keep the 220 Ω resistor in the loop this time.',
              }
            : null;
        case 'pass': {
          const loop = findLoop(c, LOOP);
          if (loop?.kind !== 'ok' || loop.source.node !== LOOP.signal.node) return null;
          const input = inputState(c);
          if (input !== 'low') return null;
          if (usesWeakPullDown(c)) return null;
          if (straySignalWire(c)) return null;
          return {
            title: 'Circuit check passed',
            detail: 'Pin 2 reads LOW at rest through the 10 kΩ pull-down and HIGH while the button is held. The LED follows the button.',
          };
        }
        // Every LED-loop mistake from Lab 01, in one bucket. Only findings on
        // the lab's own signals count — a reversed finding from an unrelated
        // net (say, a button wired to 5V) is not an LED problem.
        case 'ledLoop': {
          const loop = findLoop(c, LOOP);
          if (!loop) return null;
          if (loop.kind === 'ok') {
            if (loop.source.node === LOOP.signal.node) return null;
            return { ...say.wrongSource(loop.source), source: loop.source.node };
          }
          if (loop.kind === 'bypassed') {
            return {
              title: 'Both LED legs share one strip',
              detail: 'Current takes the shortcut through the breadboard strip and skips the LED. Put its two legs in different numbered columns.',
            };
          }
          if (loop.kind === 'reversed' && loop.source.node !== LOOP.signal.node) return null;
          if (loop.kind === 'wrongPin') return null; // Lab 02 reports input-pin mistakes separately.
          if (loop.kind === 'noResistor') return { ...say.noLimiter(loop.source), source: loop.source.node };
          return { ...say.reversed(loop.source), source: loop.source.node };
        }
        // pin 2 reads “always pressed”: either 5V's net is wired straight to a
        // digital pin, or both sides of the button share one net tied to 5V.
        case 'alwaysPressed': {
          if (!c.part('button') || !c.wired('5V')) return null;
          const fiveV = c.net('5V');
          const sides = buttonSides(c);
          const buttonShorted = !!sides && sides.sideA === sides.sideB && sides.sideA === fiveV;
          const fedStraight = c.board.wires.some((wire) => {
            const pin = PIN_BY_ID[wire.pin];
            return (pin.kind === 'digital' || pin.kind === 'analog') && c.net(pin.node) === fiveV;
          });
          if (!buttonShorted && !fedStraight) return null;
          return {
            title: 'The button reads “always pressed”',
            detail:
              'Pin 2 is tied straight to 5V — nothing the button does changes it. Wire 5V to one side of the button and pin 2 to the other side, across the center gap.',
          };
        }
        // pin 2 is wired but nothing holds it LOW: it floats. Reported once
        // the button is on the bench — before that, missingParts speaks first.
        case 'floating': {
          if (!c.part('button') || inputState(c) !== 'floating') return null;
          return {
            title: 'Pin 2 is floating',
            detail:
              'Nothing holds pin 2 at LOW while the button is up, so it drifts between readings — a real machine can start by itself this way. Add the 10 kΩ pull-down from pin 2’s column to GND.',
          };
        }
        case 'buttonWrongPin': {
          const sides = buttonSides(c);
          if (!sides || c.wired(INPUT.node)) return null;
          if (sides.sideA !== c.net('5V') && sides.sideB !== c.net('5V')) return null;
          return {
            title: 'The button doesn’t reach pin 2',
            detail: 'One side of the button is on 5V; the other side must wire to pin 2 (const int BUTTON_PIN = 2). Check which pin that jumper is in.',
          };
        }
        // A 220 Ω pull-down works but wastes 20× the current of a 10 kΩ one.
        case 'weakPullDown': {
          if (!c.part('button')) return null;
          return usesWeakPullDown(c)
            ? {
                title: 'That pull-down is a 220 Ω resistor',
                detail:
                  'It works — pin 2 still reads LOW — but it draws 23 mA whenever the button is held, against 0.5 mA through the 10 kΩ. Factory panels run for years; use the 10 kΩ.',
              }
            : null;
        }
        case 'missingParts': {
          const catalog: [string, string][] = [
            ['resistor', 'The 220 Ω resistor is'],
            ['led', 'The LED is'],
            ['button', 'The button is'],
            ['resistor10k', 'The 10 kΩ resistor is'],
          ];
          const missing = catalog.filter(([id]) => !c.part(id));
          if (missing.length === 0) return null;
          return {
            title: `${missing.map(([, text]) => text).join(', ')} still in the parts bin`,
            detail: 'Drag each part onto the breadboard. The button straddles the center gap; resistors and the LED span two columns.',
          };
        }
        case 'open':
          return {
            title: 'The circuit isn’t finished yet',
            detail:
              'Two loops to trace: pin 7 → 220 Ω → LED → GND, and 5V → button → pin 2 → 10 kΩ → GND. Each step must share a column strip with the next.',
          };
        default:
          return null;
      }
    },
  },

  physics: LAB01.physics,

  behavior: {
    tickMs: 250,
    onTick(lab, store) {
      const { state } = store;
      const input = inputState(circuitOf(lab, state));
      let ledOn = false;
      if (input === 'high') ledOn = state.pressed.includes('button');
      else if (input === 'floating') {
        // A floating input drifts: the LED flickers at random.
        const { seed, value } = nextRandom(state.seed);
        ledOn = value > 0.5;
        store.state = { ...state, seed };
        if (!state.behavior.floatWarned) {
          store.state = {
            ...store.state,
            behavior: { ...store.state.behavior, floatWarned: true },
          };
          return {
            lab,
            state: appendLog(
              { ...store.state, behavior: { ...store.state.behavior, ledOn } },
              ['warn', 'Pin 2 is floating: the LED flickers on its own.'],
              ['hint', 'Hint: An input with nothing pulling it LOW picks up noise. Wire the 10 kΩ resistor from pin 2’s column to GND.'],
            ),
          };
        }
        return { lab, state: { ...store.state, behavior: { ...store.state.behavior, ledOn } } };
      }
      return { lab, state: { ...store.state, behavior: { ...store.state.behavior, ledOn } } };
    },
    onPress(lab, store, part) {
      // Pressing or releasing changes the reading immediately, not on the next tick.
      return lab.behavior.onTick!(lab, store);
    },
    runningNote() {
      return { title: 'The sketch is running, but the LED doesn’t follow the button', detail: '' };
    },
    success: 'Hold the button: the LED lights while pin 2 reads HIGH. Lab 02 complete!',
  },

  steps: [
    {
      id: 'led-loop',
      title: 'Rebuild the Lab 01 LED loop',
      detail: '220 Ω resistor and LED in series from pin 7 to GND — same circuit as Lab 01.',
      built: (q) => {
        const loop = findLoop(q, LOOP);
        return loop?.kind === 'ok' && loop.source.node === LOOP.signal.node;
      },
    },
    {
      id: 'button',
      title: 'Place the button across the gap',
      detail: 'Its four legs straddle the center gap: two legs in the top half, two in the bottom half of the same two columns.',
      built: (q) => q.part('button') !== undefined,
    },
    {
      id: 'button-5v',
      title: 'Wire 5V to one side of the button',
      detail: 'Drag from the 5V pin to a column holding one side of the button.',
      built: (q) => {
        const sides = buttonSides(q);
        return !!sides && q.wired('5V') && (sides.sideA === q.net('5V') || sides.sideB === q.net('5V'));
      },
    },
    {
      id: 'button-pin2',
      title: 'Wire the other side to pin 2',
      detail: 'Drag from pin 2 to the column on the button’s other side.',
      built: (q) => {
        const sides = buttonSides(q);
        if (!sides || !q.wired('D2')) return false;
        const pin = q.net('D2');
        return (sides.sideA === pin || sides.sideB === pin) && sides.sideA !== sides.sideB;
      },
    },
    {
      id: 'pulldown',
      title: 'Add the 10 kΩ pull-down to GND',
      detail: 'From pin 2’s column to a GND pin. This holds the input LOW while the button is up.',
      built: (q) => {
        const pull = q.legNets('resistor10k');
        return !!pull && q.wired('D2') && q.wired('GND') && pull.includes(q.net('D2')) && pull.includes(q.net('GND'));
      },
    },
    {
      id: 'upload',
      title: 'Upload, then press and hold the button',
      detail: 'The LED lights only while you hold the button down. Release it and the LED goes dark.',
    },
  ],

  guide: {
    intro:
      'The LED circuit from Lab 01 stays. Now a button on pin 2 decides when it lights — the same start button every machine has.',
    explainers: [
      {
        title: 'Why the pull-down resistor',
        body: 'An input pin with nothing connected picks up electrical noise and reads HIGH or LOW at random — it “floats”. The 10 kΩ resistor ties pin 2 to GND, so the pin reads LOW until the button connects it to 5V.',
      },
      {
        title: 'Why 10 kΩ and not 220 Ω',
        body: 'While the button is held, current flows through the pull-down to GND: 0.5 mA through 10 kΩ, but 23 mA through 220 Ω. Same reading, nearly fifty times the wasted current.',
      },
      {
        title: 'How the button is wired inside',
        body: 'A tactile button has four legs in two pairs. Each pair is already joined on one side of the gap; pressing the button joins the two sides. That is why it must straddle the center gap.',
      },
      {
        title: 'On the factory floor',
        body: 'Start/stop buttons and limit switches are digital inputs with pull resistors, exactly like this. A floating input on a real machine can start a motor by itself — that is why the resistor is not optional.',
      },
    ],
    proTip: {
      title: 'Pro tip: INPUT_PULLUP',
      body: 'The Arduino has pull resistors built in. pinMode(2, INPUT_PULLUP) ties pin 2 to 5V internally, and the button then wires from pin 2 to GND — pressed reads LOW. One less part, same idea, upside down.',
    },
  },
  next: { id: 'lab03', title: 'Lab 03 · Machine stack light' },
};

/** True when a signal-ish pin other than 7 and 2 has a jumper in it. */
function straySignalWire(c: Parameters<typeof findLoop>[0]): boolean {
  return c.board.wires.some((wire) => {
    const pin = PIN_BY_ID[wire.pin];
    return (pin.kind === 'digital' || pin.kind === 'analog') && pin.node !== 'D7' && pin.node !== 'D2';
  });
}

/**
 * True when the 220 Ω resistor ended up doing the pull-down's job: it bridges
 * pin 2's net to GND, while the 10 kΩ is anywhere else (or still in the bin).
 */
function usesWeakPullDown(c: Parameters<typeof findLoop>[0]): boolean {
  if (!c.wired('D2') || !c.wired('GND')) return false;
  const pin = c.net('D2');
  const gnd = c.net('GND');
  const wrong = c.legNets('resistor');
  const right = c.legNets('resistor10k');
  const wrongIsPullDown = !!wrong && wrong.includes(pin) && wrong.includes(gnd);
  const rightIsPullDown = !!right && right.includes(pin) && right.includes(gnd);
  return wrongIsPullDown && !rightIsPullDown;
}
