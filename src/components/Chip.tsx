import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { toneOf, type ChipTone } from '@/data/vocab';

// Fill, 1 px border and text per tone; the chip tokens carry the light and dark values (DESIGN-DARK.md § 2).
const TONE_CLASSES: Record<ChipTone, string> = {
  green: 'bg-chip-green-bg border-chip-green-border text-chip-green-text',
  warning: 'bg-chip-orange-bg border-chip-orange-border text-chip-orange-text',
  red: 'bg-chip-red-bg border-chip-red-border text-chip-red-text',
  grey: 'bg-chip-grey-bg border-chip-grey-border text-chip-grey-text',
  blue: 'bg-chip-blue-bg border-chip-blue-border text-chip-blue-text',
};

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Status chip: light fill, 1 px solid semantic border, semantic text (DESIGN.md § 4). */
export function Chip({ tone = 'grey', children, className, title }: ChipProps) {
  return (
    <span
      title={title}
      className={cn('inline-flex h-[22px] items-center rounded-full border px-2 text-small whitespace-nowrap', TONE_CLASSES[tone], className)}
    >
      {children}
    </span>
  );
}

/** Chip whose tone is derived from an enum key via the vocab mapping; the label is the Swedish text. */
export function StatusChip({ status, label, className, title }: { status: string; label?: string; className?: string; title?: string }) {
  return (
    <Chip tone={toneOf(status)} className={className} title={title}>
      {label ?? status}
    </Chip>
  );
}

/** Count badge: 16 px black circle with white 11/600 text. */
export function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-badge px-1 text-[11px] leading-none font-semibold text-badge-text tabular">
      {count}
    </span>
  );
}
