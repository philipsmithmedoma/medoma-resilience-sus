import { describe, expect, it } from 'vitest';
import { SUS_PACK as pack } from '@/test/packs';
import { NO_DISRUPTIONS, impact, type Disruptions } from './reachability';
import { DEP_KEYS, dependencyRows } from './dependencies';

const START = 14 * 60 + 40;
const dis = (o: Partial<Disruptions>): Disruptions => ({ ...NO_DISRUPTIONS, ...o });
const run = (state: Disruptions, clock: number) => {
  const rows = impact(pack, state, ['suslund', 'susmalmo'], null, clock).rows;
  return Object.fromEntries(dependencyRows({ pack, state, rows, clock }).map((r) => [r.key, r]));
};

describe('the dependency rows (SPEC.md § 10, DATA.md § 6)', () => {
  it('lists the nineteen rows in order, Medoma Center as not dependent', () => {
    const r = dependencyRows({ pack, state: NO_DISRUPTIONS, rows: [], clock: START });
    expect(r.map((x) => x.key)).toEqual(DEP_KEYS);
    expect(r).toHaveLength(19);
    expect(r[0].status).toEqual({ kind: 'none' });
    expect(r.slice(1).every((x) => x.status.kind === 'ok')).toBe(true);
  });

  it('in a power outage in Rosengård the stationary concentrators fall at once and the network after 1 h', () => {
    const state = dis({ powerOutZones: new Set(['rosengard']), powerStart: new Map([['rosengard', START]]) });
    const early = run(state, START + 10);
    const stationary = pack.homePatients.filter((p) => p.zone === 'rosengard' && p.equipment.includes('Oxygen stationary')).length;
    expect(early.o2Stationary.status).toEqual({ kind: 'affected' });
    expect(early.o2Stationary.patients).toBe(stationary);
    expect(early.medomaGo.status).toEqual({ kind: 'soon', inMin: 50 });
    expect(early.medomaGo.patients).toBe(0);
    expect(early.fridge.status).toEqual({ kind: 'soon', inMin: 230 });
    expect(early.elevator.status).toEqual({ kind: 'affected' });
    const late = run(state, START + 60);
    expect(late.medomaGo.status).toEqual({ kind: 'affected' });
    expect(late.medomaGo.patients).toBe(pack.homePatients.filter((p) => p.zone === 'rosengard').length);
    expect(late.continuous.patients).toBe(pack.homePatients.filter((p) => p.zone === 'rosengard' && p.monitoringLevel === 'continuous').length);
    expect(late.safetyAlarm.status).toEqual({ kind: 'affected' });
  });

  it('a rural zone keeps the network 4 h; a heatwave, a supplier disruption and a boil-water advisory move their rows', () => {
    const rural = run(dis({ powerOutZones: new Set(['dalby']), powerStart: new Map([['dalby', START]]) }), START + 120);
    expect(rural.medomaGo.status).toEqual({ kind: 'soon', inMin: 120 });
    const heat = run(dis({ heatStart: new Map([['malmo', START]]) }), START + 60);
    const pumps = pack.homePatients.filter((p) => p.zone === 'malmo' && p.equipment.includes('Pump'));
    expect(pumps.length).toBeGreaterThan(0);
    expect(heat.pumpHeat.status.kind).toBe('soon');
    const supplier = run(dis({ supplierStart: START }), START + 1440);
    expect(supplier.pumpSupply.status).toEqual({ kind: 'soon', inMin: 2 * 1440 });
    expect(supplier.deliveries.patients).toBeNull();
    expect(run(dis({ supplierStart: START }), START + 3 * 1440).pumpSupply.status).toEqual({ kind: 'affected' });
    const water = run(dis({ waterOutZones: new Set(['limhamn']) }), START);
    expect(water.water).toMatchObject({ status: { kind: 'affected' }, patients: 10 });
  });
});
