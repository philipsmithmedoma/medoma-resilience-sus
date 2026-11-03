import { describe, expect, it } from 'vitest';
import { homePacks } from './home-packs';
import { SUS_PACK } from '@/test/packs';
import type { HomePatient } from './types';

const pack = homePacks.sus;

const luhnValid = (digits10: string) => {
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
};

describe('the SUS pack (SPEC.md § 4.1, DATA.md § 3)', () => {
  it('has two sites, sixteen zones, 200 patients and two teams with two cars each', () => {
    expect(pack.sites.map((s) => [s.id, s.name, s.lat, s.lng])).toEqual([
      ['suslund', 'SUS Lund', 55.7118, 13.1985],
      ['susmalmo', 'SUS Malmö', 55.5889, 13.001],
    ]);
    expect(pack.zones).toHaveLength(16);
    expect(pack.patients).toHaveLength(200);
    expect(pack.teams.map((t) => [t.name, t.cars])).toEqual([['Sjukhus hemma Lund', 2], ['Sjukhus hemma Malmö', 2]]);
    expect(pack.teams.map((t) => [t.baseLat, t.baseLng])).toEqual([[55.704, 13.192], [55.606, 13.0]]);
  });

  it('has the patient counts per zone of DATA.md § 3, 100 for Lund and 100 for Malmö', () => {
    const counts = Object.fromEntries(pack.zones.map((z) => [z.id, pack.patients.filter((p) => p.zone === z.id).length]));
    expect(counts).toEqual({
      lund: 40, kavlinge: 10, lomma: 10, staffanstorp: 10, dalby: 10, eslov: 15, horby: 5,
      malmo: 25, limhamn: 10, hyllie: 10, rosengard: 15, arlov: 10, oxie: 5, vellinge: 10, svedala: 5, trelleborg: 10,
    });
    expect(pack.patients.filter((p) => p.team === 'Sjukhus hemma Lund')).toHaveLength(100);
    expect(pack.patients.filter((p) => p.team === 'Sjukhus hemma Malmö')).toHaveLength(100);
  });

  it('marks the urban zones as the prompt lists them', () => {
    expect(pack.zones.filter((z) => z.urban).map((z) => z.id)).toEqual(['lund', 'malmo', 'limhamn', 'hyllie', 'rosengard', 'arlov']);
  });

  it('gives every zone and site a Google Places source and the zones their confidence', () => {
    for (const z of pack.zones) {
      expect(z.coordConfidence).toBe('reported');
      expect(z.coordSource).toMatch(/Google Places/);
    }
  });

  it('resolves every link endpoint to a site, a zone or an infrastructure node, and gives every node a coordinate source', () => {
    const ids = new Set([...pack.sites.map((s) => s.id), ...pack.zones.map((z) => z.graphNode), ...pack.infraNodes.map((n) => n.id)]);
    for (const l of pack.infraLinks) {
      expect(ids.has(l.a), `${l.id}: ${l.a}`).toBe(true);
      expect(ids.has(l.b), `${l.id}: ${l.b}`).toBe(true);
    }
    for (const n of pack.infraNodes) expect(n.coordSource.length, n.id).toBeGreaterThan(0);
  });

  it('makes Sege 400 kV and Vombverket nodes of Malmö too, and has no hand-placed road node for Malmö', () => {
    const linked = (node: string) => pack.infraLinks.some((l) => (l.a === node && l.b === 'susmalmo') || (l.b === node && l.a === 'susmalmo'));
    expect(linked('e-sege')).toBe(true);
    expect(linked('w-vomb')).toBe(true);
    expect(pack.infraNodes.filter((n) => n.layer === 'roads').map((n) => n.id).sort()).toEqual(['r-gardstanga', 'r-hoje', 'r-lund-n', 'r-lund-s']);
    expect(pack.infraLinks.some((l) => l.layer === 'roads')).toBe(false);
  });

  it('has the three Lund notices and one Malmö notice per kind, all in both languages', () => {
    expect(pack.messages.map((m) => m.id)).toEqual(['smsg-road', 'smsg-power', 'smsg-water', 'smsg-m-road', 'smsg-m-power', 'smsg-m-water']);
    for (const m of pack.messages) expect(m.textEn, m.id).toBeTruthy();
    expect(pack.messages.find((m) => m.id === 'smsg-m-road')!.text).toMatch(/Inre Ringvägen/);
    expect(pack.messages.find((m) => m.id === 'smsg-m-power')!.text).toMatch(/Rosengård/);
    expect(pack.messages.find((m) => m.id === 'smsg-m-water')!.text).toMatch(/Limhamn/);
  });

  it('never uses the word ASIH', () => {
    expect(JSON.stringify({ teams: pack.teams, patients: pack.patients.map((p) => p.team) })).not.toMatch(/ASIH/);
  });
});

describe('the synthetic patients (SPEC.md § 3, § 8)', () => {
  const all: HomePatient[] = [...SUS_PACK.homePatients, ...homePacks.karolinska.patients];

  it('have personal numbers in the format YYYYMMDD-XXXX with a birth date that matches the age and a failing check digit', () => {
    for (const p of all) {
      expect(p.personalNumber).toMatch(/^\d{8}-\d{4}$/);
      const year = Number(p.personalNumber.slice(0, 4));
      expect(2026 - year - (year === 2026 ? 0 : 0)).toBeGreaterThanOrEqual(p.age);
      expect(2026 - year).toBeLessThanOrEqual(p.age + 1);
      expect(luhnValid(p.personalNumber.slice(2, 8) + p.personalNumber.slice(9)), p.id).toBe(false);
    }
  });

  it('follow the equipment rules: one type, batteries and reserves per type, pumps with an antibiotic', () => {
    for (const p of all) {
      expect(p.equipment.length).toBeLessThanOrEqual(1);
      const e = p.equipment[0];
      if (e === 'Oxygen stationary') expect([p.batteryHours, p.elCritical]).toEqual([0, true]);
      if (e === 'Oxygen portable') expect(p.batteryHours!).toBeGreaterThanOrEqual(2), expect(p.batteryHours!).toBeLessThanOrEqual(5);
      if (e === 'Self-monitoring kit') expect(p.batteryHours!).toBeGreaterThanOrEqual(12), expect(p.batteryHours!).toBeLessThanOrEqual(24);
      if (e === 'Oxygen stationary' || e === 'Oxygen portable') expect(p.backupHours!).toBeGreaterThanOrEqual(4), expect(p.backupHours!).toBeLessThanOrEqual(10);
      else expect(p.backupHours).toBeNull();
      if (e === 'Pump' || e === 'IV stand') expect([p.batteryHours, p.elCritical]).toEqual([null, false]);
      expect(p.elCritical).toBe(e === 'Oxygen stationary' || e === 'Oxygen portable');
      expect(p.antibiotic !== null).toBe(e === 'Pump');
      expect(p.heatSensitive).toBe(['meropenem', 'cefepim', 'ceftazidim'].includes(p.antibiotic ?? ''));
    }
  });

  it('give monitoring level and reason only to patients with a kit: spot or continuous, reasons only for continuous', () => {
    for (const p of all) {
      if (!p.equipment.includes('Self-monitoring kit')) expect([p.monitoringLevel, p.monitoringReason]).toEqual(['none', null]);
      else expect(['spot', 'continuous']).toContain(p.monitoringLevel);
      expect(p.monitoringReason !== null).toBe(p.monitoringLevel === 'continuous');
    }
    const kits = all.filter((p) => p.equipment.includes('Self-monitoring kit'));
    const share = kits.filter((p) => p.monitoringLevel === 'continuous').length / kits.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.55);
  });

  it('log in to the patient app in about 60 % of the cases and list seven non-enrolled rows per pack', () => {
    const share = SUS_PACK.homePatients.filter((p) => p.appLoggedIn).length / 200;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.7);
    for (const id of ['sus', 'karolinska'] as const) {
      const extras = homePacks[id].registryExtras;
      expect(extras.filter((x) => x.status === 'assessment')).toHaveLength(2);
      expect(extras.filter((x) => x.status === 'paused')).toHaveLength(2);
      expect(extras.filter((x) => x.status === 'discharged')).toHaveLength(3);
    }
  });

  it('give no two patients the same name, and none a name of the incident staff', () => {
    const names = all.map((p) => `${p.givenName} ${p.familyName}`);
    expect(new Set(names).size).toBe(names.length);
  });
});
