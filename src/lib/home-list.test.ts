import { describe, expect, it } from 'vitest';
import { SUS_PACK as pack } from '@/test/packs';
import { NO_FILTERS, filterPatients, groupByZone, hasFilters } from './home-list';

const all = pack.homePatients;

describe('Hospital at Home patient list (SPEC.md § 11.6)', () => {
  it('returns every patient without filters', () => {
    expect(filterPatients(all, NO_FILTERS)).toHaveLength(200);
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });

  it('filters by zone, equipment and visit today, alone and combined', () => {
    expect(filterPatients(all, { ...NO_FILTERS, zone: 'lund' })).toHaveLength(40);
    const oxygen = filterPatients(all, { ...NO_FILTERS, equipment: 'Self-monitoring kit' });
    expect(oxygen.length).toBeGreaterThan(0);
    expect(oxygen.every((p) => p.equipment.includes('Self-monitoring kit'))).toBe(true);
    const visits = filterPatients(all, { ...NO_FILTERS, visitToday: true });
    expect(visits.every((p) => p.visitToday)).toBe(true);
    expect(visits.length).toBe(all.filter((p) => p.visitToday).length);
    const both = filterPatients(all, { ...NO_FILTERS, zone: 'malmo', visitToday: true });
    expect(both.every((p) => p.zone === 'malmo' && p.visitToday)).toBe(true);
    expect(hasFilters({ ...NO_FILTERS, visitToday: true })).toBe(true);
  });

  it('affected only keeps exactly the affected ids', () => {
    const ids = new Set(all.slice(0, 7).map((p) => p.id));
    expect(filterPatients(all, { ...NO_FILTERS, affectedOnly: true }, ids).map((p) => p.id).sort()).toEqual([...ids].sort());
    expect(filterPatients(all, { ...NO_FILTERS, affectedOnly: true })).toHaveLength(0);
  });

  it('groups by zone in pack order with patients sorted by name and drops empty zones', () => {
    const groups = groupByZone(all, pack.homeZones);
    expect(groups.map((g) => g.zone.id)).toEqual(pack.homeZones.map((z) => z.id));
    expect(groups.reduce((n, g) => n + g.patients.length, 0)).toBe(200);
    const names = groups[0].patients.map((p) => p.familyName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'sv')));
    expect(groupByZone(filterPatients(all, { ...NO_FILTERS, zone: 'dalby' }), pack.homeZones)).toHaveLength(1);
  });
});
