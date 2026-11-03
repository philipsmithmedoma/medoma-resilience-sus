import { CheckIcon } from 'lucide-react';
import type { TaskStatus } from '@/data/types';
import { cn } from '@/lib/utils';

/**
 * DESIGN.md § 4 status glyphs: Not started = dotted circle in text-muted; In progress = primary ring
 * with a primary dot; Done = green circle with a white check. 16 px.
 */
export function StatusGlyph({ status, className }: { status: TaskStatus; className?: string }) {
  if (status === 'Done') {
    return (
      <span className={cn('flex size-4 items-center justify-center rounded-full bg-green', className)} aria-hidden>
        <CheckIcon className="size-3 text-primary-foreground" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === 'In progress') {
    return (
      <span className={cn('flex size-4 items-center justify-center rounded-full border-2 border-primary-text', className)} aria-hidden>
        <span className="size-1.5 rounded-full bg-primary" />
      </span>
    );
  }
  return <span className={cn('block size-4 rounded-full border border-dotted border-text-muted', className)} aria-hidden />;
}
