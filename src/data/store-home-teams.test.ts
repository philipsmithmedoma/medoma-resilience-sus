import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { loadRoadModel, getRoadModel } from '@/lib/roadModel';
import { impact } from '@/lib/reachability';

const s = () => useStore.getState();
beforeAll(async () => {
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

describe('reassignment (SPEC.md § 14.2)', () => {
  beforeEach(() => s().reset());

  it('"Reassign to <team>" is the Send team action: Planned, the team recorded, one log entry', (ctx) => {
    if (getRoadModel()!.source !== 'fixture') ctx.skip(); // the closures below are chosen for the hand-written fixture
    for (const road of ['Solnavägen', 'Essingeleden', 'Södra länken']) s().toggleBlockedRoad(road);
    const r = impact(s().pack, s().home, ['solna', 'huddinge'], getRoadModel(), s().clock);
    expect(r.summary.teamReassignable).toBeGreaterThan(0);
    const a = r.reassignments[0];
    const n = s().log.length;
    s().sendTeam(a.patientId, a.toTeam);
    expect(s().home.work[a.patientId]).toMatchObject({ status: 'Planned', assignedTeam: a.toTeam });
    expect(s().log).toHaveLength(n + 1);
    expect(s().log.at(-1)).toMatchObject({ action: 'Skickade team till patient', ref: a.patientId, actor: 'Eva Lind' });
  });
});
