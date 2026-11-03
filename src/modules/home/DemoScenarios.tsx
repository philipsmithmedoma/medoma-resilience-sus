import { toast } from 'sonner';
import { useStore } from '@/data/store';
import { lt, t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/PageTitle';

/** Three buttons "Demoscenario" in the panel (SPEC.md § 6): each replaces the disruptions with the pack's preset (bridges, power, water). */
export function DemoScenarios() {
  const presets = useStore((s) => s.pack.homePresets);
  const applyHomePreset = useStore((s) => s.applyHomePreset);
  return (
    <section className="space-y-3 border-t border-border px-4 py-4" aria-label={t('HOME.demo.title')}>
      <SectionHeading>{t('HOME.demo.title')}</SectionHeading>
      <p className="text-small text-text-secondary">{t('HOME.demo.intro')}</p>
      <ul className="space-y-3">
        {presets.map((p) => (
          <li key={p.key} className="space-y-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                applyHomePreset(p.key);
                toast(t('HOME.demo.applied'));
              }}
            >
              {lt(p.name)}
            </Button>
            <p className="text-small text-text-secondary">{lt(p.description)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
