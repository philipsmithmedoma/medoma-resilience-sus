// The handover file (SPEC.md § 7): the interface to the hospital-management product. One record per patient marked Ta in. Pure.
import type { DataPack, Handover } from '@/data/types';
import { formatClock } from './time';

export const HANDOVER_SCHEMA = 'medoma-center/handover/1';

export interface HandoverFile {
  schema: typeof HANDOVER_SCHEMA;
  exportedAt: string;
  synthetic: true;
  pack: string;
  handovers: Array<{
    id: string;
    at: string;
    clockMinutes: number;
    site: string;
    patient: { id: string; familyName: string; givenName: string; age: number; personalNumber: string; zone: string };
    team: string;
    reasons: string[];
    priority: number | null;
    monitoring: { level: string; reason: string | null };
    equipment: string[];
  }>;
}

/** The file for the handovers so far; `exportedAt` is the demo clock (the demo day is fredag 4 september 2026). */
export function buildHandoverFile(pack: Pick<DataPack, 'homePackId' | 'homePatients'>, handovers: readonly Handover[], clock: number, demoDate = '2026-09-04'): HandoverFile {
  return {
    schema: HANDOVER_SCHEMA,
    exportedAt: `${demoDate}T${formatClock(clock)}:00`,
    synthetic: true,
    pack: pack.homePackId,
    handovers: handovers.flatMap((h) => {
      const p = pack.homePatients.find((x) => x.id === h.patientId);
      if (!p) return [];
      return [
        {
          id: h.id, at: formatClock(h.at), clockMinutes: h.at, site: h.site,
          patient: { id: p.id, familyName: p.familyName, givenName: p.givenName, age: p.age, personalNumber: p.personalNumber, zone: p.zone },
          team: p.team, reasons: h.reasons, priority: h.priority,
          monitoring: { level: p.monitoringLevel, reason: p.monitoringReason },
          equipment: p.equipment,
        },
      ];
    }),
  };
}
