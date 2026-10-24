# Circuit Coach

Learn Arduino and electronics without buying a kit. Wire real parts on a simulated Arduino Uno and breadboard, press Upload, and watch the circuit work. A built-in coach checks the wiring and explains every mistake in plain words.

Twelve labs go from blinking one LED to a small automated sorting line. Built by Vincent Mametjanov.

The idea for the app was developed in early summer of 2026, with initial design ideas that went through process of changes after interviews with teachers and students about what makes electronics hard to start. Building of the app began in August 2026, after infrastructure layout was established.

## Run it

Runs in a browser, on iPhone and iPad, and on Android phones and tablets.

```sh
npm install
npm run web        # browser
npm run ios        # iOS simulator
npm run android    # Android emulator
```

To try it on a real phone, run `npm start` and open the project in Expo Go.

## Build installable apps

Builds use [EAS Build](https://docs.expo.dev/build/introduction/) with the profiles in `eas.json`. Sign in and configure the project once. EAS asks for an Android package name and an iOS bundle identifier.

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Then build and submit:

```sh
# Android APK to install directly for testing
npx eas-cli@latest build --platform android --profile preview

# Store builds: an AAB for Google Play, an archive for App Store Connect
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production

# Submit a finished production build
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

## The labs

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

Each lab teaches one idea and reuses the circuit before it, so they are meant to be done in order. The open bench at `/play` has every part, no goal, and nothing to get wrong.

## How it works

The screen is laid out like the Arduino IDE: Verify and Upload buttons, a board selector, sketch tabs and a black Output console. Drag parts from the bin onto the breadboard, and jumper wires from the Arduino's pins into the holes. Dragging a part or a jumper end off the breadboard puts it back. Tapping any part says what it is, and tapping a placed LED flips it.

The coach is not an AI. It merges breadboard strips, power rails and jumpers into nets, then checks the result against fixed electrical rules for that lab: a backwards LED, a missing resistor, the wrong pin, a short circuit, legs that do not share a strip. Wiring mistakes are reported as soon as they appear, once each, with a hint for fixing them. An unfinished circuit is only reported after Verify or Upload. An LED with no resistor really does burn out.

Progress is saved on the device, so each lab's bench comes back the way it was left and finished labs are marked on the labs page. Nothing is sent anywhere. Every lab also has a "Show solution" link that opens one correct build, with a button to put it on the bench.

## Tests

```sh
npm test
npm run lint
npx tsc --noEmit
```

Tests in `src/lab/__tests__/` cover the circuit engine (nets, rails, jumpers, series paths), the Output console, and every check, guide step and running behavior in all twelve labs. `solutions.test.ts` builds each lab's published solution and confirms it passes that lab's own checker.

## Code layout

Pages, routed by Expo Router:

| Route | File | What it is |
| --- | --- | --- |
| `/` | `src/app/index.tsx` | homepage |
| `/labs` | `src/app/labs/index.tsx` | all twelve labs |
| `/labs/[id]` | `src/app/labs/[id].tsx` | one lab |
| `/play` | `src/app/play.tsx` | the open bench |

Everything else:

- `src/lab/engine/`: the netlist (`circuit.ts`) and the shared LED-loop checks (`ledLoop.ts`). No UI.
- `src/lab/labs/`: one file per lab. Each is a `LabDef` (see `src/lab/lab.ts`) holding its parts, sketch, checks and their wording, guide steps, solution, and what happens while the sketch runs.
- `src/lab/runtime.ts`: the reducer every lab runs on, including the Output console, LED glow, burn-out and the Serial Monitor.
- `src/lab/parts.ts` and `src/lab/geometry.ts`: the parts catalog, and the board and breadboard coordinates.
- `src/lab/catalog.ts`: the course outline shown on the labs page.
- `src/lab/progress.ts`: saving progress on the device.
- `src/components/workbench/`: the bench. `Workbench.tsx` holds drag-and-drop state, `dragging.ts` the pure helpers, `DragHandle.tsx` the touch target, `overlays.tsx` the on-screen feedback, and `Parts.tsx`, `Breadboard.tsx` and `ArduinoUno.tsx` the SVG artwork.
- `src/components/ide/`: toolbar, tabs, guide panel, sketch view, and the Output and Serial consoles.
- `src/components/site/`: the homepage and labs page, plus the shared layout pieces.

To add a lab: write `src/lab/labs/labNN.ts`, register it in `src/lab/labs/index.ts`, and set `ready: true` in `src/lab/catalog.ts`.

## Contributing

Check the open issues first, then use the Bug report or Feature request form. Keep changes focused, keep the simulator's behavior predictable, and add tests for any change to a circuit rule or a lab. Run `npm test`, `npm run lint` and `npx tsc --noEmit` before opening a pull request. For anything large, open an issue first so the goal can be discussed.
