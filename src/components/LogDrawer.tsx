import { useState } from 'react';
import type { AuditEntry } from '@/data/types';
import { t, tn } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AuditTable } from './AuditTable';

interface LogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: AuditEntry[];
  title?: string;
  description?: string;
}

/** The audit log in a side drawer. */
export function LogDrawer({ open, onOpenChange, entries, title = t('LABELS.auditLog'), description }: LogDrawerProps) {
  // The filter "Sjukhus hemma" shows only the entries of that module (SPEC.md § 14.4).
  const [homeOnly, setHomeOnly] = useState(false);
  const shown = homeOnly ? entries.filter((e) => e.area === 'home') : entries;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[640px] overflow-y-auto sm:max-w-[640px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description ?? tn('LABELS.entries', shown.length)}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <div className="mb-3 flex gap-2" role="group" aria-label={t('LABELS.filterLog')}>
            <button
              type="button"
              aria-pressed={homeOnly}
              onClick={() => setHomeOnly(!homeOnly)}
              className={cn(
                'h-[22px] rounded-full border px-2 text-small transition-colors duration-150',
                homeOnly ? 'border-primary-text bg-primary text-primary-foreground' : 'border-border bg-surface text-text hover:bg-bg-muted',
              )}
            >
              {t('AUDIT.homeObject')}
            </button>
          </div>
          <AuditTable entries={shown} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
