// One lab, as data: its parts bin, its sketch, how the checker judges the
// wiring, what the Output console says for each mistake, the guide steps, and
// the behavior model that runs while the sketch is "uploaded". The shared
// runtime in src/lab/runtime.ts drives any lab built to this shape.

import type { LabLog, LabStore } from './runtime';
import type { Circuit } from './engine/circuit';
import type { PartSpec } from './parts';

export type Message = { title: string; detail: string; source?: string };

/** Read-only questions a lab's verdict and step functions can ask. */
export type CircuitQuery = Circuit;

export type VerdictSpec = {
  /** Verdicts that mean "wired wrong" and are flagged the moment they appear. */
  mistakes: string[];
  /** In priority order: the first spec whose check fires wins. */
  order: string[];
  check: (code: string, c: CircuitQuery, lab: LabDef) => Message | null;
};

export type StepQuery = { pass: boolean; running: boolean } & CircuitQuery;

export type LabStepSpec = {
  id: string;
  title: string;
  detail: string;
  /** When this build step is done. Final "upload" steps omit it and complete on pass + running. */
  built?: (q: StepQuery) => boolean;
};

/** What the lab does once the sketch is running. */
export type Behavior = {
  /** Interval for the 'tick' action, if the lab needs a clock. */
  tickMs?: number;
  /** Immediate effects when the sketch finishes uploading. */
  onUpload?: (lab: LabDef, store: LabStore) => LabStore;
  /** On every tick while running. */
  onTick?: (lab: LabDef, store: LabStore) => LabStore;
  /** Called whenever a button is pressed or released while running. */
  onPress?: (lab: LabDef, store: LabStore, part: string, pressed: boolean) => LabStore;
  /** What each analog node reads (0–1023), for labs with sensors. */
  analogReads?: (lab: LabDef, store: LabStore) => Record<string, number>;
  /** Extra verdict for the running circuit, e.g. "the LED isn't blinking". */
  runningNote?: (lab: LabDef, store: LabStore) => Message | null;
  /** Success line logged when the lab passes on upload. */
  success?: string;
};

export type LabDef = {
  id: string;
  /** "Lab 02 · Start button" */
  title: string;
  sketch: { name: string; code: string; highlightLine?: number };
  /** The parts bin contents, in display order. */
  parts: PartSpec[];
  verdict: VerdictSpec;
  /** Extra checks while the circuit builds (burn-out physics). */
  physics?: (lab: LabDef, store: LabStore) => LabLog | null;
  behavior: Behavior;
  steps: LabStepSpec[];
  guide: { intro: string; explainers: { title: string; body: string }[]; proTip?: { title: string; body: string } };
  /** Shown in the guide panel as the next lab, when there is one. */
  next?: { id: string; title: string };
};
