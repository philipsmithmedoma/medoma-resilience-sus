import { Fragment, useMemo, useState } from 'react';
import { ChevronRightIcon } from 'lucide-react';
import { useStore } from '@/data/store';
import { HOME_EQUIPMENT } from '@/data/vocab';
import { t, tm } from '@/lib/i18n';
import { fmt } from '@/lib/format';
import { equipmentLines } from '@/lib/equipment';
import { cn } from '@/lib/utils';
import { PageTitle } from '@/components/PageTitle';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { PatientRow } from '@/modules/home/HomePatientList';
import { useHomeGeo } from '@/modules/home/useHomeGeo';
import { useHomeImpact } from '@/modules/home/useHomeImpact';
import { usePreparednessActive } from '@/modules/home/usePreparednessActive';

function LoadRoadGraph() {
  useHomeGeo();
  return null;
}

/**
 * Utrustning (SPEC.md § 8), after the platform's equipment view: one row per type with an expandable chevron and "i bruk/totalt";
 * expanded, the patients with the type in the Sjukhus hemma row. In preparedness mode each row adds how many of its patients are
 * affected and the column Batteri with the shortest remaining battery time of the type among them.
 */
export function EquipmentPage() {
  const prep = usePreparednessActive();
  const pack = useStore((s) => s.pack);
  const clock = useStore((s) => s.clock);
  const { impact } = useHomeImpact();
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const names = tm('HOME.equipment');
  const lines = useMemo(() => equipmentLines(pack, HOME_EQUIPMENT, impact.rows, clock), [pack, impact, clock]);
  const rowOf = useMemo(() => new Map(impact.rows.map((r) => [r.patient.id, r])), [impact]);
  const left = (min: number | null) => (min === null ? t('EQUIPMENT.batteryNone') : t('EQUIPMENT.batteryLeft', { h: Math.floor(min / 60), m: min % 60 }));
  return (
    <div className="space-y-4">
      {prep ? <LoadRoadGraph /> : null}
      <PageTitle title={t('EQUIPMENT.title')} />
      <p className="text-small text-text-secondary">{t('EQUIPMENT.stockNote')}</p>
      <table className="w-full max-w-[1100px] border-collapse">
        <thead>
          <tr className="text-left text-text-secondary">
            <th className="h-8 w-8 border-b border-border" />
            <th className="h-8 border-b border-border px-2 font-normal">{t('EQUIPMENT.title')}</th>
            <th className="h-8 border-b border-border px-2 text-right font-normal">{t('EQUIPMENT.inUseLabel')}</th>
            {prep ? <th className="h-8 border-b border-border px-2 font-normal" /> : null}
            {prep ? <th className="h-8 border-b border-border px-2 font-normal">{t('EQUIPMENT.battery')}</th> : null}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const expanded = open === l.type;
            const name = names[l.type];
            return (
              <Fragment key={l.type}>
                <tr className="hover:bg-bg-muted">
                  <td className="h-10 border-b border-border pl-2">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={t(expanded ? 'EQUIPMENT.collapse' : 'EQUIPMENT.expand', { name })}
                      onClick={() => setOpen(expanded ? null : l.type)}
                      className="flex size-6 items-center justify-center rounded hover:bg-bg-muted"
                    >
                      <ChevronRightIcon className={cn('size-4 transition-transform duration-150', expanded && 'rotate-90')} strokeWidth={1.5} aria-hidden />
                    </button>
                  </td>
                  <td className="h-10 border-b border-border px-2 font-medium">{name}</td>
                  <td className="h-10 border-b border-border px-2 text-right tabular">
                    {fmt(l.inUse)}/{fmt(l.total)}
                    <ConfidenceChip className="ml-2 align-middle" figure={pack.homeEquipmentStock[l.type]} />
                  </td>
                  {prep ? <td className="h-10 border-b border-border px-2 text-text-secondary">{t('EQUIPMENT.affected', { n: l.affected })}</td> : null}
                  {prep ? <td className="h-10 border-b border-border px-2 tabular">{left(l.shortestBatteryMin)}</td> : null}
                </tr>
                {expanded ? (
                  <tr>
                    <td colSpan={prep ? 5 : 3} className="border-b border-border bg-bg-muted p-0">
                      {l.patients.length === 0 ? (
                        <p className="px-4 py-3">{t('EQUIPMENT.noPatients')}</p>
                      ) : (
                        <ul>
                          {l.patients.map((p) => (
                            <PatientRow key={p.id} p={p} row={prep ? rowOf.get(p.id) : undefined} expanded={selected === p.id} onToggle={() => setSelected(selected === p.id ? null : p.id)} />
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
