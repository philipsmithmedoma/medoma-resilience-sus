import { describe, expect, it } from 'vitest';
import { homePacks } from '@/data/packs/home-packs';
import { buildPatientRows, countByTab, filterRows, responsibleOf } from './patient-rows';

const pack = homePacks.sus;
const rows = buildPatientRows(pack);

describe('the patient list rows (SPEC.md § 8)', () => {
  it('puts all 200 patients under Inskrivna, two under Under bedömning, two under Pausade, three under Utskrivna, 207 under Alla', () => {
    expect(countByTab(rows)).toEqual({ assessment: 2, enrolled: 200, paused: 2, discharged: 3, all: 207 });
  });

  it('gives every zone one Patientansvarig from its team\'s staff, the same for every patient in the zone', () => {
    for (const z of pack.zones) {
      const names = new Set(rows.filter((r) => r.zone === z.id).map((r) => r.responsible));
      expect(names.size, z.id).toBe(1);
      const team = pack.teams.find((t) => t.name === pack.patients.find((p) => p.zone === z.id)!.team)!;
      expect(team.staff).toContain([...names][0]);
    }
    expect(responsibleOf('Okänt team', 'lund', pack)).toBe('');
  });

  it('searches names and personal numbers, case-insensitively, and sorts by family and given name', () => {
    const first = rows.find((r) => r.status === 'enrolled')!;
    const hit = filterRows(rows, 'all', first.personalNumber.slice(0, 8).toUpperCase());
    expect(hit.some((r) => r.id === first.id)).toBe(true);
    const byName = filterRows(rows, 'enrolled', first.familyName.toLowerCase());
    expect(byName.every((r) => r.familyName.toLowerCase().includes(first.familyName.toLowerCase()) || r.givenName.toLowerCase().includes(first.familyName.toLowerCase()))).toBe(true);
    const all = filterRows(rows, 'enrolled', '');
    expect([...all].map((r) => r.familyName)).toEqual([...all].map((r) => r.familyName).sort((a, b) => a.localeCompare(b, 'sv')));
    expect(filterRows(rows, 'paused', '')).toHaveLength(2);
  });
});
