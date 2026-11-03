// The road graph with the two sites and the patients attached (SPEC.md § 12.3), built once per pack load.
import type { DataPack, HomePackId, HomePatient, HomeTeam, TeamId } from '@/data/types';
import { homePackIdOf, homePacks } from '@/data/packs/home-packs';
import { buildRoadGraph, dijkstra, snapToGraph, type RoadCollection, type RoadGraph, type Snap } from './roadGraph';
import { loadGeoData, type GeoData } from './geoData';

export interface RoadModel {
  graph: RoadGraph;
  /** Where each site attaches to the graph (a site beyond 1 500 m gets no source). */
  sites: Record<string, Snap>;
  /** Where each patient attaches; `unsnapped` patients have no road within 1.5 km. */
  patients: Map<string, Snap>;
  /** Where each team's base attaches (SPEC.md § 14.2); a base beyond 1 500 m reaches nobody. */
  teams: Record<TeamId, Snap>;
  /** Distances from every team's base with nothing blocked, computed once. */
  teamBaseline: () => Map<TeamId, Float64Array>;
  /** Distances with nothing blocked from the sites in scope, computed once per scope and memoised. */
  baseline: (scope: string[]) => Float64Array;
  source: GeoData['source']['roads'];
}

type SitePoint = { id: string; lat: number; lng: number };

export function buildRoadModel(
  roads: RoadCollection,
  sites: SitePoint[],
  patients: Array<Pick<HomePatient, 'id' | 'lat' | 'lng'>>,
  source: RoadModel['source'] = 'osm',
  teams: Array<Pick<HomeTeam, 'id' | 'baseLat' | 'baseLng'>> = [],
): RoadModel {
  const graph = buildRoadGraph(roads);
  const siteSnap: Record<string, Snap> = {};
  for (const s of sites) siteSnap[s.id] = snapToGraph(graph, s.lat, s.lng);
  const patientSnap = new Map<string, Snap>();
  for (const p of patients) patientSnap.set(p.id, snapToGraph(graph, p.lat, p.lng));
  const teamSnap: Record<TeamId, Snap> = {};
  for (const tm of teams) teamSnap[tm.id] = snapToGraph(graph, tm.baseLat, tm.baseLng);
  let teamMemo: Map<TeamId, Float64Array> | null = null;
  const memo = new Map<string, Float64Array>();
  const model: RoadModel = {
    graph,
    sites: siteSnap,
    patients: patientSnap,
    teams: teamSnap,
    teamBaseline: () => {
      teamMemo ??= new Map(teams.map((tm) => [tm.id, teamDistancesFrom(graph, teamSnap[tm.id])]));
      return teamMemo;
    },
    source,
    baseline: (scope) => {
      const key = [...scope].sort().join(',');
      let d = memo.get(key);
      if (!d) {
        d = dijkstra(graph, sourceVertices(model, scope)).dist;
        memo.set(key, d);
      }
      return d;
    },
  };
  return model;
}

/** Distances in metres from a team base's snap over the graph, nothing blocked unless flags are given; all Infinity when the base has no road. */
export function teamDistancesFrom(graph: RoadGraph, snap: Snap | undefined, blocked?: Uint8Array): Float64Array {
  if (!snap || snap.unsnapped) return new Float64Array(graph.vertexCount).fill(Infinity);
  return dijkstra(graph, [snap.vertex], blocked).dist;
}

/** Graph vertices the sites in scope attach to; a site with no road within 1.5 km contributes none. */
export function sourceVertices(model: Pick<RoadModel, 'sites'>, scope: string[]): number[] {
  return scope.map((s) => model.sites[s]).filter((s) => s && !s.unsnapped).map((s) => s.vertex);
}

const models = new Map<HomePackId, RoadModel>();
const loads = new Map<HomePackId, Promise<RoadModel>>();
let activeId: HomePackId = 'karolinska';

/** The pack whose model `getRoadModel` returns: the one the store has switched to (SPEC.md § 14.5). */
export function setActiveRoadPack(id: HomePackId): void {
  activeId = id;
}

/** The loaded model of the active home pack, or null before `loadRoadModel` has finished for it. */
export const getRoadModel = (): RoadModel | null => models.get(activeId) ?? null;

type ModelPack = Pick<DataPack, 'homePatients'> & Partial<Pick<DataPack, 'homeTeams' | 'homePackId'>>;

/** Loads the geometry (dynamic import) and builds the model of the pack once. */
export function loadRoadModel(pack: ModelPack): Promise<RoadModel> {
  const id = homePackIdOf(pack);
  let loading = loads.get(id);
  if (!loading) {
    loading = loadGeoData(id).then((geo) => {
      const model = buildRoadModel(geo.roads, homePacks[id].sites, pack.homePatients, geo.source.roads, pack.homeTeams);
      models.set(id, model);
      return model;
    });
    loads.set(id, loading);
  }
  return loading;
}
