import { resetStoreTo } from '@/test/packs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { loadRoadModel } from '@/lib/roadModel';
import { freeSlots } from './packs/home-visits';

const s = () => useStore.getState();
beforeAll(async () => {
  resetStoreTo('sus');
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

describe('visits and the log (SPEC.md § 14.3, § 14.4)', () => {
  beforeEach(() => resetStoreTo('sus'));

  it('Move visit works in normal operation: it changes the slot and logs it, with no status chain to move', () => {
    const patient = s().pack.homePatients.find((p) => p.visitToday)!;
    const team = s().pack.homeTeams.find((x) => x.name === patient.team)!;
    const visit = s().home.visits.find((v) => v.patientId === patient.id)!;
    const slot = freeSlots(s().home.visits.filter((v) => v.id !== visit.id), team, s().clock)[0];
    s().moveVisit(patient.id, slot);
    expect(s().home.visits.find((v) => v.id === visit.id)).toMatchObject({ start: slot, status: 'moved' });
    expect(s().home.work[patient.id]).toBeUndefined();
    expect(s().log.at(-1)).toMatchObject({ action: 'Flyttade besök', actor: 'Eva Lind', ref: patient.id });
  });

  it('a move changes the sequence: the visit takes its new place when the group is sorted', async () => {
    const { planningGroups } = await import('@/lib/planning');
    const patient = s().pack.homePatients.find((p) => p.visitToday && p.team === 'Sjukhus hemma Lund')!;
    const before = planningGroups(s().home.visits, s().home.work, s().pack.homePatients, s().pack.homeTeams, s().clock)[0].rows.map((r) => r.patient.id);
    const team = s().pack.homeTeams[0];
    const visit = s().home.visits.find((v) => v.patientId === patient.id)!;
    const slot = freeSlots(s().home.visits.filter((v) => v.id !== visit.id), team, s().clock).at(-1)!;
    s().moveVisit(patient.id, slot);
    const after = planningGroups(s().home.visits, s().home.work, s().pack.homePatients, s().pack.homeTeams, s().clock)[0].rows.map((r) => r.patient.id);
    expect(after).not.toEqual(before);
    expect(after.at(-1)).toBe(patient.id);
  });

  it('every entry of the module carries area "home" for the log filter, and the rest of the log does not', () => {
    s().togglePowerOut('rosengard');
    s().contactAllCritical();
    s().advanceClock(60);
    const log = s().log;
    const home = log.filter((e) => e.area === 'home').map((e) => e.action);
    expect(home).toEqual(expect.arrayContaining(['Slog ut elen i', 'Flyttade fram klockan', 'Kontaktade alla kritiska']));
    s().setPreparedness(true);
    expect(s().log.find((e) => e.action === 'Beredskapsläge på')!.area).toBeUndefined();
  });
});
