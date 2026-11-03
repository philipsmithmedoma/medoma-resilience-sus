// In-memory zustand store (SPEC.md § 6, § 7). Every state-changing action goes through logEntry(), which appends
// an audit entry stamped with the shared clock and advances the clock by one minute.
import { create } from 'zustand';
import type { AuditEntry, ClosedIncident, DataPack, Incident, Playbook, Staff } from './types';
import { buildDataPack, DEFAULT_HOME_PACK } from './packs/home-packs';
import { CURRENT_USER } from './vocab';
import { t, tm } from '@/lib/i18n';
import { INITIAL_CLOCK, formatClock } from '@/lib/time';
import { createIncidentSlice, type IncidentActions } from './store-incident';
import type { PreparednessReason } from '@/lib/preparedness';
import { setActiveRoadPack } from '@/lib/roadModel';
import { defaultScopeOf } from '@/lib/scope';
import { createHomeSlice, initialHome, type HomeActions, type HomeState } from './store-home';

export interface DataState {
  pack: DataPack;
  /** The unit selected in the navigation: a site id, or the id of the whole pack (SPEC.md § 4). */
  scope: string;
  clock: number;
  playbooks: Playbook[];
  incident: Incident | null;
  closedIncidents: ClosedIncident[];
  log: AuditEntry[];
  staff: Staff[];
  home: HomeState;
  /** The manual preparedness flag (SPEC.md § 2); the mode itself is derived in lib/preparedness.ts. */
  preparednessOn: boolean;
  ids: number;
}

export interface Actions {
  /** Append an audit entry and advance the clock one minute (entries that must not move the clock pass advance: false). Returns the entry id. */
  logEntry: (action: string, object: string, detail?: string, actor?: string, ref?: string, options?: { advance?: boolean; area?: 'home' }) => string;
  nextId: (prefix: string) => string;
  /** Selects a unit; a unit of the other home pack switches the pack. */
  setScope: (scope: string) => void;
  /** Reset restores the pack, clears the incident and disruptions and sets the clock back. */
  reset: () => void;
  /** Sets the manual preparedness flag; every change is logged with the reason "manual". */
  setPreparedness: (on: boolean) => void;
  /** Logs a change of the derived mode that the flag did not cause (reason "incident" or "route"). */
  logPreparednessChange: (on: boolean, reason: PreparednessReason) => void;
}

export type AppStore = DataState & Actions & IncidentActions & HomeActions;

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function initialData(): DataState {
  const pack = buildDataPack(DEFAULT_HOME_PACK);
  return {
    pack,
    scope: defaultScopeOf(pack.homePackId),
    clock: INITIAL_CLOCK,
    playbooks: clone(pack.playbooks),
    incident: null,
    closedIncidents: [],
    log: [],
    staff: clone(pack.staff),
    home: initialHome(pack),
    preparednessOn: false,
    ids: 100,
  };
}

export const useStore = create<AppStore>()((set, get, api) => ({
  ...initialData(),
  ...createIncidentSlice(set, get, api),
  ...createHomeSlice(set, get, api),

  nextId: (prefix) => {
    const n = get().ids + 1;
    set({ ids: n });
    return `${prefix}-${n}`;
  },

  logEntry: (action, object, detail, actor = CURRENT_USER.name, ref, options) => {
    const state = get();
    const id = `log-${state.log.length + 1}-${state.ids + 1}`;
    const entry: AuditEntry = { id, at: formatClock(state.clock), actor, action, object, detail, ref, ...(options?.area ? { area: options.area } : {}) };
    set({ log: [...state.log, entry], clock: state.clock + (options?.advance === false ? 0 : 1), ids: state.ids + 1 });
    get().settleHomeDisruptions();
    return id;
  },

  setScope: (scope) => get().selectScope(scope),

  reset: () => {
    setActiveRoadPack(DEFAULT_HOME_PACK); // a demo reset is back to the default pack
    set({ ...initialData() });
  },

  setPreparedness: (on) => {
    if (get().preparednessOn === on) return;
    set({ preparednessOn: on });
    get().logPreparednessChange(on, 'manual');
  },

  logPreparednessChange: (on, reason) => {
    const reasons = tm('AUDIT.preparednessReasons');
    get().logEntry(on ? t('AUDIT.preparednessOn') : t('AUDIT.preparednessOff'), t('AUDIT.preparednessObject'), t('AUDIT.preparednessReason', { reason: reasons[reason] }), undefined, reason);
  },
}));

export const selectClockLabel = (s: DataState) => formatClock(s.clock);
