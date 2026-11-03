import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { getRoadModel, loadRoadModel } from '@/lib/roadModel';
import { parseDisruptionMessage } from '@/lib/disruption-message';
import { blockedWayIdSet } from '@/lib/reachability';

const s = () => useStore.getState();

beforeAll(async () => {
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

/** What the form does on "Create": prefill from the message, then start the record with the message as its source. */
function createFrom(id: string) {
  const g = getRoadModel()!.graph;
  const roadNames = [...new Set(g.ways.map((w) => w.name).filter((n): n is string => Boolean(n)))];
  const m = s().pack.homeMessages.find((x) => x.id === id)!;
  const f = parseDisruptionMessage(m, { roadNames, zones: s().pack.homeZones, clock: s().clock });
  return s().startHomeDisruption({
    kind: f.kind,
    target: f.target,
    targetKind: f.kind === 'road' ? 'road' : 'zone',
    source: 'message',
    expectedEnd: f.durationHours === null ? null : s().clock + Math.round(f.durationHours * 60),
    note: `Meddelande ${m.id}`,
  });
}

describe('disruption from message (SPEC.md § 13.4)', () => {
  beforeEach(() => s().reset());

  it('creating from the road message blocks the named road, with an end 4 hours ahead and the message id in the log', () => {
    const t0 = s().clock;
    expect(createFrom('hmsg-road')).not.toBeNull();
    expect([...s().home.blockedRoads]).toEqual(['Essingeleden']);
    const rec = s().home.disruptions[0];
    expect(rec).toMatchObject({ kind: 'road', source: 'message', startedAt: t0, expectedEnd: t0 + 240, note: 'Meddelande hmsg-road' });
    const last = s().log.at(-1)!;
    expect(last).toMatchObject({ action: 'Startade störning', object: 'Essingeleden', actor: 'Eva Lind' });
    expect(last.detail).toContain('Meddelande hmsg-road');
    // The closure is real: it removes the ways of Essingeleden from the graph, so the impact is computed with it.
    const model = getRoadModel()!;
    const closed = blockedWayIdSet(model, s().home, s().pack);
    const named = model.graph.ways.filter((w) => w.name === 'Essingeleden').map((w) => w.id);
    expect(named.length).toBeGreaterThan(0);
    expect(named.every((id) => closed.has(id))).toBe(true);
    s().advanceClock(240);
    expect(s().home.blockedRoads.size).toBe(0); // the expected end has passed
  });

  it('creating from the power and water messages starts an outage in Huddinge and a disruption in Solna', () => {
    createFrom('hmsg-power');
    createFrom('hmsg-water');
    expect([...s().home.powerOutZones]).toEqual(['huddinge']);
    expect([...s().home.waterOutZones]).toEqual(['solna']);
    expect(s().home.disruptions.find((d) => d.kind === 'water')!.expectedEnd).toBeNull();
  });

  it('creates nothing by itself: the notices alone change no state', () => {
    expect(s().home.disruptions).toHaveLength(0);
    expect(s().pack.homeMessages).toHaveLength(3);
  });
});
