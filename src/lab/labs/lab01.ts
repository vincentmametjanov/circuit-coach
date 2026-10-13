// Lab 01: Blink an LED on pin 7. Everything specific to this lab — its parts,
// its goal loop, what the coach says about each mistake, and the guide's steps —
// lives here. The shared checker in src/lab/engine/ decides which message applies.

import { PART_SPAN } from '../geometry';
import type { SeriesLab } from '../engine/seriesLab';

const LED_CURRENT = 'About 14 mA flows — (5 V − 2 V LED drop) ÷ 220 Ω — bright, and safely under the LED’s 20 mA limit.';

export const LAB01: SeriesLab = {
  id: 'lab01',
  title: 'Lab 01: Blink an LED on pin 7',
  signal: { node: 'D7', name: 'pin 7' },
  parts: ['resistor', 'led'],
  load: 'led',
  limiter: 'resistor',

  messages: {
    pass: (order) => ({
      title: 'Circuit check passed',
      detail:
        order[0] === 'resistor'
          ? `Pin 7 → 220 Ω resistor → LED (+ to −) → GND. ${LED_CURRENT}`
          : `Pin 7 → LED (+ to −) → 220 Ω resistor → GND. A resistor works on either side of the LED. ${LED_CURRENT}`,
    }),
    shortSignalToGround: {
      title: 'Short circuit: pin 7 is wired straight to GND',
      detail:
        'With nothing in between, pin 7 would dump as much current as it can into ground — enough to damage the pin. Current has to pass through the resistor and LED on its way to GND.',
    },
    burnt: {
      title: 'This LED is burned out',
      detail: 'Drag it back to the parts bin to swap in a fresh one, and keep the 220 Ω resistor in the loop this time.',
    },
    loadBypassed: {
      title: 'Both LED legs share one strip',
      detail:
        'Current takes the shortcut through the breadboard strip and skips the LED. Put its two legs in different numbered columns.',
    },
    wrongSource: (source) => ({
      title: `The LED runs from ${source.name}, not pin 7`,
      detail: `It glows, but it’s stuck on — the sketch only switches pin 7 (const int LED_PIN = 7). Move that jumper from ${source.name} to pin 7.`,
    }),
    noLimiter: (source) => ({
      title: 'No resistor in the loop',
      detail: `${source.name} connects straight to the LED. Nothing limits the current, so the LED (and the pin) can burn out. Put the 220 Ω resistor between ${source.name} and the LED’s + leg.`,
    }),
    reversed: (source) => ({
      title: 'The LED is in backwards',
      detail: `Current only flows into the + (long) leg and out of the − (short) leg. Tap the LED to flip it so + faces ${source.name}.`,
    }),
    missingParts: (missing) => ({
      title: `${
        missing.length > 1 ? 'The resistor and LED are' : missing[0] === 'resistor' ? 'The 220 Ω resistor is' : 'The LED is'
      } still in the parts bin`,
      detail: 'Drag each part onto the breadboard so its legs drop into two different numbered columns.',
    }),
    wrongPin: (pinName) => ({
      title: `Your signal jumper is on ${pinName}`,
      detail: `The sketch drives pin 7 (const int LED_PIN = 7), so ${pinName} never switches on. Drag that jumper’s header end over to pin 7.`,
    }),
    signalUnwired: {
      title: 'Pin 7 isn’t wired yet',
      detail: 'Drag from pin 7 on the Arduino’s top header to the resistor’s free column on the breadboard.',
    },
    groundUnwired: {
      title: 'Nothing returns to GND',
      detail: 'Current needs a path back to the Arduino. Drag from a GND pin to the column holding the LED’s − (short) leg.',
    },
    signalLandsNowhere: (where) => ({
      title: 'Pin 7’s jumper doesn’t reach a part',
      detail: `It lands in ${where}, but no resistor or LED leg is in that strip. Move the jumper or a part so they share a column.`,
    }),
    groundLandsNowhere: (where) => ({
      title: 'The GND jumper doesn’t reach a part',
      detail: `It lands in ${where}, but no resistor or LED leg is in that strip. Move it to the LED’s − (short) leg column.`,
    }),
    partsDisconnected: {
      title: 'The resistor and LED don’t connect',
      detail: 'Current has to pass from one to the other, so a resistor leg and an LED leg must share a numbered column.',
    },
    loopOpen: {
      title: 'The loop isn’t closed yet',
      detail: 'Trace it: pin 7 → resistor → LED + leg → LED − leg → GND. Each step must share a column strip with the next.',
    },
  },

  steps: [
    {
      id: 'resistor',
      title: 'Place the 220 Ω resistor',
      detail: `Drag it from the parts bin onto the breadboard. Its legs land ${PART_SPAN.resistor} columns apart, in two different strips.`,
      built: (q) => q.placed('resistor'),
    },
    {
      id: 'led',
      title: 'Add the LED, + leg first',
      detail: 'Put the LED’s + (long) leg in the same column as one resistor leg. Tap the LED to flip it.',
      built: (q) => q.placed('led') && q.legs('resistor').includes(q.legs('led')[0]),
    },
    {
      id: 'signal',
      title: 'Wire pin 7 to the resistor',
      detail: 'Drag from pin 7 on the top header to the resistor’s other column.',
      built: (q) =>
        q.wired('D7') && q.legs('resistor').includes(q.net('D7')) && q.net('D7') !== q.legs('led')[0],
    },
    {
      id: 'ground',
      title: 'Wire GND to the LED’s − leg',
      detail: 'Drag from any GND pin to the column holding the LED’s − (short) leg.',
      built: (q) => q.placed('led') && q.wired('GND') && q.legs('led')[1] === q.net('GND'),
    },
    {
      id: 'upload',
      title: 'Upload and watch it blink',
      detail: 'Press Upload (→) in the toolbar. The sketch switches pin 7 on and off every 500 ms.',
    },
  ],
};
