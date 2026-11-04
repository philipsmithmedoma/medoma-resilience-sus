// The equipment page (SPEC.md § 8): in use counted from the pack's patients, total = in use plus the pack's illustrative stock;
// in preparedness mode how many of the patients with a type are affected and the shortest remaining battery. Pure.
import type { DataPack, HomeEquipment, HomePatient } from '@/data/types';
import type { ImpactRow } from './reachability';

export interface EquipmentLine {
  type: HomeEquipment;
  patients: HomePatient[];
  inUse: number;
  total: number;
  /** In preparedness mode: patients of the type that are affected now. */
  affected: number;
  /** Minutes of battery plus reserve left for the affected patients of the type; the shortest, or null when none has a deadline. */
  shortestBatteryMin: number | null;
}

export function equipmentLines(pack: Pick<DataPack, 'homePatients' | 'homeEquipmentStock'>, types: readonly HomeEquipment[], rows: readonly ImpactRow[], clock: number): EquipmentLine[] {
  return types.map((type) => {
    const patients = pack.homePatients.filter((p) => p.equipment.includes(type));
    const mine = rows.filter((r) => r.affected && r.patient.equipment.includes(type));
    const left = mine.filter((r) => r.batteryEmptyAt != null).map((r) => Math.max(0, r.batteryEmptyAt! - clock));
    return {
      type, patients, inUse: patients.length, total: patients.length + (pack.homeEquipmentStock[type].value ?? 0),
      affected: mine.length, shortestBatteryMin: left.length ? Math.min(...left) : null,
    };
  });
}
