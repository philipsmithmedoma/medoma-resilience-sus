import { useMemo } from 'react';
import { useStore } from '@/data/store';
import { homeSitesInScope } from '@/lib/home-sites';
import { disruptionCount, impact, type Impact } from '@/lib/reachability';

/** The impact of the current disruptions on the patients, from the sites in the selected scope (SPEC.md § 11.1, § 11.5). */
export function useHomeImpact(): { impact: Impact; active: boolean } {
  const pack = useStore((s) => s.pack);
  const scope = useStore((s) => s.scope);
  const blockedWays = useStore((s) => s.home.blockedWays);
  const blockedRoads = useStore((s) => s.home.blockedRoads);
  const geoReady = useStore((s) => s.home.geoReady);
  const blockedNodes = useStore((s) => s.home.blockedNodes);
  const powerOutZones = useStore((s) => s.home.powerOutZones);
  const waterOutZones = useStore((s) => s.home.waterOutZones);
  const powerStart = useStore((s) => s.home.powerStart);
  const clock = useStore((s) => s.clock);
  return useMemo(() => {
    const state = { blockedWays, blockedRoads, blockedNodes, powerOutZones, waterOutZones, powerStart };
    return { impact: impact(pack, state, homeSitesInScope(pack.homePackId, scope), undefined, clock), active: disruptionCount(state) > 0 };
    // geoReady: the road graph loads after the first render, so the result is computed again when it is there.
  }, [pack, scope, blockedWays, blockedRoads, blockedNodes, powerOutZones, waterOutZones, powerStart, clock, geoReady]);
}
