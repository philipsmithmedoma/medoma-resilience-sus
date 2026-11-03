// Pure conversion of Overpass answers (`out body geom`) to the GeoJSON files of SPEC.md § 12.2. No network here;
// scripts/fetch-osm.mjs does the fetching and writing. Coordinates are rounded to 5 decimals (about 1 m), so the
// same OSM node always gets the same coordinates in every way that contains it.

const EARTH_M = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;

/** Haversine distance in metres between [lng, lat] points. */
export function haversine(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

/** Distance in metres from point p to the segment a–b (local equirectangular projection, good for short segments). */
export function pointSegmentMetres(p, a, b) {
  const k = Math.cos(toRad(p[1]));
  const m = (q) => [(q[0] - p[0]) * k * 111320, (q[1] - p[1]) * 110540];
  const A = m(a);
  const B = m(b);
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(A[0] * dx + A[1] * dy) / len2));
  return Math.hypot(A[0] + t * dx, A[1] + t * dy);
}

/**
 * Douglas–Peucker. Both ends are always kept, and so is every index in `keep` (vertices shared with another way:
 * dropping those would cut the junction out of the road graph).
 */
export function simplify(points, toleranceM, keep = new Set()) {
  if (points.length <= 2) return points.slice();
  const kept = new Set([0, points.length - 1, ...[...keep].filter((i) => i >= 0 && i < points.length)]);
  const sorted = [...kept].sort((x, y) => x - y);
  for (let s = 0; s < sorted.length - 1; s++) recurse(points, sorted[s], sorted[s + 1], toleranceM, kept);
  return [...kept].sort((x, y) => x - y).map((i) => points[i]);
}

function recurse(points, first, last, tol, kept) {
  if (last <= first + 1) return;
  let worst = -1;
  let index = -1;
  for (let i = first + 1; i < last; i++) {
    const d = pointSegmentMetres(points[i], points[first], points[last]);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst > tol) {
    kept.add(index);
    recurse(points, first, index, tol, kept);
    recurse(points, index, last, tol, kept);
  }
}

export const round5 = (n) => Math.round(n * 1e5) / 1e5;
const coords = (geometry) => (geometry ?? []).filter((g) => g && typeof g.lat === 'number').map((g) => [round5(g.lon), round5(g.lat)]);
const feature = (geometry, properties) => ({ type: 'Feature', properties, geometry });
const collection = (features) => ({ type: 'FeatureCollection', features });
const ways = (osm) => (osm.elements ?? []).filter((e) => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length >= 2);
const nodes = (osm) => (osm.elements ?? []).filter((e) => e.type === 'node' && typeof e.lat === 'number');
const truthy = (v) => v !== undefined && v !== 'no';

/** Centroid (mean of the vertices) of a way's geometry as [lng, lat]. */
export function centroid(geometry) {
  const pts = coords(geometry);
  const n = pts.length - (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1] ? 1 : 0);
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += pts[i][0];
    y += pts[i][1];
  }
  return [round5(x / n), round5(y / n)];
}

/** One-way ways: oneway=yes/true/1, -1 (reversed: the geometry is flipped), and the implied cases motorway and roundabout. */
function onewayOf(tags) {
  const v = tags.oneway;
  if (v === '-1' || v === 'reverse') return { oneway: true, reverse: true };
  if (v === 'yes' || v === 'true' || v === '1') return { oneway: true, reverse: false };
  if (v === 'no' || v === 'false' || v === '0') return { oneway: false, reverse: false };
  const implied = tags.highway === 'motorway' || tags.highway === 'motorway_link' || tags.junction === 'roundabout';
  return { oneway: implied, reverse: false };
}

/** roads.json: LineStrings with id, highway, name, ref, bridge, tunnel, oneway, lanes; shared nodes survive simplification. */
export function convertRoads(osm, toleranceM = 8) {
  const uses = new Map();
  for (const w of ways(osm)) for (const id of new Set(w.nodes ?? [])) uses.set(id, (uses.get(id) ?? 0) + 1);
  const out = [];
  for (const w of ways(osm)) {
    const t = w.tags ?? {};
    const { oneway, reverse } = onewayOf(t);
    let pts = coords(w.geometry);
    let ids = w.nodes ?? [];
    if (reverse) {
      pts = pts.reverse();
      ids = [...ids].reverse();
    }
    const keep = new Set();
    ids.forEach((id, i) => {
      if ((uses.get(id) ?? 0) >= 2) keep.add(i);
    });
    // A node that occurs twice in one way (a loop) is also a junction.
    const seen = new Set();
    ids.forEach((id, i) => {
      if (seen.has(id)) keep.add(i);
      seen.add(id);
    });
    const line = ids.length === pts.length ? simplify(pts, toleranceM, keep) : simplify(pts, toleranceM);
    const lanes = t.lanes !== undefined && Number.isFinite(Number(t.lanes)) ? Number(t.lanes) : null;
    out.push(
      feature({ type: 'LineString', coordinates: line }, {
        id: w.id,
        highway: t.highway ?? '',
        name: t.name ?? null,
        ref: t.ref ?? null,
        bridge: truthy(t.bridge),
        tunnel: truthy(t.tunnel),
        oneway,
        lanes,
      }),
    );
  }
  return collection(out);
}

/** streets.json: LineStrings with id and name; used only to place patients. */
export function convertStreets(osm, toleranceM = 8) {
  return collection(
    ways(osm).map((w) => feature({ type: 'LineString', coordinates: simplify(coords(w.geometry), toleranceM) }, { id: w.id, name: w.tags?.name ?? null })),
  );
}

/** power.json: substations as centroid Points, 400/220 kV lines as LineStrings; properties id, power, name, operator, voltage. */
export function convertPower(osm, toleranceM = 8) {
  const out = [];
  const props = (e) => ({ id: e.id, power: e.tags?.power ?? '', name: e.tags?.name ?? null, operator: e.tags?.operator ?? null, voltage: e.tags?.voltage ?? null });
  for (const n of nodes(osm)) if (n.tags?.power === 'substation') out.push(feature({ type: 'Point', coordinates: [round5(n.lon), round5(n.lat)] }, props(n)));
  for (const w of ways(osm)) {
    if (w.tags?.power === 'substation') out.push(feature({ type: 'Point', coordinates: centroid(w.geometry) }, props(w)));
    else if (w.tags?.power === 'line') out.push(feature({ type: 'LineString', coordinates: simplify(coords(w.geometry), toleranceM) }, props(w)));
  }
  return collection(out);
}

/** water.json: water works as Points (nodes as they are, ways as centroids); properties id, name, operator. */
export function convertWater(osm) {
  const out = [];
  const props = (e) => ({ id: e.id, name: e.tags?.name ?? null, operator: e.tags?.operator ?? null });
  for (const n of nodes(osm)) out.push(feature({ type: 'Point', coordinates: [round5(n.lon), round5(n.lat)] }, props(n)));
  for (const w of ways(osm)) out.push(feature({ type: 'Point', coordinates: centroid(w.geometry) }, props(w)));
  return collection(out);
}

/** The four outputs, their queries and their size budgets in bytes (SPEC.md § 12.2). */
export const OUTPUTS = [
  { file: 'roads.json', query: 'roads', convert: convertRoads, budget: 2.5 * 1024 * 1024 },
  { file: 'streets.json', query: 'streets', convert: convertStreets, budget: 1.5 * 1024 * 1024 },
  { file: 'power.json', query: 'power', convert: convertPower, budget: 0.4 * 1024 * 1024 },
  { file: 'water.json', query: 'water', convert: convertWater, budget: Infinity },
];

export const BBOX = { roads: '59.15, 17.65, 59.52, 18.30', power: '59.10, 17.50, 59.60, 18.40', water: '59.10, 17.50, 59.60, 18.40', streets: 'within 2 500 m of each zone centre (SPEC.md § 11.4)' };

/**
 * The home packs that have geometry (SPEC.md § 14.5): the bounding boxes as south, west, north, east and the zone centres the
 * street query goes around. Karolinska's queries are the verbatim files of SPEC.md § 12.2; Lund's are built from this table.
 */
export const PACKS = {
  karolinska: {
    bbox: { roads: [59.15, 17.65, 59.52, 18.3], power: [59.1, 17.5, 59.6, 18.4], water: [59.1, 17.5, 59.6, 18.4] },
    streetCentres: [[59.3597, 18.0005], [59.3312, 18.0407], [59.3383, 17.9401], [59.3125, 18.0616], [59.2986, 18.0459], [59.2365, 17.9818], [59.1988, 17.8332], [59.31, 18.1648], [59.3661, 18.1352], [59.4451, 18.0717]],
    streetRadiusM: 2500,
  },
  lund: {
    // DATA.md § 14: bbox 55.58, 12.84, 55.93, 13.74; streets around the seven Lund zones.
    bbox: { roads: [55.58, 12.84, 55.93, 13.74], power: [55.58, 12.84, 55.93, 13.74], water: [55.58, 12.84, 55.93, 13.74] },
    streetCentres: [[55.706, 13.192], [55.792, 13.112], [55.695, 13.055], [55.642, 13.212], [55.666, 13.352], [55.838, 13.305], [55.851, 13.66]],
    streetRadiusM: 2500,
  },
};

const box = (b) => b.join(',');
const HIGHWAYS = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link';

/** The Overpass query text of one output for a pack and a bounding box (south, west, north, east); defaults to the pack's own. */
export function buildQuery(pack, name, bbox) {
  const cfg = PACKS[pack];
  if (!cfg) throw new Error(`Unknown pack "${pack}" (known: ${Object.keys(PACKS).join(', ')})`);
  const b = (name === 'streets' ? undefined : (bbox ?? cfg.bbox[name]));
  switch (name) {
    case 'roads':
      return `// roads.overpassql (${pack})\n[out:json][timeout:180];\nway["highway"~"^(${HIGHWAYS})$"](${box(b)});\nout body geom;\n`;
    case 'power':
      return `// power.overpassql (${pack})\n[out:json][timeout:120];\n(\n  node["power"="substation"]["voltage"~"400000|220000"](${box(b)});\n  way["power"="substation"]["voltage"~"400000|220000"](${box(b)});\n  way["power"="line"]["voltage"~"400000|220000"](${box(b)});\n);\nout body geom;\n`;
    case 'water':
      return `// water.overpassql (${pack})\n[out:json][timeout:60];\n(\n  node["man_made"="water_works"](${box(b)});\n  way["man_made"="water_works"](${box(b)});\n);\nout body geom;\n`;
    case 'streets':
      return `// streets.overpassql (${pack}) – one around clause per zone centre\n[out:json][timeout:180];\n(\n${cfg.streetCentres.map(([la, lo]) => `  way["highway"~"^(residential|living_street)$"](around:${cfg.streetRadiusM},${la},${lo});`).join('\n')}\n);\nout body geom;\n`;
    default:
      throw new Error(`Unknown query "${name}"`);
  }
}

/** The README that sits next to the data files of a pack. */
export function geoReadme(date, sizes, pack = 'karolinska') {
  const cfg = PACKS[pack];
  const area = (q) => (q === 'streets' ? `within ${cfg.streetRadiusM.toLocaleString('en').replace(',', ' ')} m of each zone centre (${pack === 'lund' ? 'DATA.md § 14' : 'SPEC.md § 11.4'})` : cfg.bbox[q].map((n) => n.toFixed(2)).join(', '));
  const rows = OUTPUTS.map((o) => `| \`${o.file}\` | ${area(o.query)} | ${sizes[o.file] === undefined ? 'not fetched' : `${(sizes[o.file] / 1024).toFixed(1)} KB`} |`);
  return `# OpenStreetMap geometry – ${pack}

Source: OpenStreetMap via the Overpass API (https://overpass-api.de/api/interpreter), queries in \`scripts/overpass/${pack === 'karolinska' ? '' : `${pack}/`}\`.
Query date: ${date}.

Data © OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright). © OpenStreetMap contributors, ODbL.

| File | Area | Size |
|---|---|---|
${rows.join('\n')}

Line geometry is simplified with Douglas–Peucker at 8 m tolerance (vertices shared by two ways are kept so that junctions survive), coordinates are rounded to 5 decimals, and every tag other than those listed in SPEC.md § 12.2 is dropped. Generated by \`node scripts/fetch-osm.mjs ${pack}\`; do not edit by hand.
`;
}
