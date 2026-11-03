import { useEffect, useState } from 'react';
import { useStore } from '@/data/store';
import { loadGeoData, type GeoData } from '@/lib/geoData';
import { loadRoadModel } from '@/lib/roadModel';
import { applyOsmNodes, loadQueryDate, setAppliedNodes } from '@/lib/osmNodes';
import { homePackIdOf } from '@/data/packs/home-packs';

/**
 * Loads the OpenStreetMap geometry (dynamic imports, SPEC.md § 12.2) and builds the road model when Hospital at Home
 * opens; the store is told when the graph is ready so the impact is computed again. Null while loading.
 */
export function useHomeGeo(): GeoData | null {
  const pack = useStore((s) => s.pack);
  const setHomeGeoReady = useStore((s) => s.setHomeGeoReady);
  const [geo, setGeo] = useState<GeoData | null>(null);
  useEffect(() => {
    let alive = true;
    setGeo(null); // the geometry of the pack that was open is not the new pack's
    const packId = homePackIdOf(pack);
    void Promise.all([loadGeoData(packId), loadRoadModel(pack), loadQueryDate(packId)]).then(([g, , date]) => {
      if (!alive) return;
      // The nodes take their positions from OpenStreetMap; a node without a match keeps its fallback estimate and is logged.
      const applied = applyOsmNodes(pack.infraNodes, g, date, packId);
      if (applied.missing.length) console.warn(`OpenStreetMap: no match for ${applied.missing.join(', ')}; the estimate is kept`);
      setAppliedNodes(applied, packId);
      setGeo(g);
      setHomeGeoReady(applied.nodes);
    });
    return () => {
      alive = false;
    };
  }, [pack, setHomeGeoReady]);
  return geo;
}
