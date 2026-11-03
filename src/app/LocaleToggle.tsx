import { t, useI18n } from '@/lib/i18n';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** DESIGN-LANG.md § 1 – tertiary text button showing the other language's code: "EN" in Swedish mode, "SV" in English mode. */
export function LocaleToggle() {
  const toggleLocale = useI18n((s) => s.toggleLocale);
  const label = t('LABELS.switchLocale');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} onClick={toggleLocale} className="flex h-8 items-center rounded-md px-1.5 group-data-[prep=true]:px-1 text-[13px] leading-[18px] font-medium text-primary-text hover:bg-bg-muted">
          {t('LABELS.otherLocaleCode')}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
