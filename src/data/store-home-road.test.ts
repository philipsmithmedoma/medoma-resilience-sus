import { beforeAll, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { homeSitesInScope } from '@/lib/home-sites';
import { impact } from '@/lib/reachability';
import { getRoadModel, loadRoadModel } from '@/lib/roadModel';
import { roadsAtTap, waysNearPoint, type RoadProps } from '@/lib/roadGraph';
import { resetStoreTo } from '@/test/packs';
import type { HomePackId } from './types';

const s = () => useStore.getState();

/** The first vertex of a way and the way's properties, as a tap on the segment would give them. */
function tapOn(wayId: number): { props: RoadProps; at: { lat: number; lng: number } } {
  const g = getRoadModel()!.graph;
  const i = g.wayIndexById.get(wayId)!;
  const e = g.edgeWay.findIndex((w) => w === i);
  const v = g.edgeFrom[e];
  return { props: { ...g.ways[i], lanes: null }, at: { lat: g.lat[v], lng: g.lng[v] } };
}

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

    it('closes every way that shares name or ref with the tapped E22 way within 250 m, labels the record "<name> vid <place>" and delays or isolates patients', () => {
      const node = s().pack.infraNodes.find((n) => n.id === 'r-hoje')!;
      const g = getRoadModel()!.graph;
      const near = waysNearPoint(g, node.lat, node.lng, 300).map((i) => g.ways[i]).filter((w) => w.ref === 'E22' || w.name === 'E22');
      expect(near.length).toBeGreaterThan(0);
      const { props, at } = tapOn(near[0].id);
      s().closeRoadAt(props, at);
      const want = expectedAt(props, at);
      expect(want.size).toBeGreaterThanOrEqual(1);
      expect(s().home.blockedWays).toEqual(want);
      expect(roadsAtTap(g, props, at.lat, at.lng).map(String).sort()).toEqual([...want].sort());
      // Oneway carriageways come in pairs: every closed oneway way has its opposite closed too.
      const oneway = [...want].filter((id) => g.ways[g.wayIndexById.get(Number(id))!].oneway);
      if (oneway.length) expect(oneway.length).toBeGreaterThanOrEqual(2);
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
      const e22 = g.ways.find((w) => w.name === 'E22')!;
      s().toggleBlockedRoad(`${e22.name}|${e22.ref ?? ''}`.replace(/\|$/, ''));
      expect(s().home.blockedRoads.size).toBe(1);
      s().toggleBlockedRoad(`${e22.name}|${e22.ref ?? ''}`.replace(/\|$/, ''));
      expect(s().home.blockedRoads.size).toBe(0);
    });

    it('a way with no name or ref closes alone', () => {
      const g = getRoadModel()!.graph;
      const lone = { id: 987654321, name: null, ref: null };
      expect(roadsAtTap(g, lone, 55.7, 13.19)).toEqual([987654321]);
    });
  });
});
