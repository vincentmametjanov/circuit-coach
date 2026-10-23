// Progress saved on this device: each lab's bench as the student left it, and
// which labs they have completed. Nothing leaves the device.
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BenchWire } from './runtime';
import type { Hole } from './geometry';

export type SavedLab = {
  /** The bench as last left: where each part sits (null = in the bin) and every jumper. */
  parts: Record<string, Hole | null>;
  flipped: string[];
  wires: BenchWire[];
  /** True once every step of the lab has been done, and stays true after a reset. */
  completed: boolean;
  /** When it was last saved (ms since 1970). */
  updatedAt: number;
};

export type Progress = Record<string, SavedLab>;

const KEY = 'circuit-coach/progress/v1';

/** Everything saved so far, or an empty record if nothing is saved or storage is unavailable. */
export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Progress) : {};
  } catch {
    return {};
  }
}

/** Saves one lab, keeping the others as they are. */
export async function saveLab(id: string, saved: SavedLab): Promise<void> {
  try {
    const all = await loadProgress();
    all[id] = saved;
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage can be unavailable (private browsing, full disk). The app still works, it just won't remember.
  }
}

/** Forgets everything. */
export async function clearProgress(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
