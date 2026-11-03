// Generates src/data/packs/patients.ts once, deterministically (SPEC.md § 6.7): 40 patients per site,
// wards from DATA.md § 5.1, the first prototype's distribution constraints, ages 24–91, 12 home care
// eligible per site. Run: node scripts/generate-patients.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SEED = 20260904;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const repeat = (value, n) => Array.from({ length: n }, () => value);

// 80 family names and 40 given names; no name coincides with a person in DATA.md § 7.
const FAMILY = [
  'Andersson', 'Bergström', 'Carlsson', 'Dahl', 'Ekström', 'Forsberg', 'Gustafsson', 'Hedlund', 'Isaksson', 'Jonsson',
  'Karlsson', 'Lindqvist', 'Magnusson', 'Nyström', 'Olofsson', 'Persson', 'Qvist', 'Rosén', 'Sandberg', 'Törnqvist',
  'Ullman', 'Vikström', 'Wallin', 'Åberg', 'Öhman', 'Blomkvist', 'Cederholm', 'Engström', 'Fransson', 'Grahn',
  'Hallberg', 'Ivarsson', 'Järvinen', 'Klingberg', 'Lundmark', 'Molin', 'Norén', 'Odén', 'Palm', 'Runesson',
  'Sjögren', 'Thorell', 'Uddén', 'Vinter', 'Wikander', 'Axelsson', 'Brandt', 'Collin', 'Danielsson', 'Edlund',
  'Fagerström', 'Gyllenhammar', 'Holmgren', 'Ingesson', 'Jakobsson', 'Kjellberg', 'Lindahl', 'Malmqvist', 'Nordlund', 'Oskarsson',
  'Pettersson', 'Rehn', 'Sundin', 'Tegnér', 'Ulvsköld', 'Viklund', 'Westin', 'Ytterberg', 'Zetterlund', 'Ahlgren',
  'Björk', 'Claesson', 'Dahlberg', 'Eliasson', 'Friberg', 'Granlund', 'Hägglund', 'Isberg', 'Johannesson', 'Kron',
];
const GIVEN = ['Anna', 'Björn', 'Cecilia', 'David', 'Elin', 'Fredrik', 'Gunilla', 'Hans', 'Ingrid', 'Johan', 'Karin', 'Lars', 'Maria', 'Nils', 'Olivia', 'Per', 'Rebecka', 'Stefan', 'Tove', 'Ulf', 'Vera', 'William', 'Ylva', 'Åsa', 'Örjan', 'Birgitta', 'Christer', 'Daniel', 'Eva', 'Filip', 'Gustav', 'Helena', 'Isak', 'Jenny', 'Klara', 'Leif', 'Monika', 'Noah', 'Oskar', 'Pia'];

// Wards per site (DATA.md § 5.1), 40 patients per site.
const WARDS = {
  solna: [
    ['HKN Kardiologi', 6], ['HKN Neurologi', 5], ['Cancer Onkologi', 5], ['Cancer Hematologi', 4],
    ['ARM Ortopedi', 5], ['ARM Kirurgi', 5], ['I&Å Internmedicin', 6], ['KVH Gynekologi', 4],
  ],
  huddinge: [
    ['I&Å Internmedicin', 7], ['ARM Kirurgi', 6], ['ARM Ortopedi', 6], ['ARM Infektion', 5],
    ['Cancer Onkologi', 6], ['HKN Kardiologi', 6], ['KVH Gynekologi', 4],
  ],
};

const careLevel = { Stable: 'Ward', Monitor: 'Monitored', Critical: 'Intensive' };
const TODAY = new Date(Date.UTC(2026, 8, 4));
function pin(age) {
  const daysBack = randInt(0, 364);
  const birth = new Date(Date.UTC(TODAY.getUTCFullYear() - age, TODAY.getUTCMonth(), TODAY.getUTCDate()));
  birth.setUTCDate(birth.getUTCDate() - daysBack);
  const y = birth.getUTCFullYear();
  const m = String(birth.getUTCMonth() + 1).padStart(2, '0');
  const d = String(birth.getUTCDate()).padStart(2, '0');
  const suffix = String(randInt(0, 9999)).padStart(4, '0');
  return `${y}${m}${d}-${suffix}`;
}

function generateSite(site, offset) {
  const wards = WARDS[site].flatMap(([name, n]) => repeat(name, n));
  // Stability 22 / 12 / 6, shuffled across the wards.
  const stability = shuffle([...repeat('Stable', 22), ...repeat('Monitor', 12), ...repeat('Critical', 6)]);
  // Transport per stability group (totals: 14 Walking, 10 Wheelchair, 12 Stretcher, 2 Ambulance, 2 ICT).
  const transportPools = {
    Stable: shuffle([...repeat('Walking', 14), ...repeat('Wheelchair', 6), ...repeat('Stretcher', 2)]),
    Monitor: shuffle([...repeat('Wheelchair', 4), ...repeat('Stretcher', 8)]),
    Critical: shuffle([...repeat('Stretcher', 2), ...repeat('Ambulance', 2), ...repeat('Intensive care transport', 2)]),
  };
  // Equipment: 18 none, 10 Oxygen, 8 IV infusion, 6 Monitoring (24 items over 22 patients).
  const equipmentPools = {
    Stable: shuffle([...repeat(['Oxygen'], 4), ...repeat(['IV infusion'], 2), ...repeat([], 16)]),
    Monitor: shuffle([...repeat(['Oxygen'], 4), ...repeat(['IV infusion'], 6), ...repeat([], 2)]),
    Critical: shuffle([...repeat(['Monitoring', 'Oxygen'], 2), ...repeat(['Monitoring'], 4)]),
  };
  const patients = [];
  for (let i = 0; i < 40; i++) {
    const st = stability[i];
    const age = randInt(24, 91);
    patients.push({
      id: `${site === 'solna' ? 'ps' : 'ph'}-${i + 1}`,
      familyName: FAMILY[offset + i],
      givenName: GIVEN[(i + (site === 'solna' ? 17 : 29)) % 40],
      pin: pin(age),
      age,
      ward: wards[i],
      nodeId: site,
      stability: st,
      careLevel: careLevel[st],
      transport: transportPools[st].pop(),
      equipment: equipmentPools[st].pop(),
      homeCareEligible: false,
    });
  }
  const candidates = shuffle(patients.filter((p) => p.stability === 'Stable' && (p.transport === 'Walking' || p.transport === 'Wheelchair')));
  candidates.slice(0, 12).forEach((p) => (p.homeCareEligible = true));
  return patients;
}

const all = { solna: generateSite('solna', 0), huddinge: generateSite('huddinge', 40) };

const line = (p) => `  ${JSON.stringify(p).replace(/"([a-zA-Z]+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ').replace(/\{/g, '{ ').replace(/\}/g, ' }')},`;
const out = `// Generated by scripts/generate-patients.mjs (seed ${SEED}). Do not edit by hand.
import type { Patient, SiteId } from './types';

export const PATIENTS_BY_SITE: Record<SiteId, Patient[]> = {
  solna: [
${all.solna.map(line).join('\n')}
  ],
  huddinge: [
${all.huddinge.map(line).join('\n')}
  ],
};
`;

const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/packs/patients.ts');
writeFileSync(target, out);
console.log(`Wrote ${all.solna.length + all.huddinge.length} patients to ${target}`);

// ---------------------------------------------------------------------------
// Hospital at Home (SPEC.md § 11.4): 150 synthetic home care patients, a second seeded generator that
// writes src/data/packs/home-patients.ts. It has its own random stream, so the hospital patients above
// are unaffected by it.
const HOME_SEED = 20261102;
const rand2 = mulberry32(HOME_SEED);
const randInt2 = (min, max) => min + Math.floor(rand2() * (max - min + 1));

// zone id, centre, radius (km), patients, ASIH team (SPEC.md § 11.4 table)
const HOME_ZONES = [
  ['solna', 59.3597, 18.0005, 2.5, 25, 'ASIH Nord'],
  ['innerstaden', 59.3312, 18.0407, 2.0, 20, 'ASIH City'],
  ['bromma', 59.3383, 17.9401, 2.5, 15, 'ASIH Nord'],
  ['sodermalm', 59.3125, 18.0616, 1.8, 15, 'ASIH City'],
  ['soderort', 59.2986, 18.0459, 2.5, 20, 'ASIH Syd'],
  ['huddinge', 59.2365, 17.9818, 2.5, 20, 'ASIH Syd'],
  ['botkyrka', 59.1988, 17.8332, 2.5, 10, 'ASIH Sydväst'],
  ['nacka', 59.31, 18.1648, 2.5, 10, 'ASIH City'],
  ['lidingo', 59.3661, 18.1352, 2.0, 5, 'ASIH Nord'],
  ['taby', 59.4451, 18.0717, 2.5, 10, 'ASIH Nord'],
];
const KM_PER_DEG_LAT = 111.32;
// Main equipment weights (none 55 %, Monitoring 25 %, Oxygen 10 %, IV infusion 7 %, Home ventilator 3 %).
const MAIN_EQUIPMENT = [
  [55, null], [25, 'Monitoring'], [10, 'Oxygen'], [7, 'IV infusion'], [3, 'Home ventilator'],
];
const BATTERY_HOURS = { Monitoring: [10, 24], Oxygen: [2, 6], 'IV infusion': [6, 12], 'Home ventilator': [4, 10] };

const staffNames = new Set(['Eva Lind', 'Johan Ek', 'Maria Holm', 'Omar Haddad', 'Peter Nord', 'Sara Lund', 'Karin Sjö', 'Erik Falk', 'Lena Åkesson', 'Helena Berg', 'Mats Öberg', 'Jonas Vik', 'Anna Ek']);
const usedNames = new Set([...all.solna, ...all.huddinge].map((p) => `${p.givenName} ${p.familyName}`));
function homeName() {
  for (;;) {
    const familyName = FAMILY[Math.floor(rand2() * FAMILY.length)];
    const givenName = GIVEN[Math.floor(rand2() * GIVEN.length)];
    const key = `${givenName} ${familyName}`;
    if (staffNames.has(key) || usedNames.has(key)) continue;
    usedNames.add(key);
    return { familyName, givenName };
  }
}
function pickMain() {
  let x = rand2() * 100;
  for (const [w, name] of MAIN_EQUIPMENT) {
    if (x < w) return name;
    x -= w;
  }
  return null;
}
// Two uniforms summed give the distance from the zone centre (triangular, 0 to the radius); the bearing is uniform.
function position(lat, lng, radiusKm) {
  const d = radiusKm * ((rand2() + rand2()) / 2);
  const bearing = rand2() * 2 * Math.PI;
  const dLat = (d * Math.cos(bearing)) / KM_PER_DEG_LAT;
  const dLng = (d * Math.sin(bearing)) / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [Number((lat + dLat).toFixed(5)), Number((lng + dLng).toFixed(5))];
}

// SPEC.md § 12.5: each patient lands on a random vertex of a random street within the zone's radius. The streets come from
// src/data/packs/geo/karolinska/streets.json (scripts/fetch-osm.mjs) or, until that has been fetched, from fixture-streets.json.
// Placement has its own random stream, so equipment, batteries and visits are the same whichever file is used.
const geoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/packs/geo');
const geoDir = path.join(geoRoot, 'karolinska');
const streetsFile = existsSync(path.join(geoDir, 'streets.json')) ? 'streets.json' : 'fixture-streets.json';
const streetFeatures = JSON.parse(readFileSync(path.join(geoDir, streetsFile), 'utf8')).features.filter((f) => f.properties.name);
console.log(`Placing home patients on ${streetFeatures.length} streets from ${streetsFile}`);
const rand3 = mulberry32(HOME_SEED + 1);
const kmBetween = (lat1, lng1, lat2, lng2) => Math.hypot((lat2 - lat1) * KM_PER_DEG_LAT, (lng2 - lng1) * KM_PER_DEG_LAT * Math.cos((lat1 * Math.PI) / 180));
// A street vertex counts for a zone when it is within the zone's radius and the zone's centre is the nearest of the ten
// centres: neighbouring zones overlap (Innerstaden and Södermalm are 2.4 km apart), and a patient of Södermalm must not
// live in Norrmalm.
function onStreet(zlat, zlng, radiusKm) {
  const nearestIsThisZone = (lat, lng) => HOME_ZONES.every(([, olat, olng]) => kmBetween(lat, lng, zlat, zlng) <= kmBetween(lat, lng, olat, olng) + 1e-9);
  const candidates = streetFeatures
    .map((f) => ({ name: f.properties.name, vertices: f.geometry.coordinates.filter(([lng, lat]) => kmBetween(zlat, zlng, lat, lng) <= radiusKm && nearestIsThisZone(lat, lng)) }))
    .filter((s) => s.vertices.length > 0);
  if (candidates.length === 0) throw new Error(`No street within ${radiusKm} km of ${zlat}, ${zlng}`);
  const street = candidates[Math.floor(rand3() * candidates.length)];
  const [lng, lat] = street.vertices[Math.floor(rand3() * street.vertices.length)];
  return { street: street.name, lat, lng, houseNo: 1 + Math.floor(rand3() * 60) };
}

const homePatients = [];
for (const [zone, zlat, zlng, radiusKm, count, team] of HOME_ZONES) {
  for (let i = 0; i < count; i++) {
    const main = pickMain();
    const dialysis = rand2() < 0.05;
    const equipment = [...(main ? [main] : []), ...(dialysis ? ['Home dialysis'] : [])];
    position(zlat, zlng, radiusKm); // keeps the main random stream where it was; the position now comes from a street
    const { street, lat, lng, houseNo } = onStreet(zlat, zlng, radiusKm);
    const { familyName, givenName } = homeName();
    homePatients.push({
      id: `hp-${homePatients.length + 1}`,
      familyName,
      givenName,
      age: randInt2(24, 91),
      zone,
      street,
      houseNo,
      lat,
      lng,
      team,
      equipment,
      batteryHours: main ? randInt2(...BATTERY_HOURS[main]) : null,
      visitToday: rand2() < 0.4,
      elCritical: main === 'Oxygen' || main === 'IV infusion' || main === 'Home ventilator',
      waterCritical: dialysis,
    });
  }
}

const homeOut = `// Generated by scripts/generate-patients.mjs (seed ${HOME_SEED}). Do not edit by hand.
// Synthetic Hospital at Home patients (SPEC.md § 11.4). Nothing here is a real person.
import type { HomePatient } from './types';

export const HOME_PATIENTS: HomePatient[] = [
${homePatients.map(line).join('\n')}
];
`;
const homeTarget = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/packs/home-patients.ts');
writeFileSync(homeTarget, homeOut);
console.log(`Wrote ${homePatients.length} home patients to ${homeTarget}`);

// ---------------------------------------------------------------------------
// SUS Lund (DATA.md § 14, SPEC.md § 14.5): 150 synthetic home care patients for the second home pack, a third seeded
// generator that writes src/data/packs/home-patients-lund.ts. Own random streams: the Karolinska output above is unaffected.
const LUND_SEED = 20261017;
const rL = mulberry32(LUND_SEED);
const rLpos = mulberry32(LUND_SEED + 1);
const randIntL = (min, max) => min + Math.floor(rL() * (max - min + 1));
// zone id, centre, radius (km), patients, ASIH team (DATA.md § 14)
const LUND_ZONES = [
  ['lund', 55.706, 13.192, 2.5, 60, 'ASIH Lund Nord'],
  ['kavlinge', 55.792, 13.112, 1.5, 15, 'ASIH Lund Nord'],
  ['lomma', 55.695, 13.055, 2.0, 15, 'ASIH Lund Nord'],
  ['staffanstorp', 55.642, 13.212, 1.5, 15, 'ASIH Lund Syd'],
  ['dalby', 55.666, 13.352, 1.5, 15, 'ASIH Lund Syd'],
  ['eslov', 55.838, 13.305, 2.0, 20, 'ASIH Lund Nord'],
  ['horby', 55.851, 13.66, 1.5, 10, 'ASIH Lund Nord'],
];
const lundDir = path.join(geoRoot, 'lund');
const lundStreetsFile = existsSync(path.join(lundDir, 'streets.json')) ? 'streets.json' : 'fixture-streets.json';
const lundStreetFeatures = JSON.parse(readFileSync(path.join(lundDir, lundStreetsFile), 'utf8')).features.filter((f) => f.properties.name);
console.log(`Placing Lund patients on ${lundStreetFeatures.length} streets from ${lundStreetsFile}`);
const usedL = new Set([...usedNames, ...homePatients.map((p) => `${p.givenName} ${p.familyName}`)]);
function lundName() {
  for (;;) {
    const familyName = FAMILY[Math.floor(rL() * FAMILY.length)];
    const givenName = GIVEN[Math.floor(rL() * GIVEN.length)];
    const key = `${givenName} ${familyName}`;
    if (staffNames.has(key) || usedL.has(key)) continue;
    usedL.add(key);
    return { familyName, givenName };
  }
}
function pickMainL() {
  let x = rL() * 100;
  for (const [w, name] of MAIN_EQUIPMENT) {
    if (x < w) return name;
    x -= w;
  }
  return null;
}
function onStreetLund(zlat, zlng, radiusKm) {
  const nearestIsThisZone = (lat, lng) => LUND_ZONES.every(([, olat, olng]) => kmBetween(lat, lng, zlat, zlng) <= kmBetween(lat, lng, olat, olng) + 1e-9);
  const candidates = lundStreetFeatures
    .map((f) => ({ name: f.properties.name, vertices: f.geometry.coordinates.filter(([lng, lat]) => kmBetween(zlat, zlng, lat, lng) <= radiusKm && nearestIsThisZone(lat, lng)) }))
    .filter((s) => s.vertices.length > 0);
  if (candidates.length === 0) throw new Error(`No street within ${radiusKm} km of ${zlat}, ${zlng}`);
  const street = candidates[Math.floor(rLpos() * candidates.length)];
  const [lng, lat] = street.vertices[Math.floor(rLpos() * street.vertices.length)];
  return { street: street.name, lat, lng, houseNo: 1 + Math.floor(rLpos() * 60) };
}
const lundPatients = [];
for (const [zone, zlat, zlng, radiusKm, count, team] of LUND_ZONES) {
  for (let i = 0; i < count; i++) {
    const main = pickMainL();
    const dialysis = rL() < 0.05;
    const equipment = [...(main ? [main] : []), ...(dialysis ? ['Home dialysis'] : [])];
    const { street, lat, lng, houseNo } = onStreetLund(zlat, zlng, radiusKm);
    const { familyName, givenName } = lundName();
    lundPatients.push({
      id: `lp-${lundPatients.length + 1}`,
      familyName,
      givenName,
      age: randIntL(24, 91),
      zone,
      street,
      houseNo,
      lat,
      lng,
      team,
      equipment,
      batteryHours: main ? randIntL(...BATTERY_HOURS[main]) : null,
      visitToday: rL() < 0.4,
      elCritical: main === 'Oxygen' || main === 'IV infusion' || main === 'Home ventilator',
      waterCritical: dialysis,
    });
  }
}
const lundOut = `// Generated by scripts/generate-patients.mjs (seed ${LUND_SEED}). Do not edit by hand.
// Synthetic Hospital at Home patients for the SUS Lund pack (DATA.md § 14). Nothing here is a real person.
import type { HomePatient } from './types';

export const LUND_PATIENTS: HomePatient[] = [
${lundPatients.map(line).join('\n')}
];
`;
const lundTarget = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/packs/home-patients-lund.ts');
writeFileSync(lundTarget, lundOut);
console.log(`Wrote ${lundPatients.length} Lund patients to ${lundTarget}`);
