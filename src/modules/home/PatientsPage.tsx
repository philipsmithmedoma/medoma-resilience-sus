import { useMemo, useState } from 'react';
import { useStore } from '@/data/store';
import { t, tm } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { PageTitle } from '@/components/PageTitle';
import { fictionalMarking } from '@/lib/home-sites';
import { PatientDetail } from './PatientDetail';
import { useHomeGeo } from './useHomeGeo';
import { useHomeImpact } from './useHomeImpact';
import { usePreparednessActive } from './usePreparednessActive';

/** The road graph is needed for the disruption flags only, so it loads in preparedness mode only. */
function LoadRoadGraph() {
  useHomeGeo();
  return null;
}

/** SPEC.md § 14.3 – Patienter: the 150 home patients in the platform list style; a row opens the same detail pane as Planning. */
export function PatientsPage() {
  const prep = usePreparednessActive();
  const patients = useStore((s) => s.pack.homePatients);
  const teams = useStore((s) => s.pack.homeTeams);
  const packId = useStore((s) => s.pack.homePackId);
  const work = useStore((s) => s.home.work);
  const incident = useStore((s) => s.incident);
  const { impact } = useHomeImpact();
  const [selected, setSelected] = useState<string | null>(null);
  const equipment = tm('HOME.equipment');
  const sorted = useMemo(() => [...patients].sort((a, b) => a.familyName.localeCompare(b.familyName, 'sv') || a.givenName.localeCompare(b.givenName, 'sv')), [patients]);
  const rowOf = useMemo(() => new Map(impact.rows.map((r) => [r.patient.id, r])), [impact]);
  return (
    <div className="flex flex-col" style={{ height: incident ? 'calc(100vh - 136px)' : 'calc(100vh - 96px)' }}>
      {prep ? <LoadRoadGraph /> : null}
      <div className="mb-4">
        <PageTitle title={t('MODULES.patients')} />
      </div>
      <div className="-mx-6 flex min-h-[520px] flex-1 border-t border-border">
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-border">
          <div className="sticky top-0 z-10 space-y-1 border-b border-border bg-surface px-4 py-3">
            <h2 className="text-heading">{t('HOME.patientsPage.title', { n: sorted.length })}</h2>
            <p className="text-small text-text-muted">{fictionalMarking(packId)}</p>
          </div>
          <ul>
            {sorted.map((p) => {
              const team = teams.find((x) => x.id === work[p.id]?.assignedTeam)?.name ?? p.team;
              return (
                <li key={p.id} className="border-b border-border">
                  <button type="button" aria-pressed={selected === p.id} onClick={() => setSelected(p.id)} className={cn('flex w-full flex-col gap-1 px-4 py-2 text-left hover:bg-bg-muted', selected === p.id && 'bg-bg-muted')}>
                    <span className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {p.familyName}, {p.givenName} <span className="font-normal text-text-secondary tabular">{p.age}</span>
                      </span>
                      <span className="whitespace-nowrap text-small text-text-secondary">{team}</span>
                    </span>
                    <span className="flex w-full items-center gap-2 text-small text-text-secondary">
                      <span className="truncate">
                        {p.street} {p.houseNo}
                      </span>
                      <span className="ml-auto truncate text-text-muted">{p.equipment.length ? p.equipment.map((e) => equipment[e]).join(', ') : t('HOME.list.noEquipment')}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="max-w-[560px]">{selected ? <PatientDetail patientId={selected} row={rowOf.get(selected)} prep={prep} /> : <p className="px-4 py-4">{t('HOME.patientsPage.select')}</p>}</div>
        </div>
      </div>
    </div>
  );
}
