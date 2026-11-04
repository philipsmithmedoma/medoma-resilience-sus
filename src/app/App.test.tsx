// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { homePacks } from '@/data/packs/home-packs';
import { organisations } from '@/data/packs/organisations';
import { initialData, useStore } from '@/data/store';
import type { Organisation } from '@/data/types';
import { useI18n } from '@/lib/i18n';
import { App } from './App';

const SECOND: Organisation = { id: 'test-region', name: 'Testregionen', careForm: 'asih', units: homePacks.sus.sites, pack: 'sus' };

/** A fresh session at a hash, as a browser reload or a direct link gives it: the store starts over, the hash stays. */
function openAt(hash: string) {
  cleanup();
  act(() => {
    useStore.setState({ ...initialData() });
    window.location.hash = hash;
  });
  return render(<App />);
}
const hash = () => window.location.hash;
/** Radix opens a menu on Enter; jsdom has no pointer events to open it with a click. */
const openMenu = (trigger: HTMLElement) => {
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
};

describe('the organisation and the route prefix (SPEC.md § 1)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('sv');
    window.scrollTo = () => {};
  });
  afterEach(() => {
    cleanup();
    if (organisations.includes(SECOND)) organisations.splice(organisations.indexOf(SECOND), 1);
    window.location.hash = '';
  });

  describe('with one organisation', () => {
    it('skips the start page: the app opens straight into SUS, under the prefix', async () => {
      openAt('');
      await waitFor(() => expect(hash()).toBe('#/o/sus/patients'));
      expect(screen.queryByText('Välj organisation')).toBeNull();
      expect(screen.getByLabelText('Organisation: Skånes universitetssjukhus')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Omfattning: SUS' })).toBeTruthy();
    });

    it('every route carries the prefix, in the links too, and an old link without it is moved under it', async () => {
      const { container } = openAt('#/employees');
      await waitFor(() => expect(hash()).toBe('#/o/sus/employees'));
      const hrefs = [...container.querySelectorAll('header a')].map((a) => a.getAttribute('href'));
      expect(hrefs.length).toBeGreaterThan(5);
      for (const h of hrefs) expect(h, String(h)).toMatch(/^#\/o\/sus(\/|$)/);
      openAt('#/o/sus/employees');
      await waitFor(() => expect(hash()).toBe('#/o/sus/employees'));
      openAt('#/employees');
      await waitFor(() => expect(hash()).toBe('#/o/sus/employees'));
    });

    it('"Byt organisation" in the user menu is the way back to the start page; the start page is there although it was skipped', async () => {
      openAt('');
      await waitFor(() => expect(hash()).toBe('#/o/sus/patients'));
      openMenu(screen.getByRole('button', { name: 'Användarmeny' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Byt organisation' }));
      await waitFor(() => expect(hash()).toBe('#/start-org'));
      expect(await screen.findByText('Välj organisation')).toBeTruthy();
      expect(useStore.getState().organisationId).toBeNull();
      expect(useStore.getState().log.at(-1)).toMatchObject({ action: 'Bytte organisation från', object: 'Skånes universitetssjukhus' });
      fireEvent.click(screen.getByRole('button', { name: 'Logga in i Skånes universitetssjukhus' }));
      await waitFor(() => expect(hash()).toMatch(/^#\/o\/sus\//));
      expect(useStore.getState().organisationId).toBe('sus');
    });

    it('the unit selector lists only the organisation\'s own units and no other control switches pack', async () => {
      openAt('#/o/sus/patients');
      const selector = await screen.findByRole('button', { name: 'Omfattning: SUS' });
      openMenu(selector);
      const items = (await screen.findAllByRole('menuitem')).map((i) => i.textContent);
      expect(items).toEqual(['SUS', 'Lund', 'Malmö']);
    });
  });

  describe('with several organisations', () => {
    beforeEach(() => organisations.push(SECOND));

    it('shows the start page as the root route: a card per organisation with its name and the names of its units, and "Logga in"', async () => {
      openAt('');
      expect(await screen.findByText('Välj organisation')).toBeTruthy();
      expect(hash()).toBe('#/start-org');
      expect(screen.getByText('Skånes universitetssjukhus')).toBeTruthy();
      expect(screen.getByText('Testregionen')).toBeTruthy();
      expect(screen.getAllByText('SUS Lund, SUS Malmö')).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /^Logga in i / })).toHaveLength(2);
      expect(screen.queryByRole('banner')).toBeNull(); // no navigation before the sign-in
    });

    it('has the page in English too', async () => {
      useI18n.getState().setLocale('en');
      openAt('#/start-org');
      expect(await screen.findByText('Select organisation')).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /^Sign in to / })).toHaveLength(2);
    });

    it('signing in puts the organisation in the store and in the route, and its name beside the logo', async () => {
      openAt('');
      fireEvent.click(await screen.findByRole('button', { name: 'Logga in i Testregionen' }));
      await waitFor(() => expect(hash()).toBe('#/o/test-region/patients'));
      expect(useStore.getState().organisationId).toBe('test-region');
      expect(screen.getByLabelText('Organisation: Testregionen')).toBeTruthy();
      expect(useStore.getState().log.at(-1)).toMatchObject({ action: 'Loggade in i', object: 'Testregionen' });
    });

    it('the choice survives a reload and a direct link: the route names the organisation and the store follows it', async () => {
      openAt('#/o/test-region/employees');
      await waitFor(() => expect(useStore.getState().organisationId).toBe('test-region'));
      expect(hash()).toBe('#/o/test-region/employees');
      expect(await screen.findByLabelText('Organisation: Testregionen')).toBeTruthy();
      // A reload: the store starts over with nobody signed in, the hash is the same.
      expect(initialData().organisationId).toBeNull();
      openAt('#/o/test-region/employees');
      await waitFor(() => expect(useStore.getState().organisationId).toBe('test-region'));
      expect(hash()).toBe('#/o/test-region/employees');
      openAt('#/o/sus/employees');
      await waitFor(() => expect(useStore.getState().organisationId).toBe('sus'));
      expect(hash()).toBe('#/o/sus/employees');
    });

    it('a route of an organisation that does not exist leads to the start page', async () => {
      openAt('#/o/nowhere/patients');
      expect(await screen.findByText('Välj organisation')).toBeTruthy();
      expect(hash()).toBe('#/start-org');
    });
  });
});
