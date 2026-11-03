import { CheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusChainProps {
  steps: readonly string[];
  labels: Record<string, string>;
  current: string; // the step reached
  label: string;
}

/** A numbered sequence of steps: done steps green, the current step primary, later steps muted. */
export function StatusChain({ steps, labels, current, label }: StatusChainProps) {
  const currentIndex = steps.indexOf(current);
  return (
    <ol aria-label={label} className="space-y-1.5">
      {steps.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-2 text-body">
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular',
                done ? 'bg-green text-primary-foreground' : active ? 'bg-primary text-primary-foreground' : 'border border-border-input text-text-muted',
              )}
              aria-hidden
            >
              {done ? <CheckIcon className="size-3" strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={cn(active ? 'font-medium text-text' : done ? 'text-text' : 'text-text-muted')}>{labels[step] ?? step}</span>
          </li>
        );
      })}
    </ol>
  );
}
