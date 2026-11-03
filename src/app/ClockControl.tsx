import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { dayOf, formatClock } from '@/lib/time';

/** The shared clock in the right cluster (SPEC.md § 6): the time, and the day number once it has passed midnight. "+1 h" is on the Sjukhus hemma mode bar. */
export function ClockControl() {
  const clock = useStore((s) => s.clock);
  const day = dayOf(clock);
  return (
    <div className="flex items-center gap-1">
      <span className="mx-0.5 group-data-[prep=true]:mx-0 text-body font-medium tabular" aria-label={t('CLOCK.ariaClock', { hhmm: formatClock(clock) })}>
        {formatClock(clock)}
        {day > 1 ? <span className="ml-1 font-normal text-text-secondary">{t('CLOCK.day', { n: day })}</span> : null}
      </span>
    </div>
  );
}
