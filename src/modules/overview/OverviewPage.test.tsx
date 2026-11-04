// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useStore } from '@/data/store';
import { useI18n } from '@/lib/i18n';
import { resetStoreTo } from '@/test/packs';
import { DependenciesPage } from '@/modules/dependencies/DependenciesPage';
import { EquipmentPage } from '@/modules/equipment/EquipmentPage';
import { CapacityPage } from '@/modules/capacity/CapacityPage';
import { OverviewPage } from './OverviewPage';

const mount = (el: React.ReactElement, route = '/overview') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <TooltipProvider>{el}</TooltipProvider>
    </MemoryRouter>,
  );

describe('Översikt, Utrustning, Kapacitet and Beroenden (SPEC.md § 8, § 10)', () => {
  beforeEach(() => {
    useI18n.getState().setLocale('sv');
    resetStoreTo('sus');
  });
  afterEach(cleanup);

  it('Översikt has the three realtime cards, the summary cards with the illustrative chip, and an empty handover list with a disabled export', () => {
    mount(<OverviewPage />);
    for (const title of ['Utan kontakt nu', 'Kortaste batteri (hub) i dag', 'Nästa pumpbyte inom 2 h', 'Patienter hemma', 'Påverkade nu', 'Nås inte med bil', 'Batteri slut inom 2 h', 'Aktiva störningar', 'Incidentstatus']) {
      expect(screen.getByText(title), title).toBeTruthy();
    }
    expect(screen.getAllByText('Illustrativt').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('Simulerat – kommer via integration')).toBeTruthy();
    expect(screen.getByText('Ingen patient är markerad Ta in.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Exportera' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists a patient marked Ta in with time, patient, team and reason, and exports one JSON file', () => {
    useStore.getState().applyHomePreset('power');
    const p = useStore.getState().pack.homePatients.find((x) => x.zone === 'dalby')!;
    useStore.getState().bringInPatient(p.id);
    const created: Blob[] = [];
    URL.createObjectURL = (b: Blob | MediaSource) => (created.push(b as Blob), 'blob:test');
    URL.revokeObjectURL = () => undefined;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mount(<OverviewPage />);
    const row = screen.getByText(`${p.familyName}, ${p.givenName}`).closest('tr')!;
    expect(within(row).getByText('Sjukhus hemma Lund')).toBeTruthy();
    expect(within(row).getByText('Utan el')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Exportera' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(created).toHaveLength(1);
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('Utrustning has one row per type with i bruk/totalt counted from the patients plus the stock, and unfolds the patients', () => {
    const pack = useStore.getState().pack;
    mount(<EquipmentPage />, '/equipment');
    const body = screen.getAllByRole('row').slice(1);
    expect(body).toHaveLength(5);
    const pump = body.find((r) => within(r).queryByText('Pump'))!;
    const inUse = pack.homePatients.filter((p) => p.equipment.includes('Pump')).length;
    expect(within(pump).getByText(new RegExp(`^${inUse}/${inUse + 3}`))).toBeTruthy();
    fireEvent.click(within(pump).getByRole('button', { name: 'Visa patienter med Pump' }));
    expect(screen.getAllByRole('listitem').length).toBe(inUse);
  });

  it('Utrustning in preparedness mode adds "varav N hos påverkade patienter" and the column Batteri', () => {
    useStore.getState().setPreparedness(true);
    useStore.getState().applyHomePreset('power');
    mount(<EquipmentPage />, '/equipment');
    expect(screen.getAllByText(/varav \d+ hos påverkade patienter/).length).toBe(5);
    expect(screen.getByRole('columnheader', { name: 'Batteri' })).toBeTruthy();
  });

  it('Kapacitet has seven days, the three card groups and the profession rows; the disruption layer only in preparedness mode', () => {
    mount(<CapacityPage />, '/capacity');
    expect(screen.getAllByRole('tab')).toHaveLength(7);
    for (const title of ['Patienter', 'Aktiviteter', 'Arbetspass']) expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    expect(screen.queryByText('Påverkade besök i dag')).toBeNull();
    cleanup();
    useStore.getState().setPreparedness(true);
    mount(<CapacityPage />, '/capacity');
    expect(screen.getByText('Påverkade besök i dag')).toBeTruthy();
  });

  it('Beroenden lists the nineteen rows with Medoma Center as not dependent', () => {
    mount(<DependenciesPage />, '/dependencies');
    expect(screen.getAllByRole('row').slice(1)).toHaveLength(19);
    expect(screen.getByText('Ej beroende: sjukhusets reservkraft')).toBeTruthy();
    expect(screen.getByText('Stationär syrgaskoncentrator')).toBeTruthy();
    expect(screen.getAllByText('Opåverkad').length).toBe(18);
  });
});
