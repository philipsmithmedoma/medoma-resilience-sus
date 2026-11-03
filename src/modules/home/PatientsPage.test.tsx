// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useStore } from '@/data/store';
import { useI18n } from '@/lib/i18n';
import { PatientsPage } from './PatientsPage';

const mount = (route = '/patients') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <TooltipProvider>
        <PatientsPage />
      </TooltipProvider>
    </MemoryRouter>,
  );

describe('/patients after the platform\'s patient list (SPEC.md § 8)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('sv');
    useStore.getState().reset();
  });
  afterEach(cleanup);

  it('has the search field, the two buttons that only log a click, the five tabs with counts and the nine columns in order', () => {
    mount();
    expect(screen.getByPlaceholderText('Sök patient')).toBeTruthy();
    const n = useStore.getState().log.length;
    fireEvent.click(screen.getByRole('button', { name: 'Registrera patient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Visa dagsöversikt' }));
    expect(useStore.getState().log).toHaveLength(n + 2);
    expect(useStore.getState().log.at(-1)).toMatchObject({ action: 'Klickade på knappen', object: 'Visa dagsöversikt' });
    const tabs = screen.getAllByRole('tab').map((x) => x.textContent);
    expect(tabs).toEqual(['Under bedömning (2)', 'Inskrivna (200)', 'Pausade (2)', 'Utskrivna (3)', 'Alla (207)']);
    const headers = screen.getAllByRole('columnheader').map((x) => x.textContent);
    expect(headers).toEqual(['Efternamn', 'Förnamn', 'Personnummer', 'Patienttyp', 'Område', 'Patientansvarig', 'Inskriven', 'Planerad utskrivning', 'Patientapp']);
  });

  it('shows one 27 px row per patient with Sjukhus hemma as type, and switches the list with the tabs and the search', () => {
    mount();
    const body = screen.getAllByRole('row').slice(1);
    expect(body).toHaveLength(200);
    expect(body[0].querySelector('td')!.className).toContain('h-[27px]');
    expect(within(body[0]).getByText('Sjukhus hemma')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Utskrivna/ }));
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(3);
    fireEvent.click(screen.getByRole('tab', { name: /Alla/ }));
    fireEvent.change(screen.getByPlaceholderText('Sök patient'), { target: { value: 'zzzz-no-match' } });
    expect(screen.getByText('Inga patienter matchar sökningen.')).toBeTruthy();
  });

  it('opens the patient detail on a row click', () => {
    mount();
    fireEvent.click(screen.getAllByRole('row')[1]);
    expect(screen.getAllByText('Fiktiva patientuppgifter – inga verkliga patienter.').length).toBe(2); // the page's line and the detail's
    expect(screen.getAllByText('Adress').length).toBe(1);
  });

  it('adds the first column Störning and the column Senast kontakt in preparedness mode only', () => {
    useStore.getState().setPreparedness(true);
    mount();
    const headers = screen.getAllByRole('columnheader').map((x) => x.textContent);
    expect(headers[0]).toBe('Störning');
    expect(headers.at(-1)).toBe('Senast kontakt');
    expect(headers).toHaveLength(11);
  });

  it('is the same in English with the platform\'s labels', () => {
    useI18n.getState().setLocale('en');
    mount();
    expect(screen.getByPlaceholderText('Search for patient')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Register patient' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Show daily overview' })).toBeTruthy();
    expect(screen.getAllByRole('tab').map((x) => x.textContent?.replace(/ \(\d+\)/, ''))).toEqual(['Under assessment', 'Enrolled', 'Paused', 'Discharged', 'All']);
    expect(within(screen.getAllByRole('row')[1]).getByText('Hospital at home')).toBeTruthy();
  });
});
