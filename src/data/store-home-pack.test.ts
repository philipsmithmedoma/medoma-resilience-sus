import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { homePacks } from './packs/home-packs';
import { homeSitesInScope } from '@/lib/home-sites';
import { scopeMenu, scopeName } from '@/lib/scope';
import { getRoadModel, loadRoadModel } from '@/lib/roadModel';
import { impact } from '@/lib/reachability';
import { resetStoreTo } from '@/test/packs';

const s = () => useStore.getState();

describe('the pack of the organisation and the unit selector (SPEC.md § 1, § 4)', () => {
  beforeEach(() => s().reset());

  it('starts on SUS with its own scope; a demo reset keeps the organisation', () => {
    expect(s().pack.homePackId).toBe('sus');
    expect(s().organisationId).toBe('sus');
    expect(s().scope).toBe('sus');
    expect(s().pack.homePatients).toBe(homePacks.sus.patients);
    s().setScope('susmalmo');
    s().reset();
    expect(s().scope).toBe('sus');
    expect(s().organisationId).toBe('sus');
    expect(s().pack.homePackId).toBe('sus');
  });

  it('the sites of a scope are that scope\'s', () => {
    expect(homeSitesInScope('sus', 'sus')).toEqual(['suslund', 'susmalmo']);
    expect(homeSitesInScope('sus', 'suslund')).toEqual(['suslund']);
    expect(homeSitesInScope('sus', 'susmalmo')).toEqual(['susmalmo']);
    expect([scopeName('sus', 'sus'), scopeName('sus', 'suslund'), scopeName('sus', 'susmalmo')]).toEqual(['SUS', 'Lund', 'Malmö']);
  });

  it('the menu lists only the organisation\'s own units: SUS as a whole, Lund and Malmö', () => {
    expect(scopeMenu('sus').map((x) => x.id)).toEqual(['sus', 'suslund', 'susmalmo']);
  });

  it('selecting a unit changes the scope only; an id that is not one of the organisation\'s units is ignored', () => {
    const n = s().log.length;
    s().setScope('susmalmo');
    expect(s().scope).toBe('susmalmo');
    expect(s().log).toHaveLength(n);
    s().setScope('somewhere-else');
    expect(s().scope).toBe('susmalmo');
    expect(s().pack.homePackId).toBe('sus');
    expect(s().pack.homePatients).toHaveLength(200);
    expect(s().pack.homeTeams.map((t) => t.name)).toEqual(['Sjukhus hemma Lund', 'Sjukhus hemma Malmö']);
  });

  it('with the SUS pack reachability runs from the sites of the selected unit', async () => {
    resetStoreTo('sus');
    await loadRoadModel(s().pack);
    s().setHomeGeoReady();
    expect(getRoadModel()!.sites.suslund.unsnapped).toBe(false);
    expect(getRoadModel()!.sites.susmalmo.unsnapped).toBe(false);
    s().setScope('suslund');
    s().togglePowerOut('rosengard');
    expect(s().log.at(-1)!.detail).toBe('15 av 200 patienter påverkade');
    const r = impact(s().pack, s().home, homeSitesInScope('sus', s().scope), getRoadModel(), s().clock);
    expect(r.summary.affected).toBe(15);
  });

  it('Bring in goes to the nearest site in scope and keeps the decision time and the reasons for the handover list', () => {
    resetStoreTo('sus');
    s().applyHomePreset('power');
    const p = s().pack.homePatients.find((x) => x.zone === 'dalby')!;
    s().bringInPatient(p.id);
    expect(s().home.work[p.id]).toMatchObject({ bringInSite: 'suslund', bringInAt: s().clock - 1 });
    expect(s().home.work[p.id].bringInReasons).toContain('power');
    expect(s().log.at(-1)).toMatchObject({ action: 'Tog in patient', detail: 'SUS Lund' });
    const m = s().pack.homePatients.find((x) => x.zone === 'rosengard')!;
    s().bringInPatient(m.id);
    expect(s().home.work[m.id].bringInSite).toBe('susmalmo');
  });

  it('the presets of each pack act on its own nodes and zones', () => {
    resetStoreTo('sus');
    s().applyHomePreset('bridge');
    expect([...s().home.blockedNodes].sort()).toEqual(['r-lund-n', 'r-lund-s']);
    s().applyHomePreset('power');
    expect([...s().home.powerOutZones].sort()).toEqual(['dalby', 'rosengard']);
    s().applyHomePreset('heat');
    expect([...s().home.heatStart.keys()].sort()).toEqual(['lund', 'malmo']);
    s().applyHomePreset('cold');
    expect([...s().home.coldStart.keys()]).toEqual(['svedala']);
    expect([...s().home.powerOutZones]).toEqual(['svedala']); // the cold only counts together with a power outage
  });
});

describe('the cold chain and the hypothesis in the store (SPEC.md § 6)', () => {
  it('a supplier disruption starts the countdown and a clock jump to zero makes every pump patient critical', () => {
    resetStoreTo('sus');
    expect(s().startSupplierDisruption()).toBe(true);
    expect(s().startSupplierDisruption()).toBe(false);
    expect(s().home.supplierStart).not.toBeNull();
    s().advanceClock(3 * 1440);
    const r = impact(s().pack, s().home, homeSitesInScope('sus', s().scope), undefined, s().clock);
    expect(r.summary.supplyDaysLeft).toBe(0);
    expect(r.summary.noPump).toBe(s().pack.homePatients.filter((p) => p.equipment.includes('Pump')).length);
  });

  it('closing every road within 250 m of a site starts the countdown; opening one stops it', async () => {
    resetStoreTo('sus');
    await loadRoadModel(s().pack);
    s().setHomeGeoReady();
    const model = getRoadModel()!;
    const { waysNearPoint } = await import('@/lib/roadGraph');
    const site = homePacks.sus.sites[0];
    const ways = waysNearPoint(model.graph, site.lat, site.lng, 250);
    expect(ways.length).toBeGreaterThan(0);
    for (const w of ways) s().toggleBlockedWay(String(model.graph.ways[w].id));
    expect(s().home.siteCutoffSince).not.toBeNull();
    s().toggleBlockedWay(String(model.graph.ways[ways[0]].id));
    expect(s().home.siteCutoffSince).toBeNull();
  });

  it('registering a suspected outage creates a power record dated from the signal and keeps the unregistered one hidden', () => {
    resetStoreTo('sus');
    s().startHiddenOutage('rosengard');
    s().startHiddenOutage('rosengard'); // already started: nothing
    expect([...s().home.hiddenPower.keys()]).toEqual(['rosengard']);
    expect(s().home.disruptions).toEqual([]); // nothing is registered by itself
    s().advanceClock(60 + 20);
    s().registerHypothesis('rosengard', 'power');
    const d = s().home.disruptions[0];
    expect(d).toMatchObject({ kind: 'power', target: 'rosengard', source: 'hypothesis' });
    expect(d.startedAt).toBeLessThanOrEqual(s().clock - 60);
    expect(s().log.at(-1)).toMatchObject({ action: 'Slog ut elen i', area: 'home' });
  });
});
