// The road graph of SPEC.md § 12.3, built from roads.json (or the fixture) at load. A vertex is every coordinate shared
// by two or more ways (or used twice by one) and every way end; an edge is a way segment between vertices, weighted by
// haversine length in metres. One-way ways give directed edges, all others two. Dijkstra runs by length; blocking removes
// the edges of whole ways. Pure: no network, no React.

export type LngLat = [number, number];

export interface RoadProps {
  id: number;
  highway: string;
  name: string | null;
  ref: string | null;
  bridge: boolean;
  tunnel: boolean;
  oneway: boolean;
  lanes: number | null;
}

export interface RoadFeature {
  type: 'Feature';
  properties: RoadProps;
  geometry: { type: 'LineString'; coordinates: LngLat[] };
}

export interface RoadCollection {
  type: 'FeatureCollection';
  features: RoadFeature[];
}

export type RoadWay = Pick<RoadProps, 'id' | 'name' | 'ref' | 'bridge' | 'tunnel' | 'oneway' | 'highway'>;

const EARTH_M = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Haversine distance in metres between two points given as latitude/longitude. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

export const SNAP_MAX_M = 1500;

export interface RoadGraph {
  vertexCount: number;
  lat: Float64Array;
  lng: Float64Array;
  ways: RoadWay[];
  edgeFrom: Int32Array;
  edgeTo: Int32Array;
  edgeLen: Float64Array;
  edgeWay: Int32Array;
  /** Outgoing edge indices of vertex v are adjEdges[adjStart[v] .. adjStart[v + 1]). */
  adjStart: Int32Array;
  adjEdges: Int32Array;
  wayIndexById: Map<number, number>;
  /** 1 for vertices in the largest strongly connected component: a vertex you can both enter and leave. Snapping only uses these. */
  core: Uint8Array;
}

/** The largest strongly connected component (iterative Kosaraju), as a 0/1 mask. One-way ramps make dead-end vertices that no path can use. */
function largestStrongComponent(n: number, from: Int32Array, to: Int32Array, adjStart: Int32Array, adjEdges: Int32Array): Uint8Array {
  const order: number[] = [];
  const seen = new Uint8Array(n);
  const pos = Int32Array.from(adjStart.subarray(0, n));
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    seen[s] = 1;
    const stack = [s];
    while (stack.length) {
      const u = stack[stack.length - 1];
      if (pos[u] < adjStart[u + 1]) {
        const v = to[adjEdges[pos[u]++]];
        if (!seen[v]) {
          seen[v] = 1;
          stack.push(v);
        }
      } else {
        order.push(u);
        stack.pop();
      }
    }
  }
  // Reverse adjacency.
  const rStart = new Int32Array(n + 1);
  for (let e = 0; e < to.length; e++) rStart[to[e] + 1]++;
  for (let i = 0; i < n; i++) rStart[i + 1] += rStart[i];
  const fill = rStart.slice(0, n);
  const rEdges = new Int32Array(to.length);
  for (let e = 0; e < to.length; e++) rEdges[fill[to[e]]++] = from[e];
  const comp = new Int32Array(n).fill(-1);
  const sizes: number[] = [];
  for (let i = order.length - 1; i >= 0; i--) {
    const s = order[i];
    if (comp[s] >= 0) continue;
    const c = sizes.length;
    let size = 0;
    const stack = [s];
    comp[s] = c;
    while (stack.length) {
      const u = stack.pop()!;
      size++;
      for (let k = rStart[u]; k < rStart[u + 1]; k++) {
        const v = rEdges[k];
        if (comp[v] < 0) {
          comp[v] = c;
          stack.push(v);
        }
      }
    }
    sizes.push(size);
  }
  let best = -1;
  sizes.forEach((sz, c) => {
    if (best < 0 || sz > sizes[best]) best = c;
  });
  const core = new Uint8Array(n);
  for (let v = 0; v < n; v++) if (comp[v] === best) core[v] = 1;
  return core;
}

const keyOf = (c: LngLat) => `${c[0]},${c[1]}`;

export function buildRoadGraph(roads: RoadCollection): RoadGraph {
  const lines = roads.features.filter((f) => f.geometry.coordinates.length >= 2);
  const uses = new Map<string, number>();
  for (const f of lines) for (const c of f.geometry.coordinates) uses.set(keyOf(c), (uses.get(keyOf(c)) ?? 0) + 1);

  const vertexOf = new Map<string, number>();
  const vLat: number[] = [];
  const vLng: number[] = [];
  const vertex = (c: LngLat) => {
    const k = keyOf(c);
    let v = vertexOf.get(k);
    if (v === undefined) {
      v = vLat.length;
      vertexOf.set(k, v);
      vLat.push(c[1]);
      vLng.push(c[0]);
    }
    return v;
  };

  const ways: RoadWay[] = [];
  const wayIndexById = new Map<number, number>();
  const from: number[] = [];
  const to: number[] = [];
  const len: number[] = [];
  const wayOf: number[] = [];
  const addEdge = (a: number, b: number, d: number, w: number) => {
    from.push(a);
    to.push(b);
    len.push(d);
    wayOf.push(w);
  };

  for (const f of lines) {
    const p = f.properties;
    const w = ways.length;
    ways.push({ id: p.id, name: p.name, ref: p.ref, bridge: p.bridge, tunnel: p.tunnel, oneway: p.oneway, highway: p.highway });
    wayIndexById.set(p.id, w);
    const pts = f.geometry.coordinates;
    let last = vertex(pts[0]);
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      run += haversineM(pts[i - 1][1], pts[i - 1][0], pts[i][1], pts[i][0]);
      const isVertex = i === pts.length - 1 || (uses.get(keyOf(pts[i])) ?? 0) >= 2;
      if (!isVertex) continue;
      const v = vertex(pts[i]);
      if (v !== last) {
        addEdge(last, v, run, w);
        if (!p.oneway) addEdge(v, last, run, w);
      }
      last = v;
      run = 0;
    }
  }

  const n = vLat.length;
  const adjStart = new Int32Array(n + 1);
  for (const a of from) adjStart[a + 1]++;
  for (let i = 0; i < n; i++) adjStart[i + 1] += adjStart[i];
  const fill = adjStart.slice(0, n);
  const adjEdges = new Int32Array(from.length);
  from.forEach((a, e) => {
    adjEdges[fill[a]++] = e;
  });

  const fromA = Int32Array.from(from);
  const toA = Int32Array.from(to);
  return {
    vertexCount: n,
    lat: Float64Array.from(vLat),
    lng: Float64Array.from(vLng),
    ways,
    edgeFrom: fromA,
    edgeTo: toA,
    edgeLen: Float64Array.from(len),
    edgeWay: Int32Array.from(wayOf),
    adjStart,
    adjEdges,
    wayIndexById,
    core: largestStrongComponent(n, fromA, toA, adjStart, adjEdges),
  };
}

export interface Snap {
  vertex: number;
  /** Metres from the point to the vertex. */
  distance: number;
  /** Beyond SNAP_MAX_M: no vertex was attached and the point is treated as unreachable ("no road within 1.5 km"). */
  unsnapped: boolean;
}

/**
 * The nearest vertex to a point that lies in the strongly connected core of the graph; `unsnapped` when none lies within `maxM`.
 * Without the core a point can snap to the end of a one-way ramp that has no way out (or no way in), and then nothing is reachable.
 */
export function snapToGraph(g: RoadGraph, lat: number, lng: number, maxM = SNAP_MAX_M): Snap {
  // Compare in a local flat projection first; only the winner needs the exact distance.
  const kx = Math.cos(rad(lat)) * 111320;
  const ky = 110540;
  let best = -1;
  let bestD2 = Infinity;
  for (let v = 0; v < g.vertexCount; v++) {
    if (!g.core[v]) continue;
    const dx = (g.lng[v] - lng) * kx;
    const dy = (g.lat[v] - lat) * ky;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = v;
    }
  }
  if (best < 0) return { vertex: -1, distance: Infinity, unsnapped: true };
  const distance = haversineM(lat, lng, g.lat[best], g.lng[best]);
  return { vertex: best, distance, unsnapped: distance > maxM };
}

/** What is blocked: way ids, road names (optionally `name|ref`) and bridge/tunnel/junction nodes' OSM way names. */
export interface WayBlocks {
  ways?: Iterable<string | number>;
  roads?: Iterable<string>;
  names?: Iterable<string>;
}

const norm = (s: string) => s.trim().toLocaleLowerCase('sv');

/** Key a "block the whole road" tap stores: the name, and the ref when the way has one (SPEC.md § 12.3). */
export function roadKey(p: Pick<RoadProps, 'name' | 'ref'>): string | null {
  return p.name ? (p.ref ? `${p.name}|${p.ref}` : p.name) : null;
}

/** Flags per way index: 1 when the way is blocked by id, by road key or by a node's way name. */
export function blockedWayFlags(g: RoadGraph, blocks: WayBlocks): Uint8Array {
  const flags = new Uint8Array(g.ways.length);
  for (const id of blocks.ways ?? []) {
    const w = g.wayIndexById.get(Number(id));
    if (w !== undefined) flags[w] = 1;
  }
  const byName = new Map<string, string | null>(); // normalised name → ref (null: any)
  const roadEntries: Array<{ name: string; ref: string | null }> = [];
  for (const key of blocks.roads ?? []) {
    const [name, ref] = key.split('|');
    roadEntries.push({ name: norm(name), ref: ref ? norm(ref) : null });
  }
  for (const name of blocks.names ?? []) byName.set(norm(name), null);
  if (roadEntries.length || byName.size) {
    g.ways.forEach((w, i) => {
      if (!w.name) return;
      const n = norm(w.name);
      if (byName.has(n)) flags[i] = 1;
      for (const r of roadEntries) {
        // "and ref when both are present": a differing ref on both sides is a different road with the same name.
        if (r.name === n && (r.ref === null || w.ref === null || norm(w.ref) === r.ref)) flags[i] = 1;
      }
    });
  }
  return flags;
}

/** Binary min-heap of (distance, vertex) pairs. */
class Heap {
  private d: number[] = [];
  private v: number[] = [];
  get size() {
    return this.d.length;
  }
  push(dist: number, vertex: number) {
    let i = this.d.length;
    this.d.push(dist);
    this.v.push(vertex);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.d[p] <= this.d[i]) break;
      this.swap(i, p);
      i = p;
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.d[0], this.v[0]];
    const ld = this.d.pop()!;
    const lv = this.v.pop()!;
    if (this.d.length > 0) {
      this.d[0] = ld;
      this.v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.d.length && this.d[l] < this.d[m]) m = l;
        if (r < this.d.length && this.d[r] < this.d[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    [this.d[a], this.d[b]] = [this.d[b], this.d[a]];
    [this.v[a], this.v[b]] = [this.v[b], this.v[a]];
  }
}

export interface Paths {
  /** Metres from the nearest source; Infinity when there is no path. */
  dist: Float64Array;
  /** The edge each vertex was reached by (-1 for sources and unreached vertices). */
  via: Int32Array;
}

/** Dijkstra by length from the source vertices, skipping edges of blocked ways. Several sources give the minimum over them. */
export function dijkstra(g: RoadGraph, sources: number[], blocked?: Uint8Array): Paths {
  const dist = new Float64Array(g.vertexCount).fill(Infinity);
  const via = new Int32Array(g.vertexCount).fill(-1);
  const heap = new Heap();
  for (const s of sources) {
    if (s >= 0 && dist[s] !== 0) {
      dist[s] = 0;
      heap.push(0, s);
    }
  }
  while (heap.size > 0) {
    const [d, u] = heap.pop();
    if (d > dist[u]) continue;
    for (let k = g.adjStart[u]; k < g.adjStart[u + 1]; k++) {
      const e = g.adjEdges[k];
      if (blocked && blocked[g.edgeWay[e]]) continue;
      const v = g.edgeTo[e];
      const nd = d + g.edgeLen[e];
      if (nd < dist[v]) {
        dist[v] = nd;
        via[v] = e;
        heap.push(nd, v);
      }
    }
  }
  return { dist, via };
}

/** The way names along the path to a vertex (consecutive duplicates collapsed), for explaining a path that should not exist. */
export function pathWayNames(g: RoadGraph, paths: Paths, vertex: number): string[] {
  const names: string[] = [];
  let v = vertex;
  while (v >= 0 && paths.via[v] >= 0) {
    const e = paths.via[v];
    const w = g.ways[g.edgeWay[e]];
    const label = w.name ?? w.ref ?? `OSM ${w.id}`;
    if (names[names.length - 1] !== label) names.push(label);
    v = g.edgeFrom[e];
  }
  return names.reverse();
}
