// Every playable lab, by id. LabScreen loads the lab for its route from here.

import type { LabDef } from '../lab';
import { LAB01 } from './lab01v2';
import { LAB02 } from './lab02';
import { LAB03 } from './lab03';
import { LAB04 } from './lab04';

export const LAB_DEFS: Record<string, LabDef> = {
  lab01: LAB01,
  lab02: LAB02,
  lab03: LAB03,
  lab04: LAB04,
};

export const getLabDef = (id: string): LabDef | undefined => LAB_DEFS[id];
