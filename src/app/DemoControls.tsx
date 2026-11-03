import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { formatClock } from '@/lib/time';

/** The Demo popover: reset and the demo clock line. */
export function DemoControls() {
  const clock = useStore((s) => s.clock);
  const reset = useStore((s) => s.reset);
  const navigate = useNavigate();

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
        <p className="text-small text-text-secondary">{t('LABELS.demoClock', { hhmm: formatClock(clock), date: t('LABELS.demoDate') })}</p>
      </PopoverContent>
    </Popover>
  );
}
