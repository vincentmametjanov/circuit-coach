// What each component is, shown when a student taps it in the parts bin or on
// the workbench.

export type ComponentId = 'resistor' | 'resistor10k' | 'led' | 'button' | 'pot' | 'jumper' | 'arduino' | 'breadboard';

export type ComponentInfo = {
  name: string;
  /** One sentence: what it is. */
  summary: string;
  /** Short facts a beginner needs to use it. */
  facts: string[];
  /** How to handle it in Circuit Coach. */
  howTo: string;
};

export const COMPONENTS: Record<ComponentId, ComponentInfo> = {
  resistor: {
    name: '220 Ω resistor',
    summary: 'A resistor limits how much current can flow through a circuit.',
    facts: [
      'Its value is measured in ohms (Ω). The color bands encode it: red, red, brown = 2, 2, ×10 = 220 Ω; gold means ±5%.',
      'It has no direction. Either leg can face the Arduino.',
      'In series with an LED it keeps the current near 14 mA, safely under the LED’s 20 mA limit.',
    ],
    howTo: 'Drag it onto the breadboard. Its legs land 3 columns apart.',
  },
  resistor10k: {
    name: '10 kΩ resistor',
    summary: 'A much bigger resistor, used to hold an input pin at a steady LOW or HIGH.',
    facts: [
      'Brown, black, orange = 1, 0, ×1000 = 10 000 Ω (10 kΩ); gold means ±5%.',
      'As a pull-down it connects an input to GND so the pin reads LOW until a button connects it to 5V.',
      'It passes so little current (0.5 mA at 5 V) that it barely loads the circuit — that is the point.',
    ],
    howTo: 'Drag it onto the breadboard between the input pin’s column and a GND column.',
  },
  button: {
    name: 'Pushbutton (tactile switch)',
    summary: 'A switch that connects two contacts only while you hold it down.',
    facts: [
      'It has four legs in two pairs. The legs of each pair are joined inside; pressing the button joins the pairs.',
      'It must straddle the breadboard’s center gap so the two sides stay separate until pressed.',
      'On a machine, this is the start button: a digital input the controller reads.',
    ],
    howTo: 'Drag it so two legs land above the center gap and two below. While the sketch runs, press and hold it.',
  },
  pot: {
    name: 'Potentiometer (10 kΩ)',
    summary: 'A knob that works as an adjustable voltage divider: the middle leg reads a voltage between the two outer legs.',
    facts: [
      'The two outer legs connect to 5V and GND; the middle leg (the wiper) slides between them as you turn the knob.',
      'An analog pin reads the wiper as a number from 0 (all the way down) to 1023 (all the way up).',
      'On a conveyor, the speed knob is a potentiometer feeding the controller exactly this way.',
    ],
    howTo: 'Drag it onto the breadboard so its three legs sit in three columns. While the sketch runs, drag the knob to turn it.',
  },
  led: {
    name: 'LED (light-emitting diode)',
    summary: 'An LED gives off light when current flows through it in one direction.',
    facts: [
      'Current must enter the + leg (anode, the longer leg) and leave the − leg (cathode, by the flat edge of the rim). Backwards, it stays dark.',
      'An LED has almost no resistance of its own, so it always needs a resistor in series or it burns out.',
      'A red LED uses about 2 V of the 5 V supply.',
    ],
    howTo: 'Drag it onto the breadboard. Once it’s placed, tap it to flip which leg is +.',
  },
  jumper: {
    name: 'Jumper wire',
    summary: 'A jumper wire connects two points that aren’t already joined: an Arduino pin to a breadboard column, or one column to another or to a power rail.',
    facts: [
      'It is just a wire with a metal pin on each end. Current flows either way.',
      'The color doesn’t change how it works. Here, black is GND, red is 5V and yellow is a digital pin, so you can trace the circuit by eye.',
      'Each hole and each Arduino pin holds one jumper.',
    ],
    howTo:
      'Drag one from the bin into an Arduino pin or a breadboard hole, then drag its loose end to the other spot: another pin, or another hole for a breadboard jumper. You can also drag straight from any Arduino pin. Drag an end off the board to remove it.',
  },
  arduino: {
    name: 'Arduino Uno',
    summary: 'A small computer (a microcontroller board) that runs your sketch and controls its pins.',
    facts: [
      'Digital pins 0–13 can be switched HIGH (5 V) or LOW (0 V) by code, or read as inputs.',
      'Pins marked ~ can also dim an LED or set a motor’s speed (PWM). A0–A5 read voltages between 0 and 5 V.',
      'The power header supplies 5V and 3.3V, and every GND pin is the same ground.',
    ],
    howTo: 'Drag from any pin on the top or bottom header to run a jumper wire to the breadboard.',
  },
  breadboard: {
    name: 'Breadboard',
    summary: 'A breadboard lets you build a circuit without soldering, by pushing legs and wires into its holes.',
    facts: [
      'Under each numbered column, holes a–e share one metal strip, and f–j share another.',
      'Two legs in the same strip are connected. Legs in different columns are not.',
      'The gap down the middle separates the top and bottom strips.',
      'The + and − rails along the top and bottom edges each connect end to end. Wire GND to the − rail once and every part can reach ground through a short jumper.',
    ],
    howTo: 'Drop parts and jumper ends into its holes. A green highlight shows which strip a leg will join.',
  },
};
