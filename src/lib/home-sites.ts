// The sites of the active home pack (SPEC.md § 4): the scope picks the sites reachability runs from.
import type { CareSite, HomePackId, NodeId } from '@/data/types';
import { homePacks } from '@/data/packs/home-packs';
import { t } from '@/lib/i18n';
import { sitesInScope } from './scope';

/** The sites reachability runs from: the scope's sites; with no match, all of the pack's. */
export function homeSitesInScope(packId: HomePackId, scope: NodeId): string[] {
  return sitesInScope(packId, scope);
}

/** A site's display name. */
export function homeSiteName(packId: HomePackId, siteId: string): string {
  return homePacks[packId].sites.find((s) => s.id === siteId)?.name ?? siteId;
}

/** The sites as map nodes. */
export function homeSiteNodes(packId: HomePackId): CareSite[] {
  return homePacks[packId].sites.map((s) => ({ id: s.id, name: s.name, shortName: s.name, lat: s.lat, lng: s.lng }));
}

/** "Fiktiva patientuppgifter": the marking of the home pages (all patient data is synthetic). */
export function fictionalMarking(_packId: HomePackId): string {
  return t('LABELS.fictionalPatients');
}

/** The basis text of an illustrative patient count. */
export function fictionalBasis(_packId: HomePackId): string {
  return t('HOME.impact.basis');
}
