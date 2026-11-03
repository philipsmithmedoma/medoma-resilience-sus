// Positions of the electricity and water nodes from OpenStreetMap (SPEC.md § 12.5, DATA.md § 12): the pack's nodes take the
// centroid of the matching substation or water works, Kolbotten is added the same way, and 400/220 kV lines are drawn from
// power.json. While the files have not been fetched the fixture stands in and the positions are marked illustrative.
import type { Confidence, HomePackId, InfraNode } from '@/data/types';
import { homePacks } from '@/data/packs/home-packs';
import type { GeoData, LineFeature, PointFeature } from './geoData';

export interface AppliedNodes {
  nodes: InfraNode[];
  /** Ids of the nodes that took an OpenStreetMap position. */
  matched: string[];
  /** Ids with no matching object: they keep their fallback estimate (Kolbotten is then not added). */
  missing: string[];
}

const lower = (s: string) => s.toLocaleLowerCase('sv');

function nearest<T extends PointFeature>(points: T[], lat: number, lng: number): T | undefined {
  const d = (p: T) => Math.hypot(p.geometry.coordinates[1] - lat, (p.geometry.coordinates[0] - lng) * 0.51);
  return [...points].sort((a, b) => d(a) - d(b))[0];
}

/** What the coordinate's source says: the OpenStreetMap query date, or that the fixture stands in for the data. */
export function osmCoordSource(source: GeoData['source']['power'], date: string | null): { confidence: Confidence; source: string } {
  if (source === 'osm' && date) return { confidence: 'reported', source: `OpenStreetMap, ${date}` };
  return { confidence: 'illustrative', source: 'Fixture standing in for OpenStreetMap data that has not been fetched (scripts/fetch-osm.mjs)' };
}

export function applyOsmNodes(base: InfraNode[], geo: Pick<GeoData, 'power' | 'water' | 'source'>, date: string | null, packId: HomePackId = 'karolinska'): AppliedNodes {
  const home = homePacks[packId];
  const fallback: [number, number] = [home.sites[0].lat, home.sites[0].lng];
  const power = geo.power.features.filter((f): f is PointFeature => f.geometry.type === 'Point' && f.properties.power === 'substation');
  const water = geo.water.features;
  const nodes = base.map((n) => ({ ...n }));
  const matched: string[] = [];
  const missing: string[] = [];
  for (const rule of home.osmMatches) {
    const pool = (rule.file === 'power' ? power : water).filter((f) => f.properties.name && lower(f.properties.name).includes(lower(rule.term)));
    const existing = nodes.find((n) => n.id === rule.nodeId);
    const hit = nearest(pool, existing?.lat ?? fallback[0], existing?.lng ?? fallback[1]);
    if (!hit) {
      missing.push(rule.nodeId);
      continue;
    }
    const src = osmCoordSource(rule.file === 'power' ? geo.source.power : geo.source.water, date);
    const position = { lat: hit.geometry.coordinates[1], lng: hit.geometry.coordinates[0], coordConfidence: src.confidence, coordSource: src.source };
    if (existing) Object.assign(existing, position);
    else if (home.osmExtra[rule.nodeId]) nodes.push({ ...home.osmExtra[rule.nodeId], ...position });
    matched.push(rule.nodeId);
  }
  return { nodes, matched, missing };
}

export interface PowerLine {
  id: number;
  /** "400 kV", "220 kV" or "400/220 kV". */
  label: string;
  highest: number; // kV, for the line weight
  positions: Array<[number, number]>; // [lat, lng]
}

/** "400000;220000" → "400/220 kV". */
export function voltageLabel(voltage: string | null | undefined): string {
  const kv = (voltage ?? '')
    .split(';')
    .map((v) => Number(v.trim()) / 1000)
    .filter((v) => Number.isFinite(v) && v > 0);
  return kv.length ? `${kv.join('/')} kV` : '';
}

/** 400 and 220 kV lines of power.json as polylines with a voltage label. */
export function powerLines(geo: Pick<GeoData, 'power'>): PowerLine[] {
  return geo.power.features
    .filter((f): f is LineFeature => f.geometry.type === 'LineString' && f.properties.power === 'line')
    .map((f) => ({
      id: f.properties.id,
      label: voltageLabel(f.properties.voltage),
      highest: Math.max(0, ...(f.properties.voltage ?? '').split(';').map((v) => Number(v) / 1000).filter(Number.isFinite)),
      positions: f.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
    }));
}

const applied = new Map<HomePackId, AppliedNodes>();
/** The nodes of a home pack (default Karolinska) with OpenStreetMap positions once they have been computed (kept across a demo reset). */
export const getAppliedNodes = (packId: HomePackId = 'karolinska'): AppliedNodes | null => applied.get(packId) ?? null;
export const setAppliedNodes = (a: AppliedNodes, packId: HomePackId = 'karolinska'): void => {
  applied.set(packId, a);
};

/** The query date from geo/<pack>/README.md ("Query date: 2026-11-03"), or null when the data has not been fetched. */
const readmes = import.meta.glob('../data/packs/geo/*/README.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
export async function loadQueryDate(packId: HomePackId = 'karolinska'): Promise<string | null> {
  const load = readmes[`../data/packs/geo/${packId}/README.md`];
  if (!load) return null;
  const m = /Query date: (\d{4}-\d{2}-\d{2})/.exec(await load());
  return m ? m[1] : null;
}
