// The status of each row of the page Beroenden (SPEC.md § 10, DATA.md § 6), computed from the active disruptions and the clock.
// A row is Opåverkad, Påverkad om X (the minutes until it falls) or Påverkad, with the number of patients it concerns where that can
// be counted. Pure.
import type { DataPack, HomePatient, HomeZone } from '@/data/types';
import { COLD_AFTER_H, HEAT_CRITICAL_H, registeredSignal, supplyDaysLeft, type Disruptions, type ImpactRow } from './reachability';
import { networkDownAt } from './signal';

export type DepKey =
  | 'medomaCenter' | 'medomaGo' | 'medomaCare' | 'continuous' | 'spot' | 'o2Stationary' | 'o2Portable' | 'pumpHeat' | 'pumpSupply' | 'fridge'
  | 'heating' | 'doorLock' | 'elevator' | 'safetyAlarm' | 'cars' | 'reach' | 'deliveries' | 'water' | 'handover';
export const DEP_KEYS: DepKey[] = [
  'medomaCenter', 'medomaGo', 'medomaCare', 'continuous', 'spot', 'o2Stationary', 'o2Portable', 'pumpHeat', 'pumpSupply', 'fridge',
  'heating', 'doorLock', 'elevator', 'safetyAlarm', 'cars', 'reach', 'deliveries', 'water', 'handover',
];

export type DepStatus = { kind: 'none' } | { kind: 'ok' } | { kind: 'soon'; inMin: number } | { kind: 'affected' };
export interface DepRow {
  key: DepKey;
  status: DepStatus;
  /** Patients the row concerns; null when they cannot be counted. */
  patients: number | null;
}

/** Hours assumed for a refrigerator without power (DATA.md § 6, assumption). */
export const FRIDGE_HOURS = 4;

interface Input {
  pack: Pick<DataPack, 'homePatients' | 'homeZones' | 'homeUnitStock'>;
  state: Disruptions;
  rows: readonly ImpactRow[];
  clock: number;
}

const ok: DepStatus = { kind: 'ok' };
const affected: DepStatus = { kind: 'affected' };

/** Affected when a deadline has passed, else "soon" with the earliest one, else ok. */
function byDeadlines(deadlines: number[], clock: number): DepStatus {
  if (deadlines.length === 0) return ok;
  const min = Math.min(...deadlines);
  return min <= clock ? affected : { kind: 'soon', inMin: min - clock };
}

export function dependencyRows({ pack, state, rows, clock }: Input): DepRow[] {
  const zones = new Map<string, HomeZone>(pack.homeZones.map((z) => [z.id, z]));
  const registered = registeredSignal(state);
  const down = (p: HomePatient): number | null => {
    const z = zones.get(p.zone);
    return z ? networkDownAt(z, registered) : null;
  };
  const inPower = (p: HomePatient) => state.powerOutZones.has(p.zone);
  const powerStart = (p: HomePatient) => state.powerStart?.get(p.zone) ?? clock;
  const network = (filter: (p: HomePatient) => boolean): { status: DepStatus; patients: number } => {
    const mine = pack.homePatients.filter(filter);
    const times = mine.map(down).filter((x): x is number => x !== null);
    return { status: byDeadlines(times, clock), patients: mine.filter((p) => (down(p) ?? Infinity) <= clock).length };
  };
  const out: DepRow[] = [];
  const add = (key: DepKey, status: DepStatus, patients: number | null) => out.push({ key, status, patients });
  add('medomaCenter', { kind: 'none' }, null);
  const all = network(() => true);
  add('medomaGo', all.status, all.patients);
  add('medomaCare', all.status, all.patients);
  const cont = network((p) => p.monitoringLevel === 'continuous');
  add('continuous', cont.status, cont.patients);
  // Spot checks fall with the network or when the phone or hub battery is empty.
  const spotPatients = pack.homePatients.filter((p) => p.monitoringLevel === 'spot');
  const spotTimes = spotPatients.flatMap((p) => {
    const d = down(p);
    const times: number[] = d === null ? [] : [d];
    if (inPower(p) && p.batteryHours !== null) times.push(powerStart(p) + p.batteryHours * 60);
    return times;
  });
  add('spot', byDeadlines(spotTimes, clock), spotPatients.filter((p) => spotTimes.length > 0 && ((down(p) ?? Infinity) <= clock || (inPower(p) && p.batteryHours !== null && powerStart(p) + p.batteryHours * 60 <= clock))).length);
  const stationary = pack.homePatients.filter((p) => p.equipment.includes('Oxygen stationary') && inPower(p));
  add('o2Stationary', stationary.length ? affected : ok, stationary.length);
  const portable = pack.homePatients.filter((p) => p.equipment.includes('Oxygen portable') && inPower(p));
  add('o2Portable', byDeadlines(portable.map((p) => powerStart(p) + (p.batteryHours ?? 0) * 60), clock), portable.filter((p) => powerStart(p) + (p.batteryHours ?? 0) * 60 <= clock).length);
  const heatPumps = pack.homePatients.filter((p) => p.equipment.includes('Pump') && state.heatStart?.has(p.zone));
  const heatTimes = heatPumps.map((p) => state.heatStart!.get(p.zone)! + ((p.heatSensitive ? HEAT_CRITICAL_H.sensitive : HEAT_CRITICAL_H.other) + (state.heatExtraHours?.get(p.id) ?? 0)) * 60);
  add('pumpHeat', byDeadlines(heatTimes, clock), heatTimes.filter((t) => t <= clock).length);
  const pumps = pack.homePatients.filter((p) => p.equipment.includes('Pump'));
  const days = pack.homeUnitStock?.infusorsDays.value ?? null;
  const left = days === null ? null : supplyDaysLeft(state, days, clock);
  const supply: DepStatus = left === null ? ok : left <= 0 ? affected : { kind: 'soon', inMin: Math.round(left * 1440) };
  add('pumpSupply', supply, supply.kind === 'affected' ? pumps.length : left === null ? 0 : pumps.length);
  add('deliveries', supply, null);
  // Refrigerated medicines: an assumed four hours after the outage begins; who has any cannot be counted.
  const fridgeTimes = pack.homePatients.filter(inPower).map((p) => powerStart(p) + FRIDGE_HOURS * 60);
  add('fridge', byDeadlines(fridgeTimes, clock), null);
  // Heating: cold together with a power outage, six hours after both have begun.
  const coldTimes = pack.homePatients
    .filter((p) => state.coldStart?.has(p.zone) && inPower(p))
    .map((p) => Math.max(state.coldStart!.get(p.zone)!, powerStart(p)) + COLD_AFTER_H * 60);
  add('heating', byDeadlines(coldTimes, clock), rows.filter((r) => r.cold).length);
  const anyPower = pack.homePatients.some(inPower);
  add('doorLock', anyPower ? affected : ok, null);
  add('elevator', anyPower ? affected : ok, null);
  const alarm = network(() => true);
  add('safetyAlarm', alarm.status, alarm.patients);
  const roadRows = rows.filter((r) => r.unreachable || r.delayed);
  add('cars', roadRows.length ? affected : ok, roadRows.length);
  const unreachable = rows.filter((r) => r.unreachable).length;
  const reach = rows.filter((r) => r.unreachable || r.noContact).length;
  add('reach', reach ? affected : cont.status.kind === 'soon' ? cont.status : ok, reach);
  const water = rows.filter((r) => r.water).length;
  add('water', water ? affected : ok, water);
  add('handover', unreachable ? affected : ok, unreachable);
  // Order as the page lists them.
  return DEP_KEYS.map((k) => out.find((r) => r.key === k)!);
}
