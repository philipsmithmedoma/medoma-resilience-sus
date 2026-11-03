import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStore } from '@/data/store';
import { useState } from 'react';
import { lt, t } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatClock } from '@/lib/time';

/** The Demo popover: reset and the demo clock line. */
export function DemoControls() {
  const clock = useStore((s) => s.clock);
  const reset = useStore((s) => s.reset);
  const navigate = useNavigate();
  const zones = useStore((s) => s.pack.homeZones);
  const startHiddenOutage = useStore((s) => s.startHiddenOutage);
  const hidden = useStore((s) => s.home.hiddenPower);
  const [zone, setZone] = useState('');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="group-data-[prep=true]:px-2">
          {t('LABELS.demo')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <Button
          variant="secondary"
          onClick={() => {
            reset();
            navigate('/');
            toast(t('LABELS.demoReset'));
          }}
        >
          {t('LABELS.resetDemo')}
        </Button>
        <div className="space-y-2 border-t border-border pt-3">
          <p className="font-medium">{t('HOME.demo.hidden')}</p>
          <p className="text-small text-text-secondary">{t('HOME.demo.hiddenHint')}</p>
          <div className="flex items-center gap-2">
            <Select value={zone} onValueChange={setZone}>
              <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={t('HOME.register.zone')}>
                <SelectValue placeholder={t('HOME.register.selectZone')} />
              </SelectTrigger>
              <SelectContent>
                {zones.filter((z) => !hidden.has(z.id)).map((z) => (
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
                startHiddenOutage(zone);
                setZone('');
                toast(t('HOME.demo.hiddenStarted'));
              }}
            >
              {t('HOME.demo.hiddenStart')}
            </Button>
          </div>
        </div>
        <p className="text-small text-text-secondary">{t('LABELS.demoClock', { hhmm: formatClock(clock), date: t('LABELS.demoDate') })}</p>
      </PopoverContent>
    </Popover>
  );
}
