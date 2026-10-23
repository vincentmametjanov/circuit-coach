// Every lab's "Show solution" layout must be a real, buildable, correct circuit:
// all parts placed, no two things in one hole, and the lab's own checker passes.
import { describe, expect, it } from 'vitest';
import { holeKey } from '../geometry';
import { LAB_DEFS } from '../labs';
import { partLegs } from '../parts';
import { benchFromSolution, createLabStore, judge, runtimeSteps } from '../runtime';

describe('lab solutions', () => {
  for (const lab of Object.values(LAB_DEFS)) {
    if (!lab.solution) continue;
    it(`${lab.id} solution is buildable and passes`, () => {
      const solution = lab.solution!;
      const used = new Map<string, string>();
      const claim = (key: string, by: string) => {
        expect(used.get(key), `${by} overlaps ${used.get(key)}`).toBeUndefined();
        used.set(key, by);
      };
      for (const spec of lab.parts) {
        expect(solution.parts[spec.id], `${spec.id} is placed`).toBeTruthy();
        for (const hole of partLegs(spec.def, solution.parts[spec.id])) claim(holeKey(hole), spec.id);
      }
      for (const [pin, hole] of solution.wires) claim(holeKey(hole), `${pin} jumper`);
      for (const [a, b] of solution.links ?? []) {
        claim(holeKey(a), 'breadboard jumper');
        claim(holeKey(b), 'breadboard jumper');
      }
      const state = benchFromSolution(createLabStore(lab).state, solution);
      const verdict = judge(lab, state);
      expect(verdict.code, verdict.title).toBe('pass');
      // Every build step reads as done (the final "upload" step needs the sketch running).
      const steps = runtimeSteps(lab, state, true);
      expect(steps.filter((s) => !s.done).map((s) => s.id)).toEqual([]);
    });
  }
});
