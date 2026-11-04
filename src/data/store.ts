// In-memory zustand store (SPEC.md § 6, § 7). Every state-changing action goes through logEntry(), which appends
// an audit entry stamped with the shared clock and advances the clock by one minute.
import { create } from 'zustand';
import type { AuditEntry, ClosedIncident, DataPack, Incident, Playbook, Staff } from './types';
import { buildDataPack, DEFAULT_HOME_PACK } from './packs/home-packs';
import { organisationById, organisationOfPack, organisations } from './packs/organisations';
import type { HomePackId } from './types';
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
  /**
   * The organisation the user is in (SPEC.md § 1): chosen once on `/start-org`, or at once when there is only one. Null while nobody is
   * signed in. The route carries it as the prefix `#/o/<org>/`.
   */
  organisationId: string | null;
  /** The organisation whose environment the data below belongs to; a different organisation gets a fresh environment on sign-in. */
  dataOrganisationId: string | null;
  /** The unit selected in the navigation: a site id, or the id of the whole organisation (SPEC.md § 4). */
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
  /** Selects one of the organisation's own units. */
  setScope: (scope: string) => void;
  /** Signs in to an organisation (the start page's "Logga in", or a direct link); a different organisation gets a fresh environment. Logged. */
  selectOrganisation: (id: string) => void;
  /** "Byt organisation": signs out to the start page, the only way back to it. Logged. */
  leaveOrganisation: () => void;
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

/** With one organisation the start page is skipped and it is selected at once (SPEC.md § 1). */
export const soleOrganisationId = (): string | null => (organisations.length === 1 ? organisations[0].id : null);

export function initialData(packId: HomePackId = DEFAULT_HOME_PACK): DataState {
  const pack = buildDataPack(packId);
  return {
    pack,
    organisationId: soleOrganisationId(),
    dataOrganisationId: organisationOfPack(packId)?.id ?? null,
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

  selectOrganisation: (id) => {
    const org = organisationById(id);
    if (!org) return;
    const state = get();
    if (state.organisationId === id && state.dataOrganisationId === id) return;
    if (state.dataOrganisationId !== id) {
      // A different organisation: its pack, zones, teams, infrastructure, geometry, notices and presets, from scratch.
      setActiveRoadPack(org.pack);
      set({ ...initialData(org.pack), organisationId: id, dataOrganisationId: id });
    } else {
      set({ organisationId: id });
    }
    get().logEntry(t('AUDIT.organisationSignedIn'), org.name, undefined, undefined, id, { advance: false });
  },

  leaveOrganisation: () => {
    const org = organisationById(get().organisationId);
    if (!org) return;
    get().logEntry(t('AUDIT.organisationSwitched'), org.name, undefined, undefined, org.id, { advance: false });
    set({ organisationId: null });
  },

  reset: () => {
    // A demo reset starts the signed-in organisation's environment over (the user stays signed in).
    const own = get().dataOrganisationId;
    const org = organisationById(own);
    const pack = org?.pack ?? DEFAULT_HOME_PACK;
    setActiveRoadPack(pack);
    set({ ...initialData(pack), organisationId: get().organisationId, dataOrganisationId: own ?? organisationOfPack(pack)?.id ?? null });
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
