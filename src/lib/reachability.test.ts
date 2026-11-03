import { beforeAll, describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import type { HomePatient } from '@/data/types';
import { NO_DISRUPTIONS, disruptionCount, explainPath, impact, prioritise, priorityTier, type Disruptions, type ImpactRow } from './reachability';
import { loadRoadModel, type RoadModel } from './roadModel';

const set = (...ids: string[]) => new Set(ids);
const dis = (p: Partial<Disruptions>): Disruptions => ({ ...NO_DISRUPTIONS, ...p });

let model: RoadModel;
beforeAll(async () => {
  model = await loadRoadModel(pack);
});

const SOLNA: string[] = ['solna'];
const HUDDINGE: string[] = ['huddinge'];
const BOTH: string[] = ['solna', 'huddinge'];
const inZones = (...zones: string[]) => pack.homePatients.filter((p) => zones.includes(p.zone));

/** SPEC.md § 12.4 test 3: every way with these names. A missing crossing found by the real data is added here and in DECISIONS.md. */
const CROSSINGS = ['Essingeleden', 'Västerbron', 'Centralbron', 'Munkbroleden', 'Skeppsbron', 'Söderledstunneln', 'Katarinavägen', 'Stadsgårdsleden'];
const SOUTH = ['sodermalm', 'soderort', 'huddinge', 'botkyrka', 'nacka'];

describe('the road model (SPEC.md § 12.3)', () => {
  it('attaches both sites to the graph and uses OSM data or the fixture', () => {
    expect(model.sites.solna.unsnapped).toBe(false);
    expect(model.sites.huddinge.unsnapped).toBe(false);
    expect(['osm', 'fixture']).toContain(model.source);
    expect(model.graph.vertexCount).toBeGreaterThan(50);
  });

  it('1. at baseline from Solna and from Huddinge at least 95 % of patients snap within 1 500 m and have a path', () => {
    for (const scope of [SOLNA, HUDDINGE]) {
      const base = model.baseline(scope);
      const ok = pack.homePatients.filter((p) => {
        const snap = model.patients.get(p.id)!;
        return !snap.unsnapped && snap.distance <= 1500 && Number.isFinite(base[snap.vertex]);
      });
      expect(ok.length / pack.homePatients.length, scope.join()).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('memoises the baseline per scope', () => {
    expect(model.baseline(SOLNA)).toBe(model.baseline(SOLNA));
    expect(model.baseline(BOTH)).not.toBe(model.baseline(SOLNA));
  });
});

describe('impact on the real graph (SPEC.md § 12.4)', () => {
  it('has no rows with nothing disrupted', () => {
    const r = impact(pack, NO_DISRUPTIONS, BOTH, model);
    expect(r.rows).toHaveLength(0);
    expect(r.summary).toMatchObject({ affected: 0, detour: 0, unreachable: 0, powerOut: 0, waterOut: 0, shortestBattery: null });
    expect(disruptionCount(NO_DISRUPTIONS)).toBe(0);
  });

  it('2. blocking every way named Essingeleden leaves a patient in Söderort reachable from Solna alone, without going via Huddinge', () => {
    const state = dis({ blockedRoads: set('Essingeleden') });
    const reachable = inZones('soderort').filter((p) => explainPath(pack, state, SOLNA, model, p) !== null);
    expect(reachable.length).toBeGreaterThan(0);
    // The scope is Solna only, so no path can start at Huddinge; the paths use another crossing.
    for (const p of reachable) expect(explainPath(pack, state, SOLNA, model, p)).not.toContain('Essingeleden');
    // The main-road graph has no local streets, so a patient who lives on an Essingeleden ramp is cut off with it. Everybody else
    // in Söderort stays reachable: every Söderort row that is `unreachable` is a patient whose baseline path used Essingeleden.
    const r = impact(pack, state, SOLNA, model);
    const cut = r.rows.filter((x) => x.patient.zone === 'soderort' && x.unreachable);
    for (const x of cut) expect(explainPath(pack, NO_DISRUPTIONS, SOLNA, model, x.patient), x.patient.id).toContain('Essingeleden');
    expect(cut.length).toBeLessThan(inZones('soderort').length);
  });

  it('3. blocking the crossing set makes every patient in Södermalm, Söderort, Huddinge, Botkyrka and Nacka unreachable from Solna', () => {
    const state = dis({ blockedRoads: new Set(CROSSINGS) });
    const remaining = inZones(...SOUTH)
      .map((p) => ({ p, path: explainPath(pack, state, SOLNA, model, p) }))
      .filter((x) => x.path !== null);
    // A path that survives names the crossing the set is missing (print it, fail, extend the set in this test and in DECISIONS.md).
    const message = remaining.slice(0, 5).map((x) => `${x.p.id} (${x.p.zone}): ${x.path!.join(' → ')}`).join('\n');
    if (remaining.length) console.error(`Missing crossing(s); ways on the remaining path:\n${message}`);
    expect(remaining, message).toEqual([]);
    const r = impact(pack, state, SOLNA, model);
    for (const p of inZones(...SOUTH)) {
      const snap = model.patients.get(p.id)!;
      // A patient with no road within 1.5 km is unreachable by definition and is reported by the model, not as an effect.
      if (!snap.unsnapped) expect(r.rows.find((x) => x.patient.id === p.id)?.unreachable, p.id).toBe(true);
    }
  });

  it('4. the same crossing set leaves every patient in Huddinge and Botkyrka reachable from Huddinge', () => {
    const state = dis({ blockedRoads: new Set(CROSSINGS) });
    for (const p of inZones('huddinge', 'botkyrka')) {
      const snap = model.patients.get(p.id)!;
      // A patient with no road vertex within 1.5 km (SPEC.md § 12.3) is unreachable by definition, with or without the set.
      if (snap.unsnapped) continue;
      expect(explainPath(pack, state, HUDDINGE, model, p), p.id).not.toBeNull();
    }
    expect(impact(pack, state, HUDDINGE, model).rows.filter((x) => ['huddinge', 'botkyrka'].includes(x.patient.zone) && x.unreachable && !model.patients.get(x.patient.id)!.unsnapped)).toHaveLength(0);
  });

  it('5. a power outage in Huddinge flags exactly the Huddinge patients', () => {
    const huddingeIds = pack.homePatients.filter((p) => p.zone === 'huddinge').map((p) => p.id);
    const r = impact(pack, dis({ powerOutZones: set('huddinge') }), BOTH, model);
    expect(r.rows.map((x) => x.patient.id).sort()).toEqual([...huddingeIds].sort());
    expect(r.rows.every((x) => x.power && !x.unreachable && !x.delayed && x.reasons.join() === 'power')).toBe(true);
    expect(r.summary.affected).toBe(20);
    expect(r.summary.powerOut).toBe(20);
    const batteries = pack.homePatients.filter((p) => p.zone === 'huddinge' && p.elCritical).map((p) => p.batteryHours! + (p.backupHours ?? 0));
    expect(r.summary.shortestBattery).toBe(batteries.length ? Math.min(...batteries) : null);
  });

  it('a water disruption is a boil-water advisory: it marks the zone and makes nobody critical', () => {
    const r = impact(pack, dis({ waterOutZones: set('solna') }), BOTH, model);
    expect(r.summary.waterOut).toBe(25);
    expect(r.rows.every((x) => x.water && !x.critical)).toBe(true);
  });

  it('a closed bridge node blocks the ways it names, and a closed way id blocks that way only', () => {
    const viaNode = impact(pack, dis({ blockedNodes: set('r-essingeleden') }), SOLNA, model);
    const viaName = impact(pack, dis({ blockedRoads: set('Essingeleden') }), SOLNA, model);
    expect(viaNode.summary).toEqual(viaName.summary);
    const ess = model.graph.ways.find((w) => w.name === 'Essingeleden')!;
    const one = impact(pack, dis({ blockedWays: set(String(ess.id)) }), SOLNA, model);
    expect(one.summary.affected).toBeLessThanOrEqual(viaName.summary.affected + 0);
  });

  it('marks a longer route as a detour (25 % or 3 km longer) and counts it apart from the affected', () => {
    // Closing Centralbron forces the traffic from Solna to the inner city onto a longer way round (Norra länken has parallel roads: no patient is delayed by it).
    const r = impact(pack, dis({ blockedRoads: set('Centralbron') }), SOLNA, model);
    expect(r.summary.detour).toBeGreaterThan(0);
    expect(r.rows.filter((x) => x.delayed).every((x) => x.reasons.includes('detour'))).toBe(true);
    expect(r.summary.affected).toBe(r.rows.filter((x) => x.affected).length);
  });

  it('uses both sites when the scope yields none, and answers without a model for power and water only', () => {
    const d = dis({ blockedRoads: set('Essingeleden') });
    expect(impact(pack, d, [], model).summary).toEqual(impact(pack, d, BOTH, model).summary);
    expect(impact(pack, d, BOTH, null).rows).toHaveLength(0);
    expect(impact(pack, dis({ powerOutZones: set('taby') }), BOTH, null).rows).toHaveLength(10);
  });
});

describe('prioritise (SPEC.md § 6)', () => {
  const patient = (id: string, o: Partial<HomePatient>): HomePatient => ({
    id, familyName: id, givenName: 'X', personalNumber: '19500101-0000', age: 70, zone: 'solna', street: 'Gatan', houseNo: 1, lat: 0, lng: 0, team: 'ASIH Nord', equipment: [],
    batteryHours: null, backupHours: null, monitoringLevel: 'none', monitoringReason: null, antibiotic: null, heatSensitive: false, visitToday: false, elCritical: false,
    enrolledOn: '2026-09-01', plannedDischargeOn: '2026-09-20', appLoggedIn: true, ...o,
  });
  const row = (id: string, o: Partial<HomePatient>, f: Partial<ImpactRow>): ImpactRow => ({
    patient: patient(id, o), reasons: [], unreachable: false, delayed: false, power: false, water: false, noContact: false, noContactAt: null, heat: false, cold: false, noPump: false,
    affected: true, grounds: [], critical: false, powerCritical: false, monitoringCritical: false, ...f,
  });

  it('orders unreachable with a visit, monitoring-critical out of contact, power-critical, monitoring-critical soon, other critical, other affected, detour', () => {
    const rows = [
      row('detour', {}, { delayed: true, affected: false }),
      row('plain', {}, { power: true }),
      row('heat', {}, { heat: true, critical: true, grounds: ['heat'] }),
      row('soon', { monitoringLevel: 'continuous', monitoringReason: 'sepsis' }, { monitoringCritical: true, critical: true, grounds: ['monitoring'], noContactAt: 900 }),
      row('power-9h', { elCritical: true, batteryHours: 9 }, { power: true, powerCritical: true, critical: true, grounds: ['power'], batteryEmptyAt: 900 }),
      row('power-3h', { elCritical: true, batteryHours: 3 }, { power: true, powerCritical: true, critical: true, grounds: ['power'], batteryEmptyAt: 700 }),
      row('dark-rhythm', { monitoringLevel: 'continuous', monitoringReason: 'arrhythmia' }, { noContact: true, monitoringCritical: true, critical: true, grounds: ['monitoring'], noContactAt: 600 }),
      row('dark-sepsis', { monitoringLevel: 'continuous', monitoringReason: 'sepsis' }, { noContact: true, monitoringCritical: true, critical: true, grounds: ['monitoring'], noContactAt: 650 }),
      row('unreach-visit', { visitToday: true }, { unreachable: true }),
    ];
    expect(prioritise(rows).map((r) => r.patient.id)).toEqual(['unreach-visit', 'dark-sepsis', 'dark-rhythm', 'power-3h', 'power-9h', 'soon', 'heat', 'plain', 'detour']);
    expect(prioritise(rows).map(priorityTier)).toEqual([1, 2, 2, 3, 3, 4, 5, 6, 7]);
  });

  it('breaks ties by battery plus reserve ascending, a missing battery last, and does not change its input', () => {
    const rows = [
      row('b', { visitToday: true, batteryHours: 8 }, { unreachable: true }),
      row('a', { visitToday: true, batteryHours: 2, backupHours: 2 }, { unreachable: true }),
      row('c', { visitToday: true, batteryHours: null }, { unreachable: true }),
    ];
    expect(prioritise(rows).map((r) => r.patient.id)).toEqual(['a', 'b', 'c']);
    expect(rows.map((r) => r.patient.id)).toEqual(['b', 'a', 'c']);
  });
});
