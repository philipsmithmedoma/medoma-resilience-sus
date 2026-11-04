import { expect } from 'vitest';
import { pointToSegmentM, type RoadGraph, type RoadProps } from '@/lib/roadGraph';

/** The E22 at Höje å, SPEC § 6.1: the point is a coordinate, the road is found from the data, not from an id. */
export const HOJE_A = { lat: 55.6895, lng: 13.1975 };
export const isE22 = (ref: string | null) => ref === 'E22' || ref === 'E 22';

/** The closest way with ref E22 or E 22 to a point, and the vertex of its closest edge, as a tap on the road would give it. */
export function nearestE22(g: RoadGraph, point: { lat: number; lng: number }): { props: RoadProps; at: { lat: number; lng: number } } {
  let best = { d: Infinity, e: -1 };
  for (let e = 0; e < g.edgeFrom.length; e++) {
    if (!isE22(g.ways[g.edgeWay[e]].ref)) continue;
    const a = g.edgeFrom[e];
    const b = g.edgeTo[e];
    const d = pointToSegmentM(point.lat, point.lng, g.lat[a], g.lng[a], g.lat[b], g.lng[b]);
    if (d < best.d) best = { d, e };
  }
  expect(best.e).toBeGreaterThanOrEqual(0);
  const a = g.edgeFrom[best.e];
  const b = g.edgeTo[best.e];
  const v = pointToSegmentM(point.lat, point.lng, g.lat[a], g.lng[a], g.lat[a], g.lng[a]) <=
    pointToSegmentM(point.lat, point.lng, g.lat[b], g.lng[b], g.lat[b], g.lng[b]) ? a : b;
  return { props: { ...g.ways[g.edgeWay[best.e]], lanes: null }, at: { lat: g.lat[v], lng: g.lng[v] } };
}
