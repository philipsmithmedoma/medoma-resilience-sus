// Clock helpers. The clock is minutes since 00:00 of the demo day; days beyond it keep counting (SPEC.md § 6).
// One logged user action advances it one minute; the "+1 h" control advances it 60.

export const INITIAL_CLOCK = 14 * 60 + 40;
export const DAY_MIN = 1440;

export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Day number of the demo (1 = fredag 4 september). */
export function dayOf(minutes: number): number {
  return Math.floor(minutes / 1440) + 1;
}

export function parseClock(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return Number.NaN;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return Number.NaN;
  return h * 60 + m;
}

export function isValidClock(hhmm: string): boolean {
  return !Number.isNaN(parseClock(hhmm));
}
