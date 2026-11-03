import { useMemo } from 'react';
import { useStore } from '@/data/store';
import { homeSitesInScope } from '@/lib/home-sites';
import { disruptionCount, impact, type Impact } from '@/lib/reachability';

/** The impact of the current disruptions on the patients, from the sites in the selected scope (SPEC.md § 11.1, § 11.5). */
export function useHomeImpact(): { impact: Impact; active: boolean } {
  const pack = useStore((s) => s.pack);
  const scope = useStore((s) => s.scope);
  const home = useStore((s) => s.home);
  const clock = useStore((s) => s.clock);
  return useMemo(
    () => ({ impact: impact(pack, home, homeSitesInScope(pack.homePackId, scope), undefined, clock), active: disruptionCount(home) > 0 }),
    // home.geoReady is part of home: the road graph loads after the first render, so the result is computed again when it is there.
    [pack, scope, home, clock],
  );
}
