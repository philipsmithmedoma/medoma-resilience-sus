import { useMemo, useState } from 'react';
import { useStore } from '@/data/store';
import { localeTag, t, tm, useLocale } from '@/lib/i18n';
import { fmt } from '@/lib/format';
import { CAP_ACTIVITIES, CAP_PROFESSIONS, CAP_SHIFTS, buildCapacity } from '@/lib/capacity';
import { cn } from '@/lib/utils';
import { Card } from '@/components/Card';
import { PageTitle, SectionHeading } from '@/components/PageTitle';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { effectiveVisits } from '@/data/packs/home-visits';
import { useHomeGeo } from '@/modules/home/useHomeGeo';
import { useHomeImpact } from '@/modules/home/useHomeImpact';
import { usePreparednessActive } from '@/modules/home/usePreparednessActive';
import { fictionalBasis } from '@/lib/home-sites';

function LoadRoadGraph() {
  useHomeGeo();
  return null;
}

/**
 * Kapacitet (SPEC.md § 8), after the platform's view: seven days from today, the cards Patienter, Aktiviteter and Arbetspass, and rows per
 * profession and shift. In preparedness mode every shift adds the visits a disruption affects and the extra driving time from the
 * detours, the day strip marks days a disruption with an end time covers, and the card row gains the card Störning.
 */
export function CapacityPage() {
  const prep = usePreparednessActive();
  const pack = useStore((s) => s.pack);
  const home = useStore((s) => s.home);
  const clock = useStore((s) => s.clock);
  const locale = useLocale();
  const { impact } = useHomeImpact();
  const [day, setDay] = useState(0);
  const days = useMemo(
    () => buildCapacity({ pack: { homePatients: pack.homePatients, homeTeams: pack.homeTeams, homeExtras: pack.homeExtras }, visits: effectiveVisits(home.visits, home.work), rows: prep ? impact.rows : [], disruptions: prep ? home.disruptions : [], clock, prep }),
    [pack, home.visits, home.work, home.disruptions, impact, clock, prep],
  );
  const d = days[Math.min(day, 6)];
  const basis = fictionalBasis(pack.homePackId);
  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(localeTag(locale), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const act = tm('CAPACITY.activity');
  const prof = tm('CAPACITY.profession');
  const shiftName = tm('CAPACITY.shift');
  const figure = (value: number) => ({ value, confidence: 'illustrative' as const, basis });
  return (
    <div className="space-y-6">
      {prep ? <LoadRoadGraph /> : null}
      <PageTitle title={t('CAPACITY.title')} />
      <div role="tablist" aria-label={t('CAPACITY.daysAria')} className="grid grid-cols-7 gap-2">
        {days.map((x) => (
          <button
            key={x.date}
            type="button"
            role="tab"
            aria-selected={day === x.index}
            onClick={() => setDay(x.index)}
            className={cn('flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors duration-150', day === x.index ? 'border-primary bg-bg-muted' : 'border-border hover:bg-bg-muted', prep && x.disrupted && 'border-banner-orange-border bg-banner-orange-bg')}
          >
            <span className="font-medium">{x.index === 0 ? `${t('CAPACITY.today')}, ${dateLabel(x.date)}` : dateLabel(x.date)}</span>
            <span className="tabular text-small text-text-secondary">{t('CAPACITY.enrolled', { n: fmt(x.enrolled) })}</span>
            <span className="tabular text-small text-text-secondary">{t('CAPACITY.shifts', { n: fmt(x.shifts) })}</span>
            {prep && x.disrupted ? <span className="text-small">{t('CAPACITY.disrupted')}</span> : null}
          </button>
        ))}
      </div>
      <div className={cn('grid gap-4', prep ? 'grid-cols-4' : 'grid-cols-3')}>
        <Card title={t('CAPACITY.cards.patients')}>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>{t('CAPACITY.cards.enrolled')}</dt><dd className="tabular">{fmt(d.cards.enrolled)} <span className="text-text-secondary">{t('CAPACITY.cards.withVisit', { n: fmt(d.cards.withVisit) })}</span></dd></div>
            <div className="flex justify-between"><dt>{t('CAPACITY.cards.assessment')}</dt><dd className="tabular">{fmt(d.cards.assessment)}</dd></div>
            <div className="flex justify-between"><dt>{t('CAPACITY.cards.plannedAdmission')}</dt><dd className="tabular">{fmt(d.cards.plannedAdmission)}</dd></div>
            <div className="flex justify-between"><dt>{t('CAPACITY.cards.plannedDischarge')}</dt><dd className="tabular">{fmt(d.cards.plannedDischarge)}</dd></div>
          </dl>
          <ConfidenceChip className="mt-2" figure={figure(d.cards.enrolled)} />
        </Card>
        <Card title={t('CAPACITY.cards.activities')}>
          <dl className="space-y-1">
            {CAP_ACTIVITIES.map((a) => (
              <div key={a} className="flex justify-between"><dt>{act[a]}</dt><dd className="tabular">{fmt(d.cards.activities[a])}</dd></div>
            ))}
          </dl>
        </Card>
        <Card title={t('CAPACITY.cards.shifts')}>
          <dl className="space-y-1">
            <div className="flex justify-between"><dt>{t('CAPACITY.cards.shiftCount')}</dt><dd className="tabular">{fmt(d.cards.shifts)}</dd></div>
            <div className="flex justify-between"><dt>{t('CAPACITY.cards.hours')}</dt><dd className="tabular">{fmt(d.cards.hours)}</dd></div>
          </dl>
        </Card>
        {prep ? (
          <Card title={t('CAPACITY.cards.disruption')}>
            <p className="text-figure tabular">{fmt(d.cards.affectedVisits)}</p>
            <p className="text-small text-text-secondary">{t('CAPACITY.cards.affectedVisits')}</p>
          </Card>
        ) : null}
      </div>
      <section>
        <SectionHeading>{t('CAPACITY.columns.role')}</SectionHeading>
        <table className="w-full border-collapse text-body">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="h-8 border-b border-border px-2 font-normal">{t('CAPACITY.columns.role')}</th>
              <th className="h-8 border-b border-border px-2 font-normal">{t('CAPACITY.columns.shift')}</th>
              {CAP_ACTIVITIES.map((a) => (
                <th key={a} className="h-8 border-b border-border px-2 text-right font-normal">{act[a]}</th>
              ))}
              <th className="h-8 border-b border-border px-2 text-right font-normal">{t('CAPACITY.columns.shifts')}</th>
              <th className="h-8 border-b border-border px-2 text-right font-normal">{t('CAPACITY.columns.hours')}</th>
              {prep ? <th className="h-8 border-b border-border px-2 font-normal" /> : null}
            </tr>
          </thead>
          <tbody>
            {CAP_PROFESSIONS.flatMap((pr) => CAP_SHIFTS.map((sh) => d.rows.find((r) => r.profession === pr && r.shift === sh)!)).map((r) => (
              <tr key={`${r.profession}-${r.shift}`} className="hover:bg-bg-muted">
                <td className="h-10 border-b border-border px-2">{prof[r.profession]}</td>
                <td className="h-10 border-b border-border px-2">{shiftName[r.shift]}</td>
                {CAP_ACTIVITIES.map((a) => (
                  <td key={a} className="h-10 border-b border-border px-2 text-right tabular">{fmt(r.visits[a])}</td>
                ))}
                <td className="h-10 border-b border-border px-2 text-right tabular">{fmt(r.shifts)}</td>
                <td className="h-10 border-b border-border px-2 text-right tabular">{fmt(r.hours)}</td>
                {prep ? (
                  <td className="h-10 border-b border-border px-2 text-small text-text-secondary">
                    {r.affected > 0 ? t('CAPACITY.affected', { n: r.affected }) : null}
                    {r.extraMin > 0 ? <span className="block">{t('CAPACITY.extra', { min: r.extraMin })}</span> : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-small text-text-muted">{t('CAPACITY.note')}</p>
      </section>
    </div>
  );
}
