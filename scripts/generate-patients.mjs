// Generates the synthetic home patients of each pack once, deterministically (SPEC.md § 3, DATA.md § 5.2): per pack a seeded
// generator writes src/data/packs/home-patients*.ts and the non-enrolled rows of the patient list (home-registry.ts).
// SUS: seed 20261103, 200 patients. Nothing here is a real person.
// Run: node scripts/generate-patients.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const packsDir = path.resolve(here, '../src/data/packs');

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

// 80 family names and 40 given names; no name coincides with a person in the incident data or with a team's staff.
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

// Names that belong to the incident data and to the teams' staff (src/data/packs/home-teams.ts, sus.ts): patients never get them.
const RESERVED = new Set([
  'Eva Lind', 'Johan Ek', 'Maria Holm', 'Omar Haddad', 'Peter Nord', 'Sara Lund', 'Karin Sjö', 'Erik Falk', 'Lena Åkesson', 'Helena Berg', 'Mats Öberg', 'Jonas Vik', 'Anna Ek',
]);

const DEMO_DATE = new Date(Date.UTC(2026, 8, 4)); // the demo day, fredag 4 september 2026
const KM_PER_DEG_LAT = 111.32;
const kmBetween = (lat1, lng1, lat2, lng2) => Math.hypot((lat2 - lat1) * KM_PER_DEG_LAT, (lng2 - lng1) * KM_PER_DEG_LAT * Math.cos((lat1 * Math.PI) / 180));

// Main equipment weights (DATA.md § 5.2): none 50 %, self-monitoring kit 25 %, IV stand 8 %, stationary oxygen 8 %, pump 7 %, portable oxygen 2 %.
const MAIN_EQUIPMENT = [
  [50, null], [25, 'Self-monitoring kit'], [8, 'IV stand'], [8, 'Oxygen stationary'], [7, 'Pump'], [2, 'Oxygen portable'],
];
// Battery hours of the powered equipment, or of the phone or hub of a kit; the stationary concentrator has none (it stops at once).
const BATTERY_HOURS = { 'Self-monitoring kit': [12, 24], 'Oxygen stationary': [0, 0], 'Oxygen portable': [2, 5] };
const BACKUP_HOURS = [4, 10]; // spare tubes of oxygen patients, illustrative
// Antibiotics in elastomeric pumps (DATA.md § 5.3): piperacillin/tazobaktam 25, cefazolin 20, flukloxacillin 20, bensylpenicillin 10, meropenem 10, cefepim 10, ceftazidim 5 %.
const ANTIBIOTICS = [
  [25, 'piperacillin/tazobaktam'], [20, 'cefazolin'], [20, 'flukloxacillin'], [10, 'bensylpenicillin'], [10, 'meropenem'], [10, 'cefepim'], [5, 'ceftazidim'],
];
const HEAT_SENSITIVE = new Set(['meropenem', 'cefepim', 'ceftazidim']);
const REASONS = [[35, 'arrhythmia'], [40, 'sepsis'], [20, 'respiratory'], [5, 'other']];

function weighted(rand, table) {
  let x = rand() * 100;
  for (const [w, v] of table) {
    if (x < w) return v;
    x -= w;
  }
  return table[table.length - 1][1];
}

// Luhn check over the nine digits YYMMDDXXX; the tenth (the last of the four free digits) is chosen so that the check FAILS.
function luhnValid(digits10) {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(digits10[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
function personalNumber(rand, age) {
  const birth = new Date(Date.UTC(DEMO_DATE.getUTCFullYear() - age, DEMO_DATE.getUTCMonth(), DEMO_DATE.getUTCDate()));
  birth.setUTCDate(birth.getUTCDate() - Math.floor(rand() * 365));
  const y = String(birth.getUTCFullYear());
  const m = String(birth.getUTCMonth() + 1).padStart(2, '0');
  const d = String(birth.getUTCDate()).padStart(2, '0');
  let tail = String(Math.floor(rand() * 10000)).padStart(4, '0');
  if (luhnValid(`${y.slice(2)}${m}${d}${tail}`)) tail = tail.slice(0, 3) + String((Number(tail[3]) + 1) % 10);
  return `${y}${m}${d}-${tail}`;
}
const isoDay = (offsetDays) => {
  const d = new Date(DEMO_DATE);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const PACKS = {
  sus: {
    seed: 20261103,
    prefix: 'sp',
    constName: 'SUS_PATIENTS',
    file: 'home-patients-sus.ts',
    // The Lund half uses the Lund zones with the counts of DATA.md § 3 (40, 10, 10, 10, 10, 15, 5); the Malmö half the nine zones of § 3.
    zones: [
      ['lund', 55.706, 13.192, 2.5, 40, 'Sjukhus hemma Lund'],
      ['kavlinge', 55.792, 13.112, 1.5, 10, 'Sjukhus hemma Lund'],
      ['lomma', 55.695, 13.055, 2.0, 10, 'Sjukhus hemma Lund'],
      ['staffanstorp', 55.642, 13.212, 1.5, 10, 'Sjukhus hemma Lund'],
      ['dalby', 55.666, 13.352, 1.5, 10, 'Sjukhus hemma Lund'],
      ['eslov', 55.838, 13.305, 2.0, 15, 'Sjukhus hemma Lund'],
      ['horby', 55.851, 13.66, 1.5, 5, 'Sjukhus hemma Lund'],
      ['malmo', 55.6061, 13.0002, 2.5, 25, 'Sjukhus hemma Malmö'],
      ['limhamn', 55.5816, 12.9339, 2.0, 10, 'Sjukhus hemma Malmö'],
      ['hyllie', 55.5644, 12.9735, 2.0, 10, 'Sjukhus hemma Malmö'],
      ['rosengard', 55.586, 13.0431, 2.0, 15, 'Sjukhus hemma Malmö'],
      ['arlov', 55.6398, 13.0848, 2.0, 10, 'Sjukhus hemma Malmö'],
      ['oxie', 55.54, 13.0952, 1.5, 5, 'Sjukhus hemma Malmö'],
      ['vellinge', 55.4721, 13.0205, 2.0, 10, 'Sjukhus hemma Malmö'],
      ['svedala', 55.5083, 13.2359, 1.5, 5, 'Sjukhus hemma Malmö'],
      ['trelleborg', 55.3744, 13.1584, 2.0, 10, 'Sjukhus hemma Malmö'],
    ],
  },
};

const line = (p) => `  ${JSON.stringify(p).replace(/"([a-zA-Z]+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ').replace(/\{/g, '{ ').replace(/\}/g, ' }')},`;
const used = new Set(RESERVED);
const registry = {};

for (const [packId, cfg] of Object.entries(PACKS)) {
  // Own random streams: attributes, names and dates never depend on which street file is used.
  const rand = mulberry32(cfg.seed);
  const randPos = mulberry32(cfg.seed + 1);
  const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
  const geoDir = path.join(packsDir, 'geo', packId);
  const streetsFile = existsSync(path.join(geoDir, 'streets.json')) ? 'streets.json' : 'fixture-streets.json';
  const streetFeatures = JSON.parse(readFileSync(path.join(geoDir, streetsFile), 'utf8')).features.filter((f) => f.properties.name);
  console.log(`${packId}: placing patients on ${streetFeatures.length} streets from ${streetsFile}`);

  const name = () => {
    for (;;) {
      const familyName = FAMILY[Math.floor(rand() * FAMILY.length)];
      const givenName = GIVEN[Math.floor(rand() * GIVEN.length)];
      const key = `${givenName} ${familyName}`;
      if (used.has(key)) continue;
      used.add(key);
      return { familyName, givenName };
    }
  };
  // A street vertex counts for a zone when it is within the zone's radius and the zone's centre is the nearest of the pack's centres.
  const onStreet = (zlat, zlng, radiusKm) => {
    const nearestIsThisZone = (lat, lng) => cfg.zones.every(([, olat, olng]) => kmBetween(lat, lng, zlat, zlng) <= kmBetween(lat, lng, olat, olng) + 1e-9);
    const candidates = streetFeatures
      .map((f) => ({ name: f.properties.name, vertices: f.geometry.coordinates.filter(([lng, lat]) => kmBetween(zlat, zlng, lat, lng) <= radiusKm && nearestIsThisZone(lat, lng)) }))
      .filter((s) => s.vertices.length > 0);
    if (candidates.length === 0) throw new Error(`No street within ${radiusKm} km of ${zlat}, ${zlng}`);
    const street = candidates[Math.floor(randPos() * candidates.length)];
    const [lng, lat] = street.vertices[Math.floor(randPos() * street.vertices.length)];
    return { street: street.name, lat, lng, houseNo: 1 + Math.floor(randPos() * 60) };
  };

  const patients = [];
  for (const [zone, zlat, zlng, radiusKm, count, team] of cfg.zones) {
    for (let i = 0; i < count; i++) {
      const main = weighted(rand, MAIN_EQUIPMENT);
      const equipment = main ? [main] : [];
      const age = randInt(24, 91);
      const { familyName, givenName } = name();
      const [bMin, bMax] = main ? (BATTERY_HOURS[main] ?? [0, 0]) : [0, 0];
      const hasBattery = main !== null && main in BATTERY_HOURS;
      const batteryHours = hasBattery ? randInt(bMin, bMax) : null;
      const oxygen = main === 'Oxygen stationary' || main === 'Oxygen portable';
      const backupHours = oxygen ? randInt(...BACKUP_HOURS) : null;
      let monitoringLevel = 'none';
      let monitoringReason = null;
      if (main === 'Self-monitoring kit') {
        monitoringLevel = rand() < 0.6 ? 'spot' : 'continuous';
        if (monitoringLevel === 'continuous') monitoringReason = weighted(rand, REASONS);
      }
      const antibiotic = main === 'Pump' ? weighted(rand, ANTIBIOTICS) : null;
      const visitToday = rand() < 0.4;
      const pn = personalNumber(rand, age);
      const enrolledOn = isoDay(-(1 + Math.floor(rand() * 14)));
      const plannedDischargeOn = isoDay(3 + Math.floor(rand() * 19));
      const appLoggedIn = rand() < 0.6;
      const { street, lat, lng, houseNo } = onStreet(zlat, zlng, radiusKm);
      patients.push({
        id: `${cfg.prefix}-${patients.length + 1}`,
        familyName,
        givenName,
        personalNumber: pn,
        age,
        zone,
        street,
        houseNo,
        lat,
        lng,
        team,
        equipment,
        batteryHours,
        backupHours,
        monitoringLevel,
        monitoringReason,
        antibiotic,
        heatSensitive: antibiotic !== null && HEAT_SENSITIVE.has(antibiotic),
        visitToday,
        elCritical: oxygen,
        enrolledOn,
        plannedDischargeOn,
        appLoggedIn,
      });
    }
  }

  // Non-enrolled rows of the patient list: two under assessment, two paused, three discharged.
  const extras = [];
  const statuses = ['assessment', 'assessment', 'paused', 'paused', 'discharged', 'discharged', 'discharged'];
  for (const status of statuses) {
    const z = cfg.zones[Math.floor(rand() * cfg.zones.length)];
    const age = randInt(24, 91);
    const { familyName, givenName } = name();
    extras.push({
      id: `${cfg.prefix}x-${extras.length + 1}`,
      familyName,
      givenName,
      personalNumber: personalNumber(rand, age),
      age,
      zone: z[0],
      team: z[5],
      status,
      enrolledOn: status === 'assessment' ? null : isoDay(-(10 + Math.floor(rand() * 20))),
      plannedDischargeOn: status === 'assessment' ? null : status === 'discharged' ? isoDay(-(1 + Math.floor(rand() * 5))) : isoDay(5 + Math.floor(rand() * 14)),
      appLoggedIn: rand() < 0.6,
    });
  }
  registry[packId] = extras;

  const out = `// Generated by scripts/generate-patients.mjs (seed ${cfg.seed}). Do not edit by hand.
// Synthetic home patients of the ${packId} pack (SPEC.md § 3, DATA.md § 5.2). Nothing here is a real person; every personal number fails its check digit.
import type { HomePatient } from './types';

export const ${cfg.constName}: HomePatient[] = [
${patients.map(line).join('\n')}
];
`;
  writeFileSync(path.join(packsDir, cfg.file), out);
  console.log(`${packId}: wrote ${patients.length} patients to ${cfg.file}`);
}

const regOut = `// Generated by scripts/generate-patients.mjs. Do not edit by hand.
// Synthetic non-enrolled rows of the patient list (SPEC.md § 8): two under assessment, two paused, three discharged per pack.
import type { RegistryExtra } from './types';

export const SUS_EXTRAS: RegistryExtra[] = [
${registry.sus.map(line).join('\n')}
];
`;
writeFileSync(path.join(packsDir, 'home-registry.ts'), regOut);
console.log('wrote home-registry.ts');
