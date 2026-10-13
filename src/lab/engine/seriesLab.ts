// The shared checker for "series loop" labs: a pin drives current through a set
// of parts and back to GND. A lab supplies its parts, goal and wording as data
// (see src/lab/labs/); this file holds the logic every such lab shares — which
// mistakes to look for, and in what order.

import { PIN_BY_ID, type PartId, stripName } from '../geometry';
import { type Board, type Netlist, buildNetlist, seriesPath } from './netlist';

export type Source = { node: string; name: string };

/** Board supplies that can power a loop besides the lab's signal pin. */
export const SUPPLIES: Source[] = [
  { node: '5V', name: '5V' },
  { node: '3V3', name: '3.3V' },
  { node: 'VIN', name: 'Vin' },
];

export type VerdictCode =
  | 'pass'
  | 'alwaysOn'
  | 'noResistor'
  | 'reversed'
  | 'short'
  | 'ledShorted'
  | 'burnt'
  | 'missingParts'
  | 'wrongPin'
  | 'open';

export type Message = { title: string; detail: string };

export type Verdict = Message & {
  code: VerdictCode;
  /** Node driving the loop, when a complete loop was found. */
  source?: string;
};

/** Read-only questions a lab's step checklist can ask about the circuit. */
export type CircuitQuery = {
  placed(part: PartId): boolean;
  /** Nets of a part's legs (+ leg first if polarized); empty while it's in the bin. */
  legs(part: PartId): string[];
  net(node: string): string;
  wired(node: string): boolean;
};

export type StepSpec = {
  id: string;
  title: string;
  detail: string;
  /** When this build step is done. Steps without it are done once the sketch runs on a passing circuit. */
  built?: (q: CircuitQuery) => boolean;
};

/** What a lab says for each mistake. The engine decides which one applies. */
export type SeriesLabMessages = {
  pass(order: PartId[]): Message;
  shortSignalToGround: Message;
  burnt: Message;
  loadBypassed: Message;
  wrongSource(source: Source): Message;
  noLimiter(source: Source): Message;
  reversed(source: Source): Message;
  missingParts(missing: PartId[]): Message;
  wrongPin(pinName: string): Message;
  signalUnwired: Message;
  groundUnwired: Message;
  signalLandsNowhere(where: string): Message;
  groundLandsNowhere(where: string): Message;
  partsDisconnected: Message;
  loopOpen: Message;
};

export type SeriesLab = {
  id: string;
  title: string;
  /** The pin the lab's sketch drives. */
  signal: Source;
  /** Every part in the loop, in the order a student usually builds it. */
  parts: PartId[];
  /** The polarized part that does the visible work (it can burn out or be put in backwards). */
  load: PartId;
  /** The part that keeps the current safe. */
  limiter: PartId;
  messages: SeriesLabMessages;
  steps: StepSpec[];
};

export type Analysis = { verdict: Verdict; built: Record<string, boolean> };

export type LabStep = { id: string; title: string; detail: string; done: boolean };

export function analyzeSeriesLab(lab: SeriesLab, board: Board): Analysis {
  const netlist = buildNetlist(board);
  const query: CircuitQuery = {
    placed: (part) => netlist.part(part) !== undefined,
    legs: (part) => netlist.legs(part) ?? [],
    net: netlist.net,
    wired: netlist.wired,
  };
  const built = Object.fromEntries(lab.steps.filter((s) => s.built).map((s) => [s.id, s.built!(query)]));
  return { verdict: judge(lab, netlist), built };
}

export function seriesLabSteps(lab: SeriesLab, analysis: Analysis, running: boolean): LabStep[] {
  const complete = analysis.verdict.code === 'pass';
  return lab.steps.map(({ id, title, detail, built }) => ({
    id,
    title,
    detail,
    done: built ? complete || analysis.built[id] : complete && running,
  }));
}

function judge(lab: SeriesLab, netlist: Netlist): Verdict {
  const { net, wired } = netlist;
  const say = lab.messages;
  const sources = [lab.signal, ...SUPPLIES];

  // 1. Shorts: two supplies (or a supply and GND) joined by jumpers alone.
  const supplies = [...sources, { node: 'GND', name: 'GND' }];
  for (let i = 0; i < supplies.length; i += 1) {
    for (let j = i + 1; j < supplies.length; j += 1) {
      const [a, b] = [supplies[i], supplies[j]];
      if (!wired(a.node) || !wired(b.node) || net(a.node) !== net(b.node)) continue;
      if (b.node !== 'GND') {
        return {
          code: 'short',
          title: `Short circuit: ${a.name} is tied to ${b.name}`,
          detail: `When the sketch sets ${a.name} LOW it would fight the ${b.name} supply. Give each one its own column strip.`,
        };
      }
      if (a.node === lab.signal.node) return { code: 'short', ...say.shortSignalToGround };
      return {
        code: 'short',
        title: `Short circuit: ${a.name} is wired straight to GND`,
        detail: `That connects the ${a.name} supply directly to ground. On a real board the USB fuse trips and the Arduino shuts off. Remove one of those jumpers.`,
      };
    }
  }

  if (netlist.board.burnt.includes(lab.load)) return { code: 'burnt', ...say.burnt };

  // 2. A complete loop through the load, from any source.
  const load = netlist.legs(lab.load);
  if (load) {
    if (load[0] === load[1]) return { code: 'ledShorted', ...say.loadBypassed };

    const withoutLimiter = lab.parts.filter((part) => part !== lab.limiter);
    for (const source of sources) {
      if (!wired(source.node)) continue;
      const path = (parts: PartId[], polarity?: 'any') => seriesPath(netlist, source.node, 'GND', parts, polarity);

      const order = path(lab.parts);
      if (order) {
        return source.node === lab.signal.node
          ? { code: 'pass', source: source.node, ...say.pass(order) }
          : { code: 'alwaysOn', source: source.node, ...say.wrongSource(source) };
      }
      if (path(withoutLimiter)) return { code: 'noResistor', source: source.node, ...say.noLimiter(source) };
      if (path(lab.parts, 'any') || path(withoutLimiter, 'any')) {
        return { code: 'reversed', source: source.node, ...say.reversed(source) };
      }
    }
  }

  // 3. Nothing complete yet: point at the first gap.
  const missing = lab.parts.filter((part) => !netlist.part(part));
  if (missing.length > 0) return { code: 'missingParts', ...say.missingParts(missing) };

  if (!wired(lab.signal.node)) {
    const other = netlist.board.wires
      .map((wire) => PIN_BY_ID[wire.pin])
      .find((pin) => (pin.kind === 'digital' || pin.kind === 'analog') && pin.node !== lab.signal.node);
    return other ? { code: 'wrongPin', ...say.wrongPin(other.name) } : { code: 'open', ...say.signalUnwired };
  }

  if (!wired('GND')) return { code: 'open', ...say.groundUnwired };

  const legNets = lab.parts.map((part) => netlist.legs(part)!);
  const touchesAPart = (node: string) => legNets.some((legs) => legs.includes(net(node)));
  const landing = (node: string) => {
    const wire = netlist.board.wires.find((w) => PIN_BY_ID[w.pin].node === node);
    return wire ? stripName(wire.hole) : 'a column';
  };
  if (!touchesAPart(lab.signal.node)) return { code: 'open', ...say.signalLandsNowhere(landing(lab.signal.node)) };
  if (!touchesAPart('GND')) return { code: 'open', ...say.groundLandsNowhere(landing('GND')) };

  // Every part must share a column with at least one other part.
  const isolated = legNets.some((legs, i) =>
    legNets.every((other, j) => i === j || !legs.some((n) => other.includes(n))),
  );
  if (isolated) return { code: 'open', ...say.partsDisconnected };

  return { code: 'open', ...say.loopOpen };
}
