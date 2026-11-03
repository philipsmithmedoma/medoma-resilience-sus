import { Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { t, tm, lt } from '@/lib/i18n';
import { formatClock } from '@/lib/time';
import { fictionalMarking } from '@/lib/home-sites';
import { prioritise } from '@/lib/reachability';
import { Button, buttonVariants } from '@/components/ui/button';
import { PageTitle } from '@/components/PageTitle';
import { useHomeImpact } from './useHomeImpact';
import { useHomeGeo } from './useHomeGeo';

/**
 * SPEC.md § 13.3 – the call list: a plain print view (A4, @media print) of the prioritised affected patients with name,
 * street, a phone-shaped placeholder, equipment, battery time, status and an empty line for notes. Marked as fictitious.
 */
export function CallListPage() {
  useHomeGeo();
  const { impact } = useHomeImpact();
  const clock = useStore((s) => s.clock);
  const work = useStore((s) => s.home.work);
  const zones = useStore((s) => s.pack.homeZones);
  const packId = useStore((s) => s.pack.homePackId);
  const equipment = tm('HOME.equipment');
  const statuses = tm('HOME.work.status');
  const rows = prioritise(impact.rows.filter((r) => r.affected));
  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <PageTitle title={t('HOME.callList.title')} />
        <div className="flex gap-2">
          <Link to="/home" className={buttonVariants({ variant: 'secondary' })}>
            {t('HOME.callList.back')}
          </Link>
          <Button onClick={() => window.print()}>{t('HOME.callList.print')}</Button>
        </div>
      </div>
      <div className="hidden print:block">
        <h1 className="text-heading">{t('HOME.callList.title')}</h1>
      </div>
      <p>{t('HOME.callList.intro', { hhmm: formatClock(clock) })}</p>
      <p className="text-small text-text-muted">{fictionalMarking(packId)}</p>
      {rows.length === 0 ? (
        <p>{t('HOME.callList.empty')}</p>
      ) : (
        <table className="w-full border-collapse text-small" data-testid="call-list">
          <thead>
            <tr className="border-b border-text text-left">
              {(['name', 'street', 'phone', 'equipment', 'battery', 'status', 'notes'] as const).map((c) => (
                <th key={c} className="px-2 py-1 font-medium">
                  {t(`HOME.callList.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = r.patient;
              const zone = zones.find((z) => z.id === p.zone);
              return (
                <tr key={p.id} className="border-b border-border align-top break-inside-avoid">
                  <td className="px-2 py-2">
                    {p.familyName}, {p.givenName} <span className="tabular">{p.age}</span>
                  </td>
                  <td className="px-2 py-2">
                    {p.street} {p.houseNo}
                    {zone ? <span className="text-text-muted"> {lt(zone.name)}</span> : null}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap tabular">{t('HOME.callList.phonePlaceholder')}</td>
                  <td className="px-2 py-2">{p.equipment.length ? p.equipment.map((e) => equipment[e]).join(', ') : t('HOME.callList.none')}</td>
                  <td className="px-2 py-2 whitespace-nowrap tabular">
                    {r.batteryEmptyAt == null ? '–' : r.batteryEmpty ? t('HOME.time.batteryEmpty') : t('HOME.time.batteryUntil', { hhmm: formatClock(r.batteryEmptyAt) })}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">{statuses[work[p.id]?.status ?? 'Unhandled']}</td>
                  <td className="min-w-40 px-2 py-2">
                    <div className="h-5 border-b border-text-muted" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
