import { beforeAll, describe, expect, it } from 'vitest';
import { SUS_PACK as pack } from '@/test/packs';
import { loadGeoData, type GeoData, type PointFeature } from './geoData';
import { homePacks } from '@/data/packs/home-packs';
import { applyOsmNodes, osmCoordSource, powerLines, voltageLabel } from './osmNodes';

let geo: GeoData;
beforeAll(async () => {
  geo = await loadGeoData();
});

const point = (id: number, name: string, lat: number, lng: number): PointFeature => ({ type: 'Feature', properties: { id, name, power: 'substation' }, geometry: { type: 'Point', coordinates: [lng, lat] } });
const withPower = (features: GeoData['power']['features']): GeoData => ({ ...geo, power: { type: 'FeatureCollection', features } });

const fixtureOnly = (ctx: { skip: () => void }) => {
  if (geo.source.power === 'osm' || geo.source.water === 'osm') ctx.skip(); // exact names and counts of the hand-made fixture; real OpenStreetMap data differs
};
const estimateOf = (id: string) => pack.infraNodes.find((n) => n.id === id)!;
const MATCH_IDS = homePacks.sus.osmMatches.map((m) => m.nodeId);

describe('nodes from OpenStreetMap (SPEC.md § 12.5)', () => {
  it('gives Hurva, Barsebäck, Sege, Ringsjöverket and Vombverket the position of the matching object and adds no node (the SUS pack has no osmExtra)', (ctx) => {
    fixtureOnly(ctx);
    expect(homePacks.sus.osmExtra).toEqual({});
    const r = applyOsmNodes(pack.infraNodes, geo, null);
    expect(r.missing).toEqual([]);
    expect([...r.matched].sort()).toEqual([...MATCH_IDS].sort());
    const node = (id: string) => r.nodes.find((n) => n.id === id)!;
    // The real data can hold several objects with a name; the code takes the one nearest the old estimate, so the expectation does too.
    const expected = (nodeId: string, term: string, features: Array<{ properties: { name?: string | null }; geometry: { coordinates: unknown } }>) => {
      const est = estimateOf(nodeId);
      const hits = features.filter((f) => f.properties.name?.toLowerCase().includes(term.toLowerCase())) as Array<{ geometry: { coordinates: [number, number] } }>;
      const d = (f: (typeof hits)[number]) => Math.hypot(f.geometry.coordinates[1] - est.lat, f.geometry.coordinates[0] - est.lng);
      return [...hits].sort((x, y) => d(x) - d(y))[0].geometry.coordinates;
    };
    const at = (id: string) => [node(id).lng, node(id).lat];
    const substations = geo.power.features.filter((f) => f.properties.power === 'substation');
    expect(at('e-hurva')).toEqual(expected('e-hurva', 'Hurva', substations));
    expect(at('e-barseback')).toEqual(expected('e-barseback', 'Barsebäck', substations));
    expect(at('e-sege')).toEqual(expected('e-sege', 'Sege', substations));
    expect(at('w-ringsjo')).toEqual(expected('w-ringsjo', 'Ringsjöverket', geo.water.features));
    expect(at('w-vomb')).toEqual(expected('w-vomb', 'Vombverket', geo.water.features));
    expect(r.nodes).toHaveLength(pack.infraNodes.length);
  });

  it('leaves the other nodes as they were and does not change the pack', () => {
    const before = JSON.stringify(pack.infraNodes);
    const r = applyOsmNodes(pack.infraNodes, geo, null);
    expect(JSON.stringify(pack.infraNodes)).toBe(before);
    for (const id of ['r-lund-s', 'e-regionnat', 'w-kallby']) expect(r.nodes.find((n) => n.id === id)).toEqual(estimateOf(id));
  });

  it('marks real OpenStreetMap positions reported with the query date and fixture positions illustrative', () => {
    expect(osmCoordSource('osm', '2026-11-03')).toEqual({ confidence: 'reported', source: 'OpenStreetMap, 2026-11-03' });
    const fixture = osmCoordSource('fixture', null);
    expect(fixture.confidence).toBe('illustrative');
    expect(fixture.source).toContain('not been fetched');
    // Hurva and Sege have a substation in the fixture too, so the check below holds whichever data is loaded.
    const real = applyOsmNodes(pack.infraNodes, { ...geo, source: { ...geo.source, power: 'osm', water: 'osm' } }, '2026-11-03');
    for (const id of real.matched) expect(real.nodes.find((n) => n.id === id), id).toMatchObject({ coordConfidence: 'reported', coordSource: 'OpenStreetMap, 2026-11-03' });
    expect(real.matched.length).toBeGreaterThan(0);
  });

  it('keeps the estimate of a node with no match and reports it as missing', () => {
    const only = geo.power.features.filter((f) => !/hurva|sege/i.test(f.properties.name ?? ''));
    const r = applyOsmNodes(pack.infraNodes, withPower(only), null);
    expect([...r.missing].sort()).toEqual(['e-hurva', 'e-sege']);
    expect(r.nodes.find((n) => n.id === 'e-hurva')).toEqual(estimateOf('e-hurva'));
    expect(r.nodes.find((n) => n.id === 'e-sege')).toEqual(estimateOf('e-sege'));
    expect(r.matched).not.toContain('e-hurva');
    expect(r.nodes).toHaveLength(pack.infraNodes.length);
  });

  it('matches case-insensitively and takes the object nearest the old estimate when several match', () => {
    const est = estimateOf('e-hurva');
    const near = point(1, 'HURVA stn', est.lat + 0.001, est.lng + 0.001);
    const far = point(2, 'Hurva (annan)', est.lat + 0.3, est.lng + 0.3);
    const r = applyOsmNodes(pack.infraNodes, withPower([far, near]), null);
    expect(r.nodes.find((n) => n.id === 'e-hurva')).toMatchObject({ lat: est.lat + 0.001, lng: est.lng + 0.001 });
  });

  it('every node has a coordSource, and only the regional grid renders hollow', () => {
    const r = applyOsmNodes(pack.infraNodes, geo, null);
    for (const n of r.nodes) expect(n.coordSource.length, n.id).toBeGreaterThan(0);
    expect(r.nodes.filter((n) => !n.verified).map((n) => n.id)).toEqual(['e-regionnat']);
    // A node still on an estimate says in both languages how the estimate was made (Sege is one that OpenStreetMap replaces when it has a match).
    for (const n of pack.infraNodes.filter((x) => x.coordConfidence === 'estimate')) expect(n.coordSource, n.id).toMatch(/ \/ /);
    expect(pack.infraNodes.filter((x) => x.coordConfidence === 'estimate').map((x) => x.id).sort()).toEqual(['e-sege', 'w-kallby']);
  });
});

describe('power lines (SPEC.md § 12.5)', () => {
  it('labels voltages: 400000 → 400 kV, 400000;220000 → 400/220 kV, nothing → empty', () => {
    expect(voltageLabel('400000')).toBe('400 kV');
    expect(voltageLabel('220000')).toBe('220 kV');
    expect(voltageLabel('400000;220000')).toBe('400/220 kV');
    expect(voltageLabel(null)).toBe('');
  });
  it('turns the lines of power.json into labelled polylines in [lat, lng] order, one line per connected set of ways, with its label on the line', () => {
    const lines = powerLines(geo);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.every((l) => l.label.endsWith('kV') && l.segments.every((s) => s.length >= 2 && s[0][0] > 50 && s[0][0] < 70))).toBe(true);
    expect(lines.find((l) => l.label === '400 kV')!.highest).toBe(400);
    if (geo.source.power === 'fixture') expect(lines.map((l) => [l.label, l.segments.length])).toEqual([['400 kV', 3]]); // the three connected ways of the fixture
    for (const l of lines) expect(l.segments.some((s) => s.some((p) => p[0] === l.labelAt[0] && p[1] === l.labelAt[1]))).toBe(true);
  });
  it('draws only 400 and 220 kV, and merges ways that share an end point and a voltage into one line with one label', () => {
    const line = (id: number, voltage: string, pts: Array<[number, number]>) => ({ type: 'Feature' as const, properties: { id, power: 'line', name: null, operator: null, voltage }, geometry: { type: 'LineString' as const, coordinates: pts.map(([a, b]) => [b, a]) } });
    const fake = {
      power: {
        type: 'FeatureCollection' as const,
        features: [
          line(1, '400000', [[59.1, 18.0], [59.2, 18.1]]),
          line(2, '400000', [[59.2, 18.1], [59.3, 18.2]]), // continues line 1: one line
          line(3, '400000', [[59.5, 18.5], [59.6, 18.6]]), // a separate 400 kV line
          line(4, '220000', [[59.2, 18.1], [59.25, 18.3]]), // another tier: not merged with the 400 kV ways
          line(5, '70000', [[59.0, 18.0], [59.05, 18.05]]), // 70 kV: not drawn
        ],
      },
    } as unknown as Parameters<typeof powerLines>[0];
    const lines = powerLines(fake);
    expect(lines.map((l) => [l.label, l.segments.length]).sort()).toEqual([['220 kV', 1], ['400 kV', 1], ['400 kV', 2]]);
    expect(lines.some((l) => l.highest < 220)).toBe(false);
  });
  it('the hand-drawn el links between nodes are all unverified and schematic; the off-map arrows stay', () => {
    const el = pack.infraLinks.filter((l) => l.layer === 'el');
    expect(el.filter((l) => !l.offmap).every((l) => !l.verified && l.style === 'dashed')).toBe(true);
    expect(el.filter((l) => l.offmap)).toHaveLength(3);
  });
});
