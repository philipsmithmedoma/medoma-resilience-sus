import { describe, expect, it } from 'vitest';
import type { HomeDisruption } from '@/data/types';
import { batteryEmptyAt, deriveSets, expiredIds, nextClockTime } from './disruptions';

const rec = (o: Partial<HomeDisruption>): HomeDisruption => ({
  id: 'd', kind: 'power', target: 'huddinge', targetKind: 'zone', label: { sv: 'x', en: 'x' }, startedAt: 900, expectedEnd: null, source: 'map', createdBy: 'Eva Lind', endedAt: null, endReason: null, ...o,
});

describe('disruption records (SPEC.md § 13.2)', () => {
  it('derives the blocked and outage sets from the active records only', () => {
    const sets = deriveSets([
      rec({ id: 'a', kind: 'road', target: '9000004', targetKind: 'way' }),
      rec({ id: 'b', kind: 'road', target: 'Essingeleden', targetKind: 'road' }),
      rec({ id: 'c', kind: 'road', target: 'r-centralbron', targetKind: 'node' }),
      rec({ id: 'd', kind: 'power', target: 'taby' }),
      rec({ id: 'e', kind: 'water', target: 'solna' }),
      rec({ id: 'f', kind: 'power', target: 'nacka', endedAt: 950, endReason: 'manual' }),
    ]);
    expect([...sets.blockedWays]).toEqual(['9000004']);
    expect([...sets.blockedRoads]).toEqual(['Essingeleden']);
    expect([...sets.blockedNodes]).toEqual(['r-centralbron']);
    expect([...sets.powerOutZones]).toEqual(['taby']);
    expect([...sets.waterOutZones]).toEqual(['solna']);
  });

  it('a disruption with an expected end ends when the clock reaches it, and one without never does', () => {
    const records = [rec({ id: 'timed', expectedEnd: 1000 }), rec({ id: 'open', target: 'taby', expectedEnd: null }), rec({ id: 'done', target: 'nacka', expectedEnd: 900, endedAt: 905, endReason: 'manual' })];
    expect(expiredIds(records, 999)).toEqual([]);
    expect(expiredIds(records, 1000)).toEqual(['timed']);
    expect(expiredIds(records, 5000)).toEqual(['timed']);
  });

  it('the battery deadline comes from the earliest active power disruption covering the zone', () => {
    const sets = deriveSets([
      rec({ id: 'late', startedAt: 1000 }),
      rec({ id: 'early', target: 'huddinge', startedAt: 900 }),
      rec({ id: 'gone', target: 'huddinge', startedAt: 800, endedAt: 850, endReason: 'manual' }),
      rec({ id: 'other', target: 'taby', startedAt: 700 }),
    ]);
    expect(sets.powerStart.get('huddinge')).toBe(900);
    expect(batteryEmptyAt(sets.powerStart.get('huddinge')!, 4)).toBe(900 + 240);
    expect(sets.powerStart.get('taby')).toBe(700);
    expect(sets.powerStart.has('solna')).toBe(false);
  });

  it('finds the next clock time after a given minute', () => {
    expect(nextClockTime(14 * 60 + 40, 20, 30)).toBe(20 * 60 + 30);
    expect(nextClockTime(14 * 60 + 40, 8, 0)).toBe(1440 + 8 * 60);
  });
});
