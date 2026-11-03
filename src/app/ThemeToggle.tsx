import { MoonIcon, SunIcon } from 'lucide-react';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/** DESIGN-DARK.md § 1 – icon button in the nav: moon in light mode ("Mörkt läge"), sun in dark mode ("Ljust läge"). */
export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggleTheme);
  const label = theme === 'dark' ? t('LABELS.lightMode') : t('LABELS.darkMode');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} onClick={toggleTheme} className="flex size-7 items-center justify-center rounded-md text-text hover:bg-bg-muted group-data-[prep=true]:size-6">
          {theme === 'dark' ? <SunIcon className="size-5" strokeWidth={1.5} aria-hidden /> : <MoonIcon className="size-5" strokeWidth={1.5} aria-hidden />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
