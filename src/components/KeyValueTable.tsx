import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KeyValueRow {
  label: string;
  value: ReactNode;
  action?: ReactNode; // e.g. a "Change" link
}

/** DESIGN.md § 4 key–value table: label cell bg-muted, value cell white, rows divided by border. */
export function KeyValueTable({ rows, className }: { rows: KeyValueRow[]; className?: string }) {
  return (
    <table className={cn('w-full border-collapse text-body', className)}>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-border last:border-b-0">
            <th scope="row" className="w-[220px] bg-bg-muted px-3 py-2 text-left align-top font-normal text-text">
              {r.label}
            </th>
            <td className="px-3 py-2 align-top">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">{r.value}</div>
                {r.action ? <div className="shrink-0">{r.action}</div> : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
