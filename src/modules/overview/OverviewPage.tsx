import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { AlertTriangleIcon, BatteryLowIcon, HouseIcon, TriangleAlertIcon, TruckIcon, UsersIcon, type LucideIcon } from 'lucide-react';
import { useStore } from '@/data/store';
import { lt, t, tm } from '@/lib/i18n';
import { fmt } from '@/lib/format';
import { activeDisruptions } from '@/lib/disruptions';
import { buildHandoverFile } from '@/lib/handover';
import { homeSiteName } from '@/lib/home-sites';
import { realtimeCards } from '@/lib/overview';
import { scopeName } from '@/lib/scope';
import { formatClock } from '@/lib/time';
import type { Figure } from '@/data/types';
import { Card } from '@/components/Card';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { PageTitle, SectionHeading } from '@/components/PageTitle';
import { SimulatedNote } from '@/components/Realtime';
import { Button } from '@/components/ui/button';
import { useHomeGeo } from '@/modules/home/useHomeGeo';
import { useHomeImpact } from '@/modules/home/useHomeImpact';
import { fictionalBasis } from '@/lib/home-sites';

function LoadRoadGraph() {
  useHomeGeo();
  return null;
}

const fig = (value: number, basis: string): Figure => ({ value, confidence: 'illustrative', basis });

/** A card of the summary row: the count as a Figure with its confidence, a link to the page it comes from. */
function SummaryCard({ title, icon, tint, value, basis, to, link }: { title: string; icon: LucideIcon; tint: { icon: string; tile: string }; value: string | number; basis: string; to: string; link: string }) {
  return (
    <Card
      title={title}
      tile={{ icon, iconClass: tint.icon, tileClass: tint.tile }}
      action={
        <Link to={to} className="text-primary-text hover:text-primary-hover hover:underline">
          {link}
        </Link>
      }
    >
      <div className="flex items-baseline gap-3">
        <span className="text-figure tabular">{typeof value === 'number' ? fmt(value) : value}</span>
        {typeof value === 'number' ? <ConfidenceChip figure={fig(value, basis)} /> : null}
      </div>
    </Card>
  );
}

/** Översikt (SPEC.md § 10): the realtime cards, the summary cards and the list of handovers to hospital with its export. */
export function OverviewPage() {
  const pack = useStore((s) => s.pack);
  const home = useStore((s) => s.home);
  const clock = useStore((s) => s.clock);
  const incident = useStore((s) => s.incident);
  const scope = useStore((s) => s.scope);
  const { impact } = useHomeImpact();
  const cards = useMemo(
    () => realtimeCards(pack, { powerStart: home.powerStart, teleStart: home.teleStart, hiddenPower: home.hiddenPower }, clock),
    [pack, home.powerStart, home.teleStart, home.hiddenPower, clock],
  );
  const basis = fictionalBasis(pack.homePackId);
  const reasons = tm('HOME.impact.reasons');
  const s = impact.summary;
  const handovers = home.handovers;
  const nameOf = (id: string) => pack.homePatients.find((p) => p.id === id);
  const exportFile = () => {
    const file = buildHandoverFile(pack, handovers, clock);
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `overlamningar-${pack.homePackId}-${formatClock(clock).replace(':', '')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(t('OVERVIEW.handovers.exported'));
  };
  const hub = cards.shortestHub;
  return (
    <div className="space-y-8">
      <LoadRoadGraph />
      <PageTitle title={t('MODULES.overview')} scope={scopeName(pack.homePackId, scope)} />
      <section aria-label={t('OVERVIEW.realtime.noContact')} className="space-y-2">
        <div className="grid grid-cols-3 gap-4">
          <Card title={t('OVERVIEW.realtime.noContact')} tile={{ icon: UsersIcon, iconClass: 'text-icon-red', tileClass: 'bg-tile-red' }}>
            <Link to="/home" className="text-figure tabular text-primary-text hover:underline" aria-label={`${t('OVERVIEW.realtime.noContact')}: ${cards.noContact.length}`}>
              {fmt(cards.noContact.length)}
            </Link>
          </Card>
          <Card title={t('OVERVIEW.realtime.shortestHub')} tile={{ icon: BatteryLowIcon, iconClass: 'text-icon-orange', tileClass: 'bg-tile-orange' }}>
            {hub ? (
              <Link to="/home" className="text-figure tabular text-primary-text hover:underline">
                {hub.pct} %
              </Link>
            ) : (
              <span>{t('OVERVIEW.realtime.none')}</span>
            )}
            {hub ? <p className="text-small text-text-secondary">{hub.patient.familyName}, {hub.patient.givenName}</p> : null}
          </Card>
          <Card title={t('OVERVIEW.realtime.pumpSoon')} tile={{ icon: TruckIcon, iconClass: 'text-icon-teal', tileClass: 'bg-tile-indigo' }}>
            <Link to="/equipment" className="text-figure tabular text-primary-text hover:underline">
              {fmt(cards.pumpSoon.length)}
            </Link>
            {cards.pumpSoon[0] ? <p className="text-small text-text-secondary">{t('OVERVIEW.realtime.inMin', { n: cards.pumpSoon[0].inMin })}</p> : null}
          </Card>
        </div>
        <SimulatedNote />
      </section>
      <section className="space-y-2">
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard title={t('OVERVIEW.cards.atHome')} icon={HouseIcon} tint={{ icon: 'text-icon-primary', tile: 'bg-tile-indigo' }} value={pack.homePatients.length} basis={basis} to="/home" link={t('OVERVIEW.openHome')} />
          <SummaryCard title={t('OVERVIEW.cards.affected')} icon={AlertTriangleIcon} tint={{ icon: 'text-icon-red', tile: 'bg-tile-red' }} value={s.affected} basis={basis} to="/home" link={t('OVERVIEW.openHome')} />
          <SummaryCard title={t('OVERVIEW.cards.unreachable')} icon={TruckIcon} tint={{ icon: 'text-icon-teal', tile: 'bg-tile-indigo' }} value={s.unreachable} basis={basis} to="/home" link={t('OVERVIEW.openHome')} />
          <SummaryCard title={t('OVERVIEW.cards.battery')} icon={BatteryLowIcon} tint={{ icon: 'text-icon-orange', tile: 'bg-tile-orange' }} value={s.runOutWithin2h} basis={basis} to="/home" link={t('OVERVIEW.openHome')} />
          <SummaryCard title={t('OVERVIEW.cards.disruptions')} icon={TriangleAlertIcon} tint={{ icon: 'text-icon-orange', tile: 'bg-tile-orange' }} value={activeDisruptions(home.disruptions).length} basis={basis} to="/home" link={t('OVERVIEW.openHome')} />
          <Card
            title={t('OVERVIEW.cards.incident')}
            tile={{ icon: TriangleAlertIcon, iconClass: 'text-icon-red', tileClass: 'bg-tile-red' }}
            action={
              <Link to="/incident" className="text-primary-text hover:text-primary-hover hover:underline">
                {t('OVERVIEW.openIncident')}
              </Link>
            }
          >
            <p className="text-heading">{incident ? t('OVERVIEW.incident.active', { name: lt(incident.name), lage: t(`LAGE_LABELS.${incident.lage}`) }) : t('OVERVIEW.incident.none')}</p>
            <ConfidenceChip figure={{ value: incident ? 1 : 0, confidence: 'illustrative', basis }} />
          </Card>
        </div>
      </section>
      <section>
        <SectionHeading
          right={
            <Button variant="secondary" disabled={handovers.length === 0} onClick={exportFile}>
              {t('OVERVIEW.handovers.export')}
            </Button>
          }
        >
          {t('OVERVIEW.handovers.title')} <span className="font-normal text-text-secondary tabular">({handovers.length})</span>
        </SectionHeading>
        <p className="mb-3 text-small text-text-secondary">{t('OVERVIEW.handovers.intro')}</p>
        {handovers.length === 0 ? (
          <p>{t('OVERVIEW.handovers.empty')}</p>
        ) : (
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="text-left text-text-secondary">
                <th className="h-8 border-b border-border px-2 font-normal">{t('OVERVIEW.handovers.columns.time')}</th>
                <th className="h-8 border-b border-border px-2 font-normal">{t('OVERVIEW.handovers.columns.patient')}</th>
                <th className="h-8 border-b border-border px-2 font-normal">{t('OVERVIEW.handovers.columns.team')}</th>
                <th className="h-8 border-b border-border px-2 font-normal">{t('OVERVIEW.handovers.columns.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {handovers.map((h) => {
                const p = nameOf(h.patientId);
                return (
                  <tr key={h.id}>
                    <td className="h-10 border-b border-border px-2 tabular">{formatClock(h.at)}</td>
                    <td className="h-10 border-b border-border px-2">
                      {p ? `${p.familyName}, ${p.givenName}` : h.patientId} <span className="text-text-secondary">{t('OVERVIEW.handovers.site', { site: homeSiteName(pack.homePackId, h.site) })}</span>
                    </td>
                    <td className="h-10 border-b border-border px-2">{p?.team}</td>
                    <td className="h-10 border-b border-border px-2">{h.reasons.length ? h.reasons.map((r) => reasons[r as 'power']).join(', ') : t('OVERVIEW.handovers.noReason')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
