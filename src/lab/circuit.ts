// Deterministic circuit checker. Breadboard strips and jumper wires are merged
// into electrical nets; the checker then looks for a series loop from a source
// through the resistor and LED (in the right direction) back to GND.

import { type Hole, PART_SPAN, PIN_BY_ID, type PartId, leadHoles, stripId, stripName } from './geometry';

export type Wire = { id: string; pin: string; hole: Hole };

export type CircuitState = {
  /** Hole of each part's left leg, or null while it sits in the parts bin. */
  parts: Record<PartId, Hole | null>;
  /** false: the LED's + leg (anode) is the left leg. */
  ledFlipped: boolean;
  ledBurnt: boolean;
  wires: Wire[];
};

export type VerdictCode =
  | 'pass'
  | 'alwaysOn'
  | 'noResistor'
  | 'reversed'
  | 'short'
  | 'ledShorted'
  | 'burnt'
  | 'missingParts'
  | 'wrongPin'
  | 'open';

export type Verdict = {
  code: VerdictCode;
  title: string;
  detail: string;
  /** Node driving the LED, when a complete loop was found. */
  source?: string;
};

export type Analysis = {
  verdict: Verdict;
  links: {
    resistorPlaced: boolean;
    ledPlaced: boolean;
    ledMeetsResistor: boolean;
    signalWired: boolean;
    groundWired: boolean;
  };
};

const SOURCES = [
  { node: 'D7', name: 'pin 7' },
  { node: '5V', name: '5V' },
  { node: '3V3', name: '3.3V' },
  { node: 'VIN', name: 'Vin' },
];

const LED_CURRENT = 'About 14 mA flows — (5 V − 2 V LED drop) ÷ 220 Ω — bright, and safely under the LED’s 20 mA limit.';

class Nets {
  private parent = new Map<string, string>();

  find(node: string): string {
    const parent = this.parent.get(node);
    if (parent === undefined || parent === node) return node;
    const root = this.find(parent);
    this.parent.set(node, root);
    return root;
  }

  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function ledLegs(circuit: CircuitState): { anode: Hole; cathode: Hole } | null {
  const left = circuit.parts.led;
  if (!left) return null;
  const [l, r] = leadHoles('led', left);
  return circuit.ledFlipped ? { anode: r, cathode: l } : { anode: l, cathode: r };
}

export function analyzeCircuit(circuit: CircuitState): Analysis {
  const nets = new Nets();
  for (const wire of circuit.wires) nets.union(PIN_BY_ID[wire.pin].node, stripId(wire.hole));
  const net = (node: string) => nets.find(node);
  const wired = new Set(circuit.wires.map((wire) => PIN_BY_ID[wire.pin].node));

  const gnd = net('GND');
  const d7 = net('D7');
  const resistor = circuit.parts.resistor
    ? leadHoles('resistor', circuit.parts.resistor).map((hole) => net(stripId(hole)))
    : null;
  const legs = ledLegs(circuit);
  const anode = legs ? net(stripId(legs.anode)) : null;
  const cathode = legs ? net(stripId(legs.cathode)) : null;

  const links = {
    resistorPlaced: resistor !== null,
    ledPlaced: legs !== null,
    ledMeetsResistor: resistor !== null && anode !== null && resistor.includes(anode),
    signalWired: resistor !== null && wired.has('D7') && resistor.includes(d7) && d7 !== anode,
    groundWired: cathode !== null && wired.has('GND') && cathode === gnd,
  };

  return { verdict: judge(), links };

  function judge(): Verdict {
    // 1. Shorts: two different supplies (or a supply and GND) joined by wire alone.
    const supplies = [...SOURCES, { node: 'GND', name: 'GND' }];
    for (let i = 0; i < supplies.length; i += 1) {
      for (let j = i + 1; j < supplies.length; j += 1) {
        const a = supplies[i];
        const b = supplies[j];
        if (!wired.has(a.node) || !wired.has(b.node) || net(a.node) !== net(b.node)) continue;
        if (b.node === 'GND') {
          return {
            code: 'short',
            title: `Short circuit: ${a.name} is wired straight to GND`,
            detail:
              a.node === 'D7'
                ? 'With nothing in between, pin 7 would dump as much current as it can into ground — enough to damage the pin. Current has to pass through the resistor and LED on its way to GND.'
                : `That connects the ${a.name} supply directly to ground. On a real board the USB fuse trips and the Arduino shuts off. Remove one of those jumpers.`,
          };
        }
        return {
          code: 'short',
          title: `Short circuit: ${a.name} is tied to ${b.name}`,
          detail: `When the sketch sets ${a.name} LOW it would fight the ${b.name} supply. Give each one its own column strip.`,
        };
      }
    }

    if (circuit.ledBurnt) {
      return {
        code: 'burnt',
        title: 'This LED is burned out',
        detail: 'Drag it back to the parts bin to swap in a fresh one, and keep the 220 Ω resistor in the loop this time.',
      };
    }

    // 2. A complete loop through the LED, from any source.
    if (anode !== null && cathode !== null) {
      if (anode === cathode) {
        return {
          code: 'ledShorted',
          title: 'Both LED legs share one strip',
          detail: 'Current takes the shortcut through the breadboard strip and skips the LED. Put its two legs in different numbered columns.',
        };
      }

      const r = resistor && resistor[0] !== resistor[1] ? resistor : null;
      const through = (from: string, to: string) =>
        r !== null && ((r[0] === from && r[1] === to) || (r[1] === from && r[0] === to));

      for (const source of SOURCES) {
        if (!wired.has(source.node)) continue;
        const src = net(source.node);
        const resistorFirst = (a: string, k: string) => through(src, a) && k === gnd;
        const ledFirst = (a: string, k: string) => a === src && through(k, gnd);
        const direct = (a: string, k: string) => a === src && k === gnd;

        if (resistorFirst(anode, cathode) || ledFirst(anode, cathode)) {
          if (source.node === 'D7') {
            return {
              code: 'pass',
              source: source.node,
              title: 'Circuit check passed',
              detail: resistorFirst(anode, cathode)
                ? `Pin 7 → 220 Ω resistor → LED (+ to −) → GND. ${LED_CURRENT}`
                : `Pin 7 → LED (+ to −) → 220 Ω resistor → GND. A resistor works on either side of the LED. ${LED_CURRENT}`,
            };
          }
          return {
            code: 'alwaysOn',
            source: source.node,
            title: `The LED runs from ${source.name}, not pin 7`,
            detail: `It glows, but it’s stuck on — the sketch only switches pin 7 (const int LED_PIN = 7). Move that jumper from ${source.name} to pin 7.`,
          };
        }
        if (direct(anode, cathode)) {
          return {
            code: 'noResistor',
            source: source.node,
            title: 'No resistor in the loop',
            detail: `${source.name} connects straight to the LED. Nothing limits the current, so the LED (and the pin) can burn out. Put the 220 Ω resistor between ${source.name} and the LED’s + leg.`,
          };
        }
        if (
          resistorFirst(cathode, anode) ||
          ledFirst(cathode, anode) ||
          direct(cathode, anode)
        ) {
          return {
            code: 'reversed',
            source: source.node,
            title: 'The LED is in backwards',
            detail: `Current only flows into the + (long) leg and out of the − (short) leg. Tap the LED to flip it so + faces ${source.name}.`,
          };
        }
      }
    }

    // 3. Nothing complete yet: point at the first gap.
    if (!resistor || !legs) {
      const missing = !resistor && !legs ? 'The resistor and LED are' : !resistor ? 'The 220 Ω resistor is' : 'The LED is';
      return {
        code: 'missingParts',
        title: `${missing} still in the parts bin`,
        detail: 'Drag each part onto the breadboard so its legs drop into two different numbered columns.',
      };
    }

    if (!wired.has('D7')) {
      const other = circuit.wires
        .map((wire) => PIN_BY_ID[wire.pin])
        .find((pin) => (pin.kind === 'digital' || pin.kind === 'analog') && pin.node !== 'D7');
      if (other) {
        return {
          code: 'wrongPin',
          title: `Your signal jumper is on ${other.name}`,
          detail: `The sketch drives pin 7 (const int LED_PIN = 7), so ${other.name} never switches on. Drag that jumper’s header end over to pin 7.`,
        };
      }
      return {
        code: 'open',
        title: 'Pin 7 isn’t wired yet',
        detail: 'Drag from pin 7 on the Arduino’s top header to the resistor’s free column on the breadboard.',
      };
    }

    if (!wired.has('GND')) {
      return {
        code: 'open',
        title: 'Nothing returns to GND',
        detail: 'Current needs a path back to the Arduino. Drag from a GND pin to the column holding the LED’s − (short) leg.',
      };
    }

    const partNets = [...resistor, anode, cathode];
    const landing = (node: string) => {
      const wire = circuit.wires.find((w) => PIN_BY_ID[w.pin].node === node);
      return wire ? stripName(wire.hole) : 'a column';
    };
    if (!partNets.includes(d7)) {
      return {
        code: 'open',
        title: 'Pin 7’s jumper doesn’t reach a part',
        detail: `It lands in ${landing('D7')}, but no resistor or LED leg is in that strip. Move the jumper or a part so they share a column.`,
      };
    }
    if (!partNets.includes(gnd)) {
      return {
        code: 'open',
        title: 'The GND jumper doesn’t reach a part',
        detail: `It lands in ${landing('GND')}, but no resistor or LED leg is in that strip. Move it to the LED’s − (short) leg column.`,
      };
    }
    if (anode !== null && cathode !== null && !resistor.includes(anode) && !resistor.includes(cathode)) {
      return {
        code: 'open',
        title: 'The resistor and LED don’t connect',
        detail: 'Current has to pass from one to the other, so a resistor leg and an LED leg must share a numbered column.',
      };
    }
    return {
      code: 'open',
      title: 'The loop isn’t closed yet',
      detail: 'Trace it: pin 7 → resistor → LED + leg → LED − leg → GND. Each step must share a column strip with the next.',
    };
  }
}

export type LabStep = { id: string; title: string; detail: string; done: boolean };

export function labSteps(analysis: Analysis, running: boolean): LabStep[] {
  const complete = analysis.verdict.code === 'pass';
  const { links } = analysis;
  return [
    {
      id: 'resistor',
      title: 'Place the 220 Ω resistor',
      detail: `Drag it from the parts bin onto the breadboard. Its legs land ${PART_SPAN.resistor} columns apart, in two different strips.`,
      done: complete || links.resistorPlaced,
    },
    {
      id: 'led',
      title: 'Add the LED, + leg first',
      detail: 'Put the LED’s + (long) leg in the same column as one resistor leg. Tap the LED to flip it.',
      done: complete || links.ledMeetsResistor,
    },
    {
      id: 'signal',
      title: 'Wire pin 7 to the resistor',
      detail: 'Drag from pin 7 on the top header to the resistor’s other column.',
      done: complete || links.signalWired,
    },
    {
      id: 'ground',
      title: 'Wire GND to the LED’s − leg',
      detail: 'Drag from any GND pin to the column holding the LED’s − (short) leg.',
      done: complete || links.groundWired,
    },
    {
      id: 'upload',
      title: 'Upload and watch it blink',
      detail: 'Press Upload (→) in the toolbar. The sketch switches pin 7 on and off every 500 ms.',
      done: complete && running,
    },
  ];
}
