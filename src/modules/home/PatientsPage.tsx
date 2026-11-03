import { useMemo, useState } from 'react';
import { useStore } from '@/data/store';
import { lt, t, tm } from '@/lib/i18n';
import { PATIENT_TABS, buildPatientRows, countByTab, filterRows, type PatientStatusTab } from '@/lib/patient-rows';
import { prioritise } from '@/lib/reachability';
import { cn } from '@/lib/utils';
import { PageTitle } from '@/components/PageTitle';
import { Chip } from '@/components/Chip';
import { REASON_TONE } from '@/components/ReasonChips';
import { RealtimeCells, SimulatedNote } from '@/components/Realtime';
import { fictionalMarking } from '@/lib/home-sites';
import { homePacks } from '@/data/packs/home-packs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PatientDetail } from './PatientDetail';
import { useHomeGeo } from './useHomeGeo';
import { useHomeImpact } from './useHomeImpact';
import { usePreparednessActive } from './usePreparednessActive';

/** The road graph is needed for the disruption flags only, so it loads in preparedness mode only. */
function LoadRoadGraph() {
  useHomeGeo();
  return null;
}

const TH = 'h-[27px] whitespace-nowrap border-b border-border px-2 text-left text-[13px] font-normal text-text-secondary';
const TD = 'h-[27px] whitespace-nowrap border-b border-border px-2 text-[13px] leading-[18px]';

/**
 * Patienter (SPEC.md § 8), after the platform's patient list: search, two buttons that do nothing but log a click, the status
 * tabs with counts and a table with one 27 px row per patient. In preparedness mode the table gains the first column Störning
 * and the column Senast kontakt. A row opens the same detail pane as Sjukhus hemma.
 */
export function PatientsPage() {
  const prep = usePreparednessActive();
  const pack = useStore((s) => s.pack);
  const incident = useStore((s) => s.incident);
  const logEntry = useStore((s) => s.logEntry);
  const { impact } = useHomeImpact();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<PatientStatusTab>('enrolled');
  const [search, setSearch] = useState('');
  const rows = useMemo(() => buildPatientRows({ ...homePacks[pack.homePackId], patients: pack.homePatients }), [pack]);
  const counts = useMemo(() => countByTab(rows), [rows]);
  const shown = useMemo(() => filterRows(rows, tab, search), [rows, tab, search]);
  const rowOf = useMemo(() => new Map(prioritise(impact.rows).map((r) => [r.patient.id, r])), [impact]);
  const zoneName = (id: string) => lt(pack.homeZones.find((z) => z.id === id)?.name ?? { sv: id, en: id });
  const reasons = tm('HOME.impact.reasons');
  const labels = tm('HOME.patientsPage.columns');
  const click = (label: string) => logEntry(t('AUDIT.homeClick'), label, undefined, undefined, undefined, { area: 'home' });
  return (
    <div className="flex flex-col" style={{ height: incident ? 'calc(100vh - 136px)' : 'calc(100vh - 96px)' }}>
      {prep ? <LoadRoadGraph /> : null}
      <div className="mb-3 flex items-end justify-between gap-4">
        <PageTitle title={t('MODULES.patients')} />
        <div className="flex items-center gap-2">
          <Input aria-label={t('HOME.patientsPage.search')} placeholder={t('HOME.patientsPage.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-[240px]" />
          <Button variant="secondary" onClick={() => click(t('HOME.patientsPage.register'))}>
            {t('HOME.patientsPage.register')}
          </Button>
          <Button variant="secondary" onClick={() => click(t('HOME.patientsPage.dayOverview'))}>
            {t('HOME.patientsPage.dayOverview')}
          </Button>
        </div>
      </div>
      <div role="tablist" aria-label={t('HOME.patientsPage.tabs.label')} className="flex gap-6 border-b border-border">
        {PATIENT_TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn('-mb-px border-b-2 py-2 text-nav whitespace-nowrap', tab === k ? 'border-primary text-primary-text' : 'border-border text-text hover:text-primary-text')}
          >
            {t(`HOME.patientsPage.tabs.${k}`)} <span className="tabular text-text-secondary">({counts[k]})</span>
          </button>
        ))}
      </div>
      <div className="mt-2 text-small text-text-muted">
        {fictionalMarking(pack.homePackId)} {prep ? <SimulatedNote className="inline" /> : null}
      </div>
      <div className="-mx-6 mt-2 flex min-h-[420px] flex-1 border-t border-border">
        <div className="min-w-0 flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr>
                {prep ? <th className={cn(TH, 'pl-6')}>{labels.disruption}</th> : null}
                <th className={cn(TH, !prep && 'pl-6')}>{labels.familyName}</th>
                <th className={TH}>{labels.givenName}</th>
                <th className={TH}>{labels.personalNumber}</th>
                <th className={TH}>{labels.type}</th>
                <th className={TH}>{labels.area}</th>
                <th className={TH}>{labels.responsible}</th>
                <th className={TH}>{labels.enrolled}</th>
                <th className={TH}>{labels.plannedDischarge}</th>
                <th className={TH}>{labels.app}</th>
                {prep ? <th className={TH}>{labels.lastContact}</th> : null}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const row = r.patient ? rowOf.get(r.patient.id) : undefined;
                const flag = row ? (row.critical ? row.grounds[0] : row.reasons[0]) : null;
                return (
                  <tr
                    key={r.id}
                    aria-selected={selected === r.id}
                    tabIndex={r.patient ? 0 : undefined}
                    onClick={r.patient ? () => setSelected(r.id) : undefined}
                    onKeyDown={r.patient ? (e) => { if (e.key === 'Enter') setSelected(r.id); } : undefined}
                    title={r.patient ? undefined : t('HOME.patientsPage.registryOnly')}
                    className={cn('hover:bg-bg-muted', r.patient && 'cursor-pointer', selected === r.id && 'bg-bg-muted')}
                  >
                    {prep ? (
                      <td className={cn(TD, 'pl-6')}>
                        {row && row.reasons[0] ? (
                          <Chip tone={row.critical ? 'red' : REASON_TONE[row.reasons[0]]} className="h-[18px]">
                            {row.critical && flag ? tm('HOME.impact.grounds')[flag as 'power'] : reasons[row.reasons[0]]}
                          </Chip>
                        ) : (
                          <span className="text-text-muted">{t('HOME.patientsPage.noFlag')}</span>
                        )}
                      </td>
                    ) : null}
                    <td className={cn(TD, !prep && 'pl-6')}>{r.familyName}</td>
                    <td className={TD}>{r.givenName}</td>
                    <td className={cn(TD, 'tabular')}>{r.personalNumber}</td>
                    <td className={TD}>{t('HOME.patientsPage.type')}</td>
                    <td className={TD}>{zoneName(r.zone)}</td>
                    <td className={TD}>{r.responsible}</td>
                    <td className={cn(TD, 'tabular')}>{r.enrolledOn ?? '–'}</td>
                    <td className={cn(TD, 'tabular')}>{r.plannedDischargeOn ?? '–'}</td>
                    <td className={cn(TD, !r.appLoggedIn && 'text-text-muted')}>{r.appLoggedIn ? t('HOME.patientsPage.appIn') : t('HOME.patientsPage.appOut')}</td>
                    {prep ? <td className={TD}>{r.patient ? <RealtimeCells p={r.patient} /> : null}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 ? <p className="px-6 py-4">{t('HOME.patientsPage.noRows')}</p> : null}
        </div>
        {selected ? (
          <div className="w-[420px] shrink-0 overflow-y-auto border-l border-border">
            <PatientDetail patientId={selected} row={rowOf.get(selected)} prep={prep} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
