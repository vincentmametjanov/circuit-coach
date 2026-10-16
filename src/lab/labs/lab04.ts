// Lab 04: Speed dial. A potentiometer's wiper feeds analog pin A0; the sketch
// prints the 0–1023 reading and the voltage to the Serial Monitor. The knob is
// draggable while the sketch runs. Teaches analog input and the voltage
// divider as one idea.

import { findShort } from '../engine/ledLoop';
import type { Circuit } from '../engine/circuit';
import type { LabDef } from '../lab';
import { PIN_BY_ID } from '../geometry';
import { circuitOf, printSerial } from '../runtime';

const WIPER = { node: 'A0', name: 'A0' };

const SKETCH = `// speed_dial.ino — Lab 04
// Reads the speed knob on A0 and prints it, like a conveyor's speed dial.

const int DIAL_PIN = A0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int reading = analogRead(DIAL_PIN);        // 0–1023
  float volts = reading * (5.0 / 1023.0);    // as a voltage
  Serial.print(reading);
  Serial.print("  ");
  Serial.println(volts);
  delay(200);
}`;

/**
 * What the pot actually feeds A0: the knob's fraction (0–1) when the outer
 * legs reach 5V and GND; a stuck 0 or 1023 when one outer leg is missing;
 * null when the wiper isn't on A0 at all.
 */
export function potReading(c: Circuit, knob: number): number | null {
  const legs = c.legNets('pot');
  if (!legs) return null;
  const [outerA, wiper, outerB] = legs;
  if (!c.wired(WIPER.node) || wiper !== c.net(WIPER.node)) return null;
  const onA = c.wired('5V') && outerA === c.net('5V');
  const onB = c.wired('GND') && outerB === c.net('GND');
  if (onA && onB) return Math.round(knob * 1023);
  if (onA) return 1023;
  if (onB) return 0;
  return null;
}

export const LAB04: LabDef = {
  id: 'lab04',
  title: 'Lab 04 · Speed dial',
  sketch: { name: 'speed_dial', code: SKETCH, highlightLine: 10 },
  parts: [{ def: 'pot', id: 'pot', name: '10 kΩ potentiometer' }],

  verdict: {
    mistakes: ['short', 'wiperWrongPin', 'outerMissing'],
    order: ['short', 'pass', 'wiperWrongPin', 'outerMissing', 'missingParts', 'open'],
    check(code, c) {
      switch (code) {
        case 'short': {
          const short = findShort(c);
          if (!short) return null;
          return {
            title: `Short circuit: ${short.a.name} is wired straight to ${short.b.name}`,
            detail: '5V must reach the pot’s outer leg, not a GND strip. On a real board the USB fuse trips.',
          };
        }
        case 'pass': {
          const legs = c.legNets('pot');
          if (!legs) return null;
          const reading = potReading(c, 0.5);
          if (reading === null || (reading !== 512 && reading !== 511)) {
            // 0.5 knob → 511/512 depending on rounding; anything in between means wired right.
            if (!(reading !== null && reading > 500 && reading < 524)) return null;
          }
          return {
            title: 'Circuit check passed',
            detail: 'Outer legs on 5V and GND, wiper on A0. Turn the knob and watch the Serial Monitor: 0–1023, 0–5 V.',
          };
        }
        case 'wiperWrongPin': {
          const legs = c.legNets('pot');
          if (!legs) return null;
          if (c.wired(WIPER.node) && legs[1] === c.net(WIPER.node)) return null;
          const wire = c.board.wires.find((w) => {
            const pin = PIN_BY_ID[w.pin];
            return pin.kind !== 'power' && pin.kind !== 'ground' && legs.includes(c.net(pin.node)) && legs[1] === c.net(pin.node);
          });
          if (!wire) return null;
          const pin = PIN_BY_ID[wire.pin];
          return {
            title: `The wiper is on ${pin.name}, not A0`,
            detail: `Only the analog pins (A0–A5) read a voltage in between 0 and 5 V. ${pin.name} would read just 0 or 1. Move the wiper’s jumper to A0.`,
          };
        }
        case 'outerMissing': {
          const legs = c.legNets('pot');
          if (!legs || !c.wired(WIPER.node) || legs[1] !== c.net(WIPER.node)) return null;
          const onA = c.wired('5V') && legs[0] === c.net('5V');
          const onB = c.wired('GND') && legs[2] === c.net('GND');
          if (onA && onB) return null;
          return {
            title: 'One of the outer legs isn’t connected',
            detail: `The knob only divides the voltage across the two outer legs. With ${
              onA ? 'the GND side' : 'the 5V side'
            } missing, the reading is stuck at an end. Wire the outer legs to 5V and GND.`,
          };
        }
        case 'missingParts':
          return c.part('pot')
            ? null
            : {
                title: 'The potentiometer is still in the parts bin',
                detail: 'Drag it onto the breadboard so its three legs sit in three different columns.',
              };
        case 'open':
          return {
            title: 'The dial isn’t wired yet',
            detail: 'Three jumpers: one outer leg to 5V, the other outer leg to GND, and the middle leg (the wiper) to A0.',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 400,
    analogReads(lab, store) {
      const reading = potReading(circuitOf(lab, store.state), knobOf(store.state));
      return reading === null ? {} : { A0: reading };
    },
    onUpload(lab, store) {
      return { lab, state: printSerial(store.state, 'Serial Monitor open at 9600 baud.') };
    },
    onTick(lab, store) {
      const { state } = store;
      const reading = potReading(circuitOf(lab, state), knobOf(state));
      if (reading === null) return store;
      const volts = ((reading * 5) / 1023).toFixed(2);
      return { lab, state: printSerial(state, `${reading}  ${volts} V`) };
    },
    runningNote() {
      return { title: 'The sketch is running, but the Serial Monitor is quiet', detail: '' };
    },
    success: 'Turn the knob: the Serial Monitor tracks it from 0 to 1023. Lab 04 complete!',
  },

  steps: [
    {
      id: 'pot',
      title: 'Place the potentiometer',
      detail: 'Drag it onto the breadboard so its three legs sit in three different columns.',
      built: (q) => q.part('pot') !== undefined,
    },
    {
      id: 'outer',
      title: 'Wire the outer legs to 5V and GND',
      detail: 'These set the ends of the dial: all the way down is 0 V, all the way up is 5 V.',
      built: (q) => {
        const legs = q.legNets('pot');
        return !!legs && q.wired('5V') && q.wired('GND') && legs[0] === q.net('5V') && legs[2] === q.net('GND');
      },
    },
    {
      id: 'wiper',
      title: 'Wire the middle leg to A0',
      detail: 'The wiper is the reading. Only the analog pins measure a voltage between 0 and 5 V.',
      built: (q) => {
        const legs = q.legNets('pot');
        return !!legs && q.wired('A0') && legs[1] === q.net('A0');
      },
    },
    {
      id: 'upload',
      title: 'Upload and turn the knob',
      detail: 'The Serial Monitor prints the reading (0–1023) and the voltage. Try both ends of the dial.',
    },
  ],

  guide: {
    intro: 'A conveyor’s speed knob, in miniature: the potentiometer is a voltage divider you turn, and A0 reads it as a number.',
    explainers: [
      {
        title: 'A voltage divider in one picture',
        body: 'Inside the pot, a resistive track runs from one outer leg to the other, and the wiper slides along it. Halfway up, the wiper sits between two equal resistances, so it reads half the voltage: 2.5 V.',
      },
      {
        title: '0–1023 ↔ 0–5 V',
        body: 'analogRead returns 10 bits: 1024 steps. The sketch converts with volts = reading × (5.0 ÷ 1023). A reading of 512 is 512 × 0.00489 ≈ 2.50 V — the knob halfway round.',
      },
      {
        title: 'On the factory floor',
        body: 'Industrial sensors use the same idea as 4–20 mA current loops instead of 0–5 V: the reading is a fraction of a range, and a broken wire reads below the bottom of the range so the controller can tell “zero” from “unplugged”.',
      },
    ],
    proTip: {
      title: 'Pro tip: the map() function',
      body: 'map(reading, 0, 1023, 0, 100) turns the dial straight into a percent — how a HMI shows “line speed: 62%”.',
    },
  },
  next: { id: 'lab05', title: 'Lab 05 · Motor speed (PWM)' },
};

function knobOf(state: { behavior: Record<string, unknown> }): number {
  return typeof state.behavior.knob === 'number' ? state.behavior.knob : 0.5;
}
