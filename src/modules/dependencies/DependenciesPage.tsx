import { useMemo } from 'react';
import { useStore } from '@/data/store';
import { t, tm } from '@/lib/i18n';
import { fmt, fmtDec } from '@/lib/format';
import { dependencyRows, type DepStatus } from '@/lib/dependencies';
import { PageTitle } from '@/components/PageTitle';
import { StatusChip } from '@/components/Chip';
import { useHomeGeo } from '@/modules/home/useHomeGeo';
import { useHomeImpact } from '@/modules/home/useHomeImpact';

function LoadRoadGraph() {
  useHomeGeo();
  return null;
}

const when = (min: number): string => {
  if (min >= 1440) return `${fmtDec(Math.round((min / 1440) * 10) / 10)} d`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
};

function Status({ status, centre }: { status: DepStatus; centre: string }) {
  if (status.kind === 'none') return <span className="text-text-secondary">{centre}</span>;
  if (status.kind === 'ok') return <StatusChip status="Ok" label={t('DEP.status.ok')} />;
  if (status.kind === 'soon') return <StatusChip status="Low" label={t('DEP.status.soon', { when: when(status.inMin) })} />;
  return <StatusChip status="Critical" label={t('DEP.status.affected')} />;
}

/** Beroenden (SPEC.md § 10): what falls when something breaks, computed from the active disruptions and the clock; texts and times from DATA.md § 6. */
export function DependenciesPage() {
  const pack = useStore((s) => s.pack);
  const home = useStore((s) => s.home);
  const clock = useStore((s) => s.clock);
  const { impact } = useHomeImpact();
  const rows = useMemo(() => dependencyRows({ pack, state: home, rows: impact.rows, clock }), [pack, home, impact, clock]);
  const text = tm('DEP.rows');
  const c = tm('DEP.columns');
  const keys = [...new Set(Object.values(text).flatMap((r) => (r.source ? r.source.split(', ') : [])).filter((s) => /^S-/.test(s)))].join(', ');
  return (
    <div className="space-y-4">
      <LoadRoadGraph />
      <PageTitle title={t('DEP.title')} />
      <p className="max-w-[860px] text-text-secondary">{t('DEP.intro')}</p>
      <table className="w-full border-collapse text-[14px] leading-5">
        <thead>
          <tr className="text-left text-text-secondary">
            {[c.fn, c.dependsOn, c.failsAt, c.after, c.fallback, c.status, c.patients].map((h) => (
              <th key={h} className="border-b border-border px-2 py-2 align-bottom font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const x = text[r.key as keyof typeof text];
            return (
              <tr key={r.key} className="align-top hover:bg-bg-muted">
                <td className="border-b border-border px-2 py-2 font-medium">{x.fn}</td>
                <td className="border-b border-border px-2 py-2">{x.dependsOn}</td>
                <td className="border-b border-border px-2 py-2">{x.failsAt}</td>
                <td className="border-b border-border px-2 py-2">{x.after}{x.source ? <span className="block text-small text-text-muted">{x.source}</span> : null}</td>
                <td className="border-b border-border px-2 py-2">{x.fallback}</td>
                <td className="border-b border-border px-2 py-2 whitespace-nowrap">
                  <Status status={r.status} centre={(text.medomaCenter as { status: string }).status} />
                </td>
                <td className="border-b border-border px-2 py-2 tabular">{r.status.kind === 'none' ? '' : r.patients === null ? <span className="text-text-muted">{t('DEP.cannotCount')}</span> : fmt(r.patients)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-small text-text-muted">{t('DEP.sources', { keys })}</p>
    </div>
  );
}
