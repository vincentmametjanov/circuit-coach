// Every playable lab, by id. LabScreen loads the lab for its route from here.

import type { LabDef } from '../lab';
import { LAB01 } from './lab01';
import { LAB02 } from './lab02';
import { LAB03 } from './lab03';
import { LAB04 } from './lab04';
import { LAB05 } from './lab05';
import { LAB06 } from './lab06';
import { LAB07 } from './lab07';
import { LAB08 } from './lab08';
import { LAB09 } from './lab09';
import { LAB10 } from './lab10';
import { LAB11 } from './lab11';
import { LAB12 } from './lab12';

export const LAB_DEFS: Record<string, LabDef> = {
  lab01: LAB01,
  lab02: LAB02,
  lab03: LAB03,
  lab04: LAB04,
  lab05: LAB05,
  lab06: LAB06,
  lab07: LAB07,
  lab08: LAB08,
  lab09: LAB09,
  lab10: LAB10,
  lab11: LAB11,
  lab12: LAB12,
};

export const getLabDef = (id: string): LabDef | undefined => LAB_DEFS[id];
