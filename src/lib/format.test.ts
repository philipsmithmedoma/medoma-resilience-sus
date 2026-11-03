import { afterEach, describe, expect, it } from 'vitest';
import { fmt, fmtDays, fmtDec, fmtDuration, fmtOffset, fmtPct } from './format';
import { useI18n } from './i18n';
import { dayOf, formatClock } from './time';

const NBSP = '\u00a0';

afterEach(() => useI18n.getState().setLocale('sv'));

describe('Swedish formatting (DESIGN-KS.md § 1)', () => {
  it('groups thousands with a space and uses a decimal comma', () => {
    expect(fmt(16500)).toBe(`16${NBSP}500`);
    expect(fmt(1600)).toBe(`1${NBSP}600`);
    expect(fmt(32)).toBe('32');
    expect(fmt(null)).toBe('Okänt');
    expect(fmtDec(1.3)).toBe('1,3');
  });

  it('formats shares as percentages with a space before %', () => {
    expect(fmtPct(0.956)).toBe(`95,6${NBSP}%`);
    expect(fmtPct(0.34, 0)).toBe(`34${NBSP}%`);
  });

  it('formats durations and offsets', () => {
    expect(fmtDuration(190)).toBe('3 h 10 min');
    expect(fmtDuration(45)).toBe('45 min');
    expect(fmtDuration(360)).toBe('6 h');
    expect(fmtOffset(30)).toBe('+30 min');
    expect(fmtOffset(2880)).toBe('dag 2');
    expect(fmtDays(10)).toBe('10 dygn');
  });

  it('formats the clock across days', () => {
    expect(formatClock(880)).toBe('14:40');
    expect(formatClock(880 + 1440)).toBe('14:40');
    expect(dayOf(880)).toBe(1);
    expect(dayOf(880 + 1440)).toBe(2);
  });
});

describe('English formatting (DESIGN-LANG.md § 2)', () => {
  it('uses en-GB numbers, percent without a space and English day words', () => {
    useI18n.getState().setLocale('en');
    expect(fmt(16500)).toBe('16,500');
    expect(fmt(null)).toBe('Unknown');
    expect(fmtDec(1.3)).toBe('1.3');
    expect(fmtPct(0.956)).toBe('95.6%');
    expect(fmtDuration(190)).toBe('3 h 10 min');
    expect(fmtOffset(30)).toBe('+30 min');
    expect(fmtOffset(2880)).toBe('day 2');
    expect(fmtDays(10)).toBe('10 days');
  });
});
