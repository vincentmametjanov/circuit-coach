// Open bench (free play): the whole parts bin, no sketch. The 5V and 3.3V
// rails are live, so circuits built from a supply behave exactly as they would
// on a real powered board with an empty chip: LEDs light (or burn out), buttons
// and knobs respond, and the pins sit quiet as inputs. Shorts and burn-outs are
// still caught, so this is a safe place to try a layout before touching
// hardware.

import { findShort } from '../engine/ledLoop';
import type { LabDef } from '../lab';

const SKETCH = `// free_play.ino: the open bench
// No sketch is running. On a real board with nothing uploaded:
//   - 5V, 3.3V and GND are live the moment power is connected
//   - every I/O pin sits as a high-impedance input
// So circuits wired from a supply pin work right now. An LED with
// its resistor lights, and one without pops. Pins do nothing until
// you pick a lab and upload its sketch.
//
// Try things here first. Mistakes are free.`;

export const FREEPLAY: LabDef = {
  id: 'play',
  title: 'Open bench: Free play',
  sketch: { name: 'free_play', code: SKETCH },
  parts: [
    { def: 'resistor', id: 'r1', category: 'Resistors' },
    { def: 'resistor', id: 'r2', category: 'Resistors' },
    { def: 'resistor', id: 'r3', category: 'Resistors' },
    { def: 'resistor', id: 'r4', category: 'Resistors' },
    { def: 'resistor', id: 'r5', category: 'Resistors' },
    { def: 'resistor', id: 'r6', category: 'Resistors' },
    { def: 'resistor10k', id: 'k1', category: 'Resistors' },
    { def: 'resistor10k', id: 'k2', category: 'Resistors' },
    { def: 'resistor10k', id: 'k3', category: 'Resistors' },
    { def: 'led', id: 'ledR1', name: 'Red LED', color: 'red', category: 'Lights' },
    { def: 'led', id: 'ledR2', name: 'Red LED', color: 'red', category: 'Lights' },
    { def: 'led', id: 'ledG', name: 'Green LED', color: 'green', category: 'Lights' },
    { def: 'led', id: 'ledY', name: 'Yellow LED', color: 'yellow', category: 'Lights' },
    { def: 'rgbLed', id: 'rgbLed', category: 'Lights' },
    { def: 'button', id: 'button1', name: 'Pushbutton', category: 'Buttons & knobs' },
    { def: 'button', id: 'button2', name: 'Pushbutton', category: 'Buttons & knobs' },
    { def: 'pot', id: 'pot', category: 'Buttons & knobs' },
    { def: 'ldr', id: 'ldr', category: 'Sensors' },
    { def: 'tmp36', id: 'tmp36', category: 'Sensors' },
    { def: 'buzzer', id: 'buzzer', category: 'Motors & sound' },
    { def: 'servo', id: 'servo', category: 'Motors & sound' },
    { def: 'motor', id: 'motor', category: 'Motors & sound' },
    { def: 'stepper', id: 'stepper', category: 'Motors & sound' },
    { def: 'transistor', id: 'transistor1', name: 'PN2222 transistor', category: 'Drivers & power' },
    { def: 'transistor', id: 'transistor2', name: 'PN2222 transistor', category: 'Drivers & power' },
    { def: 'diode', id: 'diode', category: 'Drivers & power' },
    { def: 'battery', id: 'battery', category: 'Drivers & power' },
  ],

  verdict: {
    mistakes: ['short', 'burnt'],
    order: ['short', 'burnt', 'pass'],
    check(code, c) {
      switch (code) {
        case 'short': {
          const short = findShort(c);
          if (!short) return null;
          return {
            title: `Short circuit: ${short.a.name} is wired straight to ${short.b.name}`,
            detail:
              'Two supply nodes are joined with nothing between them. On a real board the USB fuse trips. Give each one its own strip, with a part in between to take the current.',
          };
        }
        case 'burnt': {
          const dead = c.board.burnt[0];
          if (!dead) return null;
          return {
            title: 'An LED burned out',
            detail: 'Drag it back to the parts bin for a fresh one, and keep a 220 Ω resistor in series this time.',
          };
        }
        case 'pass':
          return {
            title: 'The bench is live',
            detail: 'No sketch running: 5V and 3.3V are powered, the pins are inputs. Whatever you wire from a supply behaves like the real board would.',
          };
        default:
          return null;
      }
    },
  },

  behavior: {
    tickMs: 250,
    success: 'The bench is live. Drag parts, wire them up, turn knobs and press buttons. Mistakes cost nothing here.',
  },

  steps: [
    {
      id: 'explore',
      title: 'Build anything',
      detail: 'Every part from the labs is in the bin. Try an LED on 5V (don’t skip the resistor), a button, the motor on the battery. Then build it on real hardware.',
    },
  ],

  guide: {
    intro:
      'The open bench: every component from the twelve labs, a live board, and no checklist. Try a layout here before you build it on real hardware.',
    explainers: [
      {
        title: 'The bin is organized by category',
        body: 'Use the dropdown in the parts bin to switch between Resistors, Lights, Buttons & knobs, Sensors, Motors & sound, and Drivers & power. Parts you place stay on the breadboard when you switch.',
      },
      {
        title: 'What “live” means with no sketch',
        body: 'With nothing uploaded, a real Arduino still powers 5V, 3.3V and GND, and every I/O pin floats as an input. Circuits wired from a supply work; anything waiting on a pin does nothing. Pick a lab when you want the pins to run code.',
      },
      {
        title: 'The coach still watches',
        body: 'Shorts between supplies are flagged the moment you make them, and an LED with no resistor still burns out. Everything else is fair game. Wire it, tap a part to learn what it is, and pull it apart again.',
      },
      {
        title: 'A habit worth keeping',
        body: 'Engineers bench-test a circuit before it goes near the machine. Build it here, check it behaves, then reach for the real parts.',
      },
    ],
    proTip: {
      title: 'Pro tip: the labs are recipes',
      body: 'Stuck for ideas? Rebuild a lab circuit from memory, like the stack light from Lab 03 or the motor drive from Lab 09. Then change something and see what happens.',
    },
  },
};
