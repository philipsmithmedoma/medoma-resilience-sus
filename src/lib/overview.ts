// The three realtime cards of Översikt (SPEC.md § 10): out of contact now, the shortest hub battery today and the next pump change
// within 2 hours. They read the simulated signals, registered disruption or not. Pure.
import type { DataPack, HomePatient } from '@/data/types';
import { WARNING_MIN, realtimeOf, type SignalState } from './signal';

export interface RealtimeCards {
  /** Patients whose zone is out of contact now (the mobile network is down). */
  noContact: HomePatient[];
  /** The patient with the lowest hub battery now, and the lowest value; ties by patient order. */
  shortestHub: { patient: HomePatient; pct: number } | null;
  /** Pump patients whose next change falls within 2 hours, soonest first, with the minutes left. */
  pumpSoon: Array<{ patient: HomePatient; inMin: number }>;
}

export function realtimeCards(pack: Pick<DataPack, 'homePatients' | 'homeZones'>, signal: SignalState, clock: number): RealtimeCards {
  const zones = new Map(pack.homeZones.map((z) => [z.id, z]));
  const noContact: HomePatient[] = [];
  let shortest: RealtimeCards['shortestHub'] = null;
  const pumpSoon: RealtimeCards['pumpSoon'] = [];
  for (const p of pack.homePatients) {
    const zone = zones.get(p.zone);
    if (!zone) continue;
    const rt = realtimeOf(p, zone, signal, clock);
    if (rt.noContact) noContact.push(p);
    if (shortest === null || rt.hubBatteryPct < shortest.pct) shortest = { patient: p, pct: rt.hubBatteryPct };
    if (rt.pumpNextChangeAt !== null && rt.pumpNextChangeAt - clock <= WARNING_MIN) pumpSoon.push({ patient: p, inMin: rt.pumpNextChangeAt - clock });
  }
  pumpSoon.sort((a, b) => a.inMin - b.inMin);
  return { noContact, shortestHub: shortest, pumpSoon };
}
