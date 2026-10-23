// What each component is, shown when a student taps it in the parts bin or on
// the workbench.

export type ComponentId =
  | 'resistor'
  | 'resistor10k'
  | 'led'
  | 'button'
  | 'pot'
  | 'rgbLed'
  | 'ldr'
  | 'tmp36'
  | 'buzzer'
  | 'servo'
  | 'motor'
  | 'transistor'
  | 'diode'
  | 'battery'
  | 'stepper'
  | 'jumper'
  | 'arduino'
  | 'breadboard';

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
      'It passes so little current (0.5 mA at 5 V) that it barely loads the circuit. That is the point.',
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
  rgbLed: {
    name: 'RGB LED (common cathode)',
    summary: 'Three LEDs (red, green, blue) in one dome, sharing one − leg.',
    facts: [
      'The longest leg is the common cathode (−); it goes to GND. The other three legs light red, green and blue.',
      'Each color needs its own resistor and its own PWM (~) pin, and the pin’s level sets that color’s brightness.',
      'Mixing levels mixes colors: red + green reads as yellow, all three at full reads as white.',
    ],
    howTo: 'Drag it onto the breadboard so its four legs sit in four columns. The − leg goes to GND.',
  },
  ldr: {
    name: 'Photoresistor (LDR)',
    summary: 'A resistor whose value changes with light: low resistance when bright, high when dark.',
    facts: [
      'Bright light: about 1 kΩ. In the dark: 100 kΩ or more.',
      'Paired with a fixed 10 kΩ resistor it makes a voltage divider an analog pin can read. That is a light sensor.',
      'In a factory, a photoelectric sensor uses the same trick to detect a box breaking a beam.',
    ],
    howTo: 'Drag it onto the breadboard like a resistor. While the sketch runs, drag it to change the light.',
  },
  tmp36: {
    name: 'TMP36 temperature sensor',
    summary: 'A sensor whose output leg reads a voltage that rises exactly 10 mV per °C.',
    facts: [
      'Legs (flat side facing you): +VS, VOUT, GND. Wired backwards on a real board it gets hot fast.',
      'Read the temperature with °C = (voltage − 0.5) × 100: 0.75 V is 25 °C.',
      'Ovens and motor cabinets use sensors like this to trip an over-temperature alarm.',
    ],
    howTo: 'Drag it onto the breadboard so its three legs sit in three columns. While the sketch runs, drag it to change the temperature.',
  },
  buzzer: {
    name: 'Piezo buzzer',
    summary: 'A small speaker that sounds while a pin drives it.',
    facts: [
      'It is polarized: the leg marked + goes toward the pin, the other to GND.',
      'It draws little current, so a digital pin can drive it directly.',
      'Machines use sounders like this so an alarm is heard, not just seen.',
    ],
    howTo: 'Drag it onto the breadboard. Tap it to flip which leg is +.',
  },
  servo: {
    name: 'Servo motor',
    summary: 'A motor that turns to a commanded angle (0–180°) and holds it.',
    facts: [
      'Three connections: brown = GND, red = 5V, orange = signal. The signal pin sends a pulse that sets the angle.',
      'Power it from 5V, not 3.3V. On 3.3V it jitters and stalls.',
      'Factories use position control like this for diverter gates and robot joints.',
    ],
    howTo: 'Drag it onto the breadboard so its three legs sit in three columns: GND, 5V, signal.',
  },
  motor: {
    name: 'DC motor',
    summary: 'Spins while current flows through it, far more current than a pin can safely supply.',
    facts: [
      'A motor can draw 500 mA or more; an Arduino pin is rated for 20 mA. Never wire a motor straight to a pin.',
      'A transistor works as the switch: the pin drives the transistor, the transistor drives the motor.',
      'When a motor switches off it kicks back a voltage spike. The flyback diode absorbs it.',
    ],
    howTo: 'Drag it onto the breadboard and wire it through the transistor, not to a pin.',
  },
  transistor: {
    name: 'PN2222 transistor',
    summary: 'An electronic switch: a small current into the base lets a big current flow collector → emitter.',
    facts: [
      'Legs (flat side facing you): emitter, base, collector. The pin drives the base; the motor sits between the supply and the collector.',
      'The emitter goes to GND, and the motor supply’s − must share that same ground.',
      'In a motor control cabinet, a contactor does the same job at hundreds of volts.',
    ],
    howTo: 'Drag it onto the breadboard so its three legs sit in three columns: E, B, C.',
  },
  diode: {
    name: '1N4007 diode',
    summary: 'A one-way valve for current: it conducts into the banded end’s opposite leg only.',
    facts: [
      'Current flows from the plain end (anode) toward the banded end (cathode), never the other way.',
      'Across a motor it sits “backwards” on purpose (band toward +) so it only conducts when the motor’s spike arrives.',
    ],
    howTo: 'Drag it onto the breadboard. Tap it to flip which end has the band.',
  },
  battery: {
    name: '9 V battery',
    summary: 'A separate power supply for the motor, so the motor’s current never passes through the Arduino.',
    facts: [
      'The red lead is +, the black lead is −.',
      'The battery’s − must connect to the Arduino’s GND. Without a common ground the transistor never switches.',
      'The Arduino reads and switches, the battery delivers the power: control and power are separate circuits.',
    ],
    howTo: 'Drag it onto the breadboard. Tap it to swap which leg is +.',
  },
  stepper: {
    name: 'Stepper motor + driver',
    summary: 'A motor that moves in exact steps. One pulse on the step leg moves it one step.',
    facts: [
      'The driver takes a step pin and a direction pin; each pulse on step moves the shaft one step in that direction.',
      'A stepper has no idea where it is at power-up. That is why machines run a homing routine first.',
      'CNC mills and pick-and-place machines home every axis this way before they start work.',
    ],
    howTo: 'Drag it onto the breadboard: step, direction and ground legs in three columns.',
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
      'Each edge has a red (+) rail and a blue (−) rail. Every hole along one rail is connected end to end, but the four rails are separate from each other. Wire GND to a − rail once and every part can reach ground through a short jumper.',
    ],
    howTo: 'Drop parts and jumper ends into its holes. A green highlight shows which strip a leg will join.',
  },
};
