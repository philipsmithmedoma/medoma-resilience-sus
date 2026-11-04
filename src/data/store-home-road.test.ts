import { beforeAll, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { homeSitesInScope } from '@/lib/home-sites';
import { impact } from '@/lib/reachability';
import { getRoadModel, loadRoadModel } from '@/lib/roadModel';
import { roadKey, roadsAtTap, waysNearPoint, type RoadProps } from '@/lib/roadGraph';
import { resetStoreTo } from '@/test/packs';
import { HOJE_A, isE22, nearestE22 } from '@/test/roads';
import type { HomePackId } from './types';

const s = () => useStore.getState();

async function load(pack: HomePackId) {
  resetStoreTo(pack);
  await loadRoadModel(s().pack);
  s().setHomeGeoReady();
}

/** The ways that the rule of SPEC § 6.1 should close, computed here from the road graph and the tap. */
const expectedAt = (props: RoadProps, at: { lat: number; lng: number }) => {
  const g = getRoadModel()!.graph;
  return new Set(
    waysNearPoint(g, at.lat, at.lng, 250)
      .map((i) => g.ways[i])
      .filter((w) => w.id === props.id || (props.name && w.name === props.name) || (props.ref && w.ref === props.ref))
      .map((w) => String(w.id)),
  );
};

describe('a tap on a road closes the same road within 250 m, in both directions (SPEC.md § 6.1)', () => {
  describe('SUS: the E22 at Höje å', () => {
    beforeAll(() => load('sus'));

    it('closes both carriageways of the E22 within 250 m of the tap, labels the record "<name> vid <place>" and delays or isolates at least one patient', () => {
      const g = getRoadModel()!.graph;
      const { props, at } = nearestE22(g, HOJE_A);
      expect(isE22(props.ref)).toBe(true);
      s().closeRoadAt(props, at);
      const want = expectedAt(props, at);
      expect(want.size).toBeGreaterThanOrEqual(2);
      expect(s().home.blockedWays).toEqual(want);
      expect(roadsAtTap(g, props, at.lat, at.lng).map(String).sort()).toEqual([...want].sort());
      // Both carriageways: at least two oneway ways with the road's ref are closed, and every closed way lies within 250 m of the tap.
      const closed = [...want].map((id) => g.ways[g.wayIndexById.get(Number(id))!]);
      expect(closed.filter((w) => isE22(w.ref) && w.oneway).length).toBeGreaterThanOrEqual(2);
      const within = new Set(waysNearPoint(g, at.lat, at.lng, 250).map((i) => String(g.ways[i].id)));
      for (const id of want) expect(within.has(id)).toBe(true);
      const d = s().home.disruptions.at(-1)!;
      expect(d).toMatchObject({ kind: 'road', targetKind: 'ways', source: 'map' });
      expect(d.label.sv).toMatch(/ vid /);
      expect(s().log.at(-1)).toMatchObject({ action: 'Stängde', area: 'home' });
      const r = impact(s().pack, s().home, homeSitesInScope('sus', 'suslund'), getRoadModel(), s().clock);
      expect(r.rows.filter((x) => x.delayed || x.unreachable).length).toBeGreaterThanOrEqual(1);
      // A second tap on a closed way opens the road again.
      s().closeRoadAt(props, at);
      expect(s().home.blockedWays.size).toBe(0);
      expect(s().log.at(-1)).toMatchObject({ action: 'Öppnade' });
    });

    it('leaves "Block whole road" as it was: every way with the name, by road key', () => {
      const g = getRoadModel()!.graph;
      const { props } = nearestE22(g, HOJE_A);
      const key = roadKey(props)!;
      s().toggleBlockedRoad(key);
      expect(s().home.blockedRoads.size).toBe(1);
      s().toggleBlockedRoad(key);
      expect(s().home.blockedRoads.size).toBe(0);
    });

    it('a way with no name or ref closes alone', () => {
      const g = getRoadModel()!.graph;
      const lone = { id: 987654321, name: null, ref: null };
      expect(roadsAtTap(g, lone, 55.7, 13.19)).toEqual([987654321]);
    });
  });
});
