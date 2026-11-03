import { beforeAll, describe, expect, it } from 'vitest';
import { SUS_PACK as pack, resetStoreTo } from '@/test/packs';
import { useStore } from '@/data/store';
import { NO_DISRUPTIONS, impact, type Disruptions } from './reachability';
import { loadRoadModel, type RoadModel } from './roadModel';
import { waysNearPoint } from './roadGraph';

let model: RoadModel;
beforeAll(async () => {
  resetStoreTo('sus');
  model = await loadRoadModel(pack);
  useStore.getState().setHomeGeoReady();
});

const LUND = ['suslund'];
const BOTH = ['suslund', 'susmalmo'];
const dis = (p: Partial<Disruptions>): Disruptions => ({ ...NO_DISRUPTIONS, ...p });

describe('reachability in the SUS pack (SPEC.md § 5, DATA.md § 3)', () => {
  it('attaches both sites to the graph', () => {
    expect(model.sites.suslund.unsnapped).toBe(false);
    expect(model.sites.susmalmo.unsnapped).toBe(false);
    expect(['osm', 'fixture']).toContain(model.source);
  });

  it('at baseline at least 95 % of the patients snap within 1 500 m and have a path from Lund or Malmö', () => {
    const lund = model.baseline(LUND);
    const malmo = model.baseline(['susmalmo']);
    const ok = pack.homePatients.filter((p) => {
      const snap = model.patients.get(p.id)!;
      return !snap.unsnapped && (Number.isFinite(lund[snap.vertex]) || Number.isFinite(malmo[snap.vertex]));
    });
    expect(ok.length / pack.homePatients.length).toBeGreaterThanOrEqual(0.95);
  });

  it('a power outage in Rosengård flags exactly the Rosengård patients', () => {
    const ids = pack.homePatients.filter((p) => p.zone === 'rosengard').map((p) => p.id);
    const r = impact(pack, dis({ powerOutZones: new Set(['rosengard']), powerStart: new Map([['rosengard', 880]]) }), BOTH, model);
    expect(r.rows.map((x) => x.patient.id).sort()).toEqual([...ids].sort());
    expect(r.summary.affected).toBe(15);
    expect(r.rows.every((x) => x.reasons.join() === 'power')).toBe(true);
  });

  it('closing the ways within 300 m of the node Tpl Lund Södra makes Staffanstorp delayed or unreachable from Lund', () => {
    const node = pack.infraNodes.find((n) => n.id === 'r-lund-s')!;
    const near = waysNearPoint(model.graph, node.lat, node.lng, 300).map((i) => String(model.graph.ways[i].id));
    expect(near.length).toBeGreaterThan(0);
    const r = impact(pack, dis({ blockedWays: new Set(near) }), LUND, model);
    const staff = r.rows.filter((x) => x.patient.zone === 'staffanstorp');
    const reachable = pack.homePatients.filter((p) => p.zone === 'staffanstorp' && !model.patients.get(p.id)!.unsnapped);
    expect(reachable.length).toBeGreaterThan(0);
    expect(staff.length).toBe(reachable.length);
    expect(staff.every((x) => x.unreachable || x.delayed)).toBe(true);
  });

  it('keeps Staffanstorp reachable from Lund by way of Malmö only when the scope has both sites and the link exists', () => {
    // The road link between the halves also leaves Lund Södra, so closing it isolates Staffanstorp from both sites.
    const node = pack.infraNodes.find((n) => n.id === 'r-lund-s')!;
    const near = waysNearPoint(model.graph, node.lat, node.lng, 300).map((i) => String(model.graph.ways[i].id));
    const r = impact(pack, dis({ blockedWays: new Set(near) }), BOTH, model);
    expect(r.rows.filter((x) => x.patient.zone === 'staffanstorp').every((x) => x.unreachable || x.delayed)).toBe(true);
  });
});
