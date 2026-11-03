import { describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { ALL_SLOTS, buildVisits, effectiveVisits, freeSlots, visitStatusAt } from './home-visits';

describe('teams and visits (SPEC.md § 14.2, § 14.3)', () => {
  it('has four teams with two cars, placeholder phone numbers and bases at zone centres', () => {
    expect(pack.homeTeams.map((t) => t.name)).toEqual(['ASIH Nord', 'ASIH City', 'ASIH Syd', 'ASIH Sydväst']);
    expect(pack.homeTeams.every((t) => t.cars === 2 && t.phone === '0XX-XXX XX XX')).toBe(true);
    const zone = (id: string) => pack.homeZones.find((z) => z.id === id)!;
    const base = (name: string) => pack.homeTeams.find((t) => t.name === name)!;
    expect([base('ASIH Nord').baseLat, base('ASIH Nord').baseLng]).toEqual([zone('solna').lat, zone('solna').lng]);
    expect([base('ASIH Syd').baseLat, base('ASIH Syd').baseLng]).toEqual([zone('soderort').lat, zone('soderort').lng]);
    expect(pack.homePatients.every((p) => pack.homeTeams.some((t) => t.name === p.team))).toBe(true);
  });

  it('gives every patient with a visit today exactly one visit with its team, 08:00–17:00 in 30-minute steps', () => {
    const withVisit = pack.homePatients.filter((p) => p.visitToday);
    expect(pack.homeVisits).toHaveLength(withVisit.length);
    for (const v of pack.homeVisits) {
      const p = pack.homePatients.find((x) => x.id === v.patientId)!;
      expect(p.visitToday).toBe(true);
      expect(pack.homeTeams.find((t) => t.id === v.teamId)!.name).toBe(p.team);
      expect(v.start).toBeGreaterThanOrEqual(8 * 60);
      expect(v.start).toBeLessThanOrEqual(17 * 60);
      expect(v.start % 30).toBe(0);
      expect(v).toMatchObject({ durationMin: 45, status: 'planned' });
    }
  });

  it('is deterministic and never puts more visits in a slot than the team has cars', () => {
    expect(buildVisits(pack.homePatients, pack.homeTeams, 20261104)).toEqual(pack.homeVisits);
    for (const team of pack.homeTeams) {
      const per = new Map<number, number>();
      for (const v of pack.homeVisits.filter((x) => x.teamId === team.id)) per.set(v.start, (per.get(v.start) ?? 0) + 1);
      expect(Math.max(0, ...per.values())).toBeLessThanOrEqual(team.cars);
    }
  });

  it('free slots are the 30-minute steps 08:00–18:00 a team has a car left in, from a given time', () => {
    const team = pack.homeTeams[0];
    expect(ALL_SLOTS[0]).toBe(480);
    expect(ALL_SLOTS.at(-1)).toBe(17 * 60 + 30);
    const mine = pack.homeVisits.filter((v) => v.teamId === team.id);
    const free = freeSlots(pack.homeVisits, team);
    for (const s of free) expect(mine.filter((v) => v.start === s).length).toBeLessThan(team.cars);
    expect(freeSlots([], team, 15 * 60)).toEqual(ALL_SLOTS.filter((s) => s >= 900));
    expect(freeSlots(pack.homeVisits.map((v) => ({ ...v, status: 'cancelled' as const })), team)).toEqual(ALL_SLOTS);
  });

  it('a visit reads as done when the clock has passed its end, and a sent team takes the visit over', () => {
    const v = pack.homeVisits[0];
    expect(visitStatusAt({ ...v, start: 480 }, 14 * 60 + 40)).toBe('done');
    expect(visitStatusAt({ ...v, start: 16 * 60 }, 14 * 60 + 40)).toBe('planned');
    expect(visitStatusAt({ ...v, start: 480, status: 'cancelled' }, 20 * 60)).toBe('cancelled');
    expect(effectiveVisits([v], { [v.patientId]: { assignedTeam: 'asih-syd' } })[0].teamId).toBe('asih-syd');
    expect(effectiveVisits([v], {})[0].teamId).toBe(v.teamId);
  });
});
