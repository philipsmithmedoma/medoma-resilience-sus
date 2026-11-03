// The rows of the patient list (SPEC.md § 8): the pack's enrolled patients and its synthetic non-enrolled rows in one shape. Pure.
import type { HomePack, HomePatient, HomeTeam, HomeZone, RegistryExtra, RegistryStatus } from '@/data/types';

export type PatientStatusTab = 'assessment' | 'enrolled' | 'paused' | 'discharged' | 'all';
export const PATIENT_TABS: PatientStatusTab[] = ['assessment', 'enrolled', 'paused', 'discharged', 'all'];

export interface PatientRow {
  id: string;
  /** The enrolled patient behind the row; absent for the non-enrolled rows, which have no home on the map. */
  patient?: HomePatient;
  familyName: string;
  givenName: string;
  personalNumber: string;
  zone: string;
  responsible: string;
  enrolledOn: string | null;
  plannedDischargeOn: string | null;
  appLoggedIn: boolean;
  status: 'enrolled' | RegistryStatus;
}

/**
 * Patientansvarig: a fictional name from the team's staff, the same for every patient in a zone. The zones of a team, in the
 * pack's order, take the staff in turn.
 */
export function responsibleOf(team: string, zone: string, pack: Pick<HomePack, 'teams' | 'zones' | 'patients' | 'registryExtras'>): string {
  const t: HomeTeam | undefined = pack.teams.find((x) => x.name === team);
  if (!t || t.staff.length === 0) return '';
  const zonesOfTeam = pack.zones.filter((z: HomeZone) => [...pack.patients, ...pack.registryExtras].some((p) => p.team === team && p.zone === z.id));
  const i = Math.max(0, zonesOfTeam.findIndex((z) => z.id === zone));
  return t.staff[i % t.staff.length];
}

export function buildPatientRows(pack: Pick<HomePack, 'teams' | 'zones' | 'patients' | 'registryExtras'>): PatientRow[] {
  const enrolled = pack.patients.map<PatientRow>((p) => ({
    id: p.id, patient: p, familyName: p.familyName, givenName: p.givenName, personalNumber: p.personalNumber, zone: p.zone,
    responsible: responsibleOf(p.team, p.zone, pack), enrolledOn: p.enrolledOn, plannedDischargeOn: p.plannedDischargeOn, appLoggedIn: p.appLoggedIn, status: 'enrolled',
  }));
  const extras = pack.registryExtras.map<PatientRow>((x: RegistryExtra) => ({
    id: x.id, familyName: x.familyName, givenName: x.givenName, personalNumber: x.personalNumber, zone: x.zone,
    responsible: responsibleOf(x.team, x.zone, pack), enrolledOn: x.enrolledOn, plannedDischargeOn: x.plannedDischargeOn, appLoggedIn: x.appLoggedIn, status: x.status,
  }));
  return [...enrolled, ...extras];
}

export function countByTab(rows: PatientRow[]): Record<PatientStatusTab, number> {
  return {
    assessment: rows.filter((r) => r.status === 'assessment').length,
    enrolled: rows.filter((r) => r.status === 'enrolled').length,
    paused: rows.filter((r) => r.status === 'paused').length,
    discharged: rows.filter((r) => r.status === 'discharged').length,
    all: rows.length,
  };
}

/** Rows of a tab matching the search text (name or personal number, case-insensitive), by family and given name. */
export function filterRows(rows: PatientRow[], tab: PatientStatusTab, search: string): PatientRow[] {
  const q = search.trim().toLowerCase();
  return rows
    .filter((r) => (tab === 'all' || r.status === tab) && (q === '' || `${r.familyName} ${r.givenName} ${r.personalNumber}`.toLowerCase().includes(q)))
    .sort((a, b) => a.familyName.localeCompare(b.familyName, 'sv') || a.givenName.localeCompare(b.givenName, 'sv'));
}
