export type LngLat = [number, number];
export interface Feature {
  type: 'Feature';
  properties: Record<string, string | number | boolean | null>;
  geometry: { type: 'LineString'; coordinates: LngLat[] } | { type: 'Point'; coordinates: LngLat };
}
export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}
export interface OverpassElement {
  type: 'node' | 'way';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number } | null>;
}
export interface Overpass {
  elements: OverpassElement[];
}
export function haversine(a: LngLat, b: LngLat): number;
export function pointSegmentMetres(p: LngLat, a: LngLat, b: LngLat): number;
export function simplify(points: LngLat[], toleranceM: number, keep?: Set<number>): LngLat[];
export function round5(n: number): number;
export function centroid(geometry: Array<{ lat: number; lon: number } | null>): LngLat;
export function convertRoads(osm: Overpass, toleranceM?: number): FeatureCollection;
export function convertStreets(osm: Overpass, toleranceM?: number): FeatureCollection;
export function convertPower(osm: Overpass, toleranceM?: number): FeatureCollection;
export function convertWater(osm: Overpass): FeatureCollection;
export const OUTPUTS: Array<{ file: string; query: string; convert: (osm: Overpass) => FeatureCollection; budget: number }>;
export const BBOX: Record<string, string>;
export interface PackGeoConfig {
  bbox: Record<'roads' | 'power' | 'water', number[]>;
  streetCentres: number[][];
  streetRadiusM: number;
}
export const PACKS: Record<string, PackGeoConfig>;
export function buildQuery(pack: string, name: string, bbox?: number[]): string;
export function geoReadme(date: string, sizes: Record<string, number | undefined>, pack?: string): string;
