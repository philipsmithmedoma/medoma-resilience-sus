import { describe, expect, it } from 'vitest';
import { SUS_PACK, KAROLINSKA_PACK } from '@/test/packs';
import { homePacks } from '@/data/packs/home-packs';
import { NO_DISRUPTIONS, impact } from './reachability';
import { INITIAL_CLOCK } from './time';
import { addDays, buildCapacity, DEMO_DATE } from './capacity';

const visits = homePacks.sus.visits;
const base = { pack: SUS_PACK, visits, rows: [], disruptions: [], clock: INITIAL_CLOCK, prep: false };

describe('capacity (SPEC.md § 8)', () => {
  const days = buildCapacity(base);

  it('has seven days from today with the enrolled count and the number of shifts', () => {
    expect(days).toHaveLength(7);
    expect(days[0].date).toBe(DEMO_DATE);
    expect(days[6].date).toBe(addDays(DEMO_DATE, 6));
    expect(days[0].enrolled).toBe(200);
    expect(days[6].enrolled).toBeLessThan(200); // discharges are planned within three weeks
    // Per team and day: four nurses day, two evening, one night, one doctor day, eight hours each; two teams in SUS.
    expect(days[0].shifts).toBe(16);
    expect(days[0].cards.hours).toBe(16 * 8);
  });

  it('has rows per profession and shift with shifts and hours as specified', () => {
    const row = (p: string, s: string) => days[0].rows.find((r) => r.profession === p && r.shift === s)!;
    expect([row('nurse', 'day').shifts, row('nurse', 'evening').shifts, row('nurse', 'night').shifts]).toEqual([8, 4, 2]);
    expect([row('doctor', 'day').shifts, row('doctor', 'evening').shifts, row('doctor', 'night').shifts]).toEqual([2, 0, 0]);
    expect(row('nurse', 'day').hours).toBe(64);
    expect(row('doctor', 'night').visits).toEqual({ homeVisit: 0, clinicVisit: 0, video: 0, admin: 0, phone: 0 });
  });

  it('takes today\'s home visits from the visits of the pack, split at 15:00 between day and evening', () => {
    const home = days[0].rows.filter((r) => r.profession === 'nurse').reduce((n, r) => n + r.visits.homeVisit, 0);
    expect(home).toBe(visits.filter((v) => v.status !== 'cancelled').length);
    expect(days[0].cards.withVisit).toBe(SUS_PACK.homePatients.filter((p) => p.visitToday).length);
  });

  it('draws the other activities deterministically', () => {
    expect(buildCapacity(base)).toEqual(days);
    const a = days[0].cards.activities;
    for (const k of ['clinicVisit', 'video', 'admin', 'phone'] as const) expect(a[k], k).toBeGreaterThan(0);
  });

  it('adds nothing about disruptions in normal operation, and in preparedness mode the affected visits, the extra driving time and the covered days', () => {
    expect(days.every((d) => !d.disrupted && d.rows.every((r) => r.affected === 0 && r.extraMin === 0))).toBe(true);
    const dis = { ...NO_DISRUPTIONS, powerOutZones: new Set(['rosengard']), powerStart: new Map([['rosengard', INITIAL_CLOCK]]) };
    const rows = impact(SUS_PACK, dis, ['suslund', 'susmalmo'], null, INITIAL_CLOCK + 60).rows;
    const record = { id: 'hd-1', kind: 'power' as const, target: 'rosengard', targetKind: 'zone' as const, label: { sv: 'x', en: 'x' }, startedAt: INITIAL_CLOCK, expectedEnd: INITIAL_CLOCK + 1440 + 60, source: 'map' as const, createdBy: 'x', endedAt: null, endReason: null };
    const prep = buildCapacity({ ...base, rows, disruptions: [record], prep: true });
    expect(prep[0].cards.affectedVisits).toBe(visits.filter((v) => v.status !== 'cancelled' && rows.some((r) => r.affected && r.patient.id === v.patientId)).length);
    expect(prep[0].disrupted && prep[1].disrupted).toBe(true);
    expect(prep[2].disrupted).toBe(false);
    expect(KAROLINSKA_PACK.homeTeams).toHaveLength(4);
  });
});
