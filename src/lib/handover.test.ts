import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/data/store';
import { resetStoreTo } from '@/test/packs';
import { HANDOVER_SCHEMA, buildHandoverFile } from './handover';

const s = () => useStore.getState();

describe('the handover file (SPEC.md § 7)', () => {
  beforeEach(() => resetStoreTo('sus'));

  it('is empty before anything is marked Ta in', () => {
    const f = buildHandoverFile(s().pack, s().home.handovers, s().clock);
    expect(f).toMatchObject({ schema: HANDOVER_SCHEMA, synthetic: true, pack: 'sus', handovers: [] });
    expect(f.exportedAt).toBe('2026-09-04T14:40:00');
  });

  it('has one record per patient marked Ta in, with time, site, reasons, priority, team, monitoring and equipment', () => {
    s().applyHomePreset('power');
    const p = s().pack.homePatients.find((x) => x.zone === 'rosengard' && x.monitoringLevel === 'continuous')!;
    s().bringInPatient(p.id);
    s().bringInPatient(p.id); // the same patient again replaces the record
    const q = s().pack.homePatients.find((x) => x.zone === 'dalby')!;
    s().bringInPatient(q.id);
    const f = buildHandoverFile(s().pack, s().home.handovers, s().clock);
    expect(f.handovers.map((h) => h.patient.id)).toEqual([p.id, q.id]);
    expect(f.handovers[0]).toMatchObject({
      site: 'susmalmo', team: 'Sjukhus hemma Malmö', reasons: ['power'], monitoring: { level: 'continuous', reason: p.monitoringReason },
      patient: { id: p.id, familyName: p.familyName, personalNumber: p.personalNumber, zone: 'rosengard' },
    });
    expect(f.handovers[0].at).toMatch(/^\d\d:\d\d$/);
    expect(typeof f.handovers[0].clockMinutes).toBe('number');
    expect(f.handovers[0].priority).toBeGreaterThanOrEqual(1);
    expect(f.handovers[1].site).toBe('suslund');
    expect(JSON.parse(JSON.stringify(f))).toEqual(f);
  });

  it('keeps the handovers when the disruption ends (the list is a record), and clears them on a demo reset', () => {
    s().applyHomePreset('power');
    s().bringInPatient(s().pack.homePatients.find((x) => x.zone === 'dalby')!.id);
    s().resetHomeDisruptions();
    expect(s().home.handovers).toHaveLength(1);
    s().reset();
    expect(s().home.handovers).toHaveLength(0);
  });
});
