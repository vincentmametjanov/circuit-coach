// The course outline shown on the homepage and the lab list. Each lab teaches
// one idea from a standard Arduino starter kit and names where the same circuit
// runs in a real factory. Only labs with `ready: true` can be opened.

export type LabPhase = 'Outputs and inputs' | 'Analog signals and sensors' | 'Motion and the capstone';

export type LabSummary = {
  id: string;
  number: string;
  title: string;
  /** The Arduino idea the lab teaches. */
  concept: string;
  /** Short name of the circuit, e.g. "Pushbutton". */
  part: string;
  /** The same idea on a factory floor. */
  factory: string;
  phase: LabPhase;
  ready: boolean;
};

export const LABS: LabSummary[] = [
  {
    id: 'lab01',
    number: '01',
    title: 'Blink an LED',
    concept: 'Digital output: switch a pin on and off from code.',
    part: 'LED + resistor',
    factory: 'Machine indicator lights',
    phase: 'Outputs and inputs',
    ready: true,
  },
  {
    id: 'lab02',
    number: '02',
    title: 'Start button',
    concept: 'Digital input and pull-down resistors.',
    part: 'Pushbutton',
    factory: 'Start/stop buttons and limit switches',
    phase: 'Outputs and inputs',
    ready: true,
  },
  {
    id: 'lab03',
    number: '03',
    title: 'Machine stack light',
    concept: 'Several outputs and a simple state machine.',
    part: 'Three LEDs',
    factory: 'Andon stack lights that show a line’s status',
    phase: 'Outputs and inputs',
    ready: true,
  },
  {
    id: 'lab04',
    number: '04',
    title: 'Speed dial',
    concept: 'Analog input and the Serial Monitor.',
    part: 'Potentiometer',
    factory: 'Conveyor speed knobs',
    phase: 'Analog signals and sensors',
    ready: true,
  },
  {
    id: 'lab05',
    number: '05',
    title: 'Dimmer and color mixer',
    concept: 'PWM output: in-between brightness from a digital pin.',
    part: 'RGB LED',
    factory: 'Motor speed and heater power control',
    phase: 'Analog signals and sensors',
    ready: false,
  },
  {
    id: 'lab06',
    number: '06',
    title: 'Part counter',
    concept: 'Light sensors, voltage dividers and thresholds.',
    part: 'Light sensor',
    factory: 'Photoelectric sensors that count parts',
    phase: 'Analog signals and sensors',
    ready: false,
  },
  {
    id: 'lab07',
    number: '07',
    title: 'Over-temperature alarm',
    concept: 'Reading a sensor in real units and raising an alarm.',
    part: 'Temperature sensor + buzzer',
    factory: 'Oven and motor overheat alarms',
    phase: 'Analog signals and sensors',
    ready: false,
  },
  {
    id: 'lab08',
    number: '08',
    title: 'Sorting gate',
    concept: 'Position control with a servo motor.',
    part: 'Servo motor',
    factory: 'Diverter gates and robot arm joints',
    phase: 'Motion and the capstone',
    ready: false,
  },
  {
    id: 'lab09',
    number: '09',
    title: 'Conveyor motor',
    concept: 'Switching a motor safely with a transistor and diode.',
    part: 'DC motor + transistor',
    factory: 'Conveyor drives and motor control cabinets',
    phase: 'Motion and the capstone',
    ready: false,
  },
  {
    id: 'lab10',
    number: '10',
    title: 'Mini sorting line',
    concept: 'Sensor, decision, actuator and status light working together.',
    part: 'Everything so far',
    factory: 'An automated work cell, the job a PLC does',
    phase: 'Motion and the capstone',
    ready: false,
  },
];

export const PHASES: LabPhase[] = ['Outputs and inputs', 'Analog signals and sensors', 'Motion and the capstone'];

export const labById = (id: string) => LABS.find((lab) => lab.id === id);
