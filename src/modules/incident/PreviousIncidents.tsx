import { useState } from 'react';
import type { ClosedIncident } from '@/data/types';
import { useStore } from '@/data/store';
import { lt, t, tm } from '@/lib/i18n';
import { taskCounts } from '@/lib/incident';
import { SectionHeading } from '@/components/PageTitle';
import { LogDrawer } from '@/components/LogDrawer';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Tidigare incidenter – closed incidents this session; hidden when empty. */
export function PreviousIncidents() {
  const closed = useStore((s) => s.closedIncidents);
  const [showing, setShowing] = useState<ClosedIncident | null>(null);
  if (closed.length === 0) return null;
  return (
    <section>
      <SectionHeading>{t('INCIDENT.previous')}</SectionHeading>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('INCIDENT.columns.name')}</TableHead>
            <TableHead>{t('INCIDENT.columns.lage')}</TableHead>
            <TableHead>{t('INCIDENT.columns.activated')}</TableHead>
            <TableHead>{t('INCIDENT.columns.closed')}</TableHead>
            <TableHead>{t('INCIDENT.columns.tasksDone')}</TableHead>
            <TableHead className="w-28" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {closed.map((c, i) => {
            const counts = taskCounts(c.incident.tasks);
            return (
              <TableRow key={`${c.incident.activatedAt}-${i}`}>
                <TableCell className="font-medium">{lt(c.incident.name)}</TableCell>
                <TableCell>{tm('LAGE_LABELS')[c.incident.lage]}</TableCell>
                <TableCell className="tabular">{c.incident.activatedAt}</TableCell>
                <TableCell className="tabular">{c.closedAt}</TableCell>
                <TableCell className="tabular">
                  {counts.done} / {counts.total}
                </TableCell>
                <TableCell className="text-right">
                  <button type="button" className="text-primary-text hover:text-primary-hover hover:underline" onClick={() => setShowing(c)}>
                    {t('LABELS.showLog')}
                  </button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <LogDrawer open={showing !== null} onOpenChange={(open) => !open && setShowing(null)} entries={showing?.log ?? []} title={showing ? `${t('LABELS.auditLog')}: ${lt(showing.incident.name)}` : t('LABELS.auditLog')} />
    </section>
  );
}
