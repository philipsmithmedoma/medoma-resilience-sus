// Writes the hand-designed fallback geometry used when the OpenStreetMap files in src/data/packs/geo/ are absent
// (SPEC.md § 12.4): fixture.json (roads), fixture-streets.json, fixture-power.json and fixture-water.json, all with the
// same schema as the files scripts/fetch-osm.mjs writes. The road topology is designed by hand to mirror the
// crossings of the real network (the north and the south of Stockholm meet only at the named crossings); the
// numbers are invented, the names are the real ones. Run: node scripts/make-geo-fixtures.mjs [karolinska|lund]
// (both without an argument); the files go to src/data/packs/geo/<pack>/ (SPEC.md § 14.5).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const geoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/packs/geo');
const out = path.join(geoRoot, 'karolinska');
const which = process.argv[2] ?? 'all';
const r5 = (n) => Math.round(n * 1e5) / 1e5;
const P = (lat, lng) => [r5(lng), r5(lat)]; // GeoJSON order

// Vertices shared between ways (written once so that they are identical).
const SOLNA_Z = P(59.3597, 18.0005);
const BROMMA_Z = P(59.3383, 17.9401);
const INNER_Z = P(59.3312, 18.0407);
const SODERMALM_Z = P(59.3125, 18.0616);
const SODERORT_Z = P(59.2986, 18.0459);
const HUDDINGE_Z = P(59.2365, 17.9818);
const BOTKYRKA_Z = P(59.1988, 17.8332);
const NACKA_Z = P(59.31, 18.1648);
const LIDINGO_Z = P(59.3661, 18.1352);
const TABY_Z = P(59.4451, 18.0717);
const HUDDINGE_SITE = P(59.2215, 17.939);
const J1 = P(59.356, 18.0335); // beside Karolinska Solna
const J_E = P(59.358, 18.02); // where Essingeleden leaves Solnavägen
const J2 = P(59.342, 18.07);
const J3 = P(59.329, 18.03);
const K1 = P(59.3165, 18.025);
const K2 = P(59.319, 18.064);
const K3 = P(59.3195, 18.07);
const L1 = P(59.305, 18.035);
const L2 = P(59.301, 18.09);
const SKANSTULL = P(59.3029, 18.0795);
const J5 = P(59.298, 18.015);

// id, name, ref, highway, bridge, tunnel, oneway, points
const W = (id, name, ref, highway, bridge, tunnel, points) => ({ id, name, ref, highway, bridge, tunnel, oneway: false, points });
const corridors = [
  W(9000001, 'Uppsalavägen', 'E4', 'trunk', false, false, [TABY_Z, P(59.41, 18.045), J1]),
  W(9000002, 'Solnavägen', null, 'primary', false, false, [SOLNA_Z, J_E, J1]),
  W(9000003, 'Sundbybergsvägen', null, 'secondary', false, false, [BROMMA_Z, P(59.35, 17.97), SOLNA_Z]),
  W(9000004, 'Norra länken', 'E4', 'motorway', false, true, [J1, P(59.35, 18.05), J2]),
  W(9000005, 'Valhallavägen', null, 'primary', false, false, [J2, P(59.338, 18.055), INNER_Z, J3]),
  W(9000006, 'Lidingövägen', null, 'primary', true, false, [J2, P(59.355, 18.1), LIDINGO_Z]),
  W(9000007, 'Essingeleden', 'E4', 'trunk', true, false, [J_E, P(59.34, 18.01), P(59.3257, 18.0045), P(59.31, 18.01), J5]),
  W(9000008, 'Västerbron', null, 'primary', true, false, [J3, P(59.3243, 18.0275), K1]),
  W(9000009, 'Centralbron', null, 'primary', true, false, [INNER_Z, P(59.3264, 18.0635), K2]),
  W(9000010, 'Munkbroleden', null, 'primary', false, false, [INNER_Z, P(59.325, 18.056), K3]),
  W(9000011, 'Skeppsbron', null, 'secondary', false, false, [P(59.338, 18.055), P(59.33, 18.07), K3]),
  W(9000012, 'Katarinavägen', null, 'secondary', false, false, [K3, P(59.32, 18.08)]),
  W(9000013, 'Stadsgårdsleden', null, 'primary', false, false, [K3, P(59.318, 18.09), L2]),
  W(9000014, 'Liljeholmsbron', null, 'primary', true, false, [K1, P(59.3134, 18.0319), L1]),
  W(9000015, 'Skanstullsbron', null, 'primary', true, false, [K2, SKANSTULL, L2]),
  W(9000016, 'Södra länken', 'E4', 'motorway', false, true, [L2, P(59.301, 18.1054), NACKA_Z]),
  W(9000017, 'Götgatan', null, 'secondary', false, false, [K3, SODERMALM_Z, SKANSTULL]),
  W(9000018, 'Söderledstunneln', null, 'trunk', false, true, [K1, P(59.31, 18.04), SODERORT_Z]),
  W(9000019, 'Södertäljevägen', 'E4', 'trunk', false, false, [J5, P(59.27, 17.99), P(59.25, 17.97), HUDDINGE_Z, HUDDINGE_SITE]),
  W(9000021, 'Södertäljevägen', 'E4', 'trunk', false, false, [HUDDINGE_SITE, P(59.2, 17.88), BOTKYRKA_Z]),
  W(9000020, 'Västberga allé', null, 'secondary', false, false, [J5, L1, SODERORT_Z]),
];

// One ring road of 0.9 km radius per zone, so that every street of the fixture is close to a vertex of its own zone. Only junctions
// and way ends are vertices, so each ring is eight short ways (and a spoke to the zone centre), not one long way.
const zones = [
  ['Solna', SOLNA_Z], ['Innerstaden', INNER_Z], ['Bromma', BROMMA_Z], ['Södermalm', SODERMALM_Z], ['Söderort', SODERORT_Z],
  ['Huddinge', HUDDINGE_Z], ['Botkyrka', BOTKYRKA_Z], ['Nacka', NACKA_Z], ['Lidingö', LIDINGO_Z], ['Täby', TABY_Z],
];
const RING_POINTS = 8;
const ringPoints = (c) => {
  const pts = [];
  for (let i = 0; i < RING_POINTS; i++) {
    const a = (i * 2 * Math.PI) / RING_POINTS;
    pts.push([r5(c[0] + (0.9 * Math.sin(a)) / (111.32 * Math.cos((c[1] * Math.PI) / 180))), r5(c[1] + (0.9 * Math.cos(a)) / 111.32)]);
  }
  return pts;
};
const rings = zones.flatMap(([name, c], zi) => {
  const ring = ringPoints(c);
  const segments = ring.map((pt, i) => [pt, ring[(i + 1) % RING_POINTS]]);
  return [[c, ring[0]], ...segments].map((pts, i) => W(9000100 + zi * 20 + i, `${name} ringväg`, null, 'secondary', false, false, pts));
});

const lineFeature = (w) => ({
  type: 'Feature',
  properties: { id: w.id, highway: w.highway, name: w.name, ref: w.ref, bridge: w.bridge, tunnel: w.tunnel, oneway: w.oneway, lanes: null },
  geometry: { type: 'LineString', coordinates: w.points },
});
const collection = (features) => ({ type: 'FeatureCollection', features });

// Streets: ten short residential streets per zone, each within 120 m of a vertex of the zone's own ring road, so that a
// patient placed on one snaps to its own zone's vertex and not across the water to a neighbouring zone's.
let seed = 20261103;
const rnd = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const STREET_NAMES = ['Provgatan', 'Testvägen', 'Fixturgränd', 'Exempelstigen', 'Modellvägen', 'Provbacken', 'Testgatan', 'Fixturvägen', 'Exempelgatan', 'Modellgränd'];
const streets = [];
zones.forEach(([zoneName, c], zi) => {
  const ring = ringPoints(c);
  for (let i = 0; i < 10; i++) {
    const anchor = ring[Math.floor(rnd() * ring.length)];
    const d = 0.12 * Math.sqrt(rnd());
    const b = rnd() * 2 * Math.PI;
    const a = P(anchor[1] + (d * Math.cos(b)) / 111.32, anchor[0] + (d * Math.sin(b)) / (111.32 * Math.cos((anchor[1] * Math.PI) / 180)));
    const dir = rnd() * 2 * Math.PI;
    const step = 0.04;
    const m = P(a[1] + (step * Math.cos(dir)) / 111.32, a[0] + (step * Math.sin(dir)) / (111.32 * Math.cos((a[1] * Math.PI) / 180)));
    const e = P(m[1] + (step * Math.cos(dir)) / 111.32, m[0] + (step * Math.sin(dir)) / (111.32 * Math.cos((m[1] * Math.PI) / 180)));
    streets.push({ type: 'Feature', properties: { id: 9100000 + zi * 100 + i, name: `${STREET_NAMES[i]} i ${zoneName}` }, geometry: { type: 'LineString', coordinates: [a, m, e] } });
  }
});

// Power: the substations the pack looks for, a few 400 and 220 kV lines. Positions differ slightly from the
// estimates in DATA.md § 11.2 so that a test can tell that the OSM position was taken.
const sub = (id, name, lat, lng, voltage) => ({ type: 'Feature', properties: { id, power: 'substation', name, operator: 'Svenska kraftnät', voltage }, geometry: { type: 'Point', coordinates: P(lat, lng) } });
const line = (id, voltage, pts) => ({ type: 'Feature', properties: { id, power: 'line', name: null, operator: 'Svenska kraftnät', voltage }, geometry: { type: 'LineString', coordinates: pts.map(([a, b]) => P(a, b)) } });
const power = collection([
  sub(9200001, 'Överby', 59.4761, 17.8851, '400000'),
  sub(9200002, 'Beckomberga ställverk', 59.3566, 17.9011, '220000'),
  sub(9200003, 'Hagby', 59.4718, 18.0226, '400000'),
  sub(9200004, 'Skanstull', 59.3031, 18.0788, '400000'),
  sub(9200005, 'Kolbotten', 59.2662, 17.8946, '220000'),
  sub(9200006, 'Annan station', 59.5, 18.3, '400000'),
  line(9200101, '220000', [[59.4761, 17.8851], [59.42, 17.89], [59.3566, 17.9011]]),
  line(9200102, '400000', [[59.4761, 17.8851], [59.4742, 17.95], [59.4718, 18.0226]]),
  line(9200103, '220000', [[59.3566, 17.9011], [59.31, 17.9], [59.2662, 17.8946]]),
]);
const water = collection([
  { type: 'Feature', properties: { id: 9300001, name: 'Görvälnverket', operator: 'Norrvatten' }, geometry: { type: 'Point', coordinates: P(59.4331, 17.7819) } },
  { type: 'Feature', properties: { id: 9300002, name: 'Lovö vattenverk', operator: 'SVOA' }, geometry: { type: 'Point', coordinates: P(59.3307, 17.8093) } },
]);

if (which === 'all' || which === 'karolinska') {
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(collection([...corridors, ...rings].map(lineFeature))));
  writeFileSync(path.join(out, 'fixture-streets.json'), JSON.stringify(collection(streets)));
  writeFileSync(path.join(out, 'fixture-power.json'), JSON.stringify(power));
  writeFileSync(path.join(out, 'fixture-water.json'), JSON.stringify(water));
  console.log(`fixture: ${corridors.length} corridor ways + ${rings.length} zone ring segments, ${streets.length} streets`);
}

// ---------------------------------------------------------------------------------------------------------------------
// SUS Lund (DATA.md § 14, SPEC.md § 14.5). The topology mirrors what the Lund tests need: the city around the hospital meets
// the rest of the pack only through the two E22 interchanges, whose ways carry the OSM names "Trafikplats Lund Norra" and
// "Trafikplats Lund Södra"; every other zone hangs on a road that leaves through one of them. Numbers are invented.
if (which === 'all' || which === 'lund') {
  const lundOut = path.join(geoRoot, 'lund');
  mkdirSync(lundOut, { recursive: true });
  const SITE_L = P(55.7118, 13.1985);
  const LUND_Z = P(55.706, 13.192);
  const KAVLINGE_Z = P(55.792, 13.112);
  const LOMMA_Z = P(55.695, 13.055);
  const STAFFAN_Z = P(55.642, 13.212);
  const DALBY_Z = P(55.666, 13.352);
  const ESLOV_Z = P(55.838, 13.305);
  const HORBY_Z = P(55.851, 13.66);
  const TPL_N = P(55.717, 13.2225);
  const J_N = P(55.7145, 13.2085);
  const HOJE = P(55.6895, 13.1975); // E22 over Höje å, the city's southern junction
  const TPL_S = P(55.6803, 13.1828);
  const GARD = P(55.7712, 13.3226);
  const lw = (id, name, ref, highway, bridge, tunnel, points) => W(id, name, ref, highway, bridge, tunnel, points);
  const lundWays = [
    lw(9500001, 'Entrégatan', null, 'secondary', false, false, [SITE_L, LUND_Z]),
    lw(9500002, 'Norra Ringen', null, 'secondary', false, false, [SITE_L, J_N]),
    lw(9500003, 'Södra vägen', null, 'secondary', false, false, [LUND_Z, HOJE]),
    lw(9500004, 'Trafikplats Lund Norra', 'E22', 'motorway_link', false, false, [J_N, TPL_N]),
    lw(9500005, 'Trafikplats Lund Södra', 'E22', 'motorway_link', true, false, [HOJE, TPL_S]),
    lw(9500006, 'E22', 'E22', 'motorway', false, false, [TPL_N, GARD]),
    lw(9500007, 'E22', 'E22', 'motorway', false, false, [GARD, P(55.81, 13.45), HORBY_Z]),
    lw(9500008, 'Väg 108', '108', 'primary', false, false, [TPL_N, P(55.75, 13.15), KAVLINGE_Z]),
    lw(9500009, 'Väg 102', '102', 'primary', false, false, [GARD, ESLOV_Z]),
    lw(9500010, 'E22', 'E22', 'motorway', false, false, [TPL_S, P(55.66, 13.2), STAFFAN_Z]),
    lw(9500011, 'Väg 108', '108', 'primary', false, false, [TPL_S, P(55.672, 13.28), DALBY_Z]),
    lw(9500012, 'Väg 102', '102', 'primary', false, false, [TPL_S, P(55.688, 13.12), LOMMA_Z]),
  ];
  const lundZones = [['Lund', LUND_Z], ['Kävlinge', KAVLINGE_Z], ['Lomma', LOMMA_Z], ['Staffanstorp', STAFFAN_Z], ['Dalby', DALBY_Z], ['Eslöv', ESLOV_Z], ['Hörby', HORBY_Z]];
  const lundRings = lundZones.flatMap(([name, c], zi) => {
    const ring = ringPoints(c);
    const segments = ring.map((pt, i) => [pt, ring[(i + 1) % RING_POINTS]]);
    return [[c, ring[0]], ...segments].map((pts, i) => lw(9500100 + zi * 20 + i, `${name} ringväg`, null, 'secondary', false, false, pts));
  });
  let lseed = 20261017;
  const lrnd = () => {
    lseed = (Math.imul(lseed, 1664525) + 1013904223) >>> 0;
    return lseed / 4294967296;
  };
  const LSTREETS = ['Provgatan', 'Testvägen', 'Fixturgränd', 'Exempelstigen', 'Modellvägen', 'Provbacken', 'Testgatan', 'Fixturvägen', 'Exempelgatan', 'Modellgränd', 'Provgränd', 'Testbacken', 'Fixturgatan', 'Exempelvägen', 'Modellgatan', 'Provstigen'];
  const lundStreets = [];
  lundZones.forEach(([zoneName, c], zi) => {
    const ring = ringPoints(c);
    for (let i = 0; i < 16; i++) {
      const anchor = ring[Math.floor(lrnd() * ring.length)];
      const d = 0.12 * Math.sqrt(lrnd());
      const b = lrnd() * 2 * Math.PI;
      const a = P(anchor[1] + (d * Math.cos(b)) / 111.32, anchor[0] + (d * Math.sin(b)) / (111.32 * Math.cos((anchor[1] * Math.PI) / 180)));
      const dir = lrnd() * 2 * Math.PI;
      const step = 0.04;
      const m = P(a[1] + (step * Math.cos(dir)) / 111.32, a[0] + (step * Math.sin(dir)) / (111.32 * Math.cos((a[1] * Math.PI) / 180)));
      const e = P(m[1] + (step * Math.cos(dir)) / 111.32, m[0] + (step * Math.sin(dir)) / (111.32 * Math.cos((m[1] * Math.PI) / 180)));
      lundStreets.push({ type: 'Feature', properties: { id: 9600000 + zi * 100 + i, name: `${LSTREETS[i]} i ${zoneName}` }, geometry: { type: 'LineString', coordinates: [a, m, e] } });
    }
  });
  // Substations and works under the names the pack looks for; positions differ a little from DATA.md § 14 so that a test can tell that the OSM position was taken.
  const lsub = (id, name, lat, lng) => ({ type: 'Feature', properties: { id, power: 'substation', name, operator: 'Svenska kraftnät', voltage: '400000' }, geometry: { type: 'Point', coordinates: P(lat, lng) } });
  const lline = (id, pts) => ({ type: 'Feature', properties: { id, power: 'line', name: null, operator: 'Svenska kraftnät', voltage: '400000' }, geometry: { type: 'LineString', coordinates: pts.map(([a, b]) => P(a, b)) } });
  const lundPower = collection([
    lsub(9700001, 'Hurva', 55.8318, 13.6027),
    lsub(9700002, 'Barsebäck', 55.7441, 12.9211),
    lsub(9700003, 'Sege', 55.6177, 13.0846),
    lline(9700101, [[55.8318, 13.6027], [55.72, 13.35], [55.6177, 13.0846]]),
    lline(9700102, [[55.8318, 13.6027], [55.79, 13.2], [55.7441, 12.9211]]),
    lline(9700103, [[55.7441, 12.9211], [55.68, 13.0], [55.6177, 13.0846]]),
  ]);
  const lundWater = collection([
    { type: 'Feature', properties: { id: 9800001, name: 'Ringsjöverket', operator: 'Sydvatten' }, geometry: { type: 'Point', coordinates: P(55.8951, 13.3942) } },
    { type: 'Feature', properties: { id: 9800002, name: 'Vombverket', operator: 'Sydvatten' }, geometry: { type: 'Point', coordinates: P(55.6628, 13.5287) } },
  ]);
  writeFileSync(path.join(lundOut, 'fixture.json'), JSON.stringify(collection([...lundWays, ...lundRings].map(lineFeature))));
  writeFileSync(path.join(lundOut, 'fixture-streets.json'), JSON.stringify(collection(lundStreets)));
  writeFileSync(path.join(lundOut, 'fixture-power.json'), JSON.stringify(lundPower));
  writeFileSync(path.join(lundOut, 'fixture-water.json'), JSON.stringify(lundWater));
  console.log(`lund fixture: ${lundWays.length} named ways + ${lundRings.length} zone ring segments, ${lundStreets.length} streets`);
}
