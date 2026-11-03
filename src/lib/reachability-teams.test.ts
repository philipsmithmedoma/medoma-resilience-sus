import { beforeAll, describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { NO_DISRUPTIONS, impact, teamDistances, type Disruptions } from './reachability';
import { loadRoadModel, type RoadModel } from './roadModel';

let model: RoadModel;
beforeAll(async () => {
  model = await loadRoadModel(pack);
});
const BOTH: Array<'solna' | 'huddinge'> = ['solna', 'huddinge'];
const dis = (roads: string[]): Disruptions => ({ ...NO_DISRUPTIONS, blockedRoads: new Set(roads) });
const CROSSINGS = ['Essingeleden', 'Västerbron', 'Centralbron', 'Munkbroleden', 'Skeppsbron', 'Söderledstunneln', 'Katarinavägen', 'Stadsgårdsleden'];
const inZone = (zone: string) => pack.homePatients.filter((p) => p.zone === zone);

describe('teams on the road graph (SPEC.md § 14.2)', () => {
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
    model.graph.ways.forEach((w, i) => (flags[i] = w.name === 'Essingeleden' ? 1 : 0));
    const open = teamDistances(model.graph, team);
    const closed = teamDistances(model.graph, team, flags);
    for (let v = 0; v < open.length; v++) expect(closed[v]).toBeGreaterThanOrEqual(open[v]);
  });

  it('at baseline the nearest team of a patient is the team of the zone they live in (Solna, Innerstaden, Söderort, Botkyrka)', () => {
    const r = impact(pack, NO_DISRUPTIONS, BOTH, model);
    // The road graph has main roads only, so a base on a ramp can be far by road from a patient close by in a straight line:
    // the zone's own team is the nearest for most of its patients (all of Botkyrka), and never a team from the other side of the water.
    const share = (zone: string, team: string) => inZone(zone).filter((p) => r.teamReach.get(p.id)?.nearestTeam === team).length / inZone(zone).length;
    expect(share('solna', 'asih-nord')).toBeGreaterThanOrEqual(0.9);
    expect(share('innerstaden', 'asih-city')).toBeGreaterThanOrEqual(0.7);
    expect(share('botkyrka', 'asih-sydvast')).toBe(1);
    const nearest = (zone: string) => new Set(inZone(zone).map((p) => r.teamReach.get(p.id)?.nearestTeam));
    for (const t of nearest('soderort')) expect(['asih-city', 'asih-syd']).toContain(t);
    expect(nearest('soderort').has('asih-syd')).toBe(true);
  });

  it('at baseline at least 95 % of the patients are reached by at least one team, and nobody is reassigned', () => {
    const r = impact(pack, NO_DISRUPTIONS, BOTH, model);
    const reached = pack.homePatients.filter((p) => (r.teamReach.get(p.id)?.reachableBy.length ?? 0) > 0);
    expect(reached.length / pack.homePatients.length).toBeGreaterThanOrEqual(0.95);
    expect(r.summary.teamCannotReach).toBe(0);
    expect(r.reassignments).toEqual([]);
  });

  it('blocking the crossing set of § 12.4 makes the Söderort patients reachable only by ASIH Syd and ASIH Sydväst', () => {
    const r = impact(pack, dis(CROSSINGS), BOTH, model);
    // A patient on an Essingeleden ramp has no road left (main-road graph) and is reached by no team: the claim is about the others.
    const south = inZone('soderort').filter((p) => (r.teamReach.get(p.id)?.reachableBy.length ?? 0) > 0);
    expect(south.length).toBeGreaterThan(0);
    for (const p of south) expect([...r.teamReach.get(p.id)!.reachableBy].sort(), p.id).toEqual(['asih-syd', 'asih-sydvast']);
    // The nearest of the two is one of them, and the north teams cannot cross.
    for (const p of south) expect(['asih-syd', 'asih-sydvast']).toContain(r.teamReach.get(p.id)!.nearestTeam);
  });

  it('counts the patients whose own team cannot reach them and those another team reaches, and suggests the nearest', () => {
    for (const roads of [CROSSINGS, ['Essingeleden'], ['Södra länken'], [...CROSSINGS, 'Södra länken']]) {
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

  it('fixture: closing Solnavägen cuts 15 patients off from their own team, and all 15 are reachable by another', (ctx) => {
    if (model.source !== 'fixture') ctx.skip(); // the count belongs to the hand-written fixture, not to OpenStreetMap
    const r = impact(pack, dis(['Solnavägen']), BOTH, model);
    expect(r.summary).toMatchObject({ teamCannotReach: 15, teamReassignable: 15 });
  });

  it('rows carry reachableBy and nearestTeam, and teams are untouched by power and water outages', () => {
    const r = impact(pack, { ...NO_DISRUPTIONS, powerOutZones: new Set(['huddinge']) }, BOTH, model);
    const row = r.rows[0];
    expect(row.reachableBy?.length).toBeGreaterThan(0);
    expect(row.nearestTeam).toBe(r.teamReach.get(row.patient.id)!.nearestTeam);
    expect(r.summary.teamCannotReach).toBe(0);
  });
});
