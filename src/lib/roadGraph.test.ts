import { describe, expect, it } from 'vitest';
import { blockedWayFlags, buildRoadGraph, dijkstra, haversineM, pathWayNames, roadKey, snapToGraph, type LngLat, type RoadCollection } from './roadGraph';

const way = (id: number, name: string | null, points: LngLat[], o: Partial<{ ref: string | null; oneway: boolean; bridge: boolean }> = {}) => ({
  type: 'Feature' as const,
  properties: { id, highway: 'primary', name, ref: o.ref ?? null, bridge: o.bridge ?? false, tunnel: false, oneway: o.oneway ?? false, lanes: null },
  geometry: { type: 'LineString' as const, coordinates: points },
});

// A —1— B —2— C, with a second way 3 from B to D and a one-way way 4 from C back to A.
const A: LngLat = [18.0, 59.3];
const B: LngLat = [18.01, 59.3];
const C: LngLat = [18.02, 59.3];
const D: LngLat = [18.01, 59.31];
const mid: LngLat = [18.005, 59.3]; // an interior point of way 1: not a vertex
const roads: RoadCollection = {
  type: 'FeatureCollection',
  features: [
    way(1, 'Västra vägen', [A, mid, B]),
    way(2, 'Östra vägen', [B, C], { ref: 'E4' }),
    way(3, 'Västra vägen', [B, D], { ref: 'E20' }),
    way(4, 'Enkelriktad', [C, [18.02, 59.31], A], { oneway: true }),
  ],
};

describe('buildRoadGraph (SPEC.md § 12.3)', () => {
  const g = buildRoadGraph(roads);
  it('makes a vertex of every shared coordinate and every way end, and not of an interior point', () => {
    // A, B, C and D; `mid` (way 1) and [18.02, 59.31] (way 4) are interior points of one way.
    expect(g.vertexCount).toBe(4);
    expect([...g.lat].some((lat, i) => lat === mid[1] && g.lng[i] === mid[0])).toBe(false);
  });

  it('weights an edge by the haversine length of the whole segment, interior points included', () => {
    const e = [...g.edgeLen].find((_, i) => g.ways[g.edgeWay[i]].id === 1)!;
    expect(e).toBeCloseTo(haversineM(59.3, 18.0, 59.3, 18.01), 0);
  });

  it('gives two directed edges to a two-way way and one to a one-way way', () => {
    const count = (id: number) => [...g.edgeWay].filter((w) => g.ways[w].id === id).length;
    expect(count(1)).toBe(2);
    expect(count(2)).toBe(2);
    expect(count(4)).toBe(1); // C → A only
    const from = (id: number) => [...g.edgeWay].map((w, i) => [g.ways[w].id, g.edgeFrom[i], g.edgeTo[i]]).filter((x) => x[0] === id);
    const [[, a, b]] = from(4);
    expect(g.lat[a]).toBe(59.3);
    expect(g.lng[a]).toBe(18.02); // C
    expect(g.lng[b]).toBe(18.0); // A
  });
});

describe('dijkstra and blocking (SPEC.md § 12.3)', () => {
  const g = buildRoadGraph(roads);
  const v = (c: LngLat) => snapToGraph(g, c[1], c[0]).vertex;

  it('finds shortest distances by length, from several sources the minimum', () => {
    const d = dijkstra(g, [v(A)]).dist;
    expect(d[v(A)]).toBe(0);
    expect(d[v(B)]).toBeCloseTo(haversineM(59.3, 18.0, 59.3, 18.01), 0);
    expect(d[v(C)]).toBeCloseTo(haversineM(59.3, 18.0, 59.3, 18.02), 0);
    const both = dijkstra(g, [v(A), v(C)]).dist;
    expect(both[v(B)]).toBeLessThan(d[v(C)]);
  });

  it('follows one-way edges only in their direction', () => {
    const noWest = blockedWayFlags(g, { ways: [1] });
    // With way 1 closed, A is only reached from C over the one-way way 4; nothing leaves A.
    expect(Number.isFinite(dijkstra(g, [v(C)], noWest).dist[v(A)])).toBe(true);
    expect(Number.isFinite(dijkstra(g, [v(A)], noWest).dist[v(C)])).toBe(false);
  });

  it('blocks a way by id, a road by name (and by ref when both have one), and a node by its way names', () => {
    const byId = blockedWayFlags(g, { ways: [2] });
    expect(g.ways.map((w, i) => (byId[i] ? w.id : 0)).filter(Boolean)).toEqual([2]);
    const byName = blockedWayFlags(g, { roads: ['Västra vägen'] });
    expect(g.ways.map((w, i) => (byName[i] ? w.id : 0)).filter(Boolean)).toEqual([1, 3]);
    const byRef = blockedWayFlags(g, { roads: ['Västra vägen|E20'] });
    expect(g.ways.map((w, i) => (byRef[i] ? w.id : 0)).filter(Boolean)).toEqual([1, 3]); // way 1 has no ref: the name is enough
    const otherRef = blockedWayFlags(g, { roads: ['Östra vägen|E18'] });
    expect([...otherRef].some(Boolean)).toBe(false);
    const byNode = blockedWayFlags(g, { names: ['östra vägen'] });
    expect(g.ways.map((w, i) => (byNode[i] ? w.id : 0)).filter(Boolean)).toEqual([2]);
  });

  it('removes the edges of blocked ways from the search and names the ways on a path', () => {
    const open = dijkstra(g, [v(A)]);
    expect(pathWayNames(g, open, v(D))).toEqual(['Västra vägen']);
    const closed = dijkstra(g, [v(A)], blockedWayFlags(g, { ways: [1] }));
    expect(Number.isFinite(closed.dist[v(D)])).toBe(false);
    expect(Number.isFinite(closed.dist[v(B)])).toBe(false);
  });

  it('builds the key of a "block whole road" tap from the name and the ref', () => {
    expect(roadKey({ name: 'Essingeleden', ref: 'E4' })).toBe('Essingeleden|E4');
    expect(roadKey({ name: 'Västerbron', ref: null })).toBe('Västerbron');
    expect(roadKey({ name: null, ref: 'E4' })).toBeNull();
  });
});

describe('snapToGraph (SPEC.md § 12.3)', () => {
  const g = buildRoadGraph(roads);
  it('attaches to the nearest vertex and records the distance', () => {
    const s = snapToGraph(g, 59.3003, 18.0101);
    expect(s.unsnapped).toBe(false);
    expect(g.lat[s.vertex]).toBe(59.3);
    expect(g.lng[s.vertex]).toBe(18.01);
    expect(s.distance).toBeGreaterThan(30);
    expect(s.distance).toBeLessThan(40);
  });
  it('flags a point more than 1 500 m from every vertex as unsnapped', () => {
    expect(snapToGraph(g, 59.35, 18.01).unsnapped).toBe(true);
    expect(snapToGraph(g, 59.3, 18.01, 50000).unsnapped).toBe(false);
  });
});

describe('snapping and one-way ramps (regression: 0 % of the patients had a path from Solna)', () => {
  // A two-way road P—Q—R, and a one-way exit ramp from Q to the dead end X that lies nearer to the point than any vertex of the road.
  const P: LngLat = [18.0, 59.3];
  const Q: LngLat = [18.01, 59.3];
  const R: LngLat = [18.02, 59.3];
  const X: LngLat = [18.01, 59.3009];
  const ramp: RoadCollection = {
    type: 'FeatureCollection',
    features: [way(1, 'Vägen', [P, Q]), way(2, 'Vägen', [Q, R]), way(3, 'Avfarten', [Q, X], { oneway: true })],
  };
  const g = buildRoadGraph(ramp);
  const nearX = [59.3011, 18.0101] as const;

  it('does not attach a point to the end of a one-way ramp that has no way out, where a search could never start', () => {
    const s = snapToGraph(g, nearX[0], nearX[1]);
    expect(g.lat[s.vertex]).toBe(Q[1]);
    expect(g.lng[s.vertex]).toBe(Q[0]);
    expect(Number.isFinite(dijkstra(g, [s.vertex]).dist[g.vertexCount - 1])).toBe(true);
  });

  it('does not attach a point to the start of a one-way entry ramp that nothing leads into, where a search could never end', () => {
    const entry = buildRoadGraph({ type: 'FeatureCollection', features: [way(1, 'Vägen', [P, Q]), way(2, 'Vägen', [Q, R]), way(3, 'Påfarten', [X, Q], { oneway: true })] });
    const s = snapToGraph(entry, nearX[0], nearX[1]);
    expect(entry.lng[s.vertex]).toBe(Q[0]);
    expect(entry.lat[s.vertex]).toBe(Q[1]);
  });

  it('marks only the strongly connected core: the road vertices, not the dead end of the ramp', () => {
    expect([...g.core].reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('the committed OpenStreetMap graph (SPEC.md § 12.3)', () => {
  it('lets the Solna site reach most of the graph: it snaps to a vertex a search can leave', async () => {
    const roadsJson = (await import('@/data/packs/geo/karolinska/roads.json')).default as unknown as RoadCollection;
    const g = buildRoadGraph(roadsJson);
    const s = snapToGraph(g, 59.3522, 18.0322);
    expect(s.unsnapped).toBe(false);
    const reached = dijkstra(g, [s.vertex]).dist.filter(Number.isFinite).length;
    expect(reached / g.vertexCount).toBeGreaterThan(0.8);
  });
});
