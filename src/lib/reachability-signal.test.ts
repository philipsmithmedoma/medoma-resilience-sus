import { describe, expect, it } from 'vitest';
import type { HomePatient, HomeZone } from '@/data/types';
import { NO_DISRUPTIONS, impact, prioritise, supplyDaysLeft, type Disruptions } from './reachability';

const zone = (id: string, urban: boolean): HomeZone => ({ id, name: { sv: id, en: id }, lat: 55, lng: 13, radiusKm: 1, graphNode: `zone:${id}`, urban, coordConfidence: 'reported', coordSource: 'test' });
const patient = (id: string, o: Partial<HomePatient>): HomePatient => ({
  id, familyName: id, givenName: 'X', personalNumber: '19500101-0000', age: 60, zone: 'u', street: 'Gatan', houseNo: 1, lat: 55, lng: 13, team: 'T', equipment: [],
  batteryHours: null, backupHours: null, monitoringLevel: 'none', monitoringReason: null, antibiotic: null, heatSensitive: false, visitToday: false, elCritical: false,
  enrolledOn: '2026-09-01', plannedDischargeOn: '2026-09-20', appLoggedIn: true, ...o,
});
const kit = (id: string, reason: 'sepsis' | 'arrhythmia' | 'respiratory', zoneId = 'u') =>
  patient(id, { zone: zoneId, equipment: ['Self-monitoring kit'], batteryHours: 18, monitoringLevel: 'continuous', monitoringReason: reason });
const oxygen = (id: string, zoneId = 'u') => patient(id, { zone: zoneId, equipment: ['Oxygen stationary'], batteryHours: 0, backupHours: 8, elCritical: true });
const pump = (id: string, antibiotic: string, heatSensitive: boolean, zoneId = 'u') => patient(id, { zone: zoneId, equipment: ['Pump'], antibiotic, heatSensitive });

const START = 14 * 60;
const dis = (o: Partial<Disruptions>): Disruptions => ({ ...NO_DISRUPTIONS, ...o });
const outage = (zoneId: string, start = START) => ({ powerOutZones: new Set([zoneId]), powerStart: new Map([[zoneId, start]]) });

const pack = {
  homeZones: [zone('u', true), zone('r', false)],
  infraNodes: [],
  homeUnitStock: { infusorsDays: { value: 3, confidence: 'illustrative' as const } },
  homePatients: [
    oxygen('o1'), kit('k-arr', 'arrhythmia'), kit('k-sep', 'sepsis'), kit('k-resp', 'respiratory'), patient('plain', {}),
    kit('rk', 'sepsis', 'r'), pump('p-mero', 'meropenem', true), pump('p-cef', 'cefazolin', false), patient('old', { age: 85 }),
  ],
};
const ids = (r: ReturnType<typeof impact>) => prioritise(r.rows).map((x) => x.patient.id);

describe('monitoring-critical and power-critical (SPEC.md § 3, § 6)', () => {
  it('an hour into a power outage in an urban zone the continuous patients are out of contact and come before the oxygen patient with reserve', () => {
    const r = impact(pack, dis(outage('u')), ['s'], null, START + 60);
    const row = (id: string) => r.rows.find((x) => x.patient.id === id)!;
    expect(row('k-sep').noContact && row('k-sep').monitoringCritical).toBe(true);
    expect(row('o1').powerCritical).toBe(true);
    expect(row('o1').monitoringCritical).toBe(false);
    const order = ids(r);
    for (const k of ['k-sep', 'k-arr', 'k-resp']) expect(order.indexOf(k)).toBeLessThan(order.indexOf('o1'));
  });

  it('a patient with sepsis monitoring comes before one with rhythm monitoring, and both before respiratory', () => {
    const order = ids(impact(pack, dis(outage('u')), ['s'], null, START + 60));
    expect(order.indexOf('k-sep')).toBeLessThan(order.indexOf('k-arr'));
    expect(order.indexOf('k-arr')).toBeLessThan(order.indexOf('k-resp'));
  });

  it('before the network falls the oxygen patient is power-critical and the continuous patients are monitoring-critical within 2 h, behind the oxygen patient', () => {
    const r = impact(pack, dis(outage('u')), ['s'], null, START + 30);
    expect(r.summary.noContact).toBe(0);
    expect(r.summary.noContactSoon).toEqual({ patients: 8, minutes: 30 });
    expect(r.summary.monitoringCritical).toBe(3);
    expect(r.summary.powerCritical).toBe(1);
    const order = ids(r);
    expect(order.indexOf('o1')).toBeLessThan(order.indexOf('k-sep'));
  });

  it('counts the grounds apart and says which ground applies', () => {
    const r = impact(pack, dis(outage('u')), ['s'], null, START + 60);
    expect(r.rows.find((x) => x.patient.id === 'o1')!.grounds).toEqual(['power']);
    expect(r.rows.find((x) => x.patient.id === 'k-sep')!.grounds).toEqual(['monitoring']);
    expect(r.summary).toMatchObject({ powerCritical: 1, monitoringCritical: 3, noContact: 8 });
  });

  it('a rural zone keeps contact for 4 h and then loses it', () => {
    expect(impact(pack, dis(outage('r')), ['s'], null, START + 61).summary.noContact).toBe(0);
    expect(impact(pack, dis(outage('r')), ['s'], null, START + 240).summary.noContact).toBe(1);
  });

  it('a tele disturbance puts the zone out of contact at once, with no power outage', () => {
    const r = impact(pack, dis({ teleStart: new Map([['u', START]]) }), ['s'], null, START + 1);
    expect(r.summary.noContact).toBe(8);
    expect(r.rows.every((x) => x.reasons.includes('noContact') && !x.power)).toBe(true);
  });

  it('counts patients without contact in the last 30 minutes whether or not a disruption is registered', () => {
    const hidden = { ...NO_DISRUPTIONS, hiddenPower: new Map([['u', START]]) };
    expect(impact(pack, hidden, ['s'], null, START + 60 + 25).summary.silent30).toBe(0);
    expect(impact(pack, hidden, ['s'], null, START + 60 + 40).summary.silent30).toBe(8);
    expect(impact(pack, hidden, ['s'], null, START + 60 + 40).rows).toHaveLength(0); // nothing is registered, so no impact
  });
});

describe('heat and cold (SPEC.md § 6)', () => {
  const heat = (extra?: Map<string, number>) => dis({ heatStart: new Map([['u', START]]), heatExtraHours: extra });

  it('marks a heat-sensitive pump patient critical after 6 h and another pump patient after 12 h; 80 and older are affected at once', () => {
    const at = (h: number) => impact(pack, heat(), ['s'], null, START + h * 60);
    expect(at(5).rows.find((x) => x.patient.id === 'p-mero')).toBeUndefined();
    expect(at(6).rows.find((x) => x.patient.id === 'p-mero')!.critical).toBe(true);
    expect(at(6).rows.find((x) => x.patient.id === 'p-cef')).toBeUndefined();
    expect(at(12).rows.find((x) => x.patient.id === 'p-cef')!.grounds).toEqual(['heat']);
    const old = at(0).rows.find((x) => x.patient.id === 'old')!;
    expect(old.reasons).toContain('heat');
    expect(old.critical).toBe(false);
  });

  it('gives 12 h extra for Kylpåse or Kortare infusion', () => {
    const extra = new Map([['p-mero', 12]]);
    expect(impact(pack, heat(extra), ['s'], null, START + 6 * 60).rows.find((x) => x.patient.id === 'p-mero')).toBeUndefined();
    expect(impact(pack, heat(extra), ['s'], null, START + 18 * 60).rows.find((x) => x.patient.id === 'p-mero')!.critical).toBe(true);
  });

  it('applies cold only together with a power outage in the same zone, after 6 h, and makes 80 and older critical', () => {
    const coldOnly = dis({ coldStart: new Map([['u', START]]) });
    expect(impact(pack, coldOnly, ['s'], null, START + 8 * 60).rows.some((x) => x.cold)).toBe(false);
    const both = dis({ ...outage('u'), coldStart: new Map([['u', START]]) });
    expect(impact(pack, both, ['s'], null, START + 5 * 60).rows.some((x) => x.cold)).toBe(false);
    const r = impact(pack, both, ['s'], null, START + 6 * 60);
    expect(r.rows.filter((x) => x.cold)).toHaveLength(pack.homePatients.filter((p) => p.zone === 'u').length);
    expect(r.rows.find((x) => x.patient.id === 'old')!.grounds).toContain('cold');
    expect(r.rows.find((x) => x.patient.id === 'plain')!.critical).toBe(false);
  });
});

describe('the cold chain (SPEC.md § 6)', () => {
  it('counts the stock down from a supplier disruption or a cut-off site and marks every pump patient critical at zero', () => {
    const state = dis({ supplierStart: START });
    expect(supplyDaysLeft(state, 3, START + 1440)).toBe(2);
    expect(supplyDaysLeft(state, 3, START + 3 * 1440 + 10)).toBe(0);
    expect(supplyDaysLeft(dis({}), 3, START)).toBeNull();
    const before = impact(pack, state, ['s'], null, START + 2 * 1440);
    expect(before.summary.noPump).toBe(0);
    expect(before.summary.supplyDaysLeft).toBeCloseTo(1, 5);
    const after = impact(pack, state, ['s'], null, START + 3 * 1440);
    expect(after.summary.noPump).toBe(2);
    expect(after.rows.filter((x) => x.noPump).every((x) => x.grounds.includes('pump') && x.reasons.includes('noPump'))).toBe(true);
    expect(after.rows.some((x) => x.patient.equipment.length === 0)).toBe(false);
  });

  it('starts counting from the earliest of the two causes', () => {
    expect(supplyDaysLeft(dis({ supplierStart: START + 100, siteCutoffSince: START }), 3, START + 1440)).toBe(2);
  });
});
