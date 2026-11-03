// Filtering and grouping of the Hospital at Home patient list (SPEC.md § 11.6). Pure.
import type { HomeEquipment, HomePatient, HomeZone } from '@/data/types';

export interface HomeFilters {
  zone: string | 'all';
  equipment: HomeEquipment | 'all';
  visitToday: boolean;
  affectedOnly: boolean;
}

export const NO_FILTERS: HomeFilters = { zone: 'all', equipment: 'all', visitToday: false, affectedOnly: false };

export function hasFilters(f: HomeFilters): boolean {
  return f.zone !== 'all' || f.equipment !== 'all' || f.visitToday || f.affectedOnly;
}

/** Patients matching every active filter; `affected` holds the ids of affected patients (empty without a disruption). */
export function filterPatients(patients: HomePatient[], f: HomeFilters, affected: ReadonlySet<string> = new Set()): HomePatient[] {
  return patients.filter(
    (p) =>
      (f.zone === 'all' || p.zone === f.zone) &&
      (f.equipment === 'all' || p.equipment.includes(f.equipment)) &&
      (!f.visitToday || p.visitToday) &&
      (!f.affectedOnly || affected.has(p.id)),
  );
}

export interface ZoneGroup {
  zone: HomeZone;
  patients: HomePatient[];
}

/** Zones in pack order, each with its patients by family and given name; empty zones are left out. */
export function groupByZone(patients: HomePatient[], zones: HomeZone[]): ZoneGroup[] {
  const byName = (a: HomePatient, b: HomePatient) => a.familyName.localeCompare(b.familyName, 'sv') || a.givenName.localeCompare(b.givenName, 'sv');
  return zones
    .map((zone) => ({ zone, patients: patients.filter((p) => p.zone === zone.id).sort(byName) }))
    .filter((g) => g.patients.length > 0);
}
