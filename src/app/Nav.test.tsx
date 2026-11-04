// @vitest-environment jsdom
import { cleanup, render as rtl } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useStore } from '@/data/store';
import { useI18n } from '@/lib/i18n';

const setLocale = (l: 'sv' | 'en') => useI18n.getState().setLocale(l);
import { Nav } from './Nav';

/** The navigation's markup for a route, from the store's current state. */
const render = (route: string): string => {
  route = `/o/sus${route}`;
  cleanup();
  const { container } = rtl(
    <MemoryRouter initialEntries={[route]}>
      <TooltipProvider>
        <Nav />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return container.innerHTML;
};
afterEach(cleanup);

const PLATFORM = ['Patienter', 'Aktiviteter', 'Planering', 'Kapacitet', 'Medarbetare', 'Utrustning', 'Rapportering'];
const PREPARED = ['Översikt', 'Sjukhus hemma', 'Incident', 'Beroenden'];

describe('what the navigation renders (SPEC.md § 2)', () => {
  beforeEach(() => {
    setLocale('sv');
    useStore.getState().reset();
  });

  it('normal operation: the seven platform tabs in order, the button Beredskap, no preparedness tab and no indicator', () => {
    const html = render('/patients');
    const positions = PLATFORM.map((l) => html.indexOf(`>${l}<`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const l of PREPARED) expect(html, l).not.toContain(`>${l}<`);
    expect(html).toContain('>Beredskap<');
    expect(html).not.toContain('Beredskapsläge');
  });

  it('shows the selected unit at the far left', () => {
    expect(render('/patients')).toContain('>SUS<');
    useStore.getState().setScope('susmalmo');
    expect(render('/patients')).toContain('>Malmö<');
  });

  it('preparedness mode by the flag: Översikt, Sjukhus hemma, Incident and Beroenden as tabs, the platform in the menu Medoma, the indicator', () => {
    useStore.getState().setPreparedness(true);
    const html = render('/patients');
    for (const l of PREPARED) expect(html, l).toContain(`>${l}<`);
    expect(html).toContain('>Medoma<');
    expect(html).toContain('Beredskapsläge');
    for (const l of PLATFORM) expect(html, l).not.toContain(`>${l}<`);
    expect(html).not.toContain('>Beredskap<');
  });

  it('preparedness mode by a direct link to a preparedness route, and by an active incident', () => {
    expect(render('/home')).toContain('Beredskapsläge');
    useStore.getState().activatePlaybook('pb1', 'Eva Lind', 'Stabsläge');
    const html = render('/patients');
    expect(html).toContain('Beredskapsläge');
    expect(html).toContain('disabled'); // the close control cannot be used while the incident is active
  });

  it('has the labels in English too', () => {
    setLocale('en');
    const html = render('/patients');
    for (const l of ['Patients', 'Activities', 'Planning', 'Capacity', 'Employees', 'Equipment', 'Reporting', 'Preparedness']) expect(html, l).toContain(`>${l}<`);
    useStore.getState().setPreparedness(true);
    const prep = render('/overview');
    for (const l of ['Overview', 'Hospital at Home', 'Incident', 'Dependencies', 'Preparedness mode']) expect(prep, l).toContain(l);
  });
});
