# Circuit Coach

A universal starter app for novice electrical-engineering students. Four labs are ready: blink an LED (01), a start button with a pull-down (02), a three-lamp machine stack light (03), and a potentiometer speed dial read on A0 (04). Students wire real parts on a simulated Uno and breadboard, and deterministic circuit checks explain every mistake.

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

Jumper wires are in the parts bin too: drag one into a pin or a hole, then drag its loose end to the other spot (dragging straight from a pin still works). Dragging a jumper end off the breadboard removes it, and dragging a part off the breadboard returns it to the bin.

Tap any part in the bin, the Arduino or the breadboard to see what it is (`src/lab/components.ts`). Once placed, tapping the LED flips it.

The Output console says only what happened. When something is wired wrong (a short, a backwards LED, a missing resistor, the wrong pin, a taken hole) it adds a red error naming the problem and a hint for fixing it, once, as soon as the mistake appears. Unfinished circuits are only reported when the student presses Verify or Upload.

The rule checker intentionally uses fixed electrical rules rather than AI guidance. It merges breadboard strips and jumpers into nets, then looks for a pin 7 → resistor → LED → GND loop. It explains common mistakes: a backwards LED, a missing resistor (the LED burns out), the wrong pin, 5V instead of pin 7, short circuits, and parts that don't share a strip.

## Tests

```sh
npm test
```

Unit tests in `src/lab/__tests__/` cover the engine (nets, power rails, breadboard jumpers, series paths), the Output console, and every verdict, guide step and running behavior of Labs 01–04. Every test circuit is one a student could actually build: one jumper per Arduino pin, breadboard jumpers to the rails.

## App structure

Expo Router pages, for the web and the Apple app:

- `/` (`src/app/index.tsx`): homepage: what Circuit Coach is, why learn Arduino, how it connects to manufacturing and engineering
- `/labs` (`src/app/labs/index.tsx`): all ten labs grouped by phase; labs not built yet show as "Coming soon"
- `/labs/[id]` (`src/app/labs/[id].tsx`): opens a ready lab; others redirect to `/labs`

The course outline lives in `src/lab/catalog.ts`; set `ready: true` when a lab ships. Page layout pieces (header, bands, grid, buttons) are in `src/components/site/`. Layouts switch at 640 px (phone to tablet) and 960 px (tablet to desktop).

Reusable circuit simulations and UI components belong outside `src/app/`.

- `src/lab/engine/circuit.ts` — the netlist: breadboard strips, power rails, pin jumpers and breadboard jumpers merged into nets (union-find), plus series-path search through parts
- `src/lab/engine/ledLoop.ts` — reusable checks for LED-and-resistor loops (shorts, missing resistor, backwards LED, wrong pin)
- `src/lab/labs/` — one file per lab (`LabDef` in `src/lab/lab.ts`): parts bin, sketch, ordered verdict checks with their wording, guide steps, and the behavior model that runs while the sketch is uploaded. Register new labs in `src/lab/labs/index.ts` and set `ready: true` in the catalog
- `src/lab/runtime.ts` — the shared reducer every lab runs on: the Output console, mistakes flagged once as they happen, LED glow and burn-out computed from the wiring and the pins the sketch drives HIGH, and the Serial Monitor
- `src/lab/parts.ts` — the parts catalog (leg patterns, polarity, buttons' internal contacts) and how identical parts stack in the bin
- `src/lab/geometry.ts` — board, breadboard, rail and canvas coordinates (no UI)
- `src/components/workbench/` — SVG drawings of the Uno, breadboard and parts, plus drag-and-drop
- `src/components/ide/` — the IDE-style toolbar, tabs, guide panel, sketch view and Output console