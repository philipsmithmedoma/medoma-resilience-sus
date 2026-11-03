// Scope helpers (SPEC.md § 4): the scope selector picks one unit of a home pack (a site) or all of its sites.
import type { HomePackId, HomeScope, LocalizedText } from '@/data/types';
import { homePacks, HOME_PACK_IDS } from '@/data/packs/home-packs';
import { lt } from '@/lib/i18n';

export const defaultScopeOf = (packId: HomePackId): string => homePacks[packId].defaultScope;

/** The pack a scope id belongs to; null for an unknown id. */
export function packOfScope(scope: string): HomePackId | null {
  return HOME_PACK_IDS.find((id) => homePacks[id].scopes.some((s) => s.id === scope)) ?? null;
}

export function scopeOf(packId: HomePackId, scope: string): HomeScope {
  const pack = homePacks[packId];
  return pack.scopes.find((s) => s.id === scope) ?? pack.scopes.find((s) => s.id === pack.defaultScope)!;
}

/** The site ids reachability runs from: the scope's sites; all of the pack's sites when the scope is unknown. */
export function sitesInScope(packId: HomePackId, scope: string): string[] {
  const found = homePacks[packId].scopes.find((s) => s.id === scope);
  return found ? found.sites : homePacks[packId].sites.map((s) => s.id);
}

export function scopeName(packId: HomePackId, scope: string): string {
  return lt(scopeOf(packId, scope).label);
}

export const scopeLabel = (label: LocalizedText): string => lt(label);

/** The packs whose units the scope selector lists: those that are always listed, and the active one. */
export function scopeMenu(activePack: HomePackId): Array<{ pack: HomePackId; scopes: HomeScope[] }> {
  return HOME_PACK_IDS.filter((id: HomePackId) => (id as string) === activePack || homePacks[id].scopeMenu === 'always').map((id) => ({ pack: id, scopes: homePacks[id].scopes }));
}
