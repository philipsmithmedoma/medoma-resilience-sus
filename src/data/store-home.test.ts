import { resetStoreTo } from '@/test/packs';
import { HOJE_A, nearestE22 } from '@/test/roads';
import { roadKey } from '@/lib/roadGraph';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { NO_DISRUPTIONS, disruptionCount, impact } from '@/lib/reachability';
import { getRoadModel, loadRoadModel } from '@/lib/roadModel';

const s = () => useStore.getState();
/** Assertions that depend on the exact topology of the hand-made fixture are skipped when real OpenStreetMap data is present. */
const fixtureOnly = (ctx: { skip: () => void }) => { if (getRoadModel()!.source !== 'fixture') ctx.skip(); };

// The road graph (OpenStreetMap data, or the fixture) decides how many patients a closed road affects.
beforeAll(async () => {
  resetStoreTo('sus');
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

describe('Hospital at Home view state (SPEC.md § 11.5)', () => {
  beforeEach(() => resetStoreTo('sus'));

  it('starts with patients and roads on, electricity and water off, no mode, nothing selected or disrupted', () => {
    expect(s().home.layers).toEqual({ patients: true, roads: true, el: false, water: false, tele: false });
    expect(s().home).toMatchObject({ mode: null, selectedNode: null });
    expect(disruptionCount(s().home)).toBe(0);
  });

  it('toggles layers without touching the audit log or the clock', () => {
    const before = s();
    s().setHomeLayer('el', true);
    s().setHomeLayer('water', true);
    expect(s().home.layers).toMatchObject({ el: true, water: true });
    expect(s().log).toHaveLength(before.log.length);
    expect(s().clock).toBe(before.clock);
  });

  it('selects a node, clears it when selected again and when its layer is switched off', () => {
    s().selectHomeNode('r-lund-s');
    expect(s().home.selectedNode).toBe('r-lund-s');
    s().selectHomeNode('r-lund-s');
    expect(s().home.selectedNode).toBeNull();
    s().selectHomeNode('r-lund-n');
    s().setHomeLayer('patients', false);
    expect(s().home.selectedNode).toBe('r-lund-n');
    s().setHomeLayer('roads', false);
    expect(s().home.selectedNode).toBeNull();
  });

  it('picks a mode, switches on its layer and clears the mode when picked again, without logging', () => {
    const logLength = s().log.length;
    s().setHomeMode('water');
    expect(s().home.mode).toBe('water');
    expect(s().home.layers.water).toBe(true);
    s().setHomeMode('water');
    expect(s().home.mode).toBeNull();
    expect(s().log).toHaveLength(logLength);
  });
});

describe('Hospital at Home disruptions (SPEC.md § 11.5)', () => {
  beforeEach(() => resetStoreTo('sus'));
  const last = () => s().log[s().log.length - 1];

  it('blocks and unblocks a road node, logging each toggle with the number of affected patients', (ctx) => {
    const n = s().log.length;
    const t0 = s().clock;
    s().toggleBlockedNode('r-lund-n');
    expect(s().home.blockedNodes.has('r-lund-n')).toBe(true);
    expect(s().log).toHaveLength(n + 1);
    expect(last()).toMatchObject({ action: 'Stängde', object: 'Tpl Lund Norra, E22', actor: 'Eva Lind' });
    expect(last().detail).toMatch(/^\d+ av 200 patienter påverkade$/);
    fixtureOnly(ctx);
    expect(last().detail).toBe('30 av 200 patienter påverkade'); // fixture: the patients of Lund hang on this interchange
    expect(s().clock).toBe(t0 + 1);
    s().toggleBlockedNode('r-lund-n');
    expect(s().home.blockedNodes.size).toBe(0);
    expect(s().log).toHaveLength(n + 2);
    expect(last().action).toBe('Öppnade');
  });

  it('closes one way by its OSM id and a whole road by its name, and ignores ids that are not road nodes', () => {
    const n = s().log.length;
    const g = getRoadModel()!.graph;
    const way = nearestE22(g, HOJE_A).props;
    const wayId = String(way.id);
    s().toggleBlockedWay(wayId);
    expect(s().home.blockedWays.has(wayId)).toBe(true);
    expect(last()).toMatchObject({ action: 'Stängde' });
    const key = roadKey(way)!;
    s().toggleBlockedRoad(key);
    expect(s().home.blockedRoads.has(key)).toBe(true);
    expect(last()).toMatchObject({ action: 'Stängde' });
    expect(last().detail).toMatch(/^\d+ av 200 patienter påverkade$/);
    s().toggleBlockedRoad(key);
    expect(last().action).toBe('Öppnade');
    s().toggleBlockedNode('w-ringsjo'); // a water node
    s().togglePowerOut('atlantis');
    expect(s().log).toHaveLength(n + 3);
  });

  it('sets and restores power and water outages per zone and logs them', () => {
    s().togglePowerOut('rosengard');
    expect(last()).toMatchObject({ action: 'Slog ut elen i', object: 'Rosengård', detail: '15 av 200 patienter påverkade' });
    s().toggleWaterOut('lund');
    expect(last()).toMatchObject({ action: 'Störde vattnet i', object: 'Lund', detail: '55 av 200 patienter påverkade' });
    expect(s().home.powerOutZones.has('rosengard') && s().home.waterOutZones.has('lund')).toBe(true);
    s().togglePowerOut('rosengard');
    s().toggleWaterOut('lund');
    expect(disruptionCount(s().home)).toBe(0);
    expect(last().action).toBe('Återställde vattnet i');
  });

  it('reset clears everything with one log entry and does nothing when nothing is disrupted', () => {
    const n = s().log.length;
    s().resetHomeDisruptions();
    expect(s().log).toHaveLength(n);
    s().toggleBlockedNode('r-lund-n');
    s().toggleBlockedWay(String(nearestE22(getRoadModel()!.graph, HOJE_A).props.id));
    s().toggleBlockedRoad('Inre Ringvägen');
    s().togglePowerOut('dalby');
    s().toggleWaterOut('malmo');
    expect(disruptionCount(s().home)).toBe(5);
    s().resetHomeDisruptions();
    expect(disruptionCount(s().home)).toBe(0);
    expect(last()).toMatchObject({ action: 'Återställde alla störningar', object: 'Sjukhus hemma', detail: '0 av 200 patienter påverkade' });
    expect(impact(s().pack, s().home, ['suslund', 'susmalmo']).rows).toHaveLength(0);
    expect(NO_DISRUPTIONS.blockedNodes.size).toBe(0);
  });

  it('computes the affected count for the scope: a closed road cuts off more patients when only one site is in scope', (ctx) => {
    const closeE22 = (scope: 'suslund' | 'sus') => {
      resetStoreTo('sus');
      s().setHomeGeoReady();
      s().setScope(scope);
      s().toggleBlockedRoad(roadKey(nearestE22(getRoadModel()!.graph, HOJE_A).props)!);
      return Number(/^(\d+) /.exec(last().detail!)![1]);
    };
    const lundOnly = closeE22('suslund');
    const both = closeE22('sus');
    // From Lund alone Malmö can be cut off by the closed E22; with both sites in scope the Malmö site reaches its own half. In the real geometry the
    // closure affects 3 patients in both scopes (DECISIONS.md 63), so the test demands only that a second site never makes it worse.
    expect(lundOnly).toBeGreaterThanOrEqual(both);
    fixtureOnly(ctx);
    expect([lundOnly, both]).toEqual([130, 40]);
  });

  it('the demo reset restores the defaults', () => {
    s().setHomeLayer('water', true);
    s().selectHomeNode('r-lund-n');
    s().toggleBlockedNode('r-lund-s');
    s().setHomeMode('roads');
    resetStoreTo('sus');
    expect(s().home.layers.water).toBe(false);
    expect(s().home).toMatchObject({ selectedNode: null, mode: null });
    expect(disruptionCount(s().home)).toBe(0);
  });
});

describe('Hospital at Home presets (SPEC.md § 11.5)', () => {
  beforeEach(() => resetStoreTo('sus'));
  const last = () => s().log[s().log.length - 1];

  it('"Trafikplatser avstängda" closes Tpl Lund Norra and Södra', () => {
    s().applyHomePreset('bridge');
    expect([...s().home.blockedNodes].sort()).toEqual(['r-lund-n', 'r-lund-s']);
    expect(disruptionCount(s().home)).toBe(2);
    expect(last()).toMatchObject({ action: 'Aktiverade störningsscenario', object: 'Trafikplatser avstängda' });
    expect(last().detail).toMatch(/^\d+ av 200 patienter påverkade$/);
  });

  it('"Elavbrott" cuts the power in Rosengård and Dalby and switches the electricity layer on', () => {
    s().applyHomePreset('power');
    expect([...s().home.powerOutZones].sort()).toEqual(['dalby', 'rosengard']);
    expect(s().home.layers.el).toBe(true);
    expect(last()).toMatchObject({ object: 'Elavbrott', detail: '25 av 200 patienter påverkade' });
  });

  it('"Vattenstörning" disrupts the water in Limhamn and Kävlinge and switches the water layer on', () => {
    s().applyHomePreset('water');
    expect([...s().home.waterOutZones].sort()).toEqual(['kavlinge', 'limhamn']);
    expect(s().home.layers.water).toBe(true);
    expect(last()).toMatchObject({ object: 'Vattenstörning', detail: '20 av 200 patienter påverkade' });
  });

  it('replaces earlier disruptions and the mode, and logs once', () => {
    s().togglePowerOut('svedala');
    s().setHomeMode('roads');
    const n = s().log.length;
    s().applyHomePreset('water');
    expect(s().home.powerOutZones.size).toBe(0);
    expect(s().home.mode).toBeNull();
    expect(s().log).toHaveLength(n + 1);
  });
});
