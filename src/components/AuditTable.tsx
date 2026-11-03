import type { AuditEntry } from '@/data/types';
import { t } from '@/lib/i18n';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AuditTableProps {
  entries: AuditEntry[];
  limit?: number;
}

/** Tid, Aktör, Åtgärd, Objekt, Detalj; newest first; most recent 200. */
export function AuditTable({ entries, limit = 200 }: AuditTableProps) {
  const rows = [...entries].reverse().slice(0, limit);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">{t('AUDIT.columns.time')}</TableHead>
          <TableHead className="w-32">{t('AUDIT.columns.actor')}</TableHead>
          <TableHead>{t('AUDIT.columns.action')}</TableHead>
          <TableHead>{t('AUDIT.columns.object')}</TableHead>
          <TableHead>{t('AUDIT.columns.detail')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="tabular">{e.at}</TableCell>
            <TableCell>{e.actor}</TableCell>
            <TableCell className="whitespace-normal">{e.action}</TableCell>
            <TableCell className="whitespace-normal">{e.object}</TableCell>
            <TableCell className="whitespace-normal text-text-secondary">{e.detail ?? ''}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
