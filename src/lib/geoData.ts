// Loads the OpenStreetMap GeoJSON of SPEC.md § 12.2 from src/data/packs/geo/<pack>/ with dynamic imports, so the files are
// fetched only when Hospital at Home needs them and never enter the initial bundle. A file that has not been fetched
// yet (scripts/fetch-osm.mjs) is replaced by its hand-designed fixture, which has the same schema. The app makes no
// network request for this data.
import type { GeoLoader, HomePackId } from '@/data/types';
import { homePacks } from '@/data/packs/home-packs';
import type { RoadCollection } from './roadGraph';

export type Source = 'osm' | 'fixture';

export interface PointFeature {
  type: 'Feature';
  properties: { id: number; name: string | null; operator?: string | null; power?: string; voltage?: string | null };
  geometry: { type: 'Point'; coordinates: [number, number] };
}
export interface LineFeature {
  type: 'Feature';
  properties: { id: number; name: string | null; operator?: string | null; power?: string; voltage?: string | null };
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
}
export interface Collection<F> {
  type: 'FeatureCollection';
  features: F[];
}

export interface GeoData {
  roads: RoadCollection;
  streets: Collection<LineFeature>;
  power: Collection<PointFeature | LineFeature>;
  water: Collection<PointFeature>;
  /** Per file: the OpenStreetMap file, or the fixture standing in for it. */
  source: Record<'roads' | 'streets' | 'power' | 'water', Source>;
}

async function pick<T>(loader: GeoLoader, label: string): Promise<{ data: T; source: Source }> {
  if (loader.osm) return { data: (await loader.osm()).default as T, source: 'osm' };
  if (!loader.fixture) throw new Error(`Neither ${label}.json nor its fixture exists under src/data/packs/geo/`);
  return { data: (await loader.fixture()).default as T, source: 'fixture' };
}

const cache = new Map<HomePackId, Promise<GeoData>>();

/** The geometry of a home pack (default Karolinska), loaded once per pack with dynamic imports. */
export function loadGeoData(packId: HomePackId = 'karolinska'): Promise<GeoData> {
  let loading = cache.get(packId);
  if (!loading) {
    const geo = homePacks[packId].geo;
    loading = (async () => {
      const [roads, streets, power, water] = await Promise.all([
        pick<RoadCollection>(geo.roads, 'roads'),
        pick<GeoData['streets']>(geo.streets, 'streets'),
        pick<GeoData['power']>(geo.power, 'power'),
        pick<GeoData['water']>(geo.water, 'water'),
      ]);
      return { roads: roads.data, streets: streets.data, power: power.data, water: water.data, source: { roads: roads.source, streets: streets.source, power: power.source, water: water.source } };
    })();
    cache.set(packId, loading);
  }
  return loading;
}
