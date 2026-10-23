// Lab 05: Dimmer and color mixer. The Lab 04 pot on A0 sets the PWM duty on
// pin ~9, dimming the LED. It is the same average-power trick a VFD uses for motor
// speed and a heater controller uses for power. Extension: an RGB LED on
// ~9/~10/~11 mixes colors from the same knob.

import { type Circuit, pathThrough } from '../engine/circuit';
import { type LedLoop, findLoop, findShort, ledLoopMessages } from '../engine/ledLoop';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { circuitOf } from '../runtime';
import { dividerWired, outerSupplies, wiperOnA0 } from './lab04';

const DIMMER: LedLoop = { signal: { node: 'D9', name: 'pin ~9' }, led: 'led', resistor: 'resistor' };

/** RGB channels: leg index in the part, its resistor instance, its pin. */
const CHANNELS = [
  { name: 'red', leg: 0, resistor: 'resistorR', signal: { node: 'D9', name: 'pin ~9' } },
  { name: 'green', leg: 2, resistor: 'resistorG', signal: { node: 'D10', name: 'pin ~10' } },
  { name: 'blue', leg: 3, resistor: 'resistorB', signal: { node: 'D11', name: 'pin ~11' } },
];

const SKETCH = `// dimmer.ino: Lab 05
// The knob on A0 sets the brightness of the LED on pin ~9 (PWM).

const int DIAL_PIN = A0;
const int LED_PIN = 9;          // must be a ~ pin: only those can dim

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int reading = analogRead(DIAL_PIN);     // 0–1023
  int brightness = reading / 4;           // 0–255 for analogWrite
  analogWrite(LED_PIN, brightness);       // duty cycle = brightness / 255
}`;

/** True when the RGB's common cathode (leg 1) reaches GND. */
function commonGrounded(c: Circuit): boolean {
  const legs = c.legNets('rgbLed');
  return !!legs && c.wired('GND') && legs[1] === c.net('GND');
}

/** True when one RGB channel runs pin → resistor → color leg. */
function channelWired(c: Circuit, channel: (typeof CHANNELS)[number]): boolean {
  const common = commonGrounded(c);
  return common && pathThrough(c, channel.signal.node, `part:rgbLed:${channel.leg}`, [channel.resistor]) !== null;
}

/** Hue wheel: knob 0 → red, ⅓ → green, ⅔ → blue, 1 → red again. */
export function mixFor(knob: number): { r: number; g: number; b: number } {
  const tri = (center: number) => {
    const distance = Math.min(Math.abs(knob - center), 1 - Math.abs(knob - center));
    return Math.max(0, Math.min(1, 1 - 3 * distance));
  };
  return { r: tri(0), g: tri(1 / 3), b: tri(2 / 3) };
}

export const LAB05: LabDef = {
  id: 'lab05',
  title: 'Lab 05: Dimmer and color mixer',
  sketch: { name: 'dimmer', code: SKETCH, highlightLine: 11 },
  parts: [
    { def: 'pot', id: 'pot', name: '10 kΩ potentiometer' },
    { def: 'resistor', id: 'resistor' },
    { def: 'led', id: 'led' },
    { def: 'rgbLed', id: 'rgbLed' },
    { def: 'resistor', id: 'resistorR' },
    { def: 'resistor', id: 'resistorG' },
    { def: 'resistor', id: 'resistorB' },
  ],

  verdict: {
    mistakes: ['short', 'nonPwm', 'rgbCommonHigh', 'ledLoop'],
    order: [
      'short',
      'burnt',
      'rgbCommonHigh',
      'pass',
      'nonPwm',
      'ledLoop',
      'wiperWrongPin',
      'outerSame',
      'outerMissing',
      'missingParts',
      'open',
    ],
    check(code, c) {
      const say = ledLoopMessages(LAB05, DIMMER);
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
        // Common cathode wired to 5V: every channel lights backwards, or worse.
        case 'rgbCommonHigh': {
          const legs = c.legNets('rgbLed');
          if (!legs || !c.wired('5V') || legs[1] !== c.net('5V')) return null;
          return {
            title: 'The RGB LED’s common leg is on 5V',
            detail:
              'This is a common-cathode part: the long leg is shared −, so it goes to GND and each color leg lights from its own ~ pin through a resistor. With the common leg on 5V, nothing can light it the way the sketch drives it.',
          };
        }
        case 'pass': {
          if (!dividerWired(c)) return null;
          const loop = findLoop(c, DIMMER);
          const dimmerOk = loop?.kind === 'ok' && loop.source.node === DIMMER.signal.node && !c.board.burnt.includes('led');
          const rgbOk = !!c.part('rgbLed') && CHANNELS.every((ch) => channelWired(c, ch));
          if (!dimmerOk && !rgbOk) return null;
          return {
            title: 'Circuit check passed',
            detail: rgbOk
              ? 'The dial divides 0–5 V into A0, and each RGB channel has its own resistor on ~9/~10/~11 with the common leg on GND. Turn the knob to sweep the color.'
              : 'The dial divides 0–5 V into A0 and the LED loop sits on pin ~9. Turn the knob while it runs and watch the brightness follow.',
          };
        }
        // A complete, working loop on a pin that cannot dim: it snaps on/off.
        case 'nonPwm': {
          const loop = findLoop(c, DIMMER);
          if (loop?.kind !== 'wrongPin') return null;
          const pin = Object.values(PIN_BY_ID).find((p) => p.name === loop.pinName);
          if (!pin || pin.kind !== 'digital' || pin.label.includes('~')) return null;
          return {
            title: `The LED is on ${loop.pinName}, which can’t dim`,
            detail: `analogWrite only works on the pins marked ~ (3, 5, 6, 9, 10, 11). On ${loop.pinName} the LED just snaps on and off. Move the signal jumper to pin ~9.`,
            source: pin.node,
          };
        }
        case 'ledLoop': {
          const loop = findLoop(c, DIMMER);
          if (!loop) return null;
          if (loop.kind === 'ok') {
            if (loop.source.node === DIMMER.signal.node) return null;
            return { ...say.wrongSource(loop.source), source: loop.source.node };
          }
          if (loop.kind === 'bypassed') {
            return {
              title: 'Both LED legs share one strip',
              detail: 'Current skips the LED. Put its two legs in different numbered columns.',
            };
          }
          if (loop.kind === 'noResistor') return { ...say.noLimiter(loop.source), source: loop.source.node };
          if (loop.kind === 'wrongPin') {
            // Another ~ pin dims, but the sketch only drives ~9.
            return {
              title: `The LED’s signal jumper is on ${loop.pinName}`,
              detail: `The sketch dims pin ~9 (const int LED_PIN = 9), so ${loop.pinName} never changes it. Move that jumper to pin ~9.`,
            };
          }
          return { ...say.reversed(loop.source), source: loop.source.node };
        }
        case 'wiperWrongPin': {
          const legs = c.legNets('pot');
          if (!legs || (c.wired('A0') && legs[1] === c.net('A0'))) return null;
          const onPin = c.board.wires.some((w) => {
            const pin = PIN_BY_ID[w.pin];
            return pin && (pin.kind === 'digital' || pin.kind === 'analog') && legs[1] === c.net(pin.node);
          });
          return onPin
            ? {
                title: 'The wiper isn’t on A0',
                detail: 'Only the analog pins (A0–A5) can read the knob’s in-between voltage. Move the wiper’s jumper to A0.',
              }
            : null;
        }
        case 'outerSame': {
          const outer = outerSupplies(c);
          if (!outer || !outer[0] || outer[0] !== outer[1]) return null;
          return {
            title: `Both outer legs are on ${outer[0]}`,
            detail: `The knob divides the voltage between its outer legs; with both on ${outer[0]} every position reads the same. Move one outer leg’s jumper to ${outer[0] === '5V' ? 'GND' : '5V'}.`,
          };
        }
        case 'outerMissing': {
          if (!c.part('pot') || !wiperOnA0(c)) return null;
          const outer = outerSupplies(c);
          if (!outer || (outer[0] && outer[1])) return null;
          return {
            title: 'One of the pot’s outer legs isn’t connected',
            detail: 'Wire one outer leg to 5V and the other to GND so the wiper sweeps the whole range.',
          };
        }
        case 'missingParts': {
          const rgbSide = !!c.part('rgbLed') && ['resistorR', 'resistorG', 'resistorB'].every((id) => c.part(id));
          const ledSide = !!c.part('led') && !!c.part('resistor');
          if (c.part('pot') && (rgbSide || ledSide)) return null;
          return {
            title: 'Some parts are still in the parts bin',
            detail: 'The dimmer needs the pot and an output: the LED loop with its 220 Ω resistor, or the RGB mixer with its three.',
          };
        }
        case 'open':
          return {
            title: 'The dimmer isn’t wired yet',
            detail:
              'Two halves: the dial (pot outer legs to 5V and GND, wiper to A0) and the LED loop (pin ~9 → 220 Ω → LED → GND).',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 150,
    ledLevels(lab, store) {
      if (!store.state.running) return {};
      const c = circuitOf(lab, store.state);
      const duty = knobOf(store.state);
      const levels: Record<string, number> = {};
      const loop = findLoop(c, DIMMER);
      levels.led = loop?.kind === 'ok' && loop.source.node === 'D9' && !c.board.burnt.includes('led') ? duty : 0;
      return levels;
    },
    onTick(lab, store) {
      // Keep the RGB mix in the behavior state so the dome redraws as the knob turns.
      const c = circuitOf(lab, store.state);
      const wired = c.part('rgbLed') && CHANNELS.every((ch) => channelWired(c, ch));
      const mix = wired ? mixFor(knobOf(store.state)) : { r: 0, g: 0, b: 0 };
      return { lab, state: { ...store.state, behavior: { ...store.state.behavior, rgbLed: mix } } };
    },
    runningNote() {
      return { title: 'The sketch is running, but the LED doesn’t follow the knob', detail: '' };
    },
    success: 'Turn the knob: the LED dims smoothly from dark to full brightness. Lab 05 complete!',
  },

  // One correct build, shown by "Show solution" in the lab guide.
  solution: {
    parts: { pot: { row: 0, col: 2 }, resistor: { row: 0, col: 8 }, led: { row: 2, col: 11 }, rgbLed: { row: 0, col: 13 }, resistorR: { row: 5, col: 0 }, resistorG: { row: 5, col: 5 }, resistorB: { row: 5, col: 10 } },
    wires: [['5V', { row: 1, col: 2 }], ['A0', { row: 1, col: 4 }], ['GND_T', { row: 1, col: 6 }], ['D9', { row: 1, col: 8 }], ['GND_P1', { row: 4, col: 12 }], ['D10', { row: 6, col: 5 }], ['D11', { row: 6, col: 10 }], ['GND_P2', { row: 1, col: 14 }]],
    links: [[{ row: 4, col: 8 }, { row: 6, col: 0 }], [{ row: 8, col: 3 }, { row: 2, col: 13 }], [{ row: 8, col: 8 }, { row: 2, col: 15 }], [{ row: 8, col: 13 }, { row: 2, col: 16 }]],
  },

  steps: [
    {
      id: 'dial',
      title: 'Wire the speed dial from Lab 04',
      detail: 'Pot outer legs to 5V and GND, wiper (middle leg) to A0.',
      built: (q) => dividerWired(q),
    },
    {
      id: 'led',
      title: 'Build the LED loop on pin ~9',
      detail: 'Pin ~9 → 220 Ω resistor → LED (+ to −) → GND. The ~ matters: only those pins can dim.',
      built: (q) => {
        const found = findLoop(q, DIMMER);
        return found?.kind === 'ok' && found.source.node === 'D9';
      },
    },
    {
      id: 'upload',
      title: 'Upload and turn the knob',
      detail: 'The brightness follows the dial smoothly, not just on and off.',
    },
    {
      id: 'rgb',
      title: 'Extension: wire the RGB mixer',
      detail: 'RGB common (−, the long leg) to GND; red, green and blue legs through their own 220 Ω resistors to pins ~9, ~10, ~11.',
      built: (q) => !!q.part('rgbLed') && CHANNELS.every((ch) => channelWired(q, ch)),
    },
  ],

  guide: {
    intro:
      'A conveyor’s speed control, in miniature: the knob sets a duty cycle, and the pin spends that fraction of its time HIGH. An LED dims; a motor or a heater responds the same way.',
    explainers: [
      {
        title: 'PWM: fake analog with a digital pin',
        body: 'analogWrite(9, 128) switches pin 9 on and off 490 times a second, on for half of each cycle. The LED, like a motor, averages it: half the power, half the brightness. The duty cycle (0–255) is the knob’s position divided by 4.',
      },
      {
        title: 'Why only the ~ pins',
        body: 'Pulse-width modulation needs a hardware timer behind the pin. On the Uno only 3, 5, 6, 9, 10 and 11 have one. They are the pins marked ~ on the board. Any other pin ignores analogWrite and just snaps HIGH or LOW.',
      },
      {
        title: 'On the factory floor',
        body: 'A variable-frequency drive runs a conveyor motor by switching power in fast pulses, exactly like your pin ~9. The average voltage sets the speed. Heater controllers do the same for power.',
      },
    ],
    proTip: {
      title: 'Pro tip: three channels make any color',
      body: 'The RGB LED is three LEDs in one dome. A second analogWrite per channel (pins ~9, ~10, ~11) mixes any color. Indicator panels use this so one lamp can show every machine state.',
    },
  },
  next: { id: 'lab06', title: 'Lab 06: Part counter' },
};

function knobOf(state: { behavior: Record<string, unknown> }): number {
  return typeof state.behavior.knob === 'number' ? state.behavior.knob : 0.5;
}
