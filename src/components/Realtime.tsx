import { useMemo } from 'react';
import type { HomePatient } from '@/data/types';
import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { realtimeOf, silentTooLong, type PatientRealtime } from '@/lib/signal';
import { cn } from '@/lib/utils';

/** The simulated realtime fields of a patient at the clock (SPEC.md § 6): the signal state is the registered and the unregistered outages. */
export function useRealtime(p: HomePatient): PatientRealtime | null {
  const zones = useStore((s) => s.pack.homeZones);
  const home = useStore((s) => s.home);
  const clock = useStore((s) => s.clock);
  return useMemo(() => {
    const zone = zones.find((z) => z.id === p.zone);
    return zone ? realtimeOf(p, zone, { powerStart: home.powerStart, teleStart: home.teleStart, hiddenPower: home.hiddenPower }, clock) : null;
  }, [p, zones, home.powerStart, home.teleStart, home.hiddenPower, clock]);
}

/** Relative time since the last contact: "nu", "12 min sedan", "1 h 5 min sedan". */
export function agoText(clock: number, at: number): string {
  const d = Math.max(0, clock - at);
  if (d < 1) return t('HOME.realtime.now');
  if (d < 60) return t('HOME.realtime.minutesAgo', { n: d });
  return t('HOME.realtime.hoursAgo', { h: Math.floor(d / 60), m: d % 60 });
}

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-small text-text-secondary" title={label}>
      <span aria-hidden className="relative h-1.5 w-8 overflow-hidden rounded-full bg-bg-muted ring-1 ring-border">
        <span className={cn('absolute inset-y-0 left-0', pct <= 20 ? 'bg-red' : 'bg-text-muted')} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular">{pct}</span>
    </span>
  );
}

/** "Senast kontakt" (red when silent too long for the monitoring level) and the hub and phone batteries as small bars. */
export function RealtimeCells({ p, className }: { p: HomePatient; className?: string }) {
  const rt = useRealtime(p);
  const clock = useStore((s) => s.clock);
  if (!rt) return null;
  const red = silentTooLong(p, rt, clock);
  return (
    <span className={cn('inline-flex items-center gap-3 text-small', className)}>
      <span className={cn('tabular', red ? 'font-medium text-red' : 'text-text-secondary')}>{agoText(clock, rt.lastContactAt)}</span>
      <Bar pct={rt.hubBatteryPct} label={t('HOME.realtime.hub', { pct: rt.hubBatteryPct })} />
      <Bar pct={rt.phoneBatteryPct} label={t('HOME.realtime.phone', { pct: rt.phoneBatteryPct })} />
    </span>
  );
}

/** The marking of simulated data; shown once per view. */
export function SimulatedNote({ className }: { className?: string }) {
  return <p className={cn('text-small text-text-muted', className)}>{t('HOME.realtime.simulated')}</p>;
}
