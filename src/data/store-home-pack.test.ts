import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { homePacks } from './packs/home-packs';
import { homeSitesInScope } from '@/lib/home-sites';
import { packOfScope, scopeMenu, scopeName } from '@/lib/scope';

const s = () => useStore.getState();

describe('home packs and the scope selector (SPEC.md § 4)', () => {
  beforeEach(() => s().reset());

  it('starts on the default pack with its default scope', () => {
    expect(s().pack.homePackId).toBe('karolinska');
    expect(s().pack.homePatients).toBe(homePacks.karolinska.patients);
    expect(s().scope).toBe('karolinska');
  });

  it('a scope belongs to one pack, and the sites in scope are that scope\'s', () => {
    expect(packOfScope('solna')).toBe('karolinska');
    expect(packOfScope('nowhere')).toBeNull();
    expect(homeSitesInScope('karolinska', 'karolinska')).toEqual(['solna', 'huddinge']);
    expect(homeSitesInScope('karolinska', 'huddinge')).toEqual(['huddinge']);
    expect(scopeName('karolinska', 'huddinge')).toBe('Huddinge');
  });

  it('lists the active pack\'s units in the scope menu', () => {
    expect(scopeMenu('karolinska').flatMap((g) => g.scopes.map((x) => x.id))).toEqual(['karolinska', 'solna', 'huddinge']);
  });

  it('selecting a unit of the active pack changes the scope only', () => {
    const n = s().log.length;
    s().setScope('huddinge');
    expect(s().scope).toBe('huddinge');
    expect(s().log).toHaveLength(n);
  });

  it('Bring in uses the pack\'s own nearest site in scope', () => {
    s().setScope('huddinge');
    const p = s().pack.homePatients[0];
    s().bringInPatient(p.id);
    expect(s().home.work[p.id].bringInSite).toBe('huddinge');
    expect(s().log.at(-1)).toMatchObject({ action: 'Tog in patient', detail: 'Karolinska Huddinge' });
  });
});
