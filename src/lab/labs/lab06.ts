// Lab 06: Part counter. A photoresistor and a 10 kΩ resistor make a voltage
// divider into A0; a box breaking the beam swings the reading across a
// threshold and the sketch counts it once, flashing the green LED. This is a
// photoelectric beam-break sensor counting parts on a conveyor.

import { type Circuit, pathThrough } from '../engine/circuit';
import { type LedLoop, findLoop, findShort, ledLoopMessages } from '../engine/ledLoop';
import type { LabDef } from '../lab';
import { type LabStore, type RuntimeState, circuitOf, printSerial } from '../runtime';

const FLASH: LedLoop = { signal: { node: 'D7', name: 'pin 7' }, led: 'led', resistor: 'resistor' };

/** A box blocks the beam during these phases of the conveyor cycle. */
const CYCLE = 8;
const BLOCKED = [4, 5];

const R_BRIGHT = 1_000;
const R_DARK = 100_000;
const R_FIXED = 10_000;

const SKETCH = `// part_counter.ino — Lab 06
// Counts boxes breaking a light beam on A0, like a photoeye on a conveyor.

const int SENSOR_PIN = A0;
const int LED_PIN = 7;
const int THRESHOLD = 512;   // swap < for > if your divider is the other way round
bool boxThere = false;
int count = 0;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(SENSOR_PIN);
  bool dark = reading < THRESHOLD;
  if (dark && !boxThere) {           // count once per box, not once per loop
    count++;
    Serial.print("Part ");
    Serial.println(count);
    digitalWrite(LED_PIN, HIGH);
  } else if (!dark) {
    digitalWrite(LED_PIN, LOW);
  }
  boxThere = dark;
  delay(100);
}`;

/**
 * The divider's topology: which part sits between 5V and A0 and which between
 * A0 and GND, or null when the midpoint doesn't reach A0 from both sides.
 */
export function sensorDivider(c: Circuit, ldrId = 'ldr', fixedId = 'resistor10k', node = 'A0'): { top: string; bottom: string } | null {
  if (!c.part(ldrId) || !c.wired(node)) return null;
  if (pathThrough(c, '5V', node, [ldrId]) && pathThrough(c, node, 'GND', [fixedId])) return { top: ldrId, bottom: fixedId };
  if (pathThrough(c, '5V', node, [fixedId]) && pathThrough(c, node, 'GND', [ldrId])) return { top: fixedId, bottom: ldrId };
  return null;
}

/**
 * What A0 reads with `light` from 0 (dark / beam blocked) to 1 (bright).
 * Swapping sensor and fixed resistor flips which way the reading swings —
 * the light-on / dark-on selector on a real photo sensor. Null when A0 floats.
 */
export function ldrReading(c: Circuit, light: number, ldrId = 'ldr', fixedId = 'resistor10k', node = 'A0'): number | null {
  const divider = sensorDivider(c, ldrId, fixedId, node);
  if (!divider) {
    // The LDR alone from 5V to the pin: the reading sits at the top no matter the light.
    if (c.part(ldrId) && c.wired(node) && pathThrough(c, '5V', node, [ldrId])) return 1020;
    return null;
  }
  const rLdr = R_BRIGHT + (R_DARK - R_BRIGHT) * (1 - light);
  const top = divider.top === ldrId ? rLdr : R_FIXED;
  const bottom = divider.bottom === ldrId ? rLdr : R_FIXED;
  return Math.round((1023 * bottom) / (top + bottom));
}

/** True when the reading says a box is in the beam, for this divider's orientation. */
function boxBlocks(c: Circuit, reading: number): boolean {
  const divider = sensorDivider(c);
  return !!divider && (divider.top === 'ldr' ? reading < 512 : reading > 512);
}

function lightAt(state: { behavior: Record<string, unknown> }): { light: number; blocked: boolean } {
  const phase = typeof state.behavior.phase === 'number' ? state.behavior.phase : 0;
  const ambient = typeof state.behavior.light === 'number' ? state.behavior.light : 1;
  const blocked = BLOCKED.includes(phase);
  return { light: blocked ? 0 : ambient, blocked };
}

function runLoop(lab: LabDef, store: LabStore): LabStore {
  const { state } = store;
  const c = circuitOf(lab, state);
  const phase = ((typeof state.behavior.phase === 'number' ? state.behavior.phase : 0) + 1) % CYCLE;
  const { light, blocked } = lightAt({ behavior: { ...state.behavior, phase } });
  const reading = ldrReading(c, light);
  const wasBox = state.behavior.wasBox === true;
  const isBox = reading !== null && boxBlocks(c, reading);
  let count = typeof state.behavior.count === 'number' ? state.behavior.count : 0;
  let flash = typeof state.behavior.flash === 'number' ? state.behavior.flash : 0;

  let next: RuntimeState = { ...state, behavior: { ...state.behavior, phase, ldr: blocked, wasBox: isBox, flash: Math.max(0, flash - 1) } };
  if (isBox && !wasBox) {
    count += 1;
    next = { ...next, behavior: { ...next.behavior, count, flash: 2 } };
    next = printSerial(next, `Part ${count} counted (${count === 1 ? '1 part' : `${count} parts`} this run)`);
  }
  return { lab, state: next };
}

export const LAB06: LabDef = {
  id: 'lab06',
  title: 'Lab 06 · Part counter',
  sketch: { name: 'part_counter', code: SKETCH, highlightLine: 18 },
  parts: [
    { def: 'ldr', id: 'ldr' },
    { def: 'resistor10k', id: 'resistor10k' },
    { def: 'led', id: 'led', name: 'Green LED', color: 'green' },
    { def: 'resistor', id: 'resistor' },
  ],

  verdict: {
    mistakes: ['short', 'noFixedResistor', 'ledLoop'],
    whenChecked: ['noFixedResistor'],
    order: ['short', 'burnt', 'pass', 'noFixedResistor', 'ledLoop', 'sensorOpen', 'missingParts', 'open'],
    check(code, c) {
      const say = ledLoopMessages(LAB06, FLASH);
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
                title: 'The green LED is burned out',
                detail: 'Drag it back to the parts bin for a fresh one, and keep its 220 Ω resistor in the loop this time.',
              }
            : null;
        case 'pass': {
          const divider = sensorDivider(c);
          const loop = findLoop(c, FLASH);
          if (!divider || loop?.kind !== 'ok' || loop.source.node !== FLASH.signal.node) return null;
          return {
            title: 'Circuit check passed',
            detail:
              divider.top === 'ldr'
                ? 'Sensor on the 5V side, 10 kΩ to GND: a box in the beam pulls A0 low, below the 512 threshold. Dark-on — the factory default for counting.'
                : 'Fixed resistor on the 5V side, sensor to GND: a box pushes A0 high instead — the light-on / dark-on selector on a real photo sensor. The sketch counts it just the same.',
          };
        }
        // The LDR alone from 5V to A0: no divider, so the reading never moves.
        case 'noFixedResistor': {
          if (!c.part('ldr') || sensorDivider(c)) return null;
          if (!c.wired('A0') || !pathThrough(c, '5V', 'A0', ['ldr'])) return null;
          return {
            title: 'No fixed resistor in the sensor circuit',
            detail:
              'A0 reads the midpoint of a divider. With the photoresistor alone on 5V the reading sits near 1023 whether the beam is blocked or not. Add the 10 kΩ resistor from A0’s column to GND.',
          };
        }
        case 'ledLoop': {
          const loop = findLoop(c, FLASH);
          if (!loop) return null;
          if (loop.kind === 'ok') {
            if (loop.source.node === FLASH.signal.node) return null;
            return { ...say.wrongSource(loop.source), source: loop.source.node };
          }
          if (loop.kind === 'bypassed') {
            return {
              title: 'Both legs of the green LED share one strip',
              detail: 'Current skips the LED. Put its two legs in different numbered columns.',
            };
          }
          if (loop.kind === 'noResistor') return { ...say.noLimiter(loop.source), source: loop.source.node };
          if (loop.kind === 'wrongPin') {
            return {
              title: `The LED’s signal jumper is on ${loop.pinName}`,
              detail: `The sketch flashes pin 7 when a box passes, so ${loop.pinName} never lights it. Move that jumper to pin 7.`,
            };
          }
          return { ...say.reversed(loop.source), source: loop.source.node };
        }
        case 'sensorOpen': {
          if (!c.part('ldr') || sensorDivider(c) || pathThrough(c, '5V', 'A0', ['ldr'])) return null;
          return {
            title: 'The beam sensor isn’t wired to A0 yet',
            detail:
              'Make a divider: 5V → photoresistor → A0, then A0 → 10 kΩ resistor → GND. (Swapping the two resistive parts works too — it just flips dark-on to light-on.)',
          };
        }
        case 'missingParts': {
          const missing = [
            ['ldr', 'the photoresistor'],
            ['resistor10k', 'the 10 kΩ resistor'],
            ['led', 'the green LED'],
            ['resistor', 'the 220 Ω resistor'],
          ]
            .filter(([id]) => !c.part(id))
            .map(([, name]) => name);
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'The counter needs the light-sensor divider and one LED loop.',
          };
        }
        case 'open':
          return {
            title: 'The counter isn’t wired yet',
            detail: 'Two halves: the beam sensor (5V → photoresistor → A0 → 10 kΩ → GND) and the count light (pin 7 → 220 Ω → LED → GND).',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 300,
    onUpload(lab, store) {
      return { lab, state: printSerial(store.state, 'Serial Monitor open at 9600 baud.') };
    },
    onTick: runLoop,
    analogReads(lab, store): Record<string, number> {
      const { light } = lightAt(store.state);
      const reading = ldrReading(circuitOf(lab, store.state), light);
      return reading === null ? {} : { A0: reading };
    },
    ledLevels(lab, store) {
      const flash = typeof store.state.behavior.flash === 'number' ? store.state.behavior.flash : 0;
      return { led: store.state.running && flash > 0 ? 1 : 0 };
    },
    runningNote() {
      return { title: 'The sketch is running, but boxes pass without being counted', detail: '' };
    },
    success: 'Boxes cross the beam and the counter climbs — one count per box. Lab 06 complete!',
  },

  steps: [
    {
      id: 'sensor',
      title: 'Place the photoresistor and the 10 kΩ resistor',
      detail: 'They make the divider: one from 5V toward A0, the other from A0 toward GND.',
      built: (q) => q.part('ldr') !== undefined && q.part('resistor10k') !== undefined,
    },
    {
      id: 'divider',
      title: 'Wire the divider into A0',
      detail: '5V → photoresistor → A0 → 10 kΩ → GND. Either order works; it only flips dark-on to light-on.',
      built: (q) => sensorDivider(q) !== null,
    },
    {
      id: 'led',
      title: 'Build the count light on pin 7',
      detail: 'Pin 7 → 220 Ω resistor → green LED (+ to −) → GND.',
      built: (q) => {
        const found = findLoop(q, FLASH);
        return found?.kind === 'ok' && found.source.node === 'D7';
      },
    },
    {
      id: 'upload',
      title: 'Upload and watch the counter',
      detail: 'Each box that breaks the beam counts once and flashes the LED. Watch the Serial Monitor.',
    },
  ],

  guide: {
    intro:
      'A photoelectric part counter, in miniature: a light sensor watches a beam, and every box that breaks it counts once and flashes the light.',
    explainers: [
      {
        title: 'The sensor is a divider',
        body: 'The photoresistor is about 1 kΩ in bright light and 100 kΩ in the dark. Against the fixed 10 kΩ, A0 sits near 930 bright and near 93 dark — an easy threshold at 512.',
      },
      {
        title: 'Light-on vs dark-on',
        body: 'Swap the sensor and the fixed resistor and the same box pushes the reading the other way. Industrial photo sensors have exactly this as a switch on the housing: light-on or dark-on.',
      },
      {
        title: 'Count once per box',
        body: 'The loop runs hundreds of times while one box passes. The sketch remembers boxThere and only counts the moment the beam changes — the same edge detection the stack light used for its button.',
      },
      {
        title: 'On the factory floor',
        body: 'Conveyors count parts with a beam-break photoeye. The count drives everything downstream: packing batches, jam detection, and the production totals on the shift board.',
      },
    ],
    proTip: {
      title: 'Pro tip: pick the threshold in the middle',
      body: 'With bright ≈ 930 and dark ≈ 93, any threshold between them works — 512 sits in the middle, farthest from noise at either end. Real sensors call this the sensitivity adjustment.',
    },
  },
  next: { id: 'lab07', title: 'Lab 07 · Over-temperature alarm' },
};
