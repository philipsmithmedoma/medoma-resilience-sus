// Today's home visits (SPEC.md § 14.3). Pure and deterministic: every patient with a visit today gets one visit with its
// team, starting 08:00–17:00 in 30-minute steps, drawn from a seeded generator. A team's cars decide how many of its
// visits may start in the same slot (two cars: two visits).
import type { HomePatient, HomeTeam, HomeVisit } from './types';

export const VISIT_FIRST_MIN = 8 * 60;
export const VISIT_LAST_START_MIN = 17 * 60;
export const SLOT_STEP_MIN = 30;
/** The slots Move visit can pick from: 08:00–18:00 in 30-minute steps (the last one starts 17:30). */
export const SLOT_END_MIN = 18 * 60;
export const VISIT_DURATION_MIN = 45;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every 30-minute step from 08:00 up to (not including) 18:00. */
export const ALL_SLOTS: number[] = Array.from({ length: (SLOT_END_MIN - VISIT_FIRST_MIN) / SLOT_STEP_MIN }, (_, i) => VISIT_FIRST_MIN + i * SLOT_STEP_MIN);

/** One visit per patient with `visitToday`, drawn per team so the result does not depend on the other teams. */
export function buildVisits(patients: HomePatient[], teams: HomeTeam[], seed: number): HomeVisit[] {
  const visits: HomeVisit[] = [];
  teams.forEach((team, i) => {
    const rand = mulberry32(seed + i * 101);
    const used = new Map<number, number>();
    const startSlots = ALL_SLOTS.filter((s) => s <= VISIT_LAST_START_MIN);
    for (const p of patients.filter((x) => x.visitToday && x.team === team.name)) {
      let start: number;
      do {
        start = startSlots[Math.floor(rand() * startSlots.length)];
      } while ((used.get(start) ?? 0) >= team.cars && startSlots.some((s) => (used.get(s) ?? 0) < team.cars));
      used.set(start, (used.get(start) ?? 0) + 1);
      visits.push({ id: `hv-${p.id}`, patientId: p.id, teamId: team.id, start, durationMin: VISIT_DURATION_MIN, status: 'planned' });
    }
  });
  return visits;
}

/** Slots a team can still take: fewer of its live visits start there than it has cars. */
export function freeSlots(visits: readonly HomeVisit[], team: Pick<HomeTeam, 'id' | 'cars'>, notBefore = 0): number[] {
  const count = new Map<number, number>();
  for (const v of visits) if (v.teamId === team.id && v.status !== 'cancelled') count.set(v.start, (count.get(v.start) ?? 0) + 1);
  return ALL_SLOTS.filter((s) => s >= notBefore && (count.get(s) ?? 0) < team.cars);
}

/** A planned or moved visit whose end the clock has passed reads as done. */
export function visitStatusAt(v: HomeVisit, clock: number): HomeVisit['status'] {
  return (v.status === 'planned' || v.status === 'moved') && v.start + v.durationMin <= clock ? 'done' : v.status;
}

/** The visits with the team that now serves each patient: a team sent to the patient (Send team) takes over the visit. */
export function effectiveVisits(visits: readonly HomeVisit[], work: Readonly<Record<string, { assignedTeam: string | null } | undefined>>): HomeVisit[] {
  return visits.map((v) => {
    const team = work[v.patientId]?.assignedTeam;
    return team && team !== v.teamId ? { ...v, teamId: team } : v;
  });
}
