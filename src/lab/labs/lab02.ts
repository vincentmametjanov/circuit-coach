// Lab 02: Start button. The Lab 01 LED loop stays, and a pushbutton on pin 2
// with a 10 kΩ pull-down decides whether the LED lights. While the sketch
// runs, holding the button lights the LED; a floating pin 2 flickers at
// random. That is the reason real machines never leave an input floating.

import { type Circuit, buildCircuit, pathThrough } from '../engine/circuit';
import { type LedLoop, findLoop, findShort, ledLoopMessages } from '../engine/ledLoop';
import { straddlesGap } from '../engine/inputs';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { type LabStore, type RuntimeState, appendLog, circuitOf, nextRandom } from '../runtime';

const LOOP: LedLoop = { signal: { node: 'D7', name: 'pin 7' }, led: 'led', resistor: 'resistor' };
const INPUT: LedLoop['signal'] = { node: 'D2', name: 'pin 2' };

const SKETCH = `// start_button.ino: Lab 02
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

/** The nets of the button's two sides (legs 0–1 are joined inside, and legs 2–3). */
function buttonSides(c: Circuit) {
  if (!c.part('button')) return null;
  return { sideA: c.net('part:button:0'), sideB: c.net('part:button:2') };
}

/**
 * What pin 2 reads with the button as it is now: HIGH when its net reaches 5V
 * (through the pressed button, or wired straight to it), LOW when a resistor
 * or jumper holds it at GND, and floating when nothing settles it.
 */
export function inputState(c: Circuit): 'high' | 'low' | 'floating' | 'disconnected' {
  if (!c.wired(INPUT.node)) return 'disconnected';
  const pin = c.net(INPUT.node);
  if (c.wired('5V') && pin === c.net('5V')) return 'high';
  if (c.wired('GND') && pin === c.net('GND')) return 'low';
  // Any resistor bridging pin 2 to GND holds it LOW. The 10 kΩ is the right
  // one; a 220 Ω doing the same job is reported separately as wasteful.
  for (const id of ['resistor10k', 'resistor']) {
    const pull = c.legNets(id);
    if (c.wired('GND') && pull && pull.includes(pin) && pull.includes(c.net('GND'))) return 'low';
  }
  return 'floating';
}

/** The same circuit with the button held down. */
export function withButtonPressed(c: Circuit): Circuit {
  return c.board.pressed.includes('button') ? c : buildCircuit({ ...c.board, pressed: [...c.board.pressed, 'button'] });
}

/** True when pressing the button really takes pin 2 HIGH: 5V on one side, pin 2 on the other. */
export function buttonWorks(c: Circuit): boolean {
  return inputState(withButtonPressed(c)) === 'high';
}

/**
 * What the sketch's digitalRead(2) returns this instant. A floating pin picks
 * up noise and returns a random value; the runtime's seeded random keeps
 * tests repeatable.
 */
export function readInput(c: Circuit, store: LabStore): { value: boolean; floating: boolean; seed: number } {
  const input = inputState(c);
  if (input === 'high') return { value: true, floating: false, seed: store.state.seed };
  if (input === 'low') return { value: false, floating: false, seed: store.state.seed };
  const { seed, value } = nextRandom(store.state.seed);
  return { value: value > 0.5, floating: true, seed };
}

const FLOAT_WARNING: [ 'warn' | 'hint', string ][] = [
  ['warn', 'Pin 2 is floating: the reading jumps between HIGH and LOW on its own.'],
  ['hint', 'Hint: An input with nothing pulling it LOW picks up electrical noise. Wire the 10 kΩ resistor from pin 2’s column to GND.'],
];

/** Runs Lab 02's loop() once: read pin 2, drive pin 7 to match. */
function runLoop(lab: LabDef, store: LabStore): LabStore {
  const { state } = store;
  const reading = readInput(circuitOf(lab, state), store);
  let next: RuntimeState = { ...state, seed: reading.seed, behavior: { ...state.behavior, d7: reading.value } };
  if (reading.floating && !state.behavior.floatWarned) {
    next = appendLog({ ...next, behavior: { ...next.behavior, floatWarned: true } }, ...FLOAT_WARNING);
  }
  return { lab, state: next };
}

export const LAB02: LabDef = {
  id: 'lab02',
  title: 'Lab 02: Start button',
  sketch: { name: 'start_button', code: SKETCH, highlightLine: 12 },
  parts: [
    { def: 'resistor', id: 'resistor' },
    { def: 'led', id: 'led' },
    { def: 'button', id: 'button' },
    { def: 'resistor10k', id: 'resistor10k' },
  ],

  verdict: {
    // A floating pin 2 is not flagged mid-build (the pull-down may simply not be wired yet); Verify and
    // Upload report it, and the running sketch shows the flicker.
    mistakes: ['short', 'buttonShort', 'ledLoop', 'dimLed', 'alwaysPressed', 'buttonWrongPin', 'weakPullDown'],
    order: [
      'short',
      'buttonShort',
      'burnt',
      'ledLoop',
      'dimLed',
      'pass',
      'alwaysPressed',
      'floating',
      'buttonWrongPin',
      'weakPullDown',
      'buttonOpen',
      'missingParts',
      'open',
    ],
    check(code, c) {
      const say = ledLoopMessages(LAB02, LOOP);
      switch (code) {
        // Shorts on the supply rails (not the button; that is buttonShort).
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
                'The button should sit between 5V and pin 2, with only the 10 kΩ pull-down going to GND. As wired, pressing it connects the supply straight to ground. On a real machine that is how fuses blow.',
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
          if (inputState(c) !== 'low' || !buttonWorks(c)) return null;
          if (usesWeakPullDown(c)) return null;
          if (straySignalWire(c)) return null;
          return {
            title: 'Circuit check passed',
            detail: 'Pin 2 reads LOW at rest through the 10 kΩ pull-down and HIGH while the button is held. The LED follows the button.',
          };
        }
        // Every LED-loop mistake from Lab 01, in one bucket. Only findings on
        // the lab's own signals count. A reversed finding from an unrelated
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
        // The 10 kΩ ended up in the LED's loop: it lights, but only just.
        case 'dimLed':
          return c.wired(LOOP.signal.node) && pathThrough(c, LOOP.signal.node, 'GND', ['resistor10k', LOOP.led])
            ? {
                title: 'The LED’s loop uses the 10 kΩ resistor',
                detail:
                  'Only about 0.3 mA gets through 10 kΩ, so the LED barely glows. Put the 220 Ω resistor in the LED’s loop and use the 10 kΩ as the pull-down on pin 2.',
              }
            : null;
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
              'Pin 2 is tied straight to 5V, so nothing the button does changes it. Wire 5V to one side of the button and pin 2 to the other side, across the center gap.',
          };
        }
        // pin 2 is wired but nothing holds it LOW: it floats. Reported once
        // the button is on the bench. Before that, missingParts speaks first.
        case 'floating': {
          if (!c.part('button') || inputState(c) !== 'floating') return null;
          return {
            title: 'Pin 2 is floating',
            detail:
              'Nothing holds pin 2 at LOW while the button is up, so it drifts between readings. A real machine can start by itself this way. Add the 10 kΩ pull-down from pin 2’s column to GND.',
          };
        }
        // The button's far side is jumpered to some other input pin instead of pin 2.
        case 'buttonWrongPin': {
          const sides = buttonSides(c);
          if (!sides || c.wired(INPUT.node) || !c.wired('5V')) return null;
          const fiveV = c.net('5V');
          if (sides.sideA !== fiveV && sides.sideB !== fiveV) return null;
          const far = sides.sideA === fiveV ? sides.sideB : sides.sideA;
          const wire = c.board.wires.find((w) => {
            const pin = PIN_BY_ID[w.pin];
            return (pin.kind === 'digital' || pin.kind === 'analog') && c.net(pin.node) === far;
          });
          if (!wire) return null;
          const name = PIN_BY_ID[wire.pin].name;
          return {
            title: `The button is wired to ${name}, not pin 2`,
            detail: `The sketch reads pin 2 (const int BUTTON_PIN = 2), so ${name} is never read. Drag that jumper’s header end over to pin 2.`,
          };
        }
        // A 220 Ω pull-down works but wastes 20× the current of a 10 kΩ one.
        case 'weakPullDown': {
          if (!c.part('button')) return null;
          return usesWeakPullDown(c)
            ? {
                title: 'That pull-down is a 220 Ω resistor',
                detail:
                  'It works, and pin 2 still reads LOW, but it draws 23 mA whenever the button is held, against 0.5 mA through the 10 kΩ. Factory panels run for years; use the 10 kΩ.',
              }
            : null;
        }
        // Everything is in place except the button's path from 5V to pin 2.
        case 'buttonOpen':
          return c.part('button') && inputState(c) === 'low' && !buttonWorks(c)
            ? {
                title: 'Pressing the button doesn’t reach pin 2',
                detail:
                  'Pin 2 reads LOW, but it would stay LOW when you press. Wire 5V to one side of the button and pin 2 to the other side, across the center gap.',
              }
            : null;
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

  behavior: {
    tickMs: 250,
    // The upload report already explains a floating pin 2, so the first loop stays quiet.
    onUpload(lab, store) {
      const quiet = { ...store.state, behavior: { ...store.state.behavior, floatWarned: true } };
      const ran = runLoop(lab, { lab, state: quiet }).state;
      const input = inputState(circuitOf(lab, store.state));
      return { lab, state: { ...ran, behavior: { ...ran.behavior, floatWarned: input !== 'high' && input !== 'low' } } };
    },
    onTick: runLoop,
    // Pressing or releasing changes the reading at once, not on the next tick.
    onPress: (lab, store) => runLoop(lab, store),
    // Pin 7 copies whatever pin 2 reads.
    outputs: (_lab, store) => (store.state.behavior.d7 === true ? ['D7'] : []),
    runningNote() {
      return { title: 'The sketch is running, but the LED doesn’t follow the button', detail: '' };
    },
    success: 'Hold the button: the LED lights while pin 2 reads HIGH. Lab 02 complete!',
  },

  // One correct build, shown by "Show solution" in the lab guide.
  solution: {
    parts: { resistor: { row: 0, col: 2 }, led: { row: 2, col: 5 }, button: { row: 2, col: 8 }, resistor10k: { row: 6, col: 11 } },
    wires: [['D7', { row: 1, col: 2 }], ['GND_T', { row: 1, col: 6 }], ['5V', { row: 0, col: 8 }], ['D2', { row: 9, col: 11 }], ['GND_P1', { row: 9, col: 14 }]],
  },

  steps: [
    {
      id: 'led-loop',
      title: 'Rebuild the Lab 01 LED loop',
      detail: '220 Ω resistor and LED in series from pin 7 to GND, the same circuit as Lab 01.',
      built: (q) => {
        const loop = findLoop(q, LOOP);
        return loop?.kind === 'ok' && loop.source.node === LOOP.signal.node;
      },
    },
    {
      id: 'button',
      title: 'Place the button across the center gap',
      detail:
        'The gap is the channel that runs across the middle of the breadboard, between rows e and f. Drop the button in the top half so two legs land above the gap (rows a to e) and two land below it (rows f to j), in the same two columns.',
      built: (q) => straddlesGap(q, 'button'),
    },
    {
      id: 'button-5v',
      title: 'Wire 5V to one side of the button',
      detail: 'Drag from the 5V pin on the Arduino’s bottom header to a column holding one of the button’s legs.',
      built: (q) => {
        const sides = buttonSides(q);
        return !!sides && q.wired('5V') && (sides.sideA === q.net('5V') || sides.sideB === q.net('5V'));
      },
    },
    {
      id: 'button-pin2',
      title: 'Wire the other side to pin 2',
      detail: 'Drag from pin 2 on the Arduino’s top header to a column holding a leg on the button’s other side (the other pair of legs, across the gap).',
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
      detail:
        'Place the 10 kΩ resistor with one leg in the same column as the pin 2 jumper (the resistor spans 3 columns). Then drag from a GND pin on the Arduino to the resistor’s other column. This holds pin 2 LOW while the button is up.',
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
      'The LED circuit from Lab 01 stays. Now a button on pin 2 decides when it lights, the same start button every machine has.',
    explainers: [
      {
        title: 'Why the pull-down resistor',
        body: 'An input pin with nothing connected picks up electrical noise and reads HIGH or LOW at random. It “floats”. The 10 kΩ resistor ties pin 2 to GND, so the pin reads LOW until the button connects it to 5V.',
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
        body: 'Start/stop buttons and limit switches are digital inputs with pull resistors, exactly like this. A floating input on a real machine can start a motor by itself. That is why the resistor is not optional.',
      },
    ],
    proTip: {
      title: 'Pro tip: INPUT_PULLUP',
      body: 'The Arduino has pull resistors built in. pinMode(2, INPUT_PULLUP) ties pin 2 to 5V internally, and the button then wires from pin 2 to GND, so pressed reads LOW. One less part, same idea, upside down.',
    },
  },
  next: { id: 'lab03', title: 'Lab 03: Machine stack light' },
};

/** True when a signal-ish pin other than 7 and 2 has a jumper in it. */
function straySignalWire(c: Circuit): boolean {
  return c.board.wires.some((wire) => {
    const pin = PIN_BY_ID[wire.pin];
    return (pin.kind === 'digital' || pin.kind === 'analog') && pin.node !== 'D7' && pin.node !== 'D2';
  });
}

/**
 * True when the 220 Ω resistor ended up doing the pull-down's job: it bridges
 * pin 2's net to GND, while the 10 kΩ is anywhere else (or still in the bin).
 */
function usesWeakPullDown(c: Circuit): boolean {
  if (!c.wired('D2') || !c.wired('GND')) return false;
  const pin = c.net('D2');
  const gnd = c.net('GND');
  const wrong = c.legNets('resistor');
  const right = c.legNets('resistor10k');
  const wrongIsPullDown = !!wrong && wrong.includes(pin) && wrong.includes(gnd);
  const rightIsPullDown = !!right && right.includes(pin) && right.includes(gnd);
  return wrongIsPullDown && !rightIsPullDown;
}
