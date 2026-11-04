import { beforeAll, describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { loadGeoData, type GeoData, type PointFeature } from './geoData';
import { applyOsmNodes, osmCoordSource, powerLines, voltageLabel } from './osmNodes';

let geo: GeoData;
beforeAll(async () => {
  geo = await loadGeoData();
});

const point = (id: number, name: string, lat: number, lng: number): PointFeature => ({ type: 'Feature', properties: { id, name, power: 'substation' }, geometry: { type: 'Point', coordinates: [lng, lat] } });
const withPower = (features: GeoData['power']['features']): GeoData => ({ ...geo, power: { type: 'FeatureCollection', features } });

describe('nodes from OpenStreetMap (SPEC.md § 12.5)', () => {
  it('gives Överby, Beckomberga, Hagby and Görväln the position of the matching object, adds Kolbotten, and reports Skanstull (no match in the data) as missing', () => {
    const r = applyOsmNodes(pack.infraNodes, geo, null);
    // OpenStreetMap has no substation named Skanstull (query 2026-11-03): the node keeps its estimate and is reported (SPEC.md § 12.5).
    expect(r.missing).toEqual(['e-skanstull']);
    expect(r.matched.sort()).toEqual(['e-beckomberga', 'e-hagby', 'e-kolbotten', 'e-overby', 'w-gorvaln']);
    expect(r.nodes.find((n) => n.id === 'e-skanstull')).toEqual(pack.infraNodes.find((n) => n.id === 'e-skanstull'));
    const node = (id: string) => r.nodes.find((n) => n.id === id)!;
    // The real data can hold several objects with a name (two Överby substations, two Görväln works); the code takes the one nearest
    // the old estimate, so the expectation does too.
    const expected = (nodeId: string, term: string, features: Array<{ properties: { name?: string | null }; geometry: { coordinates: unknown } }>) => {
      const est = pack.infraNodes.find((n) => n.id === nodeId)!;
      const hits = features.filter((f) => f.properties.name?.toLowerCase().includes(term.toLowerCase())) as Array<{ geometry: { coordinates: [number, number] } }>;
      const d = (f: (typeof hits)[number]) => Math.hypot(f.geometry.coordinates[1] - est.lat, f.geometry.coordinates[0] - est.lng);
      return [...hits].sort((x, y) => d(x) - d(y))[0].geometry.coordinates;
    };
    const at = (id: string) => [node(id).lng, node(id).lat];
    expect(at('e-overby')).toEqual(expected('e-overby', 'Överby', geo.power.features));
    expect(at('e-beckomberga')).toEqual(expected('e-beckomberga', 'Beckomberga', geo.power.features)); // "Stamstation Beckomberga": a substring match
    expect(at('e-hagby')).toEqual(expected('e-hagby', 'Hagby', geo.power.features.filter((f) => f.properties.power === 'substation')));
    expect(at('w-gorvaln')).toEqual(expected('w-gorvaln', 'Görväln', geo.water.features));
    expect(node('e-kolbotten')).toMatchObject({ layer: 'el', kind: 'transmission', verified: true });
    expect(r.nodes).toHaveLength(pack.infraNodes.length + 1);
  });

  it('leaves the other nodes as they were and does not change the pack', () => {
    const before = JSON.stringify(pack.infraNodes);
    const r = applyOsmNodes(pack.infraNodes, geo, null);
    expect(JSON.stringify(pack.infraNodes)).toBe(before);
    expect(r.nodes.find((n) => n.id === 'r-essingeleden')).toEqual(pack.infraNodes.find((n) => n.id === 'r-essingeleden'));
  });

  it('marks real OpenStreetMap positions reported with the query date and fixture positions illustrative', () => {
    expect(osmCoordSource('osm', '2026-11-03')).toEqual({ confidence: 'reported', source: 'OpenStreetMap, 2026-11-03' });
    const fixture = osmCoordSource('fixture', null);
    expect(fixture.confidence).toBe('illustrative');
    expect(fixture.source).toContain('not been fetched');
    const real = applyOsmNodes(pack.infraNodes, { ...geo, source: { ...geo.source, power: 'osm', water: 'osm' } }, '2026-11-03');
    expect(real.nodes.find((n) => n.id === 'e-hagby')).toMatchObject({ coordConfidence: 'reported', coordSource: 'OpenStreetMap, 2026-11-03' });
    expect(real.nodes.find((n) => n.id === 'e-kolbotten')).toMatchObject({ coordConfidence: 'reported', coordSource: 'OpenStreetMap, 2026-11-03' });
  });

  it('keeps the estimate of a node with no match, reports it as missing and adds no Kolbotten', () => {
    const only = geo.power.features.filter((f) => !/hagby|kolbotten/i.test(f.properties.name ?? ''));
    const r = applyOsmNodes(pack.infraNodes, withPower(only), null);
    expect(r.missing.sort()).toEqual(['e-hagby', 'e-kolbotten', 'e-skanstull']); // Skanstull has no match in the real data either
    expect(r.nodes.find((n) => n.id === 'e-hagby')).toEqual(pack.infraNodes.find((n) => n.id === 'e-hagby'));
    expect(r.nodes.some((n) => n.id === 'e-kolbotten')).toBe(false);
  });

  it('matches case-insensitively and takes the object nearest the old estimate when several match', () => {
    const near = point(1, 'ÖVERBY stn', 59.476, 17.885);
    const far = point(2, 'Överby (annan)', 59.2, 17.7);
    const r = applyOsmNodes(pack.infraNodes, withPower([far, near]), null);
    expect(r.nodes.find((n) => n.id === 'e-overby')).toMatchObject({ lat: 59.476, lng: 17.885 });
  });

  it('every node has a coordSource, and only the regional grid renders hollow', () => {
    const r = applyOsmNodes(pack.infraNodes, geo, null);
    for (const n of r.nodes) expect(n.coordSource.length, n.id).toBeGreaterThan(0);
    expect(r.nodes.filter((n) => !n.verified).map((n) => n.id)).toEqual(['e-regionnat']);
    // The estimate basis texts of DATA.md § 11 are gone from the pack.
    for (const n of pack.infraNodes.filter((x) => x.coordConfidence === 'estimate' && x.id !== 'w-norrvatten-reserve' && x.id !== 'w-malaren')) {
      expect(n.coordSource, n.id).toBe('Fallback estimate, used when OpenStreetMap has no matching object (DATA.md § 12)');
    }
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
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.label.endsWith('kV') && l.segments.every((s) => s.length >= 2 && s[0][0] > 50 && s[0][0] < 70))).toBe(true);
    expect(lines.find((l) => l.label === '400 kV')!.highest).toBe(400);
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
  it('the hand-drawn el link between nodes is gone; the off-map arrows stay', () => {
    const el = pack.infraLinks.filter((l) => l.layer === 'el');
    expect(el.every((l) => l.offmap || l.a === 'e-regionnat')).toBe(true);
    expect(el.filter((l) => l.offmap)).toHaveLength(5);
  });
});
