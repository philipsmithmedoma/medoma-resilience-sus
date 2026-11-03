// Number, percent, duration and date formatting by locale (DESIGN-KS.md § 1, DESIGN-LANG.md § 2):
// Intl.NumberFormat('sv-SE') → "16 500", "95,6 %"; Intl.NumberFormat('en-GB') → "16,500", "95.6%".
import { getLocale, localeTag, t, type Locale } from '@/lib/i18n';

const formatters = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: Locale, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const cacheKey = `${locale}:${JSON.stringify(options)}`;
  let f = formatters.get(cacheKey);
  if (!f) {
    f = new Intl.NumberFormat(localeTag(locale), options);
    formatters.set(cacheKey, f);
  }
  return f;
}

/** Whole number with the locale's thousands separator (16 500 / 16,500). */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return t('LABELS.unknown');
  return numberFormat(getLocale(), { maximumFractionDigits: 0 }).format(n);
}

/** Number with one decimal (1,3 / 1.3). */
export function fmt1(n: number): string {
  return numberFormat(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

/** Number with up to two decimals, no trailing zeros (1,3 or 0,75 / 1.3 or 0.75). */
export function fmtDec(n: number): string {
  return numberFormat(getLocale(), { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

/** Share 0–1 as a percentage: "95,6 %" in Swedish (no-break space before %), "95.6%" in English. */
export function fmtPct(share: number | null | undefined, decimals = 1): string {
  if (share === null || share === undefined || Number.isNaN(share)) return t('LABELS.unknown');
  const locale = getLocale();
  const value = numberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(share * 100);
  return locale === 'en' ? `${value}%` : `${value}\u00a0%`;
}

/** Duration in minutes as "3 h 10 min", "45 min" or "6 h" (the same in both languages). */
export function fmtDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest} min`;
  if (rest === 0) return `${h} h`;
  return `${h} h ${rest} min`;
}

/** Relative offset as "+30 min", "+2 h 15 min" or "dag 3" / "day 3". */
export function fmtOffset(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) return t('CLOCK.day', { n: minutes / 1440 });
  return `+${fmtDuration(minutes)}`;
}

/** Days as "10 dygn" / "10 days". */
export function fmtDays(days: number): string {
  return t('LABELS.days', { n: fmt(days) });
}

/** "{h} h {min} min" split for KPI strips. */
export function fmtHoursMinutes(minutes: number): string {
  return fmtDuration(minutes);
}
