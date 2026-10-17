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

/** Which supply each outer leg reaches: '5V', 'GND', or null when unwired. */
function outerSupplies(c: Circuit): [string | null, string | null] | null {
  const legs = c.legNets('pot');
  if (!legs) return null;
  const supply = (net: string) =>
    c.wired('5V') && net === c.net('5V') ? '5V' : c.wired('GND') && net === c.net('GND') ? 'GND' : null;
  return [supply(legs[0]), supply(legs[2])];
}

/** True when the wiper (middle leg) is what A0 reads. */
function wiperOnA0(c: Circuit): boolean {
  const legs = c.legNets('pot');
  return !!legs && c.wired(WIPER.node) && legs[1] === c.net(WIPER.node);
}

/**
 * What A0 reads from the pot. The knob's fraction (0–1) scales between the
 * two outer legs, so either orientation works (one just turns the other way).
 * One outer leg missing pins the reading to the other leg's end; both outer
 * legs on one supply pins it there. Null when the wiper isn't on A0, or when
 * neither outer leg is wired (A0 floats).
 */
export function potReading(c: Circuit, knob: number): number | null {
  const outer = outerSupplies(c);
  if (!outer || !wiperOnA0(c)) return null;
  const level = (supply: string | null) => (supply === '5V' ? 1023 : supply === 'GND' ? 0 : null);
  const [a, b] = outer.map(level);
  if (a !== null && b !== null) return Math.round(a + (b - a) * knob);
  return a ?? b;
}

/** True when the pot is a working divider: one outer leg on 5V, the other on GND, wiper on A0. */
function dividerWired(c: Circuit): boolean {
  const outer = outerSupplies(c);
  return !!outer && wiperOnA0(c) && outer.includes('5V') && outer.includes('GND');
}

export const LAB04: LabDef = {
  id: 'lab04',
  title: 'Lab 04 · Speed dial',
  sketch: { name: 'speed_dial', code: SKETCH, highlightLine: 10 },
  parts: [{ def: 'pot', id: 'pot', name: '10 kΩ potentiometer' }],

  verdict: {
    mistakes: ['short', 'wiperOnSupply', 'wiperWrongPin', 'outerSame'],
    order: ['short', 'wiperOnSupply', 'pass', 'wiperWrongPin', 'outerSame', 'outerMissing', 'missingParts', 'open'],
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
        // The wiper on a supply: turned to the far end, the track's last few
        // ohms sit straight across 5V and GND.
        case 'wiperOnSupply': {
          const legs = c.legNets('pot');
          if (!legs) return null;
          const supply = c.wired('5V') && legs[1] === c.net('5V') ? '5V' : c.wired('GND') && legs[1] === c.net('GND') ? 'GND' : null;
          if (!supply) return null;
          const outer = outerSupplies(c);
          if (!outer?.some((s) => s && s !== supply)) return null;
          return {
            title: `The wiper is wired to ${supply}`,
            detail: `Turn the knob to the end and the wiper touches the other outer leg: ${supply} would connect almost straight to ${
              supply === '5V' ? 'GND' : '5V'
            }. The middle leg is the reading, so it goes to A0. The outer legs go to 5V and GND.`,
          };
        }
        case 'pass':
          return dividerWired(c)
            ? {
                title: 'Circuit check passed',
                detail: 'Outer legs on 5V and GND, wiper on A0. Turn the knob and watch the Serial Monitor: 0–1023, 0–5 V.',
              }
            : null;
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
        case 'outerSame': {
          const outer = outerSupplies(c);
          if (!outer || !outer[0] || outer[0] !== outer[1]) return null;
          return {
            title: `Both outer legs are on ${outer[0]}`,
            detail: `The knob divides the voltage between its outer legs. With both on ${outer[0]}, every position reads the same (${
              outer[0] === '5V' ? '1023' : '0'
            }). Move one outer leg's jumper to ${outer[0] === '5V' ? 'GND' : '5V'}.`,
          };
        }
        case 'outerMissing': {
          const outer = outerSupplies(c);
          if (!outer || !wiperOnA0(c) || (outer[0] && outer[1])) return null;
          const has = outer[0] ?? outer[1];
          return {
            title: has ? 'One of the outer legs isn’t connected' : 'The outer legs aren’t connected',
            detail: has
              ? `The knob only divides the voltage across the two outer legs. With just ${has} wired, the reading is stuck at ${
                  has === '5V' ? '1023' : '0'
                }. Wire the other outer leg to ${has === '5V' ? 'GND' : '5V'}.`
              : 'A0 is wired to the wiper, but nothing feeds the track, so the reading floats. Wire one outer leg to 5V and the other to GND.',
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
    analogReads(lab, store): Record<string, number> {
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
      detail: 'One outer leg to 5V, the other to GND. Either way round works; it only changes which way the knob turns up.',
      built: (q) => {
        const outer = outerSupplies(q);
        return !!outer && outer.includes('5V') && outer.includes('GND');
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
