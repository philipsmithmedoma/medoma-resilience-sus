// Scope helpers (SPEC.md § 4): the scope selector picks one unit of the organisation's pack (a site) or all of its sites.
import type { HomePackId, HomeScope, LocalizedText } from '@/data/types';
import { homePacks } from '@/data/packs/home-packs';
import { lt } from '@/lib/i18n';

export const defaultScopeOf = (packId: HomePackId): string => homePacks[packId].defaultScope;

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

/** The units the scope selector lists: the scopes of the organisation's pack (the whole organisation first, then each unit). */
export const scopeMenu = (packId: HomePackId): HomeScope[] => homePacks[packId].scopes;
