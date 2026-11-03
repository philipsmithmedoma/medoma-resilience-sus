import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useStore } from '@/data/store';
import { lt, t } from '@/lib/i18n';
import { hypotheses } from '@/lib/signal';
import { formatClock } from '@/lib/time';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/PageTitle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Zones where the data says that something is wrong although nothing is registered (SPEC.md § 6, hypothesis). */
export function useHypotheses() {
  const pack = useStore((s) => s.pack);
  const home = useStore((s) => s.home);
  const clock = useStore((s) => s.clock);
  return useMemo(() => {
    const registered = new Set(home.disruptions.filter((d) => d.endedAt === null && d.targetKind === 'zone').map((d) => d.target));
    return hypotheses(pack.homePatients, pack.homeZones, { powerStart: home.powerStart, teleStart: home.teleStart, hiddenPower: home.hiddenPower }, registered, clock);
  }, [pack, home, clock]);
}

/** "Misstänkt störning i <zon>" with the buttons that register it; nothing is registered automatically. */
export function HypothesisCards() {
  const list = useHypotheses();
  const pack = useStore((s) => s.pack);
  const register = useStore((s) => s.registerHypothesis);
  if (list.length === 0) return null;
  return (
    <section className="space-y-3 border-t border-border bg-banner-orange-bg px-4 py-3" aria-label={t('HOME.hypothesis.asPower')}>
      {list.map((h) => {
        const zone = pack.homeZones.find((z) => z.id === h.zone)!;
        return (
          <div key={h.zone} className="space-y-1.5">
            <h3 className="text-body font-medium">{t('HOME.hypothesis.title', { zone: lt(zone.name) })}</h3>
            <p className="text-small">{t('HOME.hypothesis.body', { pct: Math.round(h.share * 100), hhmm: formatClock(h.firstSilentAt) })}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => register(h.zone, 'power')}>
                {t('HOME.hypothesis.asPower')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => register(h.zone, 'tele')}>
                {t('HOME.hypothesis.asTele')}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Registers the disruptions that have no map target: a tele disturbance in a zone and a supplier disruption. */
export function RegisterPanel() {
  const zones = useStore((s) => s.pack.homeZones);
  const startTele = useStore((s) => s.startTeleDisturbance);
  const startSupplier = useStore((s) => s.startSupplierDisruption);
  const [zone, setZone] = useState('');
  return (
    <section className="space-y-3 border-t border-border px-4 py-4" aria-label={t('HOME.register.title')}>
      <SectionHeading>{t('HOME.register.title')}</SectionHeading>
      <div className="flex items-center gap-2">
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={t('HOME.register.zone')}>
            <SelectValue placeholder={t('HOME.register.selectZone')} />
          </SelectTrigger>
          <SelectContent>
            {zones.map((z) => (
              <SelectItem key={z.id} value={z.id}>
                {lt(z.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="secondary"
          disabled={!zone}
          onClick={() => {
            toast(startTele(zone) ? t('HOME.register.done') : t('HOME.register.exists'));
            setZone('');
          }}
        >
          {t('HOME.register.tele')}
        </Button>
      </div>
      <div className="space-y-1">
        <Button size="sm" variant="secondary" onClick={() => toast(startSupplier() ? t('HOME.register.done') : t('HOME.register.exists'))}>
          {t('HOME.register.supplier')}
        </Button>
        <p className="text-small text-text-secondary">{t('HOME.register.supplierHint')}</p>
      </div>
    </section>
  );
}
