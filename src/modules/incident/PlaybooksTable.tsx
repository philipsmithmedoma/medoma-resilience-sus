import { Fragment, useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import type { Playbook } from '@/data/types';
import { useStore } from '@/data/store';
import { key, lt, t, tm } from '@/lib/i18n';
import { targetUnit } from './OverviewTab';
import { fmt, fmtOffset } from '@/lib/format';
import { SectionHeading } from '@/components/PageTitle';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ActivateDialog } from './ActivateDialog';

/** SPEC.md § 6.6 – Spelböcker PB1–PB5 with expandable rows and an Aktivera button per row. */
export function PlaybooksTable() {
  const playbooks = useStore((s) => s.playbooks);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState<Playbook | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section>
      <SectionHeading>{t('INCIDENT.playbooks')}</SectionHeading>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="w-14">{t('INCIDENT.columns.code')}</TableHead>
            <TableHead>{t('INCIDENT.columns.name')}</TableHead>
            <TableHead>{t('INCIDENT.columns.trigger')}</TableHead>
            <TableHead>{t('INCIDENT.columns.lage')}</TableHead>
            <TableHead className="text-right">{t('INCIDENT.columns.roles')}</TableHead>
            <TableHead className="text-right">{t('INCIDENT.columns.tasks')}</TableHead>
            <TableHead className="text-right">{t('INCIDENT.columns.channels')}</TableHead>
            <TableHead className="text-right">{t('INCIDENT.columns.targets')}</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {playbooks.map((p) => {
            const open = expanded.has(p.id);
            return (
              <Fragment key={p.id}>
                <TableRow>
                  <TableCell>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={open ? t('LABELS.ariaCollapse', { name: lt(p.name) }) : t('LABELS.ariaExpand', { name: lt(p.name) })}
                      onClick={() => toggle(p.id)}
                      className="flex size-6 items-center justify-center rounded text-text-secondary hover:bg-bg-muted"
                    >
                      {open ? <ChevronDownIcon className="size-4" strokeWidth={1.5} /> : <ChevronRightIcon className="size-4" strokeWidth={1.5} />}
                    </button>
                  </TableCell>
                  <TableCell className="text-text-secondary">{p.code}</TableCell>
                  <TableCell className="font-medium">{lt(p.name)}</TableCell>
                  <TableCell className="whitespace-normal">{lt(p.trigger)}</TableCell>
                  <TableCell>{tm('LAGE_LABELS')[p.defaultLage]}</TableCell>
                  <TableCell className="text-right tabular">{p.roles.length}</TableCell>
                  <TableCell className="text-right tabular">{p.tasks.length}</TableCell>
                  <TableCell className="text-right tabular">{p.channels.length}</TableCell>
                  <TableCell className="text-right tabular">{p.targets.length}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => setActivating(p)}>
                      {t('INCIDENT.activate')}
                    </Button>
                  </TableCell>
                </TableRow>
                {open ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell />
                    <TableCell colSpan={9} className="whitespace-normal py-3">
                      <p className="mb-3 text-text-secondary">{lt(p.summary)}</p>
                      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8">
                        <div>
                          <h4 className="mb-1 text-small text-text-secondary">{t('INCIDENT.columns.tasks')}</h4>
                          <ul className="divide-y divide-border">
                            {p.tasks.map((task) => (
                              <li key={key(task.title)} className="grid grid-cols-[200px_minmax(0,1fr)_200px_72px] gap-3 py-1.5 text-body">
                                <span className="text-text-secondary">{lt(task.area)}</span>
                                <span>
                                  {lt(task.title)}
                                  {task.note ? <span className="block text-small text-text-muted">{task.note}</span> : null}
                                </span>
                                <span className="text-text-secondary">{lt(task.ownerRole)}</span>
                                <span className="text-right tabular">{fmtOffset(task.dueOffsetMin)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="mb-1 text-small text-text-secondary">{t('INCIDENT.columns.targets')}</h4>
                          <ul className="divide-y divide-border">
                            {p.targets.map((target) => (
                              <li key={key(target.label)} className="flex justify-between gap-3 py-1.5 text-body">
                                <span>{lt(target.label)}</span>
                                <span className="tabular">
                                  {fmt(target.target)} {targetUnit(target.unit)}, {target.withinUnit === 'dygn' ? t('INCIDENT.withinDays', { n: fmt(target.withinMin / 1440) }) : t('INCIDENT.withinMin', { n: fmt(target.withinMin) })}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <ActivateDialog playbook={activating} onOpenChange={(open) => !open && setActivating(null)} />
    </section>
  );
}
