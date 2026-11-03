import { cn } from '@/lib/utils';

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** Pill group: active segment primary fill with white text, inactive white with primary text (DESIGN.md § 4). Wraps when many segments. */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-y-1 rounded-full border border-primary-text p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn('h-7 rounded-full px-3 text-small font-medium whitespace-nowrap transition-colors duration-150', active ? 'bg-primary text-primary-foreground' : 'bg-surface text-primary-text hover:bg-bg-muted')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
