# Circuit Coach lab plan (revised)

Twelve labs, four phases of three. Each phase is one clean row in the lab grid
on desktop. Manufacturing framing leads; every lab names the factory system that
uses the same circuit.

## Phase 1 · Outputs and inputs

### Lab 01 · Blink an LED (done)
Digital output. Factory: machine indicator lights.

### Lab 02 · Start button (done)
- Concept: digital input, pull-down resistors, floating inputs.
- Factory: start/stop pushbuttons; a floating input can start a motor by itself.
- Parts: Lab 01 circuit + pushbutton + 10 kΩ resistor.
- Goal: 5V → button → pin 2; pin 2 → 10 kΩ → GND; LED on pin 7 lights while held.
- Mistakes: button shorts 5V→GND; no pull-down (LED flickers at random; show it,
  then explain); both button legs in one strip (always pressed); button on wrong
  pin; 10 kΩ swapped for 220 Ω (works, warn about wasted current).
- Engine work: rule-based goals (series path + `connected` rules); press-and-hold
  interaction; pin-read behavior model (HIGH / LOW / floating).
- Follow-up: `INPUT_PULLUP` pro tip after pass.

### Lab 03 · Machine stack light (done)
- Concept: several outputs + a state machine; edge detection teaser.
- Factory: andon stack lights (green = run, yellow = warn, red = stop).
- Parts: green/yellow/red LEDs, 3× 220 Ω, button + 10 kΩ, GND rail.
- Goal: three independent LED loops on pins 5/6/7 sharing the GND rail; button
  steps RUN → WARN → STOP.
- Mistakes: one resistor shared by all three LEDs (brightness warning); LED color
  on the wrong pin; loop not reaching the rail; Lab 01/02 mistakes.
- Engine work: power rails on the breadboard; multi-instance parts; 3-state
  behavior model advanced on debounced press (sets up Lab 10).

## Phase 2 · Analog signals and sensors

### Lab 04 · Speed dial (done)
- Concept: analog input, Serial Monitor.
- Factory: conveyor speed knob; explainer line on industrial 4–20 mA loops.
- Parts: 10 kΩ potentiometer, 3 jumpers.
- Goal: outer legs to 5V/GND, wiper to A0; Serial Monitor prints 0–1023 + volts.
- Mistakes: wiper on a digital pin; outer leg unconnected (stuck 0/1023); both
  outer legs to 5V.
- Engine work: 3-leg parts; knob drag while running; Serial Monitor tab.

### Lab 05 · Motor speed (PWM)
- Concept: PWM output; duty cycle vs average power.
- Factory: VFD motor speed, heater power. Primary story is motor/heater; LED
  brightness is the proxy. RGB LED color mixer is the extension.
- Parts: pot from 04, LED + 220 Ω on ~9; extension: RGB LED + 3 resistors on
  ~9/~10/~11.
- Mistakes: LED on a non-~ pin (snaps on/off; explain the ~); RGB common leg on
  5V for a common-cathode part.
- Engine work: 0–255 glow levels; small PWM waveform in the guide panel.

### Lab 06 · Part counter
- Concept: voltage divider, thresholds, light-on vs dark-on.
- Factory: photoelectric beam-break sensors counting parts on a conveyor.
- Parts: photoresistor + 10 kΩ divider into A0; green LED flashes per part.
- Goal: Serial counter increments once per simulated box.
- Mistakes: no fixed resistor (stuck near 1023); sensor/resistor swapped → frame
  as light-on/dark-on selector, real photo sensors have this switch; counting
  every loop instead of once per part.
- Engine work: conveyor strip animation; threshold slider in guide panel.

## Phase 3 · Motion and alarms

### Lab 07 · Over-temperature alarm
- Concept: sensor in real units + alarm with hysteresis.
- Factory: oven/motor overheat alarms; alarm horn + red light response.
- Parts: TMP36 (flip matters), piezo buzzer on pin 8, red LED.
- Goal: (voltage − 0.5) × 100 = °C; over setpoint → buzzer + LED; clears 2 °C
  below setpoint (hysteresis, no chatter).
- Mistakes: TMP36 backwards (gets hot on a real part; say so); output leg on a
  digital pin; buzzer with no GND return.
- Engine work: temperature slider; Web Audio tone with classroom mute button.

### Lab 08 · Sorting gate (servo)
- Concept: position control, `map()`.
- Factory: diverter gates, robot arm joints.
- Parts: servo (power/ground/signal plug), pot from 04; extension: button to
  snap between two positions.
- Mistakes: signal on wrong pin; power on 3.3V (jitters/stalls); power/signal
  swapped; servo ground not shared with the board.
- Engine work: wire-to-pin part connections; animated horn.

### Lab 09 · Conveyor motor
- Concept: transistor switch, flyback diode, separate motor supply.
- Factory: contactors in a motor control cabinet; a pin can't power a motor.
- Parts: DC motor, PN2222/MOSFET, 1N4007 diode, 9V battery, button.
- Goal: pin 9 → gate; battery+ → motor → transistor → GND; diode band toward +;
  battery − joined to Arduino GND.
- Mistakes, in order: motor straight on a pin (pin damaged); diode backwards
  (battery short); no common ground (never starts); missing diode (works, then
  warn about the spike); transistor legs swapped.

## Phase 4 · Toward the factory

### Lab 10 · Limit switches & debounce
- Concept: end-of-travel switches, E-stop, why one press must count once.
- Factory: every machine has limit switches and a latching E-stop.
- Parts: two buttons + pull-downs (reuses Lab 02 machinery), LED.
- Goal: motor/LED "runs" only while the limit switch is clear and the E-stop is
  not pressed; a bouncing switch demo shows double-counts, then the fix.
- No new part kinds; new behavior model only.

### Lab 11 · Stepper homing
- Concept: step/direction pulses, homing sequence.
- Factory: CNC and pick-and-place machines home every axis at power-up.
- Parts: stepper + driver (simplified 2-wire step/dir), limit switch from 10.
- Goal: move the axis until the limit switch trips, then back off. The homing
  routine every real machine runs.
- Reuses motor animation + limit switch behavior.

### Lab 12 · Mini sorting line (capstone)
- Concept: sensor → decide → actuate → indicate. The logic a PLC runs.
- Factory: an automated work cell; bridge to industrial automation courses.
- Parts: photoresistor divider, servo gate, stack light, button. Nothing new.
- Goal: boxes slide past; dark boxes trip the gate; stack light and Serial
  totals show status; button pauses the line.
- Two student tunables (light threshold, gate delay) + a sorting score.
- Closing page: what a PLC is; the same logic drawn as ladder diagram.

## Cross-cutting work

- Engine v2: parts catalog (multi-instance, N-leg), power rails, rule-based
  goals, per-lab behavior models. Lab 01 tests must stay green throughout.
- Accessibility: tap-to-place alternative to dragging, labels on all
  interactive SVG, live-region Output console, ≥44 pt touch targets,
  reduced-motion support for blink/motor animations.
- Responsive: verify 12-lab grid at 320/768/1280 px; lab screen at phone and
  desktop breakpoints.
- Security: `npm audit fix` (non-force only; a forced downgrade breaks Expo);
  CSP + nosniff headers are a deployment task for the web host.
