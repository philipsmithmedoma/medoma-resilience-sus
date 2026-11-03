// Map geometry for Hospital at Home (SPEC.md § 11.5–11.6): where each graph vertex sits and where an
// off-map arrow ends. Pure.
import type { HomeZone, InfraLink, InfraNode } from '@/data/types';

export type LatLng = [number, number];
export type Dir = 'N' | 'S' | 'E' | 'W';

/** Length of an off-map arrow in degrees of latitude (about 4.5 km), and the sideways step between arrows that leave one node the same way. */
export const OFFMAP_LENGTH_DEG = 0.04;
export const OFFMAP_SPREAD_DEG = 0.07;

/** Position of every graph vertex: the sites by id, the zones as `zone:<id>`, the infrastructure nodes by id. */
export function vertexPositions(sites: Array<{ id: string; lat: number; lng: number }>, zones: HomeZone[], infra: InfraNode[]): Map<string, LatLng> {
  const out = new Map<string, LatLng>();
  for (const s of sites) out.set(s.id, [s.lat, s.lng]);
  for (const z of zones) out.set(z.graphNode, [z.lat, z.lng]);
  for (const n of infra) out.set(n.id, [n.lat, n.lng]);
  return out;
}

/** Where the k-th of n arrows leaving `from` in direction `dir` ends; arrows in the same direction fan out sideways. */
export function offmapEnd(from: LatLng, dir: Dir, k: number, n: number): LatLng {
  const side = (k - (n - 1) / 2) * OFFMAP_SPREAD_DEG;
  const lngScale = 1 / Math.cos((from[0] * Math.PI) / 180); // keep the step visually equal at this latitude
  const along = OFFMAP_LENGTH_DEG;
  switch (dir) {
    case 'N':
      return [from[0] + along, from[1] + side * 0.5];
    case 'S':
      return [from[0] - along, from[1] + side * 0.5];
    case 'E':
      return [from[0] + side * 0.25, from[1] + along * lngScale];
    case 'W':
      return [from[0] + side * 0.25, from[1] - along * lngScale];
  }
}

/** Arrowhead rotation in degrees clockwise from north. */
export function offmapRotation(dir: Dir): number {
  return { N: 0, E: 90, S: 180, W: 270 }[dir];
}

/** The index and count of each off-map link among those leaving the same node in the same direction. */
export function offmapSlots(links: InfraLink[]): Map<string, { k: number; n: number }> {
  const groups = new Map<string, InfraLink[]>();
  for (const l of links) {
    if (!l.offmap) continue;
    const key = `${l.a}|${l.offmap.dir}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  const out = new Map<string, { k: number; n: number }>();
  for (const group of groups.values()) group.forEach((l, k) => out.set(l.id, { k, n: group.length }));
  return out;
}

/** True when a link is drawn dashed: a schematic routing, an unverified connection or a dashed/dotted style. */
export function isSchematic(link: InfraLink): boolean {
  return !link.verified || link.style === 'dashed' || link.style === 'dotted';
}

/** The vertices linked to `id` (and `id` itself): what stays undimmed when a node is selected. */
export function linkedVertices(id: string, links: InfraLink[]): Set<string> {
  const out = new Set<string>([id]);
  for (const l of links) {
    if (l.a === id) out.add(l.b);
    if (l.b === id) out.add(l.a);
  }
  return out;
}

/** The links that touch `id`, for the "Linked to" list. */
export function linksOf(id: string, links: InfraLink[]): InfraLink[] {
  return links.filter((l) => l.a === id || l.b === id);
}

/**
 * What the map fits on load (SPEC.md § 12.6 batch 9): the ten zones, each as the box around its circle. Sites, markers and
 * arrow tips outside that are left to the user, so that the zone labels get the room.
 */
export function homeFitPoints(overlay: { zones: HomeZone[]; fitPoints?: LatLng[] }): LatLng[] {
  if (overlay.fitPoints) return overlay.fitPoints;
  const points: LatLng[] = [];
  for (const z of overlay.zones) {
    const dLat = z.radiusKm / 111.32;
    const dLng = z.radiusKm / (111.32 * Math.cos((z.lat * Math.PI) / 180));
    points.push([z.lat - dLat, z.lng - dLng], [z.lat + dLat, z.lng + dLng]);
  }
  return points;
}
