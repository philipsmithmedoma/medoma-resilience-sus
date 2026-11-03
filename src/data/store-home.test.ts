import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { NO_DISRUPTIONS, disruptionCount, impact } from '@/lib/reachability';
import { loadRoadModel } from '@/lib/roadModel';

const s = () => useStore.getState();

// The road graph (OpenStreetMap data, or the fixture) decides how many patients a closed road affects.
beforeAll(async () => {
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

describe('Hospital at Home view state (SPEC.md § 11.5)', () => {
  beforeEach(() => s().reset());

  it('starts with patients and roads on, electricity and water off, no mode, nothing selected or disrupted', () => {
    expect(s().home.layers).toEqual({ patients: true, roads: true, el: false, water: false });
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
    s().selectHomeNode('r-essingeleden');
    expect(s().home.selectedNode).toBe('r-essingeleden');
    s().selectHomeNode('r-essingeleden');
    expect(s().home.selectedNode).toBeNull();
    s().selectHomeNode('r-vasterbron');
    s().setHomeLayer('patients', false);
    expect(s().home.selectedNode).toBe('r-vasterbron');
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
  beforeEach(() => s().reset());
  const last = () => s().log[s().log.length - 1];

  it('blocks and unblocks a road node, logging each toggle with the number of affected patients', () => {
    const n = s().log.length;
    const t0 = s().clock;
    s().toggleBlockedNode('r-essingeleden');
    expect(s().home.blockedNodes.has('r-essingeleden')).toBe(true);
    expect(s().log).toHaveLength(n + 1);
    expect(last()).toMatchObject({ action: 'Stängde', object: 'Essingeleden (E4)', actor: 'Eva Lind' });
    expect(last().detail).toBe('3 av 150 patienter påverkade'); // real data: three patients hang on Essingeleden ramps, the rest take another way
    expect(s().clock).toBe(t0 + 1);
    s().toggleBlockedNode('r-essingeleden');
    expect(s().home.blockedNodes.size).toBe(0);
    expect(s().log).toHaveLength(n + 2);
    expect(last().action).toBe('Öppnade');
  });

  it('closes one way by its OSM id and a whole road by its name, and ignores ids that are not road nodes', () => {
    const n = s().log.length;
    s().toggleBlockedWay('35403955'); // a Norra länken way in the OpenStreetMap data
    expect(s().home.blockedWays.has('35403955')).toBe(true);
    expect(last()).toMatchObject({ action: 'Stängde', object: 'Norra länken' });
    s().toggleBlockedRoad('Uppsalavägen|E 4');
    expect(s().home.blockedRoads.has('Uppsalavägen|E 4')).toBe(true);
    expect(last()).toMatchObject({ action: 'Stängde', object: 'Uppsalavägen' });
    expect(last().detail).toBe('1 av 150 patienter påverkade'); // real data: Täby has other roads, one patient hangs on the closed E 4 ways
    s().toggleBlockedRoad('Uppsalavägen|E 4');
    expect(last().action).toBe('Öppnade');
    s().toggleBlockedNode('w-gorvaln'); // a water node
    s().togglePowerOut('atlantis');
    expect(s().log).toHaveLength(n + 3);
  });

  it('sets and restores power and water outages per zone and logs them', () => {
    s().togglePowerOut('huddinge');
    expect(last()).toMatchObject({ action: 'Slog ut elen i', object: 'Huddinge', detail: '20 av 150 patienter påverkade' });
    s().toggleWaterOut('solna');
    expect(last()).toMatchObject({ action: 'Störde vattnet i', object: 'Solna och Sundbyberg', detail: '45 av 150 patienter påverkade' });
    expect(s().home.powerOutZones.has('huddinge') && s().home.waterOutZones.has('solna')).toBe(true);
    s().togglePowerOut('huddinge');
    s().toggleWaterOut('solna');
    expect(disruptionCount(s().home)).toBe(0);
    expect(last().action).toBe('Återställde vattnet i');
  });

  it('reset clears everything with one log entry and does nothing when nothing is disrupted', () => {
    const n = s().log.length;
    s().resetHomeDisruptions();
    expect(s().log).toHaveLength(n);
    s().toggleBlockedNode('r-centralbron');
    s().toggleBlockedWay('35403955');
    s().toggleBlockedRoad('Uppsalavägen');
    s().togglePowerOut('soderort');
    s().toggleWaterOut('solna');
    expect(disruptionCount(s().home)).toBe(5);
    s().resetHomeDisruptions();
    expect(disruptionCount(s().home)).toBe(0);
    expect(last()).toMatchObject({ action: 'Återställde alla störningar', object: 'Sjukhus hemma', detail: '0 av 150 patienter påverkade' });
    expect(impact(s().pack, s().home, ['solna', 'huddinge']).rows).toHaveLength(0);
    expect(NO_DISRUPTIONS.blockedNodes.size).toBe(0);
  });

  it('computes the affected count for the scope', () => {
    s().setScope('solna');
    for (const road of ['Essingeleden', 'Västerbron', 'Centralbron', 'Munkbroleden', 'Skeppsbron', 'Söderledstunneln', 'Katarinavägen', 'Stadsgårdsleden']) s().toggleBlockedRoad(road);
    // From Solna alone Södermalm, Söderort, Huddinge, Botkyrka and Nacka are cut off (15 + 20 + 20 + 10 + 10), and so are four patients elsewhere whose only road goes over a closed crossing.
    expect(last().detail).toBe('79 av 150 patienter påverkade');
    s().setScope('karolinska'); // reachable from either site: only the part of the south that hangs on closed roads stays cut off
    s().toggleBlockedRoad('Stadsgårdsleden');
    expect(last().detail).toBe('8 av 150 patienter påverkade');
  });

  it('the demo reset restores the defaults', () => {
    s().setHomeLayer('water', true);
    s().selectHomeNode('r-vasterbron');
    s().toggleBlockedNode('r-centralbron');
    s().setHomeMode('roads');
    s().reset();
    expect(s().home.layers.water).toBe(false);
    expect(s().home).toMatchObject({ selectedNode: null, mode: null });
    expect(disruptionCount(s().home)).toBe(0);
  });
});

describe('Hospital at Home presets (SPEC.md § 11.5)', () => {
  beforeEach(() => s().reset());
  const last = () => s().log[s().log.length - 1];

  it('"Bro avstängd" closes Essingeleden and Centralbron', () => {
    s().applyHomePreset('bridge');
    expect([...s().home.blockedNodes].sort()).toEqual(['r-centralbron', 'r-essingeleden']);
    expect(disruptionCount(s().home)).toBe(2);
    expect(last()).toMatchObject({ action: 'Aktiverade störningsscenario', object: 'Bro avstängd', detail: '7 av 150 patienter påverkade' });
  });

  it('"Elavbrott" cuts the power in Söderort and Huddinge and switches the electricity layer on', () => {
    s().applyHomePreset('power');
    expect([...s().home.powerOutZones].sort()).toEqual(['huddinge', 'soderort']);
    expect(s().home.layers.el).toBe(true);
    expect(last()).toMatchObject({ object: 'Elavbrott', detail: '40 av 150 patienter påverkade' });
  });

  it('"Vattenstörning" disrupts the water in Solna and switches the water layer on', () => {
    s().applyHomePreset('water');
    expect([...s().home.waterOutZones]).toEqual(['solna']);
    expect(s().home.layers.water).toBe(true);
    expect(last()).toMatchObject({ object: 'Vattenstörning', detail: '25 av 150 patienter påverkade' });
  });

  it('replaces earlier disruptions and the mode, and logs once', () => {
    s().togglePowerOut('taby');
    s().setHomeMode('roads');
    const n = s().log.length;
    s().applyHomePreset('water');
    expect(s().home.powerOutZones.size).toBe(0);
    expect(s().home.mode).toBeNull();
    expect(s().log).toHaveLength(n + 1);
  });
});
