import type { ChipTone } from '@/data/vocab';
import { t, tm } from '@/lib/i18n';
import type { ImpactReason, ImpactRow } from '@/lib/reachability';
import { Chip } from './Chip';

export const REASON_TONE: Record<ImpactReason, ChipTone> = {
  unreachable: 'red', detour: 'warning', power: 'red', water: 'warning', noContact: 'red', heat: 'warning', cold: 'warning', noPump: 'red',
};

/** The reasons of a row as chips, and the critical grounds in red after them. */
export function ReasonChips({ row, withGrounds = true }: { row: ImpactRow; withGrounds?: boolean }) {
  const reasons = tm('HOME.impact.reasons');
  const grounds = tm('HOME.impact.grounds');
  return (
    <>
      {row.reasons.map((r) => (
        <Chip key={r} tone={REASON_TONE[r]}>
          {reasons[r]}
          {r === 'detour' && row.extraKm != null ? ` ${t('HOME.impact.plusKm', { n: row.extraKm })}` : ''}
        </Chip>
      ))}
      {withGrounds ? row.grounds.map((g) => (
        <Chip key={g} tone="red" className="font-medium" aria-label={t('HOME.impact.prioritise')}>
          {grounds[g]}
        </Chip>
      )) : null}
    </>
  );
}
