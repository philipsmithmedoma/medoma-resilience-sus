import { HOME_MODES } from '@/data/store-home';
import { useStore } from '@/data/store';
import { disruptionCount } from '@/lib/reachability';
import { t, tm } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Disruption modes above the map (SPEC.md § 11.5): close roads, power outage, water disruption, and the "Reset" chip. */
export function ModeChips({ className }: { className?: string }) {
  const mode = useStore((s) => s.home.mode);
  const home = useStore((s) => s.home);
  const setHomeMode = useStore((s) => s.setHomeMode);
  const setWholeRoad = useStore((s) => s.setWholeRoad);
  const resetHomeDisruptions = useStore((s) => s.resetHomeDisruptions);
  const advanceClock = useStore((s) => s.advanceClock);
  const labels = tm('HOME.modes');
  const any = disruptionCount(home) > 0;
  return (
    <div role="group" aria-label={labels.label} className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-small text-text-secondary">{labels.label}</span>
      {HOME_MODES.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setHomeMode(m)}
          className={cn(
            'h-7 rounded-full border px-3 text-small whitespace-nowrap transition-colors duration-150',
            mode === m ? 'border-primary-text bg-primary text-primary-foreground' : 'border-border bg-surface text-text hover:bg-bg-muted',
          )}
        >
          {labels[m]}
        </button>
      ))}
      {mode === 'roads' ? (
        <button
          type="button"
          aria-pressed={home.wholeRoad}
          onClick={() => setWholeRoad(!home.wholeRoad)}
          className={cn(
            'h-7 rounded-full border px-3 text-small whitespace-nowrap transition-colors duration-150',
            home.wholeRoad ? 'border-primary-text bg-primary text-primary-foreground' : 'border-border bg-surface text-text hover:bg-bg-muted',
          )}
        >
          {labels.wholeRoad}
        </button>
      ) : null}
      <button
        type="button"
        title={t('HOME.time.plusHourTitle')}
        onClick={() => advanceClock(60)}
        className="h-7 rounded-full border border-border bg-surface px-3 text-small whitespace-nowrap text-text tabular transition-colors duration-150 hover:bg-bg-muted"
      >
        {t('HOME.time.plusHour')}
      </button>
      <button
        type="button"
        disabled={!any}
        onClick={resetHomeDisruptions}
        className="h-7 rounded-full border border-chip-red-border bg-chip-red-bg px-3 text-small whitespace-nowrap text-chip-red-text transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {labels.reset}
      </button>
    </div>
  );
}
