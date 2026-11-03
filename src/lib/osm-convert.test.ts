import { describe, expect, it } from 'vitest';
import { OUTPUTS, centroid, convertPower, convertRoads, convertStreets, convertWater, geoReadme, haversine, simplify, type LngLat, type Overpass } from '../../scripts/osm-convert.mjs';

const g = (lat: number, lon: number) => ({ lat, lon });

describe('simplify (Douglas–Peucker, SPEC.md § 12.2)', () => {
  const line: LngLat[] = [[18, 59.3], [18.001, 59.30001], [18.002, 59.3], [18.003, 59.3005], [18.004, 59.3]];
  it('drops points within tolerance, keeps the ends and the bends', () => {
    const out = simplify(line, 8);
    expect(out[0]).toEqual(line[0]);
    expect(out[out.length - 1]).toEqual(line[4]);
    expect(out).not.toContainEqual(line[1]);
    expect(out).toContainEqual(line[3]);
  });
  it('keeps forced indices even when they are within tolerance', () => {
    expect(simplify(line, 8, new Set([1]))).toContainEqual(line[1]);
  });
  it('leaves a two-point line alone', () => {
    expect(simplify(line.slice(0, 2), 8)).toEqual(line.slice(0, 2));
  });
  it('measures in metres: 1° of latitude is about 111 km', () => {
    expect(haversine([18, 59], [18, 60])).toBeGreaterThan(111000);
    expect(haversine([18, 59], [18, 60])).toBeLessThan(111500);
  });
});

const roadsAnswer: Overpass = {
  elements: [
    { type: 'way', id: 1, nodes: [10, 11, 12, 13], tags: { highway: 'trunk', name: 'Essingeleden', ref: 'E4', bridge: 'viaduct', lanes: '3', oneway: 'yes', surface: 'asphalt' }, geometry: [g(59.33, 18.0), g(59.3301, 18.0), g(59.3303, 18.0), g(59.331, 18.0)] },
    { type: 'way', id: 2, nodes: [12, 20, 21], tags: { highway: 'primary', name: 'Korsgatan', tunnel: 'yes' }, geometry: [g(59.3303, 18.0), g(59.3303, 18.001), g(59.3303, 18.002)] },
    { type: 'way', id: 3, nodes: [30, 31], tags: { highway: 'motorway', bridge: 'no' }, geometry: [g(59.4, 18.1), g(59.401, 18.1)] },
    { type: 'way', id: 4, nodes: [41, 40], tags: { highway: 'secondary', oneway: '-1' }, geometry: [g(59.5, 18.2), g(59.501, 18.2)] },
  ],
};

describe('convertRoads (SPEC.md § 12.2)', () => {
  const fc = convertRoads(roadsAnswer);
  const byId = (id: number) => fc.features.find((f) => f.properties.id === id)!;
  it('keeps only the listed properties', () => {
    expect(Object.keys(byId(1).properties).sort()).toEqual(['bridge', 'highway', 'id', 'lanes', 'name', 'oneway', 'ref', 'tunnel']);
    expect(byId(1).properties).toMatchObject({ highway: 'trunk', name: 'Essingeleden', ref: 'E4', bridge: true, tunnel: false, oneway: true, lanes: 3 });
  });
  it('reads bridge=no as false, tunnel=yes as true, a missing name as null and implies one-way for motorways', () => {
    expect(byId(3).properties).toMatchObject({ bridge: false, name: null, oneway: true, lanes: null });
    expect(byId(2).properties.tunnel).toBe(true);
    expect(byId(2).properties.oneway).toBe(false);
  });
  it('flips the geometry of oneway=-1', () => {
    expect(byId(4).properties.oneway).toBe(true);
    expect(byId(4).geometry.coordinates).toEqual([[18.2, 59.501], [18.2, 59.5]]);
  });
  it('keeps the node shared by two ways even though it lies on a straight line', () => {
    const coordinates = byId(1).geometry.coordinates;
    expect(coordinates).toContainEqual([18, 59.3303]);
    expect(coordinates.length).toBeLessThan(4 + 1);
  });
  it('rounds to five decimals', () => {
    for (const f of fc.features) for (const p of (f.geometry as { coordinates: LngLat[] }).coordinates) expect(Math.abs(p[0] * 1e5 - Math.round(p[0] * 1e5))).toBeLessThan(1e-6);
  });
});

describe('streets, power and water (SPEC.md § 12.2)', () => {
  it('keeps id and name for streets', () => {
    const fc = convertStreets({ elements: [{ type: 'way', id: 7, tags: { highway: 'residential', name: 'Björkvägen', surface: 'gravel' }, geometry: [g(59.3, 18), g(59.301, 18)] }] });
    expect(fc.features[0].properties).toEqual({ id: 7, name: 'Björkvägen' });
  });
  it('turns substation ways into centroid points and keeps substation nodes and lines', () => {
    const fc = convertPower({
      elements: [
        { type: 'node', id: 1, lat: 59.4757, lon: 17.8844, tags: { power: 'substation', name: 'Överby', voltage: '400000', operator: 'Svenska kraftnät' } },
        { type: 'way', id: 2, tags: { power: 'substation', name: 'Beckomberga', voltage: '220000' }, geometry: [g(59.357, 17.9), g(59.358, 17.9), g(59.358, 17.901), g(59.357, 17.901), g(59.357, 17.9)] },
        { type: 'way', id: 3, tags: { power: 'line', voltage: '400000;220000', cables: '6' }, geometry: [g(59.4, 18), g(59.41, 18.05)] },
      ],
    });
    expect(fc.features.map((f) => f.geometry.type)).toEqual(['Point', 'Point', 'LineString']);
    expect(fc.features[0].properties).toEqual({ id: 1, power: 'substation', name: 'Överby', operator: 'Svenska kraftnät', voltage: '400000' });
    expect(fc.features[1].geometry.coordinates).toEqual([17.9005, 59.3575]);
    expect(fc.features[2].properties.voltage).toBe('400000;220000');
  });
  it('turns water works into points with id, name and operator', () => {
    const fc = convertWater({ elements: [{ type: 'way', id: 5, tags: { man_made: 'water_works', name: 'Görvälnverket', operator: 'Norrvatten' }, geometry: [g(59.43, 17.78), g(59.44, 17.78), g(59.44, 17.79), g(59.43, 17.79), g(59.43, 17.78)] }] });
    expect(fc.features[0].properties).toEqual({ id: 5, name: 'Görvälnverket', operator: 'Norrvatten' });
    expect(fc.features[0].geometry.coordinates).toEqual([17.785, 59.435]);
  });
  it('centroid ignores the repeated closing point of a ring', () => {
    expect(centroid([g(0, 0), g(0, 2), g(2, 2), g(2, 0), g(0, 0)])).toEqual([1, 1]);
  });
});

describe('outputs and README (SPEC.md § 12.2)', () => {
  it('lists the four files with the specified budgets', () => {
    expect(OUTPUTS.map((o) => [o.file, o.budget])).toEqual([['roads.json', 2.5 * 1024 * 1024], ['streets.json', 1.5 * 1024 * 1024], ['power.json', 0.4 * 1024 * 1024], ['water.json', Infinity]]);
  });
  it('the README carries the attribution, the date and the sizes', () => {
    const md = geoReadme('2026-11-03', { 'roads.json': 2048 });
    expect(md).toContain('© OpenStreetMap contributors, ODbL');
    expect(md).toContain('Query date: 2026-11-03');
    expect(md).toContain('2.0 KB');
    expect(md).toContain('59.15, 17.65, 59.52, 18.30');
  });
});
