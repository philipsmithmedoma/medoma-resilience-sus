// Preparedness mode (SPEC.md § 2). The navigation has two states: normal operation (the Medoma platform tabs and a
// "Beredskap" button) and preparedness mode (the preparedness modules as tabs, a filled indicator). Whether the mode is
// active is derived, never stored on its own: the manual flag, an active incident, or a route that belongs to a preparedness
// module. Pure.
import { MODULE_DEFS, PLATFORM_DEFS, type ModuleDef } from '@/data/vocab';

export type PreparednessReason = 'manual' | 'incident' | 'route';

/** The parts of the store the mode depends on. */
export interface PreparednessState {
  preparednessOn: boolean;
  incident: unknown | null;
}

/** The first page of preparedness mode and the platform's first page. */
export const START_PATH = MODULE_DEFS[0].path;
export const PLATFORM_HOME = PLATFORM_DEFS[0].path;
/** Where the close control goes from a preparedness route: the first platform module after the mode ends. */
export const CLOSE_FALLBACK = '/planning';

/** Routes of the preparedness modules, taken from the module list (the nav's own definition). */
export const preparednessPaths = (): string[] => MODULE_DEFS.map((m) => m.path);

/** True for a preparedness module's route and its children (`/home/ringlista`, `/incident/kanaler/lssl`). */
export function isPreparednessRoute(route: string): boolean {
  const path = route.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return preparednessPaths().some((p) => path === p || path.startsWith(`${p}/`));
}

/** Why the mode is on, in the order manual, incident, route; null when it is off. */
export function preparednessReason(state: PreparednessState, route: string): PreparednessReason | null {
  if (state.preparednessOn) return 'manual';
  if (state.incident !== null) return 'incident';
  if (isPreparednessRoute(route)) return 'route';
  return null;
}

export function preparednessActive(state: PreparednessState, route: string): boolean {
  return preparednessReason(state, route) !== null;
}

/** The close control is disabled while an incident is active: it would turn the mode on again. */
export function closeBlocked(state: Pick<PreparednessState, 'incident'>): boolean {
  return state.incident !== null;
}

/** What the root route redirects to. */
export const rootTarget = (active: boolean): string => (active ? START_PATH : PLATFORM_HOME);

/** What the navigation shows in each state; the component renders it and the tests read it. */
export interface NavModel {
  /** The platform entries as tabs (normal) or inside one menu "Medoma" (preparedness). */
  platform: 'tabs' | 'menu';
  platformModules: ModuleDef[];
  /** The preparedness modules that are tabs: none in normal operation. */
  preparednessTabs: ModuleDef[];
  /** The outlined "Beredskap" button, or the filled indicator with a close control. */
  button: 'enter' | 'indicator';
}

export function navModel(active: boolean): NavModel {
  return active
    ? { platform: 'menu', platformModules: PLATFORM_DEFS, preparednessTabs: MODULE_DEFS, button: 'indicator' }
    : { platform: 'tabs', platformModules: PLATFORM_DEFS, preparednessTabs: [], button: 'enter' };
}

/**
 * The log entry a change of the derived mode needs, or null. The manual flag logs itself in the action that sets it, so a
 * change to or from "manual" is not repeated here; a mode that turns on or off because of an incident or the route is logged
 * with that reason.
 */
export function preparednessTransition(before: PreparednessReason | null, after: PreparednessReason | null): { on: boolean; reason: PreparednessReason } | null {
  if (before === null && after !== null && after !== 'manual') return { on: true, reason: after };
  if (before !== null && after === null && before !== 'manual') return { on: false, reason: before };
  return null;
}
