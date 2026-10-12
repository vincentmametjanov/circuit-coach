# Circuit Coach

A universal starter app for novice electrical-engineering students. The first lab teaches a safe Arduino LED circuit through guided wiring actions and deterministic circuit checks.

## Targets

- Web browser via Expo for Web
- iPhone and iPad via Expo / Xcode

## Run locally

```sh
npm install
npm run web
```

For the Apple version, use either:

```sh
npm run ios
```

or open the project through Expo Go on a physical iPhone after running:

```sh
npm start
```

## Current lesson

`Lab 01: Blink an LED on pin 7`

The screen is laid out like the Arduino IDE: Verify and Upload buttons, a board selector, sketch tabs, and a black Output console. Students build the circuit on a simulated Arduino Uno and mini breadboard by dragging:

1. Drag the 220 ohm resistor from the parts bin onto the breadboard.
2. Drag the LED next to it, with its + leg in one of the resistor's columns (tap the LED to flip it).
3. Drag from pin 7 on the Arduino's header to the resistor's other column.
4. Drag from a GND pin to the LED's − leg column.
5. Press Upload to run the `blink_d7` sketch and watch the LED blink.

Dragging a jumper end off the breadboard removes it, and dragging a part off the breadboard returns it to the bin.

The rule checker intentionally uses fixed electrical rules rather than AI guidance. It merges breadboard strips and jumpers into nets, then looks for a pin 7 → resistor → LED → GND loop. It explains common mistakes: a backwards LED, a missing resistor (the LED burns out), the wrong pin, 5V instead of pin 7, short circuits, and parts that don't share a strip.

## App structure

Expo Router serves the lesson at `src/app/index.tsx` for the web and Apple app. New lessons should become their own files in `src/app/`; reusable circuit simulations and UI components belong outside that directory.

- `src/lab/` — breadboard and board geometry, the circuit checker, and the lab state reducer (no UI)
- `src/components/workbench/` — SVG drawings of the Uno, breadboard and parts, plus drag-and-drop
- `src/components/ide/` — the IDE-style toolbar, tabs, guide panel, sketch view and Output console