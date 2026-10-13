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

## Tests

```sh
npm test
```

Unit tests in `src/lab/__tests__/` cover the engine (nets, series paths) and every Lab 01 verdict and guide step.

## App structure

Expo Router pages, for the web and the Apple app:

- `/` (`src/app/index.tsx`): homepage: what Circuit Coach is, why learn Arduino, how it connects to manufacturing and engineering
- `/labs` (`src/app/labs/index.tsx`): all ten labs grouped by phase; labs not built yet show as "Coming soon"
- `/labs/[id]` (`src/app/labs/[id].tsx`): opens a ready lab; others redirect to `/labs`

The course outline lives in `src/lab/catalog.ts`; set `ready: true` when a lab ships. Page layout pieces (header, bands, grid, buttons) are in `src/components/site/`. Layouts switch at 640 px (phone to tablet) and 960 px (tablet to desktop).

Reusable circuit simulations and UI components belong outside `src/app/`.

- `src/lab/engine/` — the shared checker: turns strips and jumpers into nets (union-find) and searches for series paths; decides which mistake applies, in order
- `src/lab/labs/` — one file per lab: its parts, goal loop, coach messages and guide steps, as data. Adding a lab means adding a file here, not new checking code
- `src/lab/` — breadboard and board geometry, the adapter from workbench state to the checker, and the lab state reducer (no UI)
- `src/components/workbench/` — SVG drawings of the Uno, breadboard and parts, plus drag-and-drop
- `src/components/ide/` — the IDE-style toolbar, tabs, guide panel, sketch view and Output console