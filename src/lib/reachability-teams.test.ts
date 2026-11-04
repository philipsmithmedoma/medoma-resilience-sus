import { beforeAll, describe, expect, it } from 'vitest';
import { SUS_PACK as pack } from '@/test/packs';
import { NO_DISRUPTIONS, impact, teamDistances, type Disruptions } from './reachability';
import { loadRoadModel, type RoadModel } from './roadModel';

let model: RoadModel;
beforeAll(async () => {
  model = await loadRoadModel(pack);
});
const BOTH: string[] = ['suslund', 'susmalmo'];
const dis = (roads: string[]): Disruptions => ({ ...NO_DISRUPTIONS, blockedRoads: new Set(roads) });
/** The roads linking Lund and Malmö (DECISIONS.md entry 17). The real data has more links, so claims about this set alone are fixture-only. */
const CROSSINGS = ['E22'];
const inZone = (zone: string) => pack.homePatients.filter((p) => p.zone === zone);

describe('teams on the road graph (SPEC.md § 8)', () => {
  it('snaps every team base to the graph and teamDistances gives the baseline distances from it', () => {
    for (const team of pack.homeTeams) {
      expect(model.teams[team.id].unsnapped, team.id).toBe(false);
      const d = teamDistances(model.graph, team);
      expect(d).toEqual(model.teamBaseline().get(team.id));
      expect(d[model.teams[team.id].vertex]).toBe(0);
    }
  });

  it('a blocked road lengthens or removes distances from a base, never shortens them', () => {
    const team = pack.homeTeams[0];
    const flags = new Uint8Array(model.graph.ways.length);
    model.graph.ways.forEach((w, i) => (flags[i] = w.name === 'E22' ? 1 : 0));
    const open = teamDistances(model.graph, team);
    const closed = teamDistances(model.graph, team, flags);
    for (let v = 0; v < open.length; v++) expect(closed[v]).toBeGreaterThanOrEqual(open[v]);
  });

  it('at baseline the nearest team of a patient is the team of the area they live in', () => {
    const r = impact(pack, NO_DISRUPTIONS, BOTH, model);
    const share = (zone: string, team: string) => inZone(zone).filter((p) => r.teamReach.get(p.id)?.nearestTeam === team).length / inZone(zone).length;
    expect(share('lund', 'shh-lund')).toBeGreaterThanOrEqual(0.9);
    expect(share('eslov', 'shh-lund')).toBeGreaterThanOrEqual(0.9);
    expect(share('malmo', 'shh-malmo')).toBeGreaterThanOrEqual(0.9);
    expect(share('trelleborg', 'shh-malmo')).toBeGreaterThanOrEqual(0.9);
  });

  it('fixture: at baseline every patient has their own team as the nearest', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // on real roads a patient at the edge of an area can be nearer the other base
    const r = impact(pack, NO_DISRUPTIONS, BOTH, model);
    for (const p of pack.homePatients) expect(pack.homeTeams.find((t) => t.id === r.teamReach.get(p.id)?.nearestTeam)?.name, p.id).toBe(p.team);
  });

  it('at baseline at least 95 % of the patients are reached by at least one team, and nobody is reassigned', () => {
    const r = impact(pack, NO_DISRUPTIONS, BOTH, model);
    const reached = pack.homePatients.filter((p) => (r.teamReach.get(p.id)?.reachableBy.length ?? 0) > 0);
    expect(reached.length / pack.homePatients.length).toBeGreaterThanOrEqual(0.95);
    expect(r.summary.teamCannotReach).toBe(0);
    expect(r.reassignments).toEqual([]);
  });

  it('fixture: blocking the crossing set makes the Malmö-side patients reachable only by Sjukhus hemma Malmö', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // the real data has more links between the halves than the crossing set names
    const r = impact(pack, dis(CROSSINGS), BOTH, model);
    const malmoSide = pack.homePatients.filter((p) => p.team === 'Sjukhus hemma Malmö' && (r.teamReach.get(p.id)?.reachableBy.length ?? 0) > 0);
    expect(malmoSide.length).toBeGreaterThan(0);
    for (const p of malmoSide) {
      expect([...r.teamReach.get(p.id)!.reachableBy], p.id).toEqual(['shh-malmo']);
      expect(r.teamReach.get(p.id)!.nearestTeam).toBe('shh-malmo');
    }
  });

  it('counts the patients whose own team cannot reach them and those another team reaches, and suggests the nearest', () => {
    for (const roads of [CROSSINGS, ['Södra vägen'], ['Trafikplats Lund Södra'], ['Inre Ringvägen'], [...CROSSINGS, 'Väg 108']]) {
      const r = impact(pack, dis(roads), BOTH, model);
      const { teamCannotReach: n, teamReassignable: m } = r.summary;
      expect(m).toBeLessThanOrEqual(n);
      expect(r.reassignments).toHaveLength(m);
      for (const a of r.reassignments) {
        const reach = r.teamReach.get(a.patientId)!;
        expect(reach.reachableBy).toContain(a.toTeam);
        expect(reach.reachableBy).not.toContain(a.ownTeam);
        expect(a.toTeam).toBe(reach.nearestTeam);
        expect(pack.homePatients.find((p) => p.id === a.patientId)!.team).toBe(pack.homeTeams.find((x) => x.id === a.ownTeam)!.name);
      }
    }
  });

  it('fixture: closing Södra vägen cuts 30 patients off from their own team, and all 30 are reachable by another', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // the count belongs to the hand-written fixture, not to OpenStreetMap
    const r = impact(pack, dis(['Södra vägen']), BOTH, model);
    expect(r.summary).toMatchObject({ teamCannotReach: 30, teamReassignable: 30 });
  });

  it('rows carry reachableBy and nearestTeam, and teams are untouched by power and water outages', () => {
    const r = impact(pack, { ...NO_DISRUPTIONS, powerOutZones: new Set(['lund']) }, BOTH, model);
    const row = r.rows[0];
    expect(row.reachableBy?.length).toBeGreaterThan(0);
    expect(row.nearestTeam).toBe(r.teamReach.get(row.patient.id)!.nearestTeam);
    expect(r.summary.teamCannotReach).toBe(0);
  });
});
