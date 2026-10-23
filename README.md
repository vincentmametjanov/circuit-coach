# Circuit Coach

A universal learning app for anyone who wants to learn how Arduino, circuits, and code work together. Wire real parts on a simulated Arduino Uno and breadboard, then receive deterministic circuit checks that explain each mistake.

Circuit Coach is developed by **Vincent Mametjanov**.

## Targets

- Web browser via Expo for Web
- iPhone and iPad via Expo / Xcode
- Android phones and tablets via Expo / Android Studio

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

For Android, use either:

```sh
npm run android
```

or install Expo Go on an Android phone and open the project after running `npm start`.

## Installable mobile builds

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) profiles in `eas.json`. Sign in to an Expo account, then configure the project once. EAS will guide you through setting the required Android package name and iOS bundle identifier.

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Create an Android APK for direct installation and testing:

```sh
npx eas-cli@latest build --platform android --profile preview
```

Create store-ready builds. The production Android build is an AAB for Google Play, and the iOS build is an archive for App Store Connect:

```sh
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

After the relevant Google Play or Apple developer account is configured, submit a completed production build with:

```sh
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

## Included labs

All twelve labs are ready to use:

1. Blink an LED
2. Start button
3. Machine stack light
4. Speed dial
5. Dimmer and color mixer
6. Part counter
7. Over-temperature alarm
8. Sorting gate
9. Conveyor motor
10. Limit switches and debounce
11. Stepper homing
12. Mini sorting line

`Lab 01: Blink an LED on pin 7` introduces the workbench and its controls.

The screen is laid out like the Arduino IDE: Verify and Upload buttons, a board selector, sketch tabs, and a black Output console. Build the circuit on a simulated Arduino Uno and mini breadboard by dragging:

1. Drag the 220 ohm resistor from the parts bin onto the breadboard.
2. Drag the LED next to it, with its + leg in one of the resistor's columns (tap the LED to flip it).
3. Drag from pin 7 on the Arduino's header to the resistor's other column.
4. Drag from a GND pin to the LED's − leg column.
5. Press Upload to run the `blink_d7` sketch and watch the LED blink.

Jumper wires are in the parts bin too: drag one into a pin or a hole, then drag its loose end to the other spot (dragging straight from a pin still works). Dragging a jumper end off the breadboard removes it, and dragging a part off the breadboard returns it to the bin.

Tap any part in the bin, the Arduino or the breadboard to see what it is (`src/lab/components.ts`). Once placed, tapping the LED flips it.

The Output console says only what happened. When something is wired wrong (a short, a backwards LED, a missing resistor, the wrong pin, a taken hole) it adds a red error naming the problem and a hint for fixing it, once, as soon as the mistake appears. Unfinished circuits are only reported after Verify or Upload is pressed.

The rule checker intentionally uses fixed electrical rules rather than AI guidance. It merges breadboard strips and jumpers into nets, then looks for a pin 7 → resistor → LED → GND loop. It explains common mistakes: a backwards LED, a missing resistor (the LED burns out), the wrong pin, 5V instead of pin 7, short circuits, and parts that don't share a strip.

## Progress and solutions

Progress is saved on the device (browser storage on the web, app storage on iOS and Android): each lab's bench comes back the way it was left, and finished labs show "Completed" on the labs page. Nothing is sent anywhere. Every lab has a "Show solution" link in its guide that opens a picture of one correct build, with the option to put it on the bench. The solutions live in each lab file under `solution` and are checked by `src/lab/__tests__/solutions.test.ts`.

## Tests

```sh
npm test
```

Unit tests in `src/lab/__tests__/` cover the engine (nets, power rails, breadboard jumpers, series paths), the Output console, and every verdict, guide step, and running behavior of Labs 01–12. Every test circuit is a practical build: one jumper per Arduino pin and breadboard jumpers to the rails.

## App structure

Expo Router pages for the web and mobile apps:

- `/` (`src/app/index.tsx`): homepage: what Circuit Coach is, why learn Arduino, how it connects to manufacturing and engineering
- `/labs` (`src/app/labs/index.tsx`): all twelve labs grouped by phase
- `/labs/[id]` (`src/app/labs/[id].tsx`): opens a ready lab; others redirect to `/labs`
- `/play` (`src/app/play.tsx`): the open bench, free play with every part

The course outline lives in `src/lab/catalog.ts`; set `ready: true` when a lab ships. Page layout pieces (header, bands, grid, buttons) are in `src/components/site/`. Layouts switch at 640 px (phone to tablet) and 960 px (tablet to desktop).

Reusable circuit simulations and UI components belong outside `src/app/`.

- `src/lab/engine/circuit.ts`: the netlist: breadboard strips, power rails, pin jumpers and breadboard jumpers merged into nets (union-find), plus series-path search through parts
- `src/lab/engine/ledLoop.ts`: reusable checks for LED-and-resistor loops (shorts, missing resistor, backwards LED, wrong pin)
- `src/lab/labs/`: one file per lab (`LabDef` in `src/lab/lab.ts`): parts bin, sketch, ordered verdict checks with their wording, guide steps, and the behavior model that runs while the sketch is uploaded. Register new labs in `src/lab/labs/index.ts` and set `ready: true` in the catalog
- `src/lab/runtime.ts`: the shared reducer every lab runs on: the Output console, mistakes flagged once as they happen, LED glow and burn-out computed from the wiring and the pins the sketch drives HIGH, and the Serial Monitor
- `src/lab/parts.ts`: the parts catalog (leg patterns, polarity, buttons' internal contacts) and how identical parts stack in the bin
- `src/lab/geometry.ts`: board, breadboard, rail and canvas coordinates (no UI)
- `src/components/workbench/`: the bench. `Workbench.tsx` holds the drag-and-drop state and drop rules; `dragging.ts` has the pure helpers (where parts anchor, which holes are taken); `DragHandle.tsx` is the touch target that works for mouse and finger; `overlays.tsx` draws each part, the drop preview and the floating tag; `Parts.tsx`, `Breadboard.tsx` and `ArduinoUno.tsx` are the SVG artwork
- `src/components/ide/`: the IDE-style toolbar, tabs, guide panel, sketch view and Output console

## Issues and contributing

Please check existing issues before opening a new one. Use the **Bug report** form for a reproducible problem and the **Feature request** form for an idea or improvement. Include the affected lab, device or browser, and clear steps whenever possible.

Contributions are welcome. Keep changes focused, preserve the simulator's deterministic behavior, and include tests for changed circuit rules or lab behavior. Before opening a pull request, run:

```sh
npm test
npm run lint
npx tsc --noEmit
```

For larger changes, open an issue first so the goal and lesson behavior can be discussed before implementation.

## Developer

Circuit Coach is developed by Vincent Mametjanov.