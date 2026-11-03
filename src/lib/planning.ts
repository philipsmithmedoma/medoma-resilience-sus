// The Planning page's data (SPEC.md § 14.3): today's visits grouped by the team that serves them, sorted by start, and the
// numbered sequence of one team's visits for the map. Pure.
import type { HomePatient, HomeTeam, HomeVisit, HomeVisitStatus, HomeWork, TeamId } from '@/data/types';
import { visitStatusAt } from '@/data/packs/home-visits';

export interface VisitRow {
  visit: HomeVisit;
  patient: HomePatient;
  team: HomeTeam;
  /** The visit's status at the clock: a planned or moved visit that has ended reads as done. */
  status: HomeVisitStatus;
}

export interface TeamGroup {
  team: HomeTeam;
  rows: VisitRow[];
}

/** One group per team in pack order (empty teams included), rows by start then by name; a team sent to a patient takes the visit over. */
export function planningGroups(
  visits: readonly HomeVisit[],
  work: Readonly<Record<string, Pick<HomeWork, 'assignedTeam'> | undefined>>,
  patients: readonly HomePatient[],
  teams: readonly HomeTeam[],
  clock: number,
): TeamGroup[] {
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const byName = (a: HomePatient, b: HomePatient) => a.familyName.localeCompare(b.familyName, 'sv') || a.givenName.localeCompare(b.givenName, 'sv');
  const rows: VisitRow[] = [];
  for (const v of visits) {
    const patient = patientById.get(v.patientId);
    const team = teamById.get(work[v.patientId]?.assignedTeam ?? v.teamId) ?? teamById.get(v.teamId);
    if (patient && team) rows.push({ visit: v, patient, team, status: visitStatusAt(v, clock) });
  }
  return teams.map((team) => ({
    team,
    rows: rows.filter((r) => r.team.id === team.id).sort((a, b) => a.visit.start - b.visit.start || byName(a.patient, b.patient)),
  }));
}

export interface SequenceStop {
  n: number;
  row: VisitRow;
}

/** The team's visits in the order they are driven, numbered from 1; a cancelled visit is not a stop. */
export function teamSequence(group: TeamGroup): SequenceStop[] {
  return group.rows.filter((r) => r.status !== 'cancelled').map((row, i) => ({ n: i + 1, row }));
}

/** The group a visit belongs to, by the patient. */
export function groupOfPatient(groups: readonly TeamGroup[], patientId: string): TeamId | null {
  return groups.find((g) => g.rows.some((r) => r.patient.id === patientId))?.team.id ?? null;
}
