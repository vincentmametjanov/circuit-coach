// Lab 07: Over-temperature alarm. A TMP36 feeds A0 a voltage that means a
// real temperature (°C = (volts − 0.5) × 100); over the setpoint the buzzer
// and red light respond, and the alarm only clears 2 °C lower — hysteresis,
// so it doesn't chatter at the boundary. This is an oven/motor overheat alarm.

import { type Circuit, pathThrough } from '../engine/circuit';
import { type LedLoop, findLoop, findShort, ledLoopMessages } from '../engine/ledLoop';
import { PIN_BY_ID } from '../geometry';
import type { LabDef } from '../lab';
import { type LabStore, type RuntimeState, appendLog, circuitOf, printSerial } from '../runtime';

const ALARM_LED: LedLoop = { signal: { node: 'D7', name: 'pin 7' }, led: 'led', resistor: 'resistor' };
const BUZZER_PIN = { node: 'D8', name: 'pin 8' };

/** TMP36 legs, in order: +VS, VOUT, GND. */
const LEG = { vcc: 0, vout: 1, gnd: 2 };

const SETPOINT = 30;
const HYSTERESIS = 2;

const SKETCH = `// over_temp_alarm.ino — Lab 07
// Reads a TMP36 on A0 in real °C and raises an alarm over the setpoint,
// clearing it 2 °C lower so it doesn't chatter at the boundary.

const int SENSOR_PIN = A0;
const int LED_PIN = 7;
const int BUZZER_PIN = 8;
const float SETPOINT = 30.0;     // °C
bool alarm = false;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  float volts = analogRead(SENSOR_PIN) * (5.0 / 1023.0);
  float tempC = (volts - 0.5) * 100.0;   // the TMP36's scale
  if (!alarm && tempC >= SETPOINT) alarm = true;
  if (alarm && tempC <= SETPOINT - 2.0) alarm = false;   // hysteresis
  digitalWrite(LED_PIN, alarm ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, alarm ? HIGH : LOW);
  Serial.print(tempC);
  Serial.println(alarm ? " C  ALARM" : " C");
  delay(250);
}`;

/** The simulated temperature in °C from the slider (0–1 → 10–50 °C). */
export function tempOf(state: { behavior: Record<string, unknown> }): number {
  const slider = typeof state.behavior.temp === 'number' ? state.behavior.temp : 0.4;
  return Math.round((10 + 40 * slider) * 10) / 10;
}

/** True when the TMP36 has power on the right legs: +VS to 5V, GND leg to GND. */
function sensorPowered(c: Circuit): boolean {
  const legs = c.legNets('tmp36');
  return !!legs && c.wired('5V') && c.wired('GND') && legs[LEG.vcc] === c.net('5V') && legs[LEG.gnd] === c.net('GND');
}

/** True when VOUT is what A0 reads. */
export function tmp36Wired(c: Circuit): boolean {
  const legs = c.legNets('tmp36');
  return !!legs && sensorPowered(c) && c.wired('A0') && legs[LEG.vout] === c.net('A0');
}

/** True when the sensor is in backwards: +VS on GND's net, GND leg on 5V's net. */
function tmp36Backwards(c: Circuit): boolean {
  const legs = c.legNets('tmp36');
  return !!legs && c.wired('5V') && c.wired('GND') && legs[LEG.vcc] === c.net('GND') && legs[LEG.gnd] === c.net('5V');
}

/** What A0 reads: the TMP36's 10 mV/°C plus its 500 mV offset, as 0–1023. */
export function tmp36Reading(c: Circuit, tempC: number): number | null {
  if (!tmp36Wired(c)) return null;
  return Math.round(((0.5 + tempC * 0.01) / 5) * 1023);
}

/** True when the buzzer loops pin 8 → buzzer (+ to −) → GND. */
function buzzerWired(c: Circuit): boolean {
  return pathThrough(c, BUZZER_PIN.node, 'GND', ['buzzer']) !== null;
}

function alarmOn(state: RuntimeState): boolean {
  return state.behavior.alarm === true;
}

function runLoop(lab: LabDef, store: LabStore): LabStore {
  const { state } = store;
  const c = circuitOf(lab, state);
  const temp = tempOf(state);
  const alarm = alarmOn(state);
  const wired = tmp36Wired(c);

  let next: RuntimeState = { ...state, behavior: { ...state.behavior, buzzer: alarm && buzzerWired(c) } };
  if (wired) next = printSerial(next, `${temp.toFixed(1)} C${alarm ? '  ALARM' : ''}`);
  if (wired && !alarm && temp >= SETPOINT) {
    next = { ...next, behavior: { ...next.behavior, alarm: true, buzzer: buzzerWired(c) } };
    return {
      lab,
      state: appendLog(next, ['warn', `ALARM: ${temp.toFixed(1)} °C is over the ${SETPOINT} °C setpoint — horn on, red light on.`]),
    };
  }
  if (alarm && temp <= SETPOINT - HYSTERESIS) {
    return {
      lab,
      state: appendLog({ ...next, behavior: { ...next.behavior, alarm: false, buzzer: false } }, [
        'info',
        `Alarm cleared at ${temp.toFixed(1)} °C — it stayed on until ${HYSTERESIS} °C below the setpoint (hysteresis, so it can't chatter).`,
      ]),
    };
  }
  return { lab, state: next };
}

export const LAB07: LabDef = {
  id: 'lab07',
  title: 'Lab 07 · Over-temperature alarm',
  sketch: { name: 'over_temp_alarm', code: SKETCH, highlightLine: 20 },
  parts: [
    { def: 'tmp36', id: 'tmp36' },
    { def: 'buzzer', id: 'buzzer' },
    { def: 'led', id: 'led', name: 'Red LED', color: 'red' },
    { def: 'resistor', id: 'resistor' },
  ],

  verdict: {
    mistakes: ['short', 'tmp36Backwards', 'ledLoop'],
    order: ['short', 'burnt', 'pass', 'tmp36Backwards', 'sensorWiring', 'buzzerLoop', 'ledLoop', 'missingParts', 'open'],
    check(code, c) {
      const say = ledLoopMessages(LAB07, ALARM_LED);
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
                title: 'The red LED is burned out',
                detail: 'Drag it back to the parts bin for a fresh one, and keep its 220 Ω resistor in the loop this time.',
              }
            : null;
        case 'pass': {
          if (!tmp36Wired(c) || !buzzerWired(c)) return null;
          const loop = findLoop(c, ALARM_LED);
          if (loop?.kind !== 'ok' || loop.source.node !== ALARM_LED.signal.node) return null;
          return {
            title: 'Circuit check passed',
            detail: 'TMP36: +VS on 5V, VOUT on A0, GND leg to GND. Pin 7 drives the red light, pin 8 the buzzer. Drag the sensor to warm it past 30 °C.',
          };
        }
        case 'tmp36Backwards': {
          if (!tmp36Backwards(c)) return null;
          return {
            title: 'The TMP36 is in backwards',
            detail:
              'With +VS on GND and its GND leg on 5V, a real TMP36 gets hot to the touch within a minute. Flat side facing you, the legs are +VS, VOUT, GND — re-place it so +VS reaches 5V.',
          };
        }
        case 'sensorWiring': {
          const legs = c.legNets('tmp36');
          if (!legs || tmp36Wired(c) || tmp36Backwards(c)) return null;
          if (sensorPowered(c)) {
            const onPin = c.board.wires.find((w) => {
              const pin = PIN_BY_ID[w.pin];
              return (pin.kind === 'digital' || pin.kind === 'analog') && legs[LEG.vout] === c.net(pin.node);
            });
            if (onPin && PIN_BY_ID[onPin.pin].node !== 'A0') {
              return {
                title: `The sensor’s output is on ${PIN_BY_ID[onPin.pin].name}, not A0`,
                detail: 'VOUT reads a voltage between 0 and 5 V, so it belongs on an analog pin. Move that jumper to A0.',
              };
            }
            return {
              title: 'The sensor’s output leg doesn’t reach A0',
              detail: 'VOUT (the middle leg) is the temperature reading. Wire its column to A0.',
            };
          }
          return {
            title: 'The TMP36 isn’t powered yet',
            detail: 'Flat side facing you: left leg (+VS) to 5V, right leg (GND) to GND, middle leg (VOUT) to A0.',
          };
        }
        case 'buzzerLoop': {
          if (!c.part('buzzer')) return null;
          if (buzzerWired(c)) return null;
          if (pathThrough(c, BUZZER_PIN.node, 'GND', ['buzzer'], 'any')) {
            return {
              title: 'The buzzer is in backwards',
              detail: 'It’s polarized: the leg marked + faces pin 8. Tap the buzzer to flip it.',
            };
          }
          const fromOtherPin = c.board.wires.find((w) => {
            const pin = PIN_BY_ID[w.pin];
            return pin.kind === 'digital' && pin.node !== BUZZER_PIN.node && pathThrough(c, pin.node, 'GND', ['buzzer'], 'any');
          });
          if (fromOtherPin) {
            return {
              title: `The buzzer is on ${PIN_BY_ID[fromOtherPin.pin].name}, not pin 8`,
              detail: `The sketch sounds pin 8 (const int BUZZER_PIN = 8). Move that jumper to pin 8.`,
            };
          }
          const legs = c.legNets('buzzer')!;
          const onGnd = c.wired('GND') && legs.includes(c.net('GND'));
          return {
            title: onGnd ? 'The buzzer doesn’t reach pin 8' : 'The buzzer has no path back to GND',
            detail: onGnd
              ? 'One leg is grounded; wire the + leg’s column to pin 8 so the sketch can sound it.'
              : 'Current needs a return path: pin 8 → buzzer (+ to −) → GND.',
          };
        }
        case 'ledLoop': {
          const loop = findLoop(c, ALARM_LED);
          if (!loop) return null;
          if (loop.kind === 'ok') {
            if (loop.source.node === ALARM_LED.signal.node) return null;
            return { ...say.wrongSource(loop.source), source: loop.source.node };
          }
          if (loop.kind === 'bypassed') {
            return { title: 'Both legs of the red LED share one strip', detail: 'Current skips the LED. Put its two legs in different numbered columns.' };
          }
          if (loop.kind === 'noResistor') return { ...say.noLimiter(loop.source), source: loop.source.node };
          if (loop.kind === 'wrongPin') {
            return {
              title: `The LED’s signal jumper is on ${loop.pinName}`,
              detail: `The sketch lights pin 7 for the alarm, so ${loop.pinName} never lights it. Move that jumper to pin 7.`,
            };
          }
          return { ...say.reversed(loop.source), source: loop.source.node };
        }
        case 'missingParts': {
          const missing = [
            ['tmp36', 'the temperature sensor'],
            ['buzzer', 'the buzzer'],
            ['led', 'the red LED'],
            ['resistor', 'the 220 Ω resistor'],
          ]
            .filter(([id]) => !c.part(id))
            .map(([, name]) => name);
          if (missing.length === 0) return null;
          return {
            title: `${missing.length === 1 ? missing[0] : 'Some parts are'} still in the parts bin`,
            detail: 'The alarm needs the sensor, the buzzer, and the red light loop.',
          };
        }
        case 'open':
          return {
            title: 'The alarm circuit isn’t finished yet',
            detail: 'Three loops: TMP36 (+VS to 5V, VOUT to A0, GND to GND), pin 8 → buzzer → GND, and pin 7 → 220 Ω → red LED → GND.',
          };
        default:
          return null;
      }
    },
  },

  physics(lab, store) {
    // A backwards TMP36 on a real board gets hot. Say so once it's powered that way.
    const { state } = store;
    if (!state.running || state.behavior.tmpWarned === true) return null;
    if (!tmp36Backwards(circuitOf(lab, state))) return null;
    store.state = { ...state, behavior: { ...state.behavior, tmpWarned: true } };
    return [
      ['warn', 'The TMP36 is running backwards — on a real board it would be getting hot right now.'],
      ['hint', 'Hint: Cut the power (Reset), then re-place the sensor: flat side facing you, +VS left to 5V, GND right.'],
    ];
  },

  behavior: {
    tickMs: 400,
    onUpload(lab, store) {
      return { lab, state: printSerial(store.state, 'Serial Monitor open at 9600 baud.') };
    },
    onTick: runLoop,
    analogReads(lab, store): Record<string, number> {
      const reading = tmp36Reading(circuitOf(lab, store.state), tempOf(store.state));
      return reading === null ? {} : { A0: reading };
    },
    outputs: (_lab, store) => (alarmOn(store.state) ? [ALARM_LED.signal.node, BUZZER_PIN.node] : []),
    runningNote(lab, store) {
      const c = circuitOf(lab, store.state);
      if (!tmp36Wired(c)) return { title: 'The sketch is running, but the Serial Monitor shows no temperature', detail: '' };
      return { title: 'The sketch is running, but the alarm can’t sound or light', detail: '' };
    },
    success: 'Drag the sensor to warm it: past 30 °C the horn and red light trip — and stay on until it cools 2 °C. Lab 07 complete!',
  },

  steps: [
    {
      id: 'sensor',
      title: 'Place and power the TMP36',
      detail: 'Flat side facing you: +VS (left) to 5V, GND (right) to GND.',
      built: (q) => sensorPowered(q) && !tmp36Backwards(q),
    },
    {
      id: 'output',
      title: 'Wire the output leg to A0',
      detail: 'VOUT, the middle leg, is the temperature as a voltage: 10 mV per °C plus a 500 mV offset.',
      built: (q) => tmp36Wired(q),
    },
    {
      id: 'buzzer',
      title: 'Wire the buzzer to pin 8',
      detail: 'Pin 8 → buzzer + leg → buzzer − leg → GND. Tap it to flip the + leg.',
      built: (q) => buzzerWired(q),
    },
    {
      id: 'led',
      title: 'Build the red alarm light on pin 7',
      detail: 'Pin 7 → 220 Ω resistor → red LED (+ to −) → GND.',
      built: (q) => {
        const found = findLoop(q, ALARM_LED);
        return found?.kind === 'ok' && found.source.node === 'D7';
      },
    },
    {
      id: 'upload',
      title: 'Upload and heat it up',
      detail: 'Drag the sensor to raise the temperature past 30 °C. Watch the alarm trip — and notice it doesn’t clear until 28 °C.',
    },
  ],

  guide: {
    intro:
      'An oven overheat alarm, in miniature: a temperature sensor reads real °C, and past the setpoint the horn sounds and the red light comes on.',
    explainers: [
      {
        title: 'A sensor that speaks °C',
        body: 'The TMP36 outputs 10 mV per °C with a 500 mV offset, so °C = (volts − 0.5) × 100. 0.75 V is 25 °C. The sketch converts the analogRead count to volts, then to degrees — real units, not a raw 0–1023.',
      },
      {
        title: 'Hysteresis: on at 30, off at 28',
        body: 'Without the 2 °C gap, a temperature hovering at 30.0 °C would chatter the alarm on and off many times a second. Real thermostats and motor-protection relays all have hysteresis for exactly this reason.',
      },
      {
        title: 'On the factory floor',
        body: 'Overheat protection pairs a sounder with a red light: the light shows where, the horn makes sure someone looks. This alarm does both from the same decision in code.',
      },
    ],
    proTip: {
      title: 'Pro tip: why the 500 mV offset',
      body: 'The offset pushes 0 °C up to 0.5 V so the sensor can read below freezing (down to −40 °C) without needing a negative supply. When you see an offset in a datasheet, it’s usually buying range.',
    },
  },
  next: { id: 'lab08', title: 'Lab 08 · Sorting gate' },
};
