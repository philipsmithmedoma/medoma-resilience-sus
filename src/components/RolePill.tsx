import type { Profession } from '@/data/types';
import { tm } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Fill per profession with a 1 px dashed border in a darker tint of the fill (DESIGN.md § 4); tokens carry the dark values.
const PILL: Record<Profession, string> = {
  Doc: 'bg-pill-doc border-pill-doc-border',
  Nrs: 'bg-pill-nrs border-pill-nrs-border',
  AsPr: 'bg-pill-aspr border-pill-aspr-border',
  Supp: 'bg-pill-supp border-pill-supp-border',
};

export function RolePill({ profession, className }: { profession: Profession; className?: string }) {
  return (
    <span title={tm('PROFESSION_LABELS')[profession]} className={cn('inline-flex h-[22px] items-center rounded-full border border-dashed px-2 text-small text-text', PILL[profession], className)}>
      {profession}
    </span>
  );
}

/** Text pill used for roles that are not professions (e.g. an owner role on a task). */
export function TextPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-[22px] items-center rounded-full border border-border bg-bg-muted px-2 text-small text-text', className)}>
      {children}
    </span>
  );
}
