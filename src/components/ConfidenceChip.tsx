import type { Figure } from '@/data/types';
import { toneOf } from '@/data/vocab';
import { t, tm } from '@/lib/i18n';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Chip } from './Chip';
import { HOME_PACK_IDS, homePacks } from '@/data/packs/home-packs';

interface ConfidenceChipProps {
  figure: Figure;
  /** Show a small "Källa S5" link for verified figures (which have no chip by default). */
  showSource?: boolean;
  className?: string;
}

/**
 * DESIGN-KS.md § 4: verified → no chip; reported → grey "Uppgift"; estimate → warning "Estimat";
 * illustrative → grey "Illustrativt". Clicking opens a
 * popover with the meaning, source, basis and a link "Visa i Källor".
 */
export function ConfidenceChip({ figure, showSource = false, className }: ConfidenceChipProps) {
  const label = tm('CONFIDENCE_CHIPS')[figure.confidence];
  if (!label) {
    if (!showSource || !figure.source) return null;
    return (
      <ConfidencePopover figure={figure}>
        <button type="button" className={`text-small text-text-muted hover:text-primary-text hover:underline ${className ?? ''}`}>
          {t('CONFIDENCE_TEXT.source')} {figure.source}
        </button>
      </ConfidencePopover>
    );
  }
  return (
    <ConfidencePopover figure={figure}>
      <button type="button" className={`rounded-full ${className ?? ''}`} aria-label={`${label}: ${tm('CONFIDENCE_TEXT')[figure.confidence]}`}>
        <Chip tone={toneOf(figure.confidence)}>{label}</Chip>
      </button>
    </ConfidencePopover>
  );
}

export function ConfidencePopover({ figure, children }: { figure: Figure; children: React.ReactNode }) {
  const sources = HOME_PACK_IDS.flatMap((id) => homePacks[id].sources);
  const source = figure.source ? sources.find((s) => s.key === figure.source) : undefined;
  const text = tm('CONFIDENCE_TEXT')[figure.confidence];
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2 text-body">
        <p className="font-medium">{text}</p>
        {source ? (
          <p className="text-small text-text-secondary">
            {source.key}: {source.name}, {source.date}.{' '}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer" className="text-primary-text hover:underline">
                {t('CONFIDENCE_TEXT.openSource')}
              </a>
            ) : null}
          </p>
        ) : null}
        {figure.basis ? (
          <p className="text-small text-text-secondary">
            {t('CONFIDENCE_TEXT.basis')}: {figure.basis}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
