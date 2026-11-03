import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { explainRow } from '@/lib/explain';
import type { ImpactRow } from '@/lib/reachability';

/** The explanation chain of an affected row as a short timeline (SPEC.md § 6): each step carries its source or assumption. */
export function ExplanationChain({ row }: { row: ImpactRow }) {
  const pack = useStore((s) => s.pack);
  const home = useStore((s) => s.home);
  const clock = useStore((s) => s.clock);
  const steps = explainRow(row, pack, home, clock);
  if (steps.length === 0) return null;
  return (
    <section aria-label={t('HOME.chain.title')} className="space-y-1 pt-2">
      <h4 className="text-small font-medium text-text-secondary">{t('HOME.chain.title')}</h4>
      <ol className="space-y-0.5 border-l border-border pl-3 text-small">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </section>
  );
}
