// Hospital at Home state – SPEC.md § 11.5. Mixed into the store. Map layers, the mode and the selection are view
// state and are not logged; every change to the disruptions (a road closed or opened, an outage, a reset) is written
// to the audit log through logEntry() (by way of logHome, which marks the entry as this module's) like every other action.
import type { StateCreator } from 'zustand';
import type { AppStore } from './store';
import type { DataPack, Handover, HomeDisruption, HomeDisruptionPreset, HomeVisit, HomeWork, HomeWorkStatus, TeamId, HomeDisruptionKind, HomeDisruptionSource, HomeDisruptionTargetKind, InfraLayer, InfraNode, LocalizedText, ZoneId } from './types';
import { lt, same, t } from '@/lib/i18n';
import { CURRENT_USER, SYSTEM_ACTOR } from './vocab';
import { deriveSets, expiredIds } from '@/lib/disruptions';
import { freeSlots, effectiveVisits } from './packs/home-visits';
import { formatClock } from '@/lib/time';
import { haversineM } from '@/lib/roadGraph';
import { getRoadModel } from '@/lib/roadModel';
import { getAppliedNodes } from '@/lib/osmNodes';
import { homeSiteName, homeSitesInScope } from '@/lib/home-sites';
import { homePackIdOf, homePacks } from './packs/home-packs';
import { blockedFlags, disruptionCount, impact, priorityTier } from '@/lib/reachability';
import { roadsAtTap, waysNearPoint } from '@/lib/roadGraph';
import { hypotheses } from '@/lib/signal';

export type HomeLayerKey = InfraLayer | 'patients' | 'tele';
export const HOME_LAYER_KEYS: HomeLayerKey[] = ['patients', 'roads', 'el', 'water', 'tele'];

/** What a tap on the map does: nothing selected = select a node; otherwise toggle a road, a power outage or a water disruption. */
export type HomeMode = null | 'roads' | 'el' | 'water' | 'heat' | 'cold';
export const HOME_MODES: Array<Exclude<HomeMode, null>> = ['roads', 'el', 'water', 'heat', 'cold'];

/** The radius of the cold chain's "every road within 250 m of the site is closed" (SPEC.md § 6). */
export const SITE_CUTOFF_RADIUS_M = 250;

export interface HomeState {
  /** Defaults: patients and roads on, el and water off. */
  layers: Record<HomeLayerKey, boolean>;
  mode: HomeMode;
  /** OSM way ids closed by a tap on a segment. */
  blockedWays: Set<string>;
  /** Roads closed by a tap with "block whole road": `name` or `name|ref`. */
  blockedRoads: Set<string>;
  /** Road nodes (bridges, tunnels) closed; each blocks its `osmWayNames`. */
  blockedNodes: Set<string>;
  powerOutZones: Set<ZoneId>;
  waterOutZones: Set<ZoneId>;
  /** Every disruption as a record in time, ended ones included as history (SPEC.md § 13.2). The sets above are derived from the active records. */
  disruptions: HomeDisruption[];
  /** Zone → start of the earliest active power disruption covering it; the battery deadlines are computed from it. */
  powerStart: Map<ZoneId, number>;
  /** Zone → start of the earliest tele disturbance, heatwave and cold; start of the earliest supplier disruption (SPEC.md § 6). */
  teleStart: Map<ZoneId, number>;
  heatStart: Map<ZoneId, number>;
  coldStart: Map<ZoneId, number>;
  supplierStart: number | null;
  /** Outages that nobody has registered, started from the Demo popover; they change the realtime signal, not the impact. */
  hiddenPower: Map<ZoneId, number>;
  /** Clock minute since which every road within 250 m of a site is closed, or null (the cold chain). */
  siteCutoffSince: number | null;
  /** Patient → extra hours given by Kylpåse and Kortare infusion before a heat-critical pump patient is marked. */
  heatExtraHours: Map<string, number>;
  /** The work on affected patients: the status chain and what was decided (SPEC.md § 13.3). A patient with no entry is Unhandled. */
  work: Record<string, HomeWork>;
  /** Today's visits; Move visit changes a slot or cancels one (SPEC.md § 14.3). */
  visits: HomeVisit[];
  /** The patients marked Ta in, in order (SPEC.md § 7); kept when the disruption ends. */
  handovers: Handover[];
  /** The infrastructure node the panel shows; the map dims everything it is not linked to. */
  selectedNode: string | null;
  /** In roads mode a tap blocks every way that shares the tapped way's name (view state). */
  wholeRoad: boolean;
  /** The road geometry has loaded (it is a dynamic import), so the road graph can answer. */
  geoReady: boolean;
  /** The infrastructure nodes with OpenStreetMap positions once the geometry has loaded (SPEC.md § 12.5); the pack's before. */
  infraNodes: InfraNode[];
}

export interface HomeActions {
  setHomeLayer: (layer: HomeLayerKey, on: boolean) => void;
  /** Selecting is view state (not logged); selecting the selected node again clears it. */
  selectHomeNode: (id: string | null) => void;
  /** Picks the mode (picking the active one clears it) and switches on the layer the mode acts on. */
  setHomeMode: (mode: HomeMode) => void;
  toggleBlockedNode: (id: string) => void;
  toggleBlockedWay: (id: string) => void;
  /** A tap on a road segment (SPEC.md § 6.1): closes every way that shares the tapped way's name or ref within 250 m of the point, or opens them if the tapped way is closed. */
  closeRoadAt: (props: { id: number; name: string | null; ref: string | null }, at: { lat: number; lng: number }) => void;
  toggleBlockedRoad: (key: string) => void;
  setWholeRoad: (on: boolean) => void;
  /** The geometry has loaded; `infraNodes` are the pack's nodes with their OpenStreetMap positions. */
  setHomeGeoReady: (infraNodes?: InfraNode[]) => void;
  togglePowerOut: (zone: ZoneId) => void;
  toggleWaterOut: (zone: ZoneId) => void;
  /** Heatwave and cold per zone, like the power and water map modes. */
  toggleHeat: (zone: ZoneId) => void;
  toggleCold: (zone: ZoneId) => void;
  /** A tele disturbance in a zone and a supplier disruption (chosen in the panel, no map target); each returns false when it is already active. */
  startTeleDisturbance: (zone: ZoneId, startedAt?: number, source?: 'panel' | 'hypothesis') => boolean;
  startSupplierDisruption: () => boolean;
  /** Registers the suspected disruption of a zone as a power outage or a tele disturbance (SPEC.md § 6, hypothesis). */
  registerHypothesis: (zone: ZoneId, as: 'power' | 'tele') => void;
  /** Demo: an outage in a zone that nobody has registered; it changes the signal only. */
  startHiddenOutage: (zone: ZoneId) => void;
  /** Kylpåse and Kortare infusion: logged, 12 h extra before a heat-critical pump patient is marked; sets Planned. */
  heatRelief: (patientId: string, kind: 'coolingPouch' | 'shorterInfusion') => void;
  /** Besök inom 2 h: logged; sets Planned. */
  visitWithin2h: (patientId: string) => void;
  /** Starts a disruption record (from the map, a preset or a message) and logs it; returns its id, or null when it is already active. */
  startHomeDisruption: (input: NewDisruption) => string | null;
  /** Ends a record by hand ("end now") and logs it. */
  endHomeDisruption: (id: string) => void;
  /** Ends every active record whose expected end the clock has reached and logs each as "ended (expected)". Called when the clock moves. */
  settleHomeDisruptions: () => void;
  /** Advances the shared clock (the "+1 h" control), logs it and lets expired disruptions end. */
  advanceClock: (minutes: number) => void;
  /** Selects a unit in the scope selector: one of the organisation's own units, or the whole organisation (SPEC.md § 4). */
  selectScope: (scope: string) => void;
  /** Contact – sets Contacted (the status never moves backwards) and records the note. */
  contactPatient: (patientId: string, note: string) => void;
  /** Move visit – a new slot from the team's free slots, or null for "no visit today"; sets Planned. */
  moveVisit: (patientId: string, slot: number | null) => void;
  /** Send team – sets Planned and records the team on the patient. */
  sendTeam: (patientId: string, teamId: TeamId) => void;
  /** Bring in – marks the patient for transfer to the nearest site in scope; sets Planned. */
  bringInPatient: (patientId: string) => void;
  /** Confirm – sets Confirmed. */
  confirmPatient: (patientId: string) => void;
  /** Contact all critical – Contacted on every critical row, note "bulk contact"; one log entry. */
  contactAllCritical: () => void;
  /** Clears every disruption and writes one log entry; nothing happens when there is none. */
  resetHomeDisruptions: () => void;
  /** A demo scenario (SPEC.md § 6): replaces the disruptions with the preset's and writes one log entry. */
  applyHomePreset: (key: HomeDisruptionPreset['key']) => void;
}

export interface NewDisruption {
  kind: HomeDisruptionKind;
  target: string;
  targetKind: HomeDisruptionTargetKind;
  /** Display label; derived from the target when absent. */
  label?: LocalizedText;
  expectedEnd?: number | null;
  source: HomeDisruptionSource;
  /** E.g. the id of the message the disruption was created from. */
  note?: string | null;
  /** Clock minute the disruption began, when it is not now (a suspected outage is dated from the signal). */
  startedAt?: number;
}

export const WORK_STATUSES: HomeWorkStatus[] = ['Unhandled', 'Contacted', 'Planned', 'Confirmed'];
const RANK = (s: HomeWorkStatus) => WORK_STATUSES.indexOf(s);
const NO_WORK: HomeWork = { status: 'Unhandled', note: null, assignedTeam: null, bringInSite: null, bringInAt: null, bringInReasons: [] };

export function initialHome(pack: Pick<DataPack, 'infraNodes'> & Partial<Pick<DataPack, 'homeVisits' | 'homePackId'>>): HomeState {
  return {
    layers: { patients: true, roads: true, el: false, water: false, tele: false },
    mode: null,
    blockedWays: new Set(),
    blockedRoads: new Set(),
    blockedNodes: new Set(),
    powerOutZones: new Set(),
    waterOutZones: new Set(),
    disruptions: [],
    powerStart: new Map(),
    teleStart: new Map(),
    heatStart: new Map(),
    coldStart: new Map(),
    supplierStart: null,
    hiddenPower: new Map(),
    siteCutoffSince: null,
    heatExtraHours: new Map(),
    work: {},
    handovers: [],
    visits: structuredClone(pack.homeVisits ?? []),
    selectedNode: null,
    wholeRoad: false,
    geoReady: getRoadModel() !== null,
    infraNodes: getAppliedNodes(homePackIdOf(pack))?.nodes ?? pack.infraNodes,
  };
}

/** A way by its name, else its ref, else its OSM id (for the log and the panel). */
export function wayLabel(id: string): string {
  const g = getRoadModel()?.graph;
  const w = g?.ways[g.wayIndexById.get(Number(id)) ?? -1];
  return w?.name ?? w?.ref ?? `OSM ${id}`;
}

/** The state with the given records and the sets derived from the active ones. */
function withRecords(home: HomeState, disruptions: HomeDisruption[]): HomeState {
  return { ...home, disruptions, ...deriveSets(disruptions) };
}

const same_ = (a: HomeDisruption, kind: HomeDisruptionKind, target: string) => a.kind === kind && a.target === target;

let settlingHome = false;

export const createHomeSlice: StateCreator<AppStore, [], [], HomeActions> = (set, get) => {
  /** "N of 150 patients affected" for the current state and scope: the detail of every disruption log entry. */
  const detail = () => {
    const { pack, home } = get();
    const r = impact(pack, home, scopeSites(), undefined, get().clock);
    return t('AUDIT.homeDetail', { n: r.summary.affected, total: pack.homePatients.length });
  };
  /** Zones with any active registered disruption record. */
  const registeredZones = (): Set<ZoneId> => new Set(get().home.disruptions.filter((d) => d.endedAt === null && d.targetKind === 'zone').map((d) => d.target));
  const zoneName = (zone: ZoneId) => {
    const z = get().pack.homeZones.find((x) => x.id === zone);
    return z ? lt(z.name) : zone;
  };

  /** The sites reachability runs from: the sites of the selected unit. */
  const scopeSites = () => homeSitesInScope(get().pack.homePackId, get().scope);
  const labelOf = (input: NewDisruption): LocalizedText => {
    if (input.label) return input.label;
    const { pack } = get();
    if (input.kind === 'road') {
      if (input.targetKind === 'node') return pack.infraNodes.find((n) => n.id === input.target)?.name ?? same(input.target);
      return same(input.targetKind === 'way' ? wayLabel(input.target) : input.target.split('|')[0]);
    }
    const zone = pack.homeZones.find((z) => z.id === input.target);
    const name = input.kind === 'supplier' ? same(homePacks[pack.homePackId].name) : zone ? zone.name : same(input.target);
    const key = `HOME.disruption.${input.kind}` as const;
    return { sv: t(key, { name: name.sv }, 'sv'), en: t(key, { name: name.en }, 'en') };
  };
  /** Adds a record (state only; the caller logs). Null when the same target is already disrupted. */
  const addRecord = (input: NewDisruption): string | null => {
    const { home, clock, nextId } = get();
    if (home.disruptions.some((d) => d.endedAt === null && same_(d, input.kind, input.target))) return null;
    const id = nextId('hd');
    const record: HomeDisruption = {
      id,
      kind: input.kind,
      target: input.target,
      targetKind: input.targetKind,
      label: labelOf(input),
      startedAt: input.startedAt ?? clock,
      expectedEnd: input.expectedEnd ?? null,
      source: input.source,
      createdBy: CURRENT_USER.name,
      endedAt: null,
      endReason: null,
      note: input.note ?? null,
    };
    set((s) => ({ home: withRecords(s.home, [...s.home.disruptions, record]) }));
    return id;
  };
  /** Ends the active record for a target (state only). Returns the record, or null. */
  const endRecord = (match: (d: HomeDisruption) => boolean, reason: NonNullable<HomeDisruption['endReason']>): HomeDisruption | null => {
    const found = get().home.disruptions.find((d) => d.endedAt === null && match(d));
    if (!found) return null;
    const at = get().clock;
    set((s) => ({ home: withRecords(s.home, s.home.disruptions.map((d) => (d === found ? { ...d, endedAt: at, endReason: reason } : d))) }));
    return found;
  };
  const endAll = (reason: 'reset' | 'replaced') => {
    const at = get().clock;
    set((s) => ({ home: withRecords(s.home, s.home.disruptions.map((d) => (d.endedAt === null ? { ...d, endedAt: at, endReason: reason } : d))) }));
  };
  /** A map tap: ends the active record for the target, else starts one (source "map"). Returns true when it started one. */
  const toggleRecord = (input: NewDisruption): boolean => {
    if (endRecord((d) => same_(d, input.kind, input.target), 'manual')) return false;
    addRecord(input);
    return true;
  };

  /** Every entry of this module carries `area: 'home'` for the log drawer's filter (SPEC.md § 14.4). */
  const logHome = (action: string, object: string, detail?: string, actor?: string, ref?: string, options?: { advance?: boolean }) =>
    get().logEntry(action, object, detail, actor, ref, { ...options, area: 'home' });

  const patientOf = (id: string) => get().pack.homePatients.find((p) => p.id === id);
  const nameOf = (id: string) => {
    const p = patientOf(id);
    return p ? `${p.familyName}, ${p.givenName}` : id;
  };
  /** Sets the work record of a patient; the status never moves backwards. */
  const setWork = (id: string, patch: Partial<HomeWork>, status: HomeWorkStatus) =>
    set((s) => {
      const cur = s.home.work[id] ?? NO_WORK;
      const next: HomeWork = { ...cur, ...patch, status: RANK(status) > RANK(cur.status) ? status : cur.status };
      return { home: { ...s.home, work: { ...s.home.work, [id]: next } } };
    });
  /** True when the patient is affected now from the sites in scope (unreachable, without power or water). */
  const affectedNow = (id: string) => {
    const { pack, home, clock } = get();
    return impact(pack, home, scopeSites(), undefined, clock).rows.some((r) => r.affected && r.patient.id === id);
  };
  const teamName = (id: TeamId) => get().pack.homeTeams.find((x) => x.id === id)?.name ?? id;

  /**
   * Status resets to Unhandled only when the disruption that affected the patient has ended (SPEC.md § 13.3): a patient with
   * work on them who is no longer affected from the sites in scope starts over. The log keeps the history.
   */
  const reconcile = () => {
    const { pack, home, clock } = get();
    const touched = Object.keys(home.work).filter((id) => home.work[id].status !== 'Unhandled');
    if (touched.length === 0) return;
    const affected = new Set(impact(pack, home, scopeSites(), undefined, clock).rows.filter((r) => r.affected).map((r) => r.patient.id));
    const reset = touched.filter((id) => !affected.has(id));
    if (reset.length === 0) return;
    set((s) => {
      const work = { ...s.home.work };
      for (const id of reset) delete work[id];
      return { home: { ...s.home, work } };
    });
    logHome(t('AUDIT.homeStatusReset'), t('AUDIT.homeObject'), t('AUDIT.homeStatusResetDetail', { n: reset.length }), SYSTEM_ACTOR, reset.join(','));
  };

  const cutoffCache = new WeakMap<object, Map<string, number[]>>();
  /** Recomputes since when every road within 250 m of a site is closed (the cold chain); call after any change of the roads. */
  const updateCutoff = () => {
    const model = getRoadModel();
    const { pack, home, clock } = get();
    if (!model) return;
    let cache = cutoffCache.get(model);
    if (!cache) cutoffCache.set(model, (cache = new Map()));
    const flags = blockedFlags(model, home, pack);
    const sites = homePacks[pack.homePackId].sites;
    const cut = sites.some((site) => {
      let ways = cache!.get(site.id);
      if (!ways) cache!.set(site.id, (ways = waysNearPoint(model.graph, site.lat, site.lng, SITE_CUTOFF_RADIUS_M)));
      return ways.length > 0 && ways.every((w) => flags[w] === 1);
    });
    const since = home.siteCutoffSince;
    if (cut && since === null) set((s) => ({ home: { ...s.home, siteCutoffSince: clock } }));
    else if (!cut && since !== null) set((s) => ({ home: { ...s.home, siteCutoffSince: null } }));
  };

  /** Toggles a zone record of the kind (power, water, heat, cold) and logs it; shared by the map modes. */
  const toggleZone = (kind: 'heat' | 'cold', zone: ZoneId, on: string, off: string) => {
    if (!get().pack.homeZones.some((z) => z.id === zone)) return;
    const started = toggleRecord({ kind, target: zone, targetKind: 'zone', source: 'map' });
    logHome(started ? t(on as never) : t(off as never), zoneName(zone), detail());
    reconcile();
  };

  return {
    setHomeLayer: (layer, on) =>
      set((s) => ({
        home: {
          ...s.home,
          layers: { ...s.home.layers, [layer]: on },
          // A node of a layer that is switched off cannot stay selected.
          selectedNode: !on && layer !== 'patients' && s.home.infraNodes.find((n) => n.id === s.home.selectedNode)?.layer === layer ? null : s.home.selectedNode,
        },
      })),

    selectHomeNode: (id) => set((s) => ({ home: { ...s.home, selectedNode: id === s.home.selectedNode ? null : id } })),

    setHomeMode: (mode) =>
      set((s) => {
        const next = mode === s.home.mode ? null : mode;
        return { home: { ...s.home, mode: next, layers: next ? { ...s.home.layers, [next]: true } : s.home.layers } };
      }),

    toggleBlockedNode: (id) => {
      const { pack } = get();
      const node = pack.infraNodes.find((n) => n.id === id && n.layer === 'roads');
      if (!node) return;
      const blocking = toggleRecord({ kind: 'road', target: id, targetKind: 'node', source: 'map' });
      logHome(blocking ? t('AUDIT.homeBlocked') : t('AUDIT.homeUnblocked'), lt(node.name), detail());
      updateCutoff();
      reconcile();
    },

    toggleBlockedWay: (id) => {
            const blocking = toggleRecord({ kind: 'road', target: id, targetKind: 'way', source: 'map' });
      logHome(blocking ? t('AUDIT.homeBlocked') : t('AUDIT.homeUnblocked'), wayLabel(id), detail());
      updateCutoff();
      reconcile();
    },

    closeRoadAt: (props, at) => {
      const model = getRoadModel();
      const { pack, home } = get();
      const open = home.disruptions.find((d) => d.endedAt === null && d.kind === 'road' && (d.targetKind === 'ways' ? d.target.split(',').includes(String(props.id)) : d.targetKind === 'way' && d.target === String(props.id)));
      if (open) {
        endRecord((d) => d === open, 'manual');
        logHome(t('AUDIT.homeUnblocked'), lt(open.label), detail());
        updateCutoff();
        reconcile();
        return;
      }
      const ids = model ? roadsAtTap(model.graph, props, at.lat, at.lng) : [props.id];
      // "<name> vid <nearest locality or zone>": the road's name (or ref) and the zone whose centre is nearest the tap.
      const nearest = [...pack.homeZones].sort((a, b) => haversineM(at.lat, at.lng, a.lat, a.lng) - haversineM(at.lat, at.lng, b.lat, b.lng))[0];
      const roadName = props.name ?? props.ref ?? `OSM ${props.id}`;
      const label: LocalizedText = nearest
        ? { sv: t('HOME.disruption.roadAt', { name: roadName, place: nearest.name.sv }, 'sv'), en: t('HOME.disruption.roadAt', { name: roadName, place: nearest.name.en }, 'en') }
        : same(roadName);
      addRecord({ kind: 'road', target: ids.join(','), targetKind: 'ways', source: 'map', label });
      logHome(t('AUDIT.homeBlocked'), lt(label), detail());
      updateCutoff();
      reconcile();
    },

    toggleBlockedRoad: (key) => {
            const blocking = toggleRecord({ kind: 'road', target: key, targetKind: 'road', source: 'map' });
      logHome(blocking ? t('AUDIT.homeBlocked') : t('AUDIT.homeUnblocked'), key.split('|')[0], detail());
      updateCutoff();
      reconcile();
    },

    setWholeRoad: (on) => set((s) => ({ home: { ...s.home, wholeRoad: on } })),

    setHomeGeoReady: (infraNodes) => set((s) => ({ home: { ...s.home, geoReady: true, infraNodes: infraNodes ?? s.home.infraNodes } })),

    togglePowerOut: (zone) => {
      const { pack } = get();
      if (!pack.homeZones.some((z) => z.id === zone)) return;
      const out = toggleRecord({ kind: 'power', target: zone, targetKind: 'zone', source: 'map' });
      logHome(out ? t('AUDIT.homePowerOut') : t('AUDIT.homePowerRestored'), zoneName(zone), detail());
      reconcile();
    },

    toggleWaterOut: (zone) => {
      const { pack } = get();
      if (!pack.homeZones.some((z) => z.id === zone)) return;
      const out = toggleRecord({ kind: 'water', target: zone, targetKind: 'zone', source: 'map' });
      logHome(out ? t('AUDIT.homeWaterOut') : t('AUDIT.homeWaterRestored'), zoneName(zone), detail());
      reconcile();
    },

    toggleHeat: (zone) => toggleZone('heat', zone, 'AUDIT.homeHeatOn', 'AUDIT.homeHeatOff'),

    toggleCold: (zone) => toggleZone('cold', zone, 'AUDIT.homeColdOn', 'AUDIT.homeColdOff'),

    startTeleDisturbance: (zone, startedAt, source = 'panel') => {
      if (!get().pack.homeZones.some((z) => z.id === zone)) return false;
      const id = addRecord({ kind: 'tele', target: zone, targetKind: 'zone', source, startedAt });
      if (!id) return false;
      logHome(t('AUDIT.homeTeleOn'), zoneName(zone), [detail(), t(`AUDIT.homeSources.${source}`)].join(' · '), undefined, id);
      return true;
    },

    startSupplierDisruption: () => {
      const id = addRecord({ kind: 'supplier', target: get().pack.homePackId, targetKind: 'pack', source: 'panel' });
      if (!id) return false;
      logHome(t('AUDIT.homeSupplierOn'), homePacks[get().pack.homePackId].customer, detail(), undefined, id);
      return true;
    },

    registerHypothesis: (zone, as) => {
      const { pack, home, clock } = get();
      const found = hypotheses(pack.homePatients, pack.homeZones, { powerStart: home.powerStart, teleStart: home.teleStart, hiddenPower: home.hiddenPower }, registeredZones(), clock).find((h) => h.zone === zone);
      if (!found) return;
      const z = pack.homeZones.find((x) => x.id === zone)!;
      // The start is estimated from the cluster of last contacts: a power outage began before the network fell.
      const startedAt = as === 'power' ? Math.max(0, found.firstSilentAt - (z.urban ? 60 : 240)) : found.firstSilentAt;
      const id = addRecord({ kind: as, target: zone, targetKind: 'zone', source: 'hypothesis', startedAt });
      if (!id) return;
      logHome(as === 'power' ? t('AUDIT.homePowerOut') : t('AUDIT.homeTeleOn'), zoneName(zone), [detail(), t('AUDIT.homeSources.hypothesis')].join(' · '), undefined, id);
      reconcile();
    },

    startHiddenOutage: (zone) => {
      const { pack, clock, home } = get();
      if (!pack.homeZones.some((z) => z.id === zone) || home.hiddenPower.has(zone)) return;
      set((s) => ({ home: { ...s.home, hiddenPower: new Map(s.home.hiddenPower).set(zone, clock) } }));
      logHome(t('AUDIT.homeHiddenOutage'), zoneName(zone), undefined, SYSTEM_ACTOR);
    },

    heatRelief: (patientId, kind) => {
      if (!patientOf(patientId)) return;
      set((s) => ({ home: { ...s.home, heatExtraHours: new Map(s.home.heatExtraHours).set(patientId, (s.home.heatExtraHours.get(patientId) ?? 0) + 12) } }));
      setWork(patientId, {}, 'Planned');
      logHome(t(kind === 'coolingPouch' ? 'AUDIT.homeCoolingPouch' : 'AUDIT.homeShorterInfusion'), nameOf(patientId), undefined, undefined, patientId);
    },

    visitWithin2h: (patientId) => {
      if (!patientOf(patientId)) return;
      setWork(patientId, {}, 'Planned');
      logHome(t('AUDIT.homeVisit2h'), nameOf(patientId), undefined, undefined, patientId);
    },

    startHomeDisruption: (input) => {
      const id = addRecord(input);
      if (!id) return null;
      const d = get().home.disruptions.find((x) => x.id === id)!;
      logHome(t('AUDIT.homeStarted'), lt(d.label), [detail(), t(`AUDIT.homeSources.${d.source}`), d.note].filter(Boolean).join(' · '), undefined, id);
      return id;
    },

    endHomeDisruption: (id) => {
      const d = endRecord((x) => x.id === id, 'manual');
      if (!d) return;
      logHome(t('AUDIT.homeEnded'), lt(d.label), detail(), undefined, id);
      updateCutoff();
      reconcile();
    },

    settleHomeDisruptions: () => {
      if (settlingHome) return;
      const due = expiredIds(get().home.disruptions, get().clock);
      if (due.length === 0) return;
      settlingHome = true;
      try {
        for (const id of due) {
          const d = endRecord((x) => x.id === id, 'expected');
          if (d) logHome(t('AUDIT.homeEndedExpected'), lt(d.label), detail(), SYSTEM_ACTOR, id);
        }
        updateCutoff();
        reconcile();
      } finally {
        settlingHome = false;
      }
    },

    advanceClock: (minutes) => {
      set((s) => ({ clock: s.clock + minutes }));
      logHome(t('AUDIT.homeClockAdvanced'), t('AUDIT.homeObject'), t('AUDIT.homeClockDetail', { n: minutes }), undefined, undefined, { advance: false });
    },

    selectScope: (scope) => {
      // Only the organisation's own units can be selected; nothing in the interface switches to another organisation's.
      if (!homePacks[get().pack.homePackId].scopes.some((x) => x.id === scope)) return;
      set({ scope });
    },

    contactPatient: (patientId, note) => {
      if (!patientOf(patientId)) return;
      const text = note.trim();
      setWork(patientId, { note: text || null }, 'Contacted');
      logHome(t('AUDIT.homeContact'), nameOf(patientId), text || undefined, undefined, patientId);
    },

    moveVisit: (patientId, slot) => {
      const { home, pack, clock } = get();
      const visit = home.visits.find((v) => v.patientId === patientId);
      const patient = patientOf(patientId);
      if (!visit || !patient?.visitToday) return;
      const team = pack.homeTeams.find((x) => x.id === (home.work[patientId]?.assignedTeam ?? visit.teamId));
      if (!team) return;
      const was = formatClock(visit.start);
      if (slot === null) {
        set((s) => ({ home: { ...s.home, visits: s.home.visits.map((v) => (v.id === visit.id ? { ...v, status: 'cancelled' } : v)) } }));
        if (affectedNow(patientId)) setWork(patientId, {}, 'Planned');
        logHome(t('AUDIT.homeVisitCancelled'), nameOf(patientId), t('AUDIT.homeVisitFrom', { from: was }), undefined, patientId);
        return;
      }
      const free = freeSlots(effectiveVisits(home.visits, home.work).filter((v) => v.id !== visit.id), team, clock);
      if (!free.includes(slot)) return;
      set((s) => ({ home: { ...s.home, visits: s.home.visits.map((v) => (v.id === visit.id ? { ...v, start: slot, status: 'moved' } : v)) } }));
      // Outside a disruption a move is plain planning: it changes the slot and is logged, but there is no status chain to move.
      if (affectedNow(patientId)) setWork(patientId, {}, 'Planned');
      logHome(t('AUDIT.homeVisitMoved'), nameOf(patientId), t('AUDIT.homeVisitMove', { from: was, to: formatClock(slot) }), undefined, patientId);
    },

    sendTeam: (patientId, teamId) => {
      if (!patientOf(patientId) || !get().pack.homeTeams.some((x) => x.id === teamId)) return;
      setWork(patientId, { assignedTeam: teamId }, 'Planned');
      logHome(t('AUDIT.homeSendTeam'), nameOf(patientId), teamName(teamId), undefined, patientId);
    },

    bringInPatient: (patientId) => {
      const patient = patientOf(patientId);
      if (!patient) return;
      const packId = get().pack.homePackId;
      const inScope = scopeSites();
      const candidates = homePacks[packId].sites.filter((x) => inScope.length === 0 || inScope.includes(x.id));
      const nearest = [...candidates].sort((a, b) => haversineM(patient.lat, patient.lng, a.lat, a.lng) - haversineM(patient.lat, patient.lng, b.lat, b.lng))[0] ?? homePacks[packId].sites[0];
      const { pack, home, clock } = get();
      const row = impact(pack, home, scopeSites(), undefined, clock).rows.find((r) => r.patient.id === patientId);
      setWork(patientId, { bringInSite: nearest.id, bringInAt: clock, bringInReasons: row ? row.reasons : [] }, 'Planned');
      const handover: Handover = { id: get().nextId('ho'), patientId, at: clock, site: nearest.id, reasons: row ? row.reasons : [], priority: row ? priorityTier(row) : null };
      set((s) => ({ home: { ...s.home, handovers: [...s.home.handovers.filter((h) => h.patientId !== patientId), handover] } }));
      logHome(t('AUDIT.homeBringIn'), nameOf(patientId), homeSiteName(packId, nearest.id), undefined, patientId);
    },

    confirmPatient: (patientId) => {
      if (!patientOf(patientId)) return;
      setWork(patientId, {}, 'Confirmed');
      logHome(t('AUDIT.homeConfirm'), nameOf(patientId), undefined, undefined, patientId);
    },

    contactAllCritical: () => {
      const { pack, home, clock } = get();
      // A patient out of contact cannot be reached by phone: a physical visit is needed, so the bulk contact leaves those rows.
      const rows = impact(pack, home, scopeSites(), undefined, clock).rows.filter((r) => r.critical && !r.noContact);
      if (rows.length === 0) return;
      const note = t('HOME.work.bulkNote');
      for (const r of rows) setWork(r.patient.id, { note }, 'Contacted');
      logHome(t('AUDIT.homeBulk'), t('AUDIT.homeObject'), t('AUDIT.homeBulkDetail', { n: rows.length }), undefined, rows.map((r) => r.patient.id).join(','));
    },

    resetHomeDisruptions: () => {
      const { home } = get();
      if (disruptionCount(home) === 0) return;
      endAll('reset');
      logHome(t('AUDIT.homeReset'), t('AUDIT.homeObject'), detail());
      updateCutoff();
      reconcile();
    },

    applyHomePreset: (key) => {
      const { pack } = get();
      const preset = pack.homePresets.find((p) => p.key === key);
      if (!preset) return;
      endAll('replaced');
      for (const id of preset.blockedNodes) addRecord({ kind: 'road', target: id, targetKind: 'node', source: 'preset' });
      for (const z of preset.powerOutZones) addRecord({ kind: 'power', target: z, targetKind: 'zone', source: 'preset' });
      for (const z of preset.waterOutZones) addRecord({ kind: 'water', target: z, targetKind: 'zone', source: 'preset' });
      for (const z of preset.heatZones ?? []) addRecord({ kind: 'heat', target: z, targetKind: 'zone', source: 'preset' });
      for (const z of preset.coldZones ?? []) addRecord({ kind: 'cold', target: z, targetKind: 'zone', source: 'preset' });
      set((s) => ({
        home: {
          ...s.home,
          mode: null,
          selectedNode: null,
          // The layer the preset acts on is switched on so that the cause is visible.
          layers: { ...s.home.layers, roads: s.home.layers.roads || preset.blockedNodes.length > 0, el: s.home.layers.el || preset.powerOutZones.length > 0, water: s.home.layers.water || preset.waterOutZones.length > 0, tele: s.home.layers.tele || preset.powerOutZones.length > 0 },
        },
      }));
      logHome(t('AUDIT.homePreset'), lt(preset.name), detail());
      updateCutoff();
      reconcile();
    },
  };
};

