// Disruptions in time – SPEC.md § 13.2. A disruption is a record; the sets the reachability code reads are derived from the
// active records. A record ends when the clock reaches its expected end or when it is ended by hand. Battery deadlines are
// computed from the earliest active power disruption that covers the zone. Pure.
import type { HomeDisruption, ZoneId } from '@/data/types';

export const isActive = (d: Pick<HomeDisruption, 'endedAt'>): boolean => d.endedAt === null;

export const activeDisruptions = (records: readonly HomeDisruption[]): HomeDisruption[] => records.filter(isActive);

/** The sets of SPEC.md § 11.5 and § 12.3, plus the start of the earliest power disruption per zone. */
export interface DerivedSets {
  blockedWays: Set<string>;
  blockedRoads: Set<string>;
  blockedNodes: Set<string>;
  powerOutZones: Set<ZoneId>;
  waterOutZones: Set<ZoneId>;
  /** Zone → clock minute at which the earliest active power disruption covering it started. */
  powerStart: Map<ZoneId, number>;
}

export function deriveSets(records: readonly HomeDisruption[]): DerivedSets {
  const sets: DerivedSets = { blockedWays: new Set(), blockedRoads: new Set(), blockedNodes: new Set(), powerOutZones: new Set(), waterOutZones: new Set(), powerStart: new Map() };
  for (const d of records) {
    if (!isActive(d)) continue;
    if (d.kind === 'road') {
      if (d.targetKind === 'way') sets.blockedWays.add(d.target);
      else if (d.targetKind === 'node') sets.blockedNodes.add(d.target);
      else sets.blockedRoads.add(d.target);
    } else if (d.kind === 'power') {
      sets.powerOutZones.add(d.target);
      const earlier = sets.powerStart.get(d.target);
      if (earlier === undefined || d.startedAt < earlier) sets.powerStart.set(d.target, d.startedAt);
    } else {
      sets.waterOutZones.add(d.target);
    }
  }
  return sets;
}

/** Ids of the active records whose expected end the clock has reached. */
export function expiredIds(records: readonly HomeDisruption[], clock: number): string[] {
  return records.filter((d) => isActive(d) && d.expectedEnd !== null && clock >= d.expectedEnd).map((d) => d.id);
}

/** Clock minute at which a battery of `hours` that started to drain at `startedAt` is empty. */
export const batteryEmptyAt = (startedAt: number, hours: number): number => startedAt + hours * 60;

/** The next clock minute after `from` that reads hh:mm (today's if it is still ahead, else tomorrow's). */
export function nextClockTime(from: number, hh: number, mm: number): number {
  const day = Math.floor(from / 1440) * 1440;
  const at = day + hh * 60 + mm;
  return at > from ? at : at + 1440;
}
