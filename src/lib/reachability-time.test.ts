import { beforeAll, describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { NO_DISRUPTIONS, impact, prioritise, priorityTier, type Disruptions, type ImpactRow } from './reachability';
import { loadRoadModel, type RoadModel } from './roadModel';

let model: RoadModel;
beforeAll(async () => {
  model = await loadRoadModel(pack);
});
const BOTH: string[] = ['solna', 'huddinge'];
const power = (start: number): Disruptions => ({ ...NO_DISRUPTIONS, powerOutZones: new Set(['huddinge']), powerStart: new Map([['huddinge', start]]) });

describe('battery deadlines in impact (SPEC.md § 13.2)', () => {
  const START = 14 * 60 + 40;

  it('puts batteryEmptyAt = start + hours × 60 on every power-out row with a battery', () => {
    const r = impact(pack, power(START), BOTH, model, START);
    const withBattery = r.rows.filter((x) => x.patient.batteryHours !== null);
    expect(withBattery.length).toBeGreaterThan(0);
    for (const row of withBattery) expect(row.batteryEmptyAt).toBe(START + row.patient.batteryHours! * 60);
    for (const row of r.rows.filter((x) => x.patient.batteryHours === null)) expect(row.batteryEmptyAt).toBeNull();
    expect(r.rows.every((x) => !x.batteryEmpty)).toBe(true);
  });

  it('rows whose clock has passed the deadline are battery empty and critical whatever the equipment', () => {
    const rows = impact(pack, power(START), BOTH, model, START).rows;
    const monitoring = rows.find((x) => !x.patient.elCritical && x.patient.batteryHours !== null)!;
    expect(monitoring.critical).toBe(false);
    const late = impact(pack, power(START), BOTH, model, monitoring.batteryEmptyAt!).rows.find((x) => x.patient.id === monitoring.patient.id)!;
    expect(late.batteryEmpty).toBe(true);
    expect(late.critical).toBe(true);
    expect(priorityTier(late)).toBe(2);
  });

  it('counts the patients that run out within 2 h, the empty ones included, and finds the first deadline', () => {
    const base = impact(pack, power(START), BOTH, model, START);
    const hours = base.rows.map((x) => x.patient.batteryHours).filter((h): h is number => h !== null);
    const first = Math.min(...hours);
    expect(base.summary.earliestBatteryEmptyAt).toBe(START + first * 60);
    const within = (clock: number) => hours.filter((h) => START + h * 60 <= clock + 120).length;
    expect(base.summary.runOutWithin2h).toBe(within(START));
    const later = impact(pack, power(START), BOTH, model, START + 180);
    expect(later.summary.runOutWithin2h).toBe(within(START + 180));
    expect(later.summary.batteryEmpty).toBe(hours.filter((h) => h * 60 <= 180).length);
  });

  it('has no battery figures without a clock or a start time (pure callers keep working)', () => {
    const none = impact(pack, { ...NO_DISRUPTIONS, powerOutZones: new Set(['huddinge']) }, BOTH, model);
    expect(none.rows.every((x) => x.batteryEmptyAt === null)).toBe(true);
    expect(none.summary.runOutWithin2h).toBe(0);
  });
});

describe('prioritise by batteryEmptyAt (SPEC.md § 13.2)', () => {
  const patient = (id: string, hours: number) => ({
    id, familyName: id, givenName: 'X', age: 70, zone: 'huddinge', street: 'Gatan', houseNo: 1, lat: 0, lng: 0, team: 'ASIH Syd', equipment: [], batteryHours: hours,
    visitToday: false, elCritical: true, waterCritical: false,
  });
  const row = (id: string, hours: number, emptyAt: number | null): ImpactRow => ({
    patient: patient(id, hours), reasons: ['power'], unreachable: false, delayed: false, power: true, water: false, affected: true, critical: true, batteryEmptyAt: emptyAt,
  });

  it('orders power-out rows by the deadline, not by battery hours', () => {
    // b has more battery hours but its disruption started earlier, so it runs out first.
    const rows = [row('a', 3, 1000 + 180), row('b', 6, 700 + 360), row('c', 2, 2000 + 120)];
    expect(prioritise(rows).map((r) => r.patient.id)).toEqual(['b', 'a', 'c']);
  });
});
