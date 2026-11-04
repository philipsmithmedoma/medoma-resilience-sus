import { useCallback, useMemo } from 'react';
import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { blockedWayIdSet, type Impact } from '@/lib/reachability';
import { getRoadModel } from '@/lib/roadModel';
import { roadKey, type RoadProps } from '@/lib/roadGraph';
import type { GeoData } from '@/lib/geoData';
import { powerLines } from '@/lib/osmNodes';
import { networkDownAt } from '@/lib/signal';
import { homeSiteNodes } from '@/lib/home-sites';
import { NodeMap } from '@/components/NodeMap';
import type { HomeOverlay, PatientMark } from '@/components/HomeMapLayers';
import { LayerChips } from './LayerChips';
import { ModeChips } from './ModeChips';
import { MapLegend } from './MapLegend';

/** Right pane (SPEC.md § 11.6): layer and mode chips above the map, the legend under it. */
export function HomeMap({ impact, geo }: { impact: Impact; geo: GeoData | null }) {
  const pack = useStore((s) => s.pack);
  const home = useStore((s) => s.home);
  const infraNodes = home.infraNodes;
  // The ODbL attribution is for OpenStreetMap data; the fixture that stands in for it is not OpenStreetMap's.
  const osmData = geo !== null && Object.values(geo.source).includes('osm');
  const lines = useMemo(() => (geo ? powerLines(geo) : []), [geo]);
  const selectHomeNode = useStore((s) => s.selectHomeNode);
  const toggleBlockedNode = useStore((s) => s.toggleBlockedNode);
  const closeRoadAt = useStore((s) => s.closeRoadAt);
  const toggleBlockedRoad = useStore((s) => s.toggleBlockedRoad);
  const togglePowerOut = useStore((s) => s.togglePowerOut);
  const toggleWaterOut = useStore((s) => s.toggleWaterOut);
  const toggleHeat = useStore((s) => s.toggleHeat);
  const toggleCold = useStore((s) => s.toggleCold);
  const clock = useStore((s) => s.clock);
  // The tele layer (SPEC.md § 5): zones whose mobile network is down, or falls within two hours.
  const teleStatus = useMemo(() => {
    const m = new Map<string, 'soon' | 'down'>();
    for (const z of pack.homeZones) {
      const down = networkDownAt(z, { powerStart: home.powerStart, teleStart: home.teleStart });
      if (down === null) continue;
      if (clock >= down) m.set(z.id, 'down');
      else m.set(z.id, 'soon');
    }
    return m;
  }, [pack.homeZones, home.powerStart, home.teleStart, clock]);
  // The sites of the active home pack are the hospital nodes on this map.
  const sites = useMemo(() => homeSiteNodes(pack.homePackId), [pack.homePackId]);
  // Affected patients are filled, affected and critical ones a hollow ring, detour-only ones amber (SPEC.md § 11.5).
  const patientMarks = useMemo(() => {
    const marks = new Map<string, PatientMark>();
    for (const r of impact.rows) marks.set(r.patient.id, r.critical ? 'critical' : r.affected ? 'affected' : 'detour');
    return marks;
  }, [impact]);
  // A tap on a segment closes that way, or with "block whole road" every way with the same name (SPEC.md § 12.4).
  const onTapWay = useCallback(
    (p: RoadProps, at: { lat: number; lng: number }) => {
      const key = home.wholeRoad ? roadKey(p) : null;
      if (key) toggleBlockedRoad(key);
      else closeRoadAt(p, at);
    },
    [home.wholeRoad, toggleBlockedRoad, closeRoadAt],
  );
  const blockedWayIds = useMemo(() => {
    const model = getRoadModel();
    return model ? blockedWayIdSet(model, home, pack) : new Set<number>();
    // geoReady: the model exists once the geometry has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home.blockedWays, home.blockedRoads, home.blockedNodes, home.geoReady, pack]);
  const overlay = useMemo<HomeOverlay>(
    () => ({
      layers: home.layers,
      zones: pack.homeZones,
      infraNodes,
      powerLines: lines,
      infraLinks: pack.infraLinks,
      patients: pack.homePatients,
      selectedId: home.selectedNode,
      onSelectNode: selectHomeNode,
      mode: home.mode,
      blockedNodes: home.blockedNodes,
      roads: geo?.roads,
      blockedWayIds,
      powerOutZones: home.powerOutZones,
      waterOutZones: home.waterOutZones,
      patientMarks,
      onToggleNode: toggleBlockedNode,
      onTapWay,
      heatZones: new Set(home.heatStart.keys()),
      coldZones: new Set(home.coldStart.keys()),
      teleStatus,
      onToggleZone: home.mode === 'el' ? togglePowerOut : home.mode === 'heat' ? toggleHeat : home.mode === 'cold' ? toggleCold : toggleWaterOut,
      teams: pack.homeTeams,
    }),
    [home, pack, geo, infraNodes, lines, blockedWayIds, onTapWay, patientMarks, teleStatus, selectHomeNode, toggleBlockedNode, togglePowerOut, toggleWaterOut, toggleHeat, toggleCold],
  );
  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="space-y-2 border-b border-border px-4 py-2">
        <LayerChips />
        <ModeChips />
      </div>
      <div className="min-h-0 flex-1" role="region" aria-label={t('HOME.mapAria')}>
        <NodeMap sites={sites} home={overlay} scrollWheelZoom fitPadding={24} attributionExtra={osmData ? t('HOME.attribution') : undefined} className="h-full" />
      </div>
      <div className="border-t border-border px-4 py-2">
        <MapLegend />
      </div>
    </div>
  );
}
