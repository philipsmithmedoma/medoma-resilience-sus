import { beforeAll, describe, expect, it } from 'vitest';
import { SUS_PACK as pack } from '@/test/packs';
import type { HomePatient } from '@/data/types';
import { NO_DISRUPTIONS, disruptionCount, explainPath, impact, prioritise, priorityTier, type Disruptions, type ImpactRow } from './reachability';
import { loadRoadModel, type RoadModel } from './roadModel';

const set = (...ids: string[]) => new Set(ids);
const dis = (p: Partial<Disruptions>): Disruptions => ({ ...NO_DISRUPTIONS, ...p });

let model: RoadModel;
beforeAll(async () => {
  model = await loadRoadModel(pack);
});

const LUND: string[] = ['suslund'];
const MALMO: string[] = ['susmalmo'];
const BOTH: string[] = ['suslund', 'susmalmo'];
const inZones = (...zones: string[]) => pack.homePatients.filter((p) => zones.includes(p.zone));

/** Zones served by Sjukhus hemma Malmö, i.e. the far side of the Lund-Malmö link when seen from Lund. */
const MALMO_SIDE = ['malmo', 'limhamn', 'hyllie', 'rosengard', 'arlov', 'oxie', 'vellinge', 'svedala', 'trelleborg'];
/** Malmö-side zones that do not hang off the E22 link itself (Arlöv is reached by the E22 way from Lund Södra in the fixture). */
const MALMO_CORE = MALMO_SIDE.filter((z) => z !== 'arlov');
/** The roads linking Lund and Malmö (DECISIONS.md entry 17: the E22 way from Lund Södra to Arlöv). Real OpenStreetMap data has more links (E6, Väg 108 ...), so claims about this set alone are fixture-only. */
const CROSSINGS = ['E22'];

describe('the road model (SPEC.md § 5)', () => {
  it('attaches both sites to the graph and uses OSM data or the fixture', () => {
    expect(model.sites.suslund.unsnapped).toBe(false);
    expect(model.sites.susmalmo.unsnapped).toBe(false);
    expect(['osm', 'fixture']).toContain(model.source);
    expect(model.graph.vertexCount).toBeGreaterThan(50);
  });

  it('1. at baseline from Lund and from Malmö at least 95 % of patients snap within 1 500 m and have a path', () => {
    for (const scope of [LUND, MALMO]) {
      const base = model.baseline(scope);
      const ok = pack.homePatients.filter((p) => {
        const snap = model.patients.get(p.id)!;
        return !snap.unsnapped && snap.distance <= 1500 && Number.isFinite(base[snap.vertex]);
      });
      expect(ok.length / pack.homePatients.length, scope.join()).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('memoises the baseline per scope', () => {
    expect(model.baseline(LUND)).toBe(model.baseline(LUND));
    expect(model.baseline(BOTH)).not.toBe(model.baseline(LUND));
  });
});

describe('impact on the road graph (SPEC.md § 6)', () => {
  it('has no rows with nothing disrupted', () => {
    const r = impact(pack, NO_DISRUPTIONS, BOTH, model);
    expect(r.rows).toHaveLength(0);
    expect(r.summary).toMatchObject({ affected: 0, detour: 0, unreachable: 0, powerOut: 0, waterOut: 0, shortestBattery: null });
    expect(disruptionCount(NO_DISRUPTIONS)).toBe(0);
  });

  it('2. blocking every way named E22 leaves a patient in Lund reachable from Lund alone, without going via Malmö', () => {
    const state = dis({ blockedRoads: set('E22') });
    const reachable = inZones('lund').filter((p) => explainPath(pack, state, LUND, model, p) !== null);
    expect(reachable.length).toBeGreaterThan(0);
    // The scope is Lund only, so no path can start at Malmö; the paths use local roads.
    for (const p of reachable) expect(explainPath(pack, state, LUND, model, p)).not.toContain('E22');
    const r = impact(pack, state, LUND, model);
    const cut = r.rows.filter((x) => x.patient.zone === 'lund' && x.unreachable);
    expect(cut.length).toBeLessThan(inZones('lund').length);
  });

  it('2b. fixture: every Lund patient cut off by blocking E22 had E22 on the baseline path', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // path names depend on how the ways are named, which the fixture fixes
    const r = impact(pack, dis({ blockedRoads: set('E22') }), LUND, model);
    for (const x of r.rows.filter((y) => y.unreachable)) expect(explainPath(pack, NO_DISRUPTIONS, LUND, model, x.patient), x.patient.id).toContain('E22');
  });

  it('3. fixture: blocking the crossing set makes every patient on the Malmö side unreachable from Lund', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // the real data has more links between the halves than the crossing set names
    const state = dis({ blockedRoads: new Set(CROSSINGS) });
    const remaining = inZones(...MALMO_SIDE)
      .map((p) => ({ p, path: explainPath(pack, state, LUND, model, p) }))
      .filter((x) => x.path !== null);
    // A path that survives names the crossing the set is missing (print it, fail, extend the set in this test and in DECISIONS.md).
    const message = remaining.slice(0, 5).map((x) => `${x.p.id} (${x.p.zone}): ${x.path!.join(' → ')}`).join('\n');
    if (remaining.length) console.error(`Missing crossing(s); ways on the remaining path:\n${message}`);
    expect(remaining, message).toEqual([]);
    const r = impact(pack, state, LUND, model);
    for (const p of inZones(...MALMO_SIDE)) {
      const snap = model.patients.get(p.id)!;
      // A patient with no road within 1.5 km is unreachable by definition and is reported by the model, not as an effect.
      if (!snap.unsnapped) expect(r.rows.find((x) => x.patient.id === p.id)?.unreachable, p.id).toBe(true);
    }
  });

  it('4. fixture: the same crossing set leaves every Malmö, Limhamn, Hyllie and Rosengård patient reachable from Malmö', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // see 3
    const state = dis({ blockedRoads: new Set(CROSSINGS) });
    for (const p of inZones(...MALMO_CORE)) {
      const snap = model.patients.get(p.id)!;
      // A patient with no road vertex within 1.5 km (SPEC.md § 5) is unreachable by definition, with or without the set.
      if (snap.unsnapped) continue;
      expect(explainPath(pack, state, MALMO, model, p), p.id).not.toBeNull();
    }
    expect(impact(pack, state, MALMO, model).rows.filter((x) => MALMO_CORE.includes(x.patient.zone) && x.unreachable && !model.patients.get(x.patient.id)!.unsnapped)).toHaveLength(0);
  });

  it('5. a power outage in Dalby flags exactly the Dalby patients', () => {
    const dalbyIds = pack.homePatients.filter((p) => p.zone === 'dalby').map((p) => p.id);
    expect(dalbyIds.length).toBeGreaterThan(0);
    const r = impact(pack, dis({ powerOutZones: set('dalby') }), BOTH, model);
    expect(r.rows.map((x) => x.patient.id).sort()).toEqual([...dalbyIds].sort());
    expect(r.rows.every((x) => x.power && !x.unreachable && !x.delayed && x.reasons.join() === 'power')).toBe(true);
    expect(r.summary.affected).toBe(dalbyIds.length);
    expect(r.summary.powerOut).toBe(dalbyIds.length);
    const batteries = pack.homePatients.filter((p) => p.zone === 'dalby' && p.elCritical).map((p) => p.batteryHours! + (p.backupHours ?? 0));
    expect(r.summary.shortestBattery).toBe(batteries.length ? Math.min(...batteries) : null);
  });

  it('a water disruption is a boil-water advisory: it marks the zone and makes nobody critical', () => {
    const r = impact(pack, dis({ waterOutZones: set('lund') }), BOTH, model);
    expect(r.summary.waterOut).toBe(inZones('lund').length);
    expect(r.rows.every((x) => x.water && !x.critical)).toBe(true);
  });

  it('a closed junction node blocks the ways it names, and a closed way id blocks that way only', () => {
    const node = pack.infraNodes.find((n) => n.id === 'r-lund-s')!;
    const viaNode = impact(pack, dis({ blockedNodes: set(node.id) }), LUND, model);
    const viaName = impact(pack, dis({ blockedRoads: new Set(node.osmWayNames) }), LUND, model);
    expect(viaNode.summary).toEqual(viaName.summary);
    const way = model.graph.ways.find((w) => w.name === node.osmWayNames![0]);
    if (way) {
      const one = impact(pack, dis({ blockedWays: set(String(way.id)) }), LUND, model);
      expect(one.summary.affected).toBeLessThanOrEqual(viaName.summary.affected);
    }
  });

  it('6. fixture: closing Södra vägen with both sites in scope turns 30 patients into detours and leaves nobody unreachable', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // the count belongs to the hand-written fixture
    // The fixture's Södra vägen is the link between Lund and the E22; with it closed the patients behind it get a longer route.
    const r = impact(pack, dis({ blockedRoads: set('Södra vägen') }), BOTH, model);
    expect(r.summary).toMatchObject({ detour: 30, unreachable: 0 });
    expect(r.rows.filter((x) => x.delayed).every((x) => x.reasons.includes('detour'))).toBe(true);
    expect(r.summary.affected).toBe(r.rows.filter((x) => x.affected).length);
  });

  it('gives every delayed patient extraKm = the shortest path now minus the baseline, and the summary the median and the maximum', () => {
    for (const roads of [['Södra vägen'], ['Entrégatan'], ['Inre Ringvägen'], ['E22']]) {
      const state = dis({ blockedRoads: new Set(roads) });
      const r = impact(pack, state, BOTH, model);
      const delayed = r.rows.filter((x) => x.delayed);
      for (const row of delayed) {
        expect(Number.isInteger(row.extraKm)).toBe(true);
        expect(row.extraKm!).toBeGreaterThanOrEqual(0);
        expect(r.rows.find((x) => x.patient.id === row.patient.id)!.reasons).toContain('detour');
      }
      if (!delayed.length) {
        expect(r.summary).toMatchObject({ medianExtraKm: null, maxExtraKm: null });
        continue;
      }
      const km = delayed.map((x) => x.extraKm!).sort((a, b) => a - b);
      expect(r.summary.maxExtraKm).toBe(km[km.length - 1]);
      expect(r.summary.medianExtraKm).toBe(km.length % 2 ? km[km.length >> 1] : Math.round((km[(km.length >> 1) - 1] + km[km.length >> 1]) / 2));
    }
    expect(impact(pack, dis({}), BOTH, model).summary).toMatchObject({ medianExtraKm: null, maxExtraKm: null });
  });

  it('7. fixture: the detour from closing Södra vägen is positive for every delayed patient', (ctx) => {
    if (model.source !== 'fixture') ctx.skip();
    const r = impact(pack, dis({ blockedRoads: set('Södra vägen') }), BOTH, model);
    const delayed = r.rows.filter((x) => x.delayed);
    expect(delayed.length).toBeGreaterThan(0);
    expect(delayed.every((x) => x.extraKm! > 0)).toBe(true);
    expect(r.summary.maxExtraKm).toBeGreaterThan(0);
  });

  it('uses every site of the road model when the scope yields none, and answers without a model for power and water only', () => {
    const d = dis({ blockedRoads: set('E22') });
    expect(impact(pack, d, [], model).summary).toEqual(impact(pack, d, BOTH, model).summary);
    expect(impact(pack, d, BOTH, null).rows).toHaveLength(0);
    expect(impact(pack, dis({ powerOutZones: set('hyllie') }), BOTH, null).rows).toHaveLength(inZones('hyllie').length);
  });
});

describe('prioritise (SPEC.md § 6)', () => {
  const patient = (id: string, o: Partial<HomePatient>): HomePatient => ({
    id, familyName: id, givenName: 'X', personalNumber: '19500101-0000', age: 70, zone: 'lund', street: 'Gatan', houseNo: 1, lat: 0, lng: 0, team: 'Sjukhus hemma Lund', equipment: [],
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
