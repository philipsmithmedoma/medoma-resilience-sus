// The mobile network, the team's own app and the simulated device feed (SPEC.md § 6, § 7). Pure. In a power outage the mobile
// network is assumed to fall after 1 h in an urban zone and after 4 h elsewhere (PTS requirement on backup power, DATA.md § 5.4);
// a tele disturbance takes it down at once. From then a zone's patients are out of contact: `lastContactAt` stops updating.
import type { HomePatient, HomeZone, ZoneId } from '@/data/types';

export const FALL_URBAN_MIN = 60;
export const FALL_OTHER_MIN = 240;
/** The warning window of "will be out of contact within 2 h" and of "battery runs out within 2 h". */
export const WARNING_MIN = 120;
export const CONTACT_STEP_MIN = 5;
/** Contact is red after 30 minutes for continuous monitoring and after 4 hours for spot checks; never for none. */
export const SILENT_RED_MIN = { continuous: 30, spot: 240 } as const;
/** A zone counts as silent for the hypothesis when its patients have been without contact this long. */
export const HYPOTHESIS_SILENT_MIN = 10;
export const HYPOTHESIS_SHARE = 0.6;
export const HYPOTHESIS_WINDOW_MIN = 15;
export const CHARGE_TIMES = [7 * 60, 22 * 60];
export const HUB_DRAIN_PER_H = 4;
export const PHONE_DRAIN_PER_H = 6;

/** The state the signal depends on: registered disruptions (start per zone) and unregistered ones the demo simulates. */
export interface SignalState {
  powerStart?: ReadonlyMap<ZoneId, number>;
  teleStart?: ReadonlyMap<ZoneId, number>;
  /** Outages that are not registered by the user (Demo popover); they affect the signal, not the impact. */
  hiddenPower?: ReadonlyMap<ZoneId, number>;
}

/** The earliest power outage covering a zone, registered or not. */
export function powerStartOf(zone: ZoneId, s: SignalState): number | null {
  const a = s.powerStart?.get(zone);
  const b = s.hiddenPower?.get(zone);
  if (a === undefined && b === undefined) return null;
  return Math.min(a ?? Infinity, b ?? Infinity);
}

/** Clock minute at which the mobile network is down in the zone, or null when nothing takes it down. */
export function networkDownAt(zone: Pick<HomeZone, 'id' | 'urban'>, s: SignalState): number | null {
  const times: number[] = [];
  const p = powerStartOf(zone.id, s);
  if (p !== null) times.push(p + (zone.urban ? FALL_URBAN_MIN : FALL_OTHER_MIN));
  const t = s.teleStart?.get(zone.id);
  if (t !== undefined) times.push(t);
  return times.length ? Math.min(...times) : null;
}

/** A small stable hash of a string, for per-patient phases. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const lastCharge = (t: number): number => {
  const day = Math.floor(t / 1440) * 1440;
  const today = CHARGE_TIMES.map((c) => day + c).filter((c) => c <= t);
  return today.length ? Math.max(...today) : day - 1440 + CHARGE_TIMES[CHARGE_TIMES.length - 1];
};

/** The latest contact at or before `t` on the patient's 5-minute grid. */
export function contactAtOrBefore(p: Pick<HomePatient, 'id'>, t: number): number {
  const phase = hash(p.id) % CONTACT_STEP_MIN;
  return t - ((((t - phase) % CONTACT_STEP_MIN) + CONTACT_STEP_MIN) % CONTACT_STEP_MIN);
}

export interface PatientRealtime {
  lastContactAt: number;
  hubBatteryPct: number;
  phoneBatteryPct: number;
  lastMeasurementAt: number | null;
  pumpNextChangeAt: number | null;
  /** The mobile network is down in the patient's zone. */
  noContact: boolean;
  /** Clock minute the network falls (or fell) in the zone; null when nothing takes it down. */
  networkDownAt: number | null;
}

/** Clock minute of the next pump change after `clock`: every 24 h at a per-patient time of day between 06:00 and 22:00. */
export function pumpNextChange(p: Pick<HomePatient, 'id'>, clock: number): number {
  const tod = 6 * 60 + (hash(`${p.id}:pump`) % 64) * 15;
  const day = Math.floor(clock / 1440) * 1440;
  return day + tod > clock ? day + tod : day + 1440 + tod;
}

/** The simulated realtime fields of one patient at the clock. */
export function realtimeOf(p: HomePatient, zone: Pick<HomeZone, 'id' | 'urban'>, s: SignalState, clock: number): PatientRealtime {
  const down = networkDownAt(zone, s);
  const noContact = down !== null && clock >= down;
  const lastContactAt = contactAtOrBefore(p, noContact ? down : clock);
  const power = powerStartOf(zone.id, s);
  // Charging stops in an outage: the battery drains from the last charge before the outage began.
  const ref = lastCharge(power !== null && power <= clock ? power : clock);
  const hours = Math.max(0, clock - ref) / 60;
  const pct = (rate: number) => Math.max(0, Math.min(100, Math.round(100 - rate * hours)));
  let lastMeasurementAt: number | null = null;
  if (p.monitoringLevel === 'continuous') lastMeasurementAt = lastContactAt;
  else if (p.monitoringLevel === 'spot') {
    const tod = 8 * 60 + (hash(`${p.id}:spot`) % 9) * 15;
    const upTo = noContact ? down : clock;
    const day = Math.floor(upTo / 1440) * 1440;
    lastMeasurementAt = day + tod <= upTo ? day + tod : day - 1440 + tod;
  }
  return {
    lastContactAt,
    hubBatteryPct: pct(HUB_DRAIN_PER_H),
    phoneBatteryPct: pct(PHONE_DRAIN_PER_H),
    lastMeasurementAt,
    pumpNextChangeAt: p.equipment.includes('Pump') ? pumpNextChange(p, clock) : null,
    noContact,
    networkDownAt: down,
  };
}

/** Whether the last-contact column is red: silent too long for the patient's monitoring level (never for none). */
export function silentTooLong(p: Pick<HomePatient, 'monitoringLevel'>, rt: Pick<PatientRealtime, 'lastContactAt'>, clock: number): boolean {
  if (p.monitoringLevel === 'none') return false;
  return clock - rt.lastContactAt > SILENT_RED_MIN[p.monitoringLevel];
}

/** The incoming device event of SPEC.md § 7: one per device. */
export interface DeviceEvent {
  deviceId: string;
  patientId: string;
  kind: 'hub' | 'phone' | 'sensor';
  batteryPct: number | null;
  lastContactAt: number;
  lastMeasurementAt: number | null;
  /** The supplier of the device data; here the simulation. */
  source: string;
}

export const SIMULATED_SOURCE = 'simulated';

/** The events the simulation stands for: a hub and a phone per patient, and a sensor for a self-monitoring kit. */
export function deviceEvents(p: HomePatient, rt: PatientRealtime): DeviceEvent[] {
  const events: DeviceEvent[] = [
    { deviceId: `${p.id}-hub`, patientId: p.id, kind: 'hub', batteryPct: rt.hubBatteryPct, lastContactAt: rt.lastContactAt, lastMeasurementAt: null, source: SIMULATED_SOURCE },
    { deviceId: `${p.id}-phone`, patientId: p.id, kind: 'phone', batteryPct: rt.phoneBatteryPct, lastContactAt: rt.lastContactAt, lastMeasurementAt: null, source: SIMULATED_SOURCE },
  ];
  if (p.equipment.includes('Self-monitoring kit')) {
    events.push({ deviceId: `${p.id}-sensor`, patientId: p.id, kind: 'sensor', batteryPct: null, lastContactAt: rt.lastContactAt, lastMeasurementAt: rt.lastMeasurementAt, source: SIMULATED_SOURCE });
  }
  return events;
}

/** A zone the data suggests is disrupted although none is registered (SPEC.md § 6, hypothesis). */
export interface Hypothesis {
  zone: ZoneId;
  /** Start of the silence cluster: the earliest last contact in the zone. */
  firstSilentAt: number;
  share: number;
}

/**
 * At least 60 % of a zone's patients have lost contact within the same 15 minutes (their last contacts lie within a 15-minute
 * window and have been silent at least 10 minutes) and no disruption is registered in the zone.
 */
export function hypotheses(
  patients: readonly HomePatient[],
  zones: readonly HomeZone[],
  s: SignalState,
  registeredZones: ReadonlySet<ZoneId>,
  clock: number,
): Hypothesis[] {
  const out: Hypothesis[] = [];
  for (const z of zones) {
    if (registeredZones.has(z.id)) continue;
    const members = patients.filter((p) => p.zone === z.id);
    if (members.length === 0) continue;
    const silent = members.map((p) => realtimeOf(p, z, s, clock).lastContactAt).filter((t) => clock - t >= HYPOTHESIS_SILENT_MIN);
    if (silent.length / members.length < HYPOTHESIS_SHARE) continue;
    const sorted = [...silent].sort((a, b) => a - b);
    const need = Math.ceil(HYPOTHESIS_SHARE * members.length);
    let found = false;
    for (let i = 0; i + need <= sorted.length && !found; i++) if (sorted[i + need - 1] - sorted[i] <= HYPOTHESIS_WINDOW_MIN) found = true;
    if (found) out.push({ zone: z.id, firstSilentAt: sorted[0], share: silent.length / members.length });
  }
  return out;
}
