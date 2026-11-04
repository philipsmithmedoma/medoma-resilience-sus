// Hospital at Home reachability and impact – SPEC.md § 11.5 and § 12.3. Pure: Dijkstra by length over the road graph from
// the sites in scope, a status per patient, one row per affected patient and their priority order. Zones keep their role
// for power and water outages only.
import type { DataPack, HomePatient, HomeTeam, TeamId, ZoneId } from '@/data/types';
import { blockedWayFlags, dijkstra, pathWayNames, snapToGraph, type RoadGraph } from './roadGraph';
import { getRoadModel, sourceVertices, teamDistancesFrom, type RoadModel } from './roadModel';
import { batteryEmptyAt } from './disruptions';
import { networkDownAt, realtimeOf, WARNING_MIN, type SignalState } from './signal';

/** A scope that yields no sites falls back to every site the road model knows (SPEC.md § 4); a pack always passes its own. */
const allSites = (model: Pick<RoadModel, 'sites'> | null): string[] => (model ? Object.keys(model.sites) : []);

/** Everything that can be disrupted (SPEC.md § 11.5, § 12.3). */
export interface Disruptions {
  /** OSM way ids (as strings) closed by a tap on a segment. */
  blockedWays: ReadonlySet<string>;
  /** Road keys (`name` or `name|ref`) closed by a tap with "block whole road". */
  blockedRoads: ReadonlySet<string>;
  /** InfraNode ids of bridges and tunnels; each blocks the ways in its `osmWayNames`. */
  blockedNodes: ReadonlySet<string>;
  powerOutZones: ReadonlySet<ZoneId>;
  waterOutZones: ReadonlySet<ZoneId>;
  /** Zone → clock minute at which the earliest active power disruption covering it started (SPEC.md § 13.2); absent in pure tests. */
  powerStart?: ReadonlyMap<ZoneId, number>;
  /** Start per zone of the earliest tele disturbance, heatwave and cold; start of the earliest supplier disruption (SPEC.md § 6). */
  teleStart?: ReadonlyMap<ZoneId, number>;
  heatStart?: ReadonlyMap<ZoneId, number>;
  coldStart?: ReadonlyMap<ZoneId, number>;
  supplierStart?: number | null;
  /** Outages the user has not registered (Demo): they change the realtime signal, not the impact. */
  hiddenPower?: ReadonlyMap<ZoneId, number>;
  /** Clock minute since which every road within 250 m of a site is closed (the cold chain), or null. */
  siteCutoffSince?: number | null;
  /** Patient → extra hours before a heat-critical pump patient is marked, given by "Kylpåse" and "Kortare infusion". */
  heatExtraHours?: ReadonlyMap<string, number>;
}

export const NO_DISRUPTIONS: Disruptions = {
  blockedWays: new Set(),
  blockedRoads: new Set(),
  blockedNodes: new Set(),
  powerOutZones: new Set(),
  waterOutZones: new Set(),
};

export function disruptionCount(d: Disruptions): number {
  return d.blockedWays.size + d.blockedRoads.size + d.blockedNodes.size + d.powerOutZones.size + d.waterOutZones.size + (d.teleStart?.size ?? 0) + (d.heatStart?.size ?? 0) + (d.coldStart?.size ?? 0) + (d.supplierStart != null ? 1 : 0);
}

/** A patient is delayed when the shortest path is at least 25 % or 3 km longer than with nothing blocked (SPEC.md § 12.3). */
export const DELAY_RATIO = 1.25;
export const DELAY_EXTRA_M = 3000;

type RoadPack = Pick<DataPack, 'infraNodes'>;

/** The registered part of the state the signal depends on. */
export const registeredSignal = (d: Disruptions): SignalState => ({ powerStart: d.powerStart, teleStart: d.teleStart });
/** All of it, including outages nobody has registered. */
export const actualSignal = (d: Disruptions): SignalState => ({ powerStart: d.powerStart, teleStart: d.teleStart, hiddenPower: d.hiddenPower });

/** Flags per way of the graph for the roads the state closes. */
export function blockedFlags(model: RoadModel, state: Disruptions, pack: RoadPack): Uint8Array {
  const names = [...state.blockedNodes].flatMap((id) => pack.infraNodes.find((n) => n.id === id)?.osmWayNames ?? []);
  return blockedWayFlags(model.graph, { ways: state.blockedWays, roads: state.blockedRoads, names });
}

/**
 * Distances in metres from a team's base over the graph with the given ways blocked (SPEC.md § 14.2). The base snaps to the
 * graph like a site; all Infinity when no road lies within 1.5 km of it.
 */
export function teamDistances(graph: RoadGraph, team: Pick<HomeTeam, 'baseLat' | 'baseLng'>, blocked?: Uint8Array): Float64Array {
  return teamDistancesFrom(graph, snapToGraph(graph, team.baseLat, team.baseLng), blocked);
}

/** Which teams reach a patient by road, and which is nearest by road length (SPEC.md § 14.2). */
export interface TeamReach {
  reachableBy: TeamId[];
  nearestTeam: TeamId | null;
  /** Metres by road from each team that reaches the patient. */
  distanceM: Record<TeamId, number>;
}

export type ImpactReason = 'unreachable' | 'detour' | 'power' | 'water' | 'noContact' | 'heat' | 'cold' | 'noPump';
/** The grounds on which a row is critical (SPEC.md § 3): they are independent of each other. */
export type CriticalGround = 'power' | 'monitoring' | 'heat' | 'cold' | 'pump';

const REASON_RANK: Record<string, number> = { sepsis: 0, arrhythmia: 1, respiratory: 2, other: 3 };

export interface ImpactRow {
  patient: HomePatient;
  reasons: ImpactReason[]; // unreachable and detour are exclusive
  unreachable: boolean;
  delayed: boolean;
  power: boolean;
  /** A boil-water advisory (a marking, nothing critical). */
  water: boolean;
  /** The mobile network is down in the patient's zone: no contact, a visit is needed. */
  noContact: boolean;
  /** Clock minute the network falls (fell) in the zone, when something takes it down. */
  noContactAt: number | null;
  heat: boolean;
  cold: boolean;
  noPump: boolean;
  /** Affected counts unreachable, power, water, no contact, heat, cold and a missing pump change; a patient who only has a detour is a row but not affected. */
  affected: boolean;
  /** Why the row is critical; empty when it is not. */
  grounds: CriticalGround[];
  /** Affected with at least one critical ground (drives the ring on the map). */
  critical: boolean;
  powerCritical: boolean;
  monitoringCritical: boolean;
  /** Clock minute at which battery plus reserve is empty: the start of the earliest power disruption plus the hours (SPEC.md § 6). */
  batteryEmptyAt?: number | null;
  /** The clock has passed `batteryEmptyAt`; the row is then critical whatever the equipment. */
  batteryEmpty?: boolean;
  /** Extra kilometres of the detour: the shortest path now minus the baseline (SPEC.md § 6.2); only for delayed rows. */
  extraKm?: number | null;
  /** The teams that reach the patient and the nearest one (SPEC.md § 8); absent in rows built without a road model. */
  reachableBy?: TeamId[];
  nearestTeam?: TeamId | null;
}

/** The window of the summary line "N run out within 2 h". */
export const BATTERY_WARNING_MIN = WARNING_MIN;

export interface ImpactSummary {
  affected: number;
  detour: number;
  unreachable: number;
  unreachableZones: ZoneId[];
  unreachableVisitToday: number;
  /** Power-critical among the unreachable. */
  unreachableCritical: number;
  powerOut: number;
  shortestBattery: number | null; // hours of battery plus reserve among power-critical patients
  /** Patients without power whose battery plus reserve is empty or runs out within 2 h of the clock. */
  runOutWithin2h: number;
  /** Of those, the ones whose battery is already empty. */
  batteryEmpty: number;
  earliestBatteryEmptyAt: number | null;
  /** Boil-water advisories. */
  waterOut: number;
  powerCritical: number;
  monitoringCritical: number;
  /** Patients whose zone is out of contact now. */
  noContact: number;
  /** Patients whose zone loses contact later: how many, and minutes until the soonest fall. */
  noContactSoon: { patients: number; minutes: number } | null;
  /** Patients whose last contact is at least 30 minutes old, registered disruption or not (needs the clock). */
  silent30: number;
  heat: number;
  cold: number;
  noPump: number;
  /** Days of infusers left in the unit's stock, or null while nothing counts it down. */
  supplyDaysLeft: number | null;
  /** Median and maximum extra km over the delayed patients; null when none is delayed. */
  medianExtraKm: number | null;
  maxExtraKm: number | null;
  /** Patients whose own team reached them before the roads closed and no longer does (SPEC.md § 8). */
  teamCannotReach: number;
  /** Of those, the ones another team still reaches. */
  teamReassignable: number;
}

/** A patient whose own team no longer reaches them, with the team that could take over (SPEC.md § 8). */
export interface Reassignment {
  patientId: string;
  ownTeam: TeamId;
  toTeam: TeamId;
}

export interface Impact {
  rows: ImpactRow[]; // pack order; one row per patient with at least one flag
  summary: ImpactSummary;
  /** For every patient with a road: the teams that reach them now. Empty without a road model or without teams. */
  teamReach: Map<string, TeamReach>;
  /** The patients whose own team cannot reach them but another team does, in pack order. */
  reassignments: Reassignment[];
}

/** OSM ids of every way the state closes (by id, by road or through a node), for drawing them in the danger colour. */
export function blockedWayIdSet(model: RoadModel, state: Disruptions, pack: RoadPack): Set<number> {
  const flags = blockedFlags(model, state, pack);
  const ids = new Set<number>();
  flags.forEach((f, i) => {
    if (f) ids.add(model.graph.ways[i].id);
  });
  return ids;
}

/** Hours until a heat-critical pump patient is marked: 6 h when the antibiotic is heat sensitive, 12 h otherwise. */
export const HEAT_CRITICAL_H = { sensitive: 6, other: 12 } as const;
export const COLD_AFTER_H = 6;
export const HEAT_AGE = 80;
export const COLD_CRITICAL_AGE = 80;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};

/** Clock minute since which the unit's stock counts down, or null. */
export function supplyStartOf(state: Disruptions): number | null {
  const times = [state.supplierStart, state.siteCutoffSince].filter((x): x is number => x != null);
  return times.length ? Math.min(...times) : null;
}

/** Days of infusers left (never below 0) with the stock of `days` and the clock, or null while nothing counts it down. */
export function supplyDaysLeft(state: Disruptions, days: number, clock: number | null): number | null {
  const start = supplyStartOf(state);
  if (start === null || clock === null) return null;
  return Math.max(0, days - (clock - start) / 1440);
}

type ImpactPack = Pick<DataPack, 'homeZones' | 'homePatients' | 'infraNodes'> & Partial<Pick<DataPack, 'homeTeams' | 'homeUnitStock'>>;

/**
 * Impact of the disruptions on the patients from the sites in scope. Road status per patient comes from the road model
 * (null before the geometry has loaded: only the other disruptions show). A patient with no road within 1.5 km never reaches
 * a site, with or without a disruption; that is a property of the data, reported by the model, not an effect, so such a
 * patient is not a row here.
 */
export function impact(
  pack: ImpactPack,
  state: Disruptions,
  scopeSites: string[],
  model: RoadModel | null = getRoadModel(),
  clock: number | null = null,
): Impact {
  // A scope that yields no sites uses every site of the pack; a pack always passes its own.
  const sites = scopeSites.length ? scopeSites : allSites(model);
  const roadsClosed = state.blockedWays.size + state.blockedRoads.size + state.blockedNodes.size > 0;
  let base: Float64Array | null = null;
  let now: Float64Array | null = null;
  if (model && roadsClosed) {
    base = model.baseline(sites);
    now = dijkstra(model.graph, sourceVertices(model, sites), blockedFlags(model, state, pack)).dist;
  }

  // Teams: who reaches each patient now, and before anything was closed.
  const teams = pack.homeTeams ?? [];
  const teamReach = new Map<string, TeamReach>();
  const ownCannot: Array<{ patientId: string; ownTeam: TeamId; toTeam: TeamId | null }> = [];
  if (model && teams.length) {
    const baseTeams = model.teamBaseline();
    const flags = roadsClosed ? blockedFlags(model, state, pack) : undefined;
    const nowTeams = new Map(teams.map((tm) => [tm.id, flags ? teamDistancesFrom(model.graph, model.teams[tm.id], flags) : baseTeams.get(tm.id)!]));
    for (const p of pack.homePatients) {
      const snap = model.patients.get(p.id);
      if (!snap || snap.unsnapped) continue;
      const distanceM: Record<TeamId, number> = {};
      for (const tm of teams) {
        const d = nowTeams.get(tm.id)![snap.vertex];
        if (Number.isFinite(d)) distanceM[tm.id] = d;
      }
      const reachableBy = teams.map((tm) => tm.id).filter((id) => id in distanceM);
      const nearestTeam = reachableBy.length ? reachableBy.reduce((a, b) => (distanceM[b] < distanceM[a] ? b : a)) : null;
      teamReach.set(p.id, { reachableBy, nearestTeam, distanceM });
      const own = teams.find((tm) => tm.name === p.team);
      if (own && roadsClosed && Number.isFinite(baseTeams.get(own.id)![snap.vertex]) && !reachableBy.includes(own.id)) {
        ownCannot.push({ patientId: p.id, ownTeam: own.id, toTeam: nearestTeam });
      }
    }
  }

  const registered = registeredSignal(state);
  const actual = actualSignal(state);
  const zoneOf = new Map(pack.homeZones.map((z) => [z.id, z]));
  const stockDays = pack.homeUnitStock?.infusorsDays.value ?? null;
  const daysLeft = stockDays === null ? null : supplyDaysLeft(state, stockDays, clock);
  const supplyOut = daysLeft !== null && daysLeft <= 0;

  const rows: ImpactRow[] = [];
  let silent30 = 0;
  for (const p of pack.homePatients) {
    const zone = zoneOf.get(p.zone);
    if (clock !== null && zone && clock - realtimeOf(p, zone, actual, clock).lastContactAt >= 30) silent30++;
    let unreachable = false;
    let delayed = false;
    let extraKm: number | null = null;
    const snap = model?.patients.get(p.id);
    if (base && now && snap && !snap.unsnapped) {
      const b = base[snap.vertex];
      const d = now[snap.vertex];
      if (Number.isFinite(b)) {
        if (!Number.isFinite(d)) unreachable = true;
        else {
          delayed = d > b && (d >= b * DELAY_RATIO || d >= b + DELAY_EXTRA_M);
          if (delayed) extraKm = Math.round((d - b) / 1000);
        }
      }
    }
    const power = state.powerOutZones.has(p.zone);
    const water = state.waterOutZones.has(p.zone);
    const down = zone ? networkDownAt(zone, registered) : null;
    const noContact = clock !== null && down !== null && clock >= down;
    const soon = clock !== null && down !== null && down > clock && down - clock <= WARNING_MIN;
    // Heat: from 80 on affected at once; a pump patient is critical after 6 h (heat-sensitive antibiotic) or 12 h, plus the extra hours given.
    const heatStart = state.heatStart?.get(p.zone);
    const extraH = state.heatExtraHours?.get(p.id) ?? 0;
    const heatAge = heatStart !== undefined && p.age >= HEAT_AGE;
    const heatPump =
      heatStart !== undefined && clock !== null && p.equipment.includes('Pump') && clock >= heatStart + ((p.heatSensitive ? HEAT_CRITICAL_H.sensitive : HEAT_CRITICAL_H.other) + extraH) * 60;
    const heat = heatAge || heatPump;
    // Cold counts only together with a power outage in the zone, six hours after both have begun.
    const coldStart = state.coldStart?.get(p.zone);
    const powerStart = state.powerStart?.get(p.zone);
    const coldSince = coldStart !== undefined && powerStart !== undefined ? Math.max(coldStart, powerStart) : null;
    const cold = coldSince !== null && clock !== null && clock >= coldSince + COLD_AFTER_H * 60;
    const noPump = supplyOut && p.equipment.includes('Pump');
    const monitoringCritical = p.monitoringLevel === 'continuous' && (noContact || soon);
    if (!unreachable && !delayed && !power && !water && !noContact && !heat && !cold && !noPump && !monitoringCritical) continue;
    const emptyAt = power && powerStart !== undefined && p.batteryHours !== null ? batteryEmptyAt(powerStart, p.batteryHours, p.backupHours ?? 0) : null;
    const batteryEmpty = emptyAt !== null && clock !== null && clock >= emptyAt;
    const powerCritical = power && (p.elCritical || batteryEmpty);
    const grounds: CriticalGround[] = [];
    if (powerCritical) grounds.push('power');
    if (monitoringCritical) grounds.push('monitoring');
    if (heatPump) grounds.push('heat');
    if (cold && p.age >= COLD_CRITICAL_AGE) grounds.push('cold');
    if (noPump) grounds.push('pump');
    const reasons: ImpactReason[] = [];
    if (unreachable) reasons.push('unreachable');
    if (delayed) reasons.push('detour');
    if (power) reasons.push('power');
    if (noContact) reasons.push('noContact');
    if (water) reasons.push('water');
    if (heat) reasons.push('heat');
    if (cold) reasons.push('cold');
    if (noPump) reasons.push('noPump');
    const affected = unreachable || power || water || noContact || heat || cold || noPump;
    rows.push({
      patient: p, reasons, unreachable, delayed, power, water, noContact, noContactAt: down, heat, cold, noPump, affected,
      grounds, critical: affected && grounds.length > 0, powerCritical, monitoringCritical,
      batteryEmptyAt: emptyAt, batteryEmpty, extraKm,
      reachableBy: teamReach.get(p.id)?.reachableBy, nearestTeam: teamReach.get(p.id)?.nearestTeam,
    });
  }

  const unreachableRows = rows.filter((r) => r.unreachable);
  const powerRows = rows.filter((r) => r.power);
  const critPower = rows.filter((r) => r.powerCritical);
  const emptyAts = powerRows.map((r) => r.batteryEmptyAt).filter((x): x is number => x != null);
  const soonRows = clock === null ? [] : powerRows.filter((r) => r.batteryEmptyAt != null && r.batteryEmptyAt <= clock + BATTERY_WARNING_MIN);
  const unreachableZoneIds = new Set(unreachableRows.map((r) => r.patient.zone));
  // Zones that lose contact later, from the registered disruptions.
  let noContactSoon: ImpactSummary['noContactSoon'] = null;
  if (clock !== null) {
    const pending = pack.homeZones
      .map((z) => ({ z, down: networkDownAt(z, registered) }))
      .filter((x): x is { z: (typeof pack.homeZones)[number]; down: number } => x.down !== null && x.down > clock);
    if (pending.length) {
      const ids = new Set(pending.map((x) => x.z.id));
      noContactSoon = { patients: pack.homePatients.filter((p) => ids.has(p.zone)).length, minutes: Math.min(...pending.map((x) => x.down)) - clock };
    }
  }
  const extras = rows.filter((r) => r.delayed && r.extraKm != null).map((r) => r.extraKm!);
  const summary: ImpactSummary = {
    affected: rows.filter((r) => r.affected).length,
    detour: rows.filter((r) => r.delayed).length,
    unreachable: unreachableRows.length,
    unreachableZones: pack.homeZones.filter((z) => unreachableZoneIds.has(z.id)).map((z) => z.id),
    unreachableVisitToday: unreachableRows.filter((r) => r.patient.visitToday).length,
    unreachableCritical: unreachableRows.filter((r) => r.powerCritical).length,
    powerOut: powerRows.length,
    shortestBattery: critPower.length ? Math.min(...critPower.map((r) => (r.patient.batteryHours ?? 0) + (r.patient.backupHours ?? 0))) : null,
    runOutWithin2h: soonRows.length,
    batteryEmpty: powerRows.filter((r) => r.batteryEmpty).length,
    earliestBatteryEmptyAt: emptyAts.length ? Math.min(...emptyAts) : null,
    waterOut: rows.filter((r) => r.water).length,
    powerCritical: critPower.length,
    monitoringCritical: rows.filter((r) => r.monitoringCritical).length,
    noContact: rows.filter((r) => r.noContact).length,
    noContactSoon,
    silent30,
    heat: rows.filter((r) => r.heat).length,
    cold: rows.filter((r) => r.cold).length,
    noPump: rows.filter((r) => r.noPump).length,
    supplyDaysLeft: daysLeft,
    medianExtraKm: median(extras),
    maxExtraKm: extras.length ? Math.max(...extras) : null,
    teamCannotReach: ownCannot.length,
    teamReassignable: ownCannot.filter((c) => c.toTeam !== null).length,
  };
  const reassignments = ownCannot.filter((c): c is Reassignment => c.toTeam !== null);
  return { rows, summary, teamReach, reassignments };
}

/**
 * The way names on the shortest path from the sites in scope to a patient with the roads closed, or null when there is
 * none or the patient has no road within 1.5 km. Used to explain a path that a test expects not to exist.
 */
export function explainPath(
  pack: Pick<DataPack, 'infraNodes'>,
  state: Disruptions,
  scopeSites: string[],
  model: RoadModel,
  patient: Pick<HomePatient, 'id'>,
): string[] | null {
  const snap = model.patients.get(patient.id);
  if (!snap || snap.unsnapped) return null;
  const paths = dijkstra(model.graph, sourceVertices(model, scopeSites.length ? scopeSites : allSites(model)), blockedFlags(model, state, pack));
  return Number.isFinite(paths.dist[snap.vertex]) ? pathWayNames(model.graph, paths, snap.vertex) : null;
}

/**
 * Priority tier of a row, 1 first (SPEC.md § 6): (1) unreachable with a visit today, (2) monitoring-critical and out of contact,
 * (3) power-critical, (4) monitoring-critical that will be out of contact within 2 h, (5) other critical grounds (heat, cold, pump),
 * (6) other affected, (7) detour only.
 */
export function priorityTier(r: ImpactRow): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  if (r.unreachable && r.patient.visitToday) return 1;
  if (r.monitoringCritical && r.noContact) return 2;
  if (r.powerCritical) return 3;
  if (r.monitoringCritical) return 4;
  if (r.critical) return 5;
  if (r.affected) return 6;
  return 7;
}

/** Tiers 1–5 are the ones the list marks "Prioritera". */
export const isPrioritised = (r: ImpactRow): boolean => priorityTier(r) <= 5;

/**
 * Order for the list: by tier; in tier 2 sepsis before arrhythmia before respiratory before other, then the longest silence first;
 * in tier 3 the earliest battery-plus-reserve deadline first; in tier 4 the soonest fall of the network; then deadline, battery and name.
 */
export function prioritise(rows: ImpactRow[]): ImpactRow[] {
  const deadline = (r: ImpactRow) => r.batteryEmptyAt ?? Number.POSITIVE_INFINITY;
  const battery = (r: ImpactRow) => (r.patient.batteryHours === null ? Number.POSITIVE_INFINITY : r.patient.batteryHours + (r.patient.backupHours ?? 0));
  const reason = (r: ImpactRow) => REASON_RANK[r.patient.monitoringReason ?? 'other'] ?? 3;
  const fall = (r: ImpactRow) => r.noContactAt ?? Number.POSITIVE_INFINITY;
  return [...rows].sort((a, b) => {
    const ta = priorityTier(a);
    const tb = priorityTier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 2) return reason(a) - reason(b) || fall(a) - fall(b) || a.patient.id.localeCompare(b.patient.id);
    if (ta === 4) return fall(a) - fall(b) || reason(a) - reason(b) || a.patient.id.localeCompare(b.patient.id);
    return (
      deadline(a) - deadline(b) ||
      battery(a) - battery(b) ||
      a.patient.familyName.localeCompare(b.patient.familyName, 'sv') ||
      a.patient.givenName.localeCompare(b.patient.givenName, 'sv')
    );
  });
}
