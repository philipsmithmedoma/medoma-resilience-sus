import { describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { groupOfPatient, planningGroups, teamSequence } from './planning';

const groups = (work = {}, visits = pack.homeVisits, clock = 14 * 60 + 40) => planningGroups(visits, work, pack.homePatients, pack.homeTeams, clock);

describe('planning groups (SPEC.md § 14.3)', () => {
  it('has one group per team with every visit of the day exactly once, sorted by start', () => {
    const g = groups();
    expect(g.map((x) => x.team.name)).toEqual(['ASIH Nord', 'ASIH City', 'ASIH Syd', 'ASIH Sydväst']);
    expect(g.reduce((n, x) => n + x.rows.length, 0)).toBe(pack.homeVisits.length);
    for (const x of g) {
      const starts = x.rows.map((r) => r.visit.start);
      expect(starts).toEqual([...starts].sort((a, b) => a - b));
      expect(x.rows.every((r) => r.patient.team === x.team.name)).toBe(true);
    }
  });

  it('a visit before the clock reads as done, and moving a visit changes its place in the group', () => {
    const g = groups();
    const nord = g[0];
    expect(nord.rows.some((r) => r.status === 'done')).toBe(true);
    const first = nord.rows[0];
    const moved = pack.homeVisits.map((v) => (v.id === first.visit.id ? { ...v, start: 17 * 60 + 30, status: 'moved' as const } : v));
    const after = groups({}, moved)[0];
    expect(after.rows.at(-1)!.visit.id).toBe(first.visit.id);
    expect(after.rows.at(-1)!.status).toBe('moved');
  });

  it('numbers the stops of a team from 1 in driving order and leaves cancelled visits out', () => {
    const nord = groups()[0];
    const cancel = nord.rows[1].visit.id;
    const cancelled = pack.homeVisits.map((v) => (v.id === cancel ? { ...v, status: 'cancelled' as const } : v));
    const seq = teamSequence(groups({}, cancelled)[0]);
    expect(seq.map((s) => s.n)).toEqual(seq.map((_, i) => i + 1));
    expect(seq.some((s) => s.row.visit.id === cancel)).toBe(false);
    expect(seq).toHaveLength(nord.rows.length - 1);
  });

  it('a team sent to a patient takes the visit over', () => {
    const victim = groups()[0].rows[0];
    const g = groups({ [victim.patient.id]: { assignedTeam: 'asih-syd' } });
    expect(g[0].rows.some((r) => r.patient.id === victim.patient.id)).toBe(false);
    expect(g[2].rows.some((r) => r.patient.id === victim.patient.id)).toBe(true);
    expect(groupOfPatient(g, victim.patient.id)).toBe('asih-syd');
  });
});
