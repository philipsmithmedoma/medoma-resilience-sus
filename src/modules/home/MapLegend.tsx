import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

function Swatch({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <li className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-flex h-4 w-8 items-center justify-center">
        {children}
      </span>
      <span>{label}</span>
    </li>
  );
}

const line = (extra: string) => cn('block w-8 border-t-2 border-text-secondary', extra);

/** Legend under the map (SPEC.md § 11.6). */
export function MapLegend({ className }: { className?: string }) {
  return (
    <ul aria-label={t('HOME.legend.title')} className={cn('flex flex-wrap items-center gap-x-5 gap-y-1 text-small text-text-secondary', className)}>
      <Swatch label={t('HOME.legend.patient')}>
        <span className="size-1.5 rounded-full bg-text-muted opacity-60" />
      </Swatch>
      <Swatch label={t('HOME.legend.affected')}>
        <span className="size-2 rounded-full bg-red" />
      </Swatch>
      <Swatch label={t('HOME.legend.critical')}>
        <span className="size-2.5 rounded-full border-2 border-red" />
      </Swatch>
      <Swatch label={t('HOME.legend.detour')}>
        <span className="size-2 rounded-full bg-orange" />
      </Swatch>
      <Swatch label={t('HOME.legend.verifiedLink')}>
        <span className={line('border-solid')} />
      </Swatch>
      <Swatch label={t('HOME.legend.schematicLink')}>
        <span className={line('border-dashed')} />
      </Swatch>
      <Swatch label={t('HOME.legend.bridge')}>
        <span className="size-3.5 rounded-[3px] border-2 border-text-secondary bg-text-secondary" />
      </Swatch>
      <Swatch label={t('HOME.legend.unverifiedNode')}>
        <span className="flex size-3.5 items-center justify-center rounded-full border-2 border-text-secondary bg-surface text-[10px] leading-none font-semibold text-text-secondary">?</span>
      </Swatch>
    </ul>
  );
}
