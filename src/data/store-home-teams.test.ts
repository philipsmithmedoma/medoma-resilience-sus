import { resetStoreTo } from '@/test/packs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { loadRoadModel, getRoadModel } from '@/lib/roadModel';
import { impact } from '@/lib/reachability';

const s = () => useStore.getState();
beforeAll(async () => {
  resetStoreTo('sus');
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

describe('reassignment (SPEC.md § 8)', () => {
  beforeEach(() => resetStoreTo('sus'));

  it('"Reassign to <team>" is the Send team action: Planned, the team recorded, one log entry', (ctx) => {
    if (getRoadModel()!.source !== 'fixture') ctx.skip(); // the closures below are chosen for the hand-written fixture
    for (const road of ['Trafikplats Lund Södra']) s().toggleBlockedRoad(road);
    const r = impact(s().pack, s().home, ['suslund', 'susmalmo'], getRoadModel(), s().clock);
    expect(r.summary.teamReassignable).toBe(30); // fixture count
    expect(r.reassignments.every((x) => x.toTeam === 'shh-lund' || x.toTeam === 'shh-malmo')).toBe(true);
    const a = r.reassignments[0];
    const n = s().log.length;
    s().sendTeam(a.patientId, a.toTeam);
    expect(s().home.work[a.patientId]).toMatchObject({ status: 'Planned', assignedTeam: a.toTeam });
    expect(s().log).toHaveLength(n + 1);
    expect(s().log.at(-1)).toMatchObject({ action: 'Skickade team till patient', ref: a.patientId, actor: 'Eva Lind' });
  });
});
