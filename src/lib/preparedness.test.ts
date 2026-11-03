import { describe, expect, it } from 'vitest';
import { MODULE_DEFS, PLATFORM_DEFS, en, sv } from '@/data/vocab';
import { useStore } from '@/data/store';
import { CLOSE_FALLBACK, closeBlocked, isPreparednessRoute, navModel, preparednessActive, preparednessPaths, preparednessReason, preparednessTransition, rootTarget, type PreparednessState } from './preparedness';

const off: PreparednessState = { preparednessOn: false, incident: null };

describe('preparednessActive (SPEC.md § 2)', () => {
  it('is off with no flag, no incident and a platform route', () => {
    expect(preparednessActive(off, '/patients')).toBe(false);
    expect(preparednessReason(off, '/planning')).toBeNull();
  });

  it('manual: the flag turns it on on any route', () => {
    expect(preparednessReason({ ...off, preparednessOn: true }, '/patients')).toBe('manual');
  });

  it('incident: an active incident turns it on', () => {
    expect(preparednessReason({ ...off, incident: { playbookKey: 'masskada' } }, '/patients')).toBe('incident');
  });

  it('route: a preparedness route alone turns it on, so a reload or a direct link there keeps the mode', () => {
    expect(preparednessReason(off, '/home')).toBe('route');
    expect(preparednessReason(off, '/incident')).toBe('route');
  });

  it('names the first reason when several hold: manual, incident, route', () => {
    const all = { preparednessOn: true, incident: {} };
    expect(preparednessReason(all, '/home')).toBe('manual');
    expect(preparednessReason({ ...all, preparednessOn: false }, '/home')).toBe('incident');
    expect(preparednessReason({ ...all, preparednessOn: false, incident: null }, '/home')).toBe('route');
  });
});

describe('preparedness routes come from the module list (SPEC.md § 2)', () => {
  it('are every module of the preparedness nav, with their children', () => {
    expect(preparednessPaths()).toEqual(MODULE_DEFS.map((m) => m.path));
    for (const m of MODULE_DEFS) {
      expect(isPreparednessRoute(m.path), m.path).toBe(true);
      expect(isPreparednessRoute(`${m.path}/child`), `${m.path}/child`).toBe(true);
    }
    expect(isPreparednessRoute('/incident/kanaler/lssl')).toBe(true);
    expect(isPreparednessRoute('/home?x=1')).toBe(true);
  });
  it('are not the platform modules, the root or a path that only starts with a module path', () => {
    for (const m of PLATFORM_DEFS.filter((p) => !MODULE_DEFS.some((x) => x.path === p.path))) expect(isPreparednessRoute(m.path), m.path).toBe(false);
    expect(isPreparednessRoute('/')).toBe(false);
    expect(isPreparednessRoute('/homestead')).toBe(false);
  });
});

describe('closing and the root (SPEC.md § 2)', () => {
  it('blocks the close control while an incident is active', () => {
    expect(closeBlocked(off)).toBe(false);
    expect(closeBlocked({ incident: {} })).toBe(true);
    expect(CLOSE_FALLBACK).toBe('/planning');
  });
  it('sends the root to the first preparedness page in preparedness mode and to Patienter otherwise', () => {
    expect(rootTarget(true)).toBe(MODULE_DEFS[0].path);
    expect(rootTarget(false)).toBe('/patients');
  });
});

describe('what the navigation shows (SPEC.md § 2)', () => {
  it('normal: the platform tabs, no preparedness tab, the outlined button', () => {
    const m = navModel(false);
    expect(m.platform).toBe('tabs');
    expect(m.platformModules.map((p) => p.key)).toEqual(PLATFORM_DEFS.map((p) => p.key));
    expect(m.preparednessTabs).toEqual([]);
    expect(m.button).toBe('enter');
  });
  it('preparedness: one Medoma menu, the preparedness tabs in order, the indicator', () => {
    const m = navModel(true);
    expect(m.platform).toBe('menu');
    expect(m.preparednessTabs.map((p) => p.key)).toEqual(MODULE_DEFS.map((p) => p.key));
    expect(m.button).toBe('indicator');
  });
  it('has the labels of the spec in both languages', () => {
    expect([sv.PREP.enter, en.PREP.enter]).toEqual(['Beredskap', 'Preparedness']);
    expect([sv.PREP.active, en.PREP.active]).toEqual(['Beredskapsläge', 'Preparedness mode']);
    expect([sv.PREP.closeBlocked, en.PREP.closeBlocked]).toEqual(['Avsluta incidenten först', 'End the incident first']);
  });
});

describe('what is logged (SPEC.md § 2)', () => {
  it('logs a mode that turns on or off for an incident or the route, and not the flag, which logs itself', () => {
    expect(preparednessTransition(null, 'incident')).toEqual({ on: true, reason: 'incident' });
    expect(preparednessTransition(null, 'route')).toEqual({ on: true, reason: 'route' });
    expect(preparednessTransition('route', null)).toEqual({ on: false, reason: 'route' });
    expect(preparednessTransition('incident', null)).toEqual({ on: false, reason: 'incident' });
    expect(preparednessTransition(null, 'manual')).toBeNull();
    expect(preparednessTransition('manual', null)).toBeNull();
    expect(preparednessTransition('route', 'incident')).toBeNull(); // still on
  });

  it('the manual flag changes through logEntry with the reason "manual" and starts off', () => {
    useStore.getState().reset();
    expect(useStore.getState().preparednessOn).toBe(false);
    const n = useStore.getState().log.length;
    useStore.getState().setPreparedness(true);
    expect(useStore.getState().preparednessOn).toBe(true);
    const last = useStore.getState().log[useStore.getState().log.length - 1];
    expect(useStore.getState().log).toHaveLength(n + 1);
    expect(last).toMatchObject({ action: 'Beredskapsläge på', object: 'Navigation', detail: 'Orsak: manuellt', ref: 'manual', actor: 'Eva Lind' });
    useStore.getState().setPreparedness(true); // no change, no entry
    expect(useStore.getState().log).toHaveLength(n + 1);
  });
});
