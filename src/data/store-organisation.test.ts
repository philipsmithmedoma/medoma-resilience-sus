import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initialData, useStore } from './store';
import { homePacks } from './packs/home-packs';
import { organisationById, organisations, packOfOrganisation } from './packs/organisations';
import type { Organisation } from './types';
import { useI18n } from '@/lib/i18n';

const s = () => useStore.getState();

/** A second organisation for the tests that need a choice; it uses the SUS pack's data. */
const SECOND: Organisation = { id: 'test-region', name: 'Testregionen', careForm: 'asih', units: homePacks.sus.sites, pack: 'sus' };

describe('the organisation (SPEC.md § 1, § 4)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('sv');
    s().reset();
  });

  it('SUS is the only organisation: hospital at home, with Lund and Malmö as its units, and the pack is reached through it', () => {
    expect(organisations.map((o) => o.id)).toEqual(['sus']);
    const sus = organisationById('sus')!;
    expect(sus.careForm).toBe('hospital-at-home');
    expect(sus.pack).toBe('sus');
    expect(sus.units.map((u) => u.id)).toEqual(['suslund', 'susmalmo']);
    expect(sus.units.map((u) => u.name)).toEqual(['SUS Lund', 'SUS Malmö']);
    expect(packOfOrganisation(sus)).toBe(homePacks.sus);
    expect(organisationById('nope')).toBeNull();
  });

  it('with one organisation the user is signed in at once, with an empty log and an unmoved clock', () => {
    expect(initialData().organisationId).toBe('sus');
    expect(s().organisationId).toBe('sus');
    expect(s().log).toHaveLength(0);
  });

  it('"Byt organisation" signs out and is logged; signing in again keeps the environment and is logged too', () => {
    s().setScope('susmalmo');
    s().togglePowerOut('rosengard');
    const clock = s().clock;
    const n = s().log.length;
    s().leaveOrganisation();
    expect(s().organisationId).toBeNull();
    expect(s().log).toHaveLength(n + 1);
    expect(s().log.at(-1)).toMatchObject({ action: 'Bytte organisation från', object: 'Skånes universitetssjukhus', ref: 'sus' });
    expect(s().clock).toBe(clock); // no demo time passes when somebody signs out
    s().selectOrganisation('sus');
    expect(s().organisationId).toBe('sus');
    expect(s().log.at(-1)).toMatchObject({ action: 'Loggade in i', object: 'Skånes universitetssjukhus' });
    expect(s().scope).toBe('susmalmo'); // the same organisation: the environment is as it was
    expect([...s().home.powerOutZones]).toEqual(['rosengard']);
  });

  it('signing out twice, or in to an organisation that does not exist, changes and logs nothing', () => {
    s().leaveOrganisation();
    const n = s().log.length;
    s().leaveOrganisation();
    s().selectOrganisation('nope');
    expect(s().log).toHaveLength(n);
    expect(s().organisationId).toBeNull();
  });
});

describe('a choice between organisations (SPEC.md § 1)', () => {
  beforeEach(() => {
    organisations.push(SECOND);
    s().reset();
  });
  afterEach(() => {
    organisations.splice(organisations.indexOf(SECOND), 1);
    s().reset();
  });

  it('nobody is signed in at the start when there is more than one organisation', () => {
    expect(initialData().organisationId).toBeNull();
  });

  it('a different organisation gets a fresh environment: nothing of the other one is left', () => {
    s().selectOrganisation('sus');
    s().setScope('susmalmo');
    s().togglePowerOut('rosengard');
    s().setHomeLayer('tele', true);
    s().leaveOrganisation();
    s().selectOrganisation('test-region');
    expect(s().organisationId).toBe('test-region');
    expect(s().dataOrganisationId).toBe('test-region');
    expect(s().scope).toBe('sus');
    expect(s().home.disruptions).toEqual([]);
    expect(s().home.work).toEqual({});
    expect(s().log).toHaveLength(1);
    expect(s().log[0]).toMatchObject({ action: 'Loggade in i', object: 'Testregionen' });
  });
});
