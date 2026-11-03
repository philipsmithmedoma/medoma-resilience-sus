import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, sv } from './vocab';

const at = (table: unknown, path: string): unknown => path.split('.').reduce<unknown>((n, k) => (n !== null && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), table);
const ROOT = join(__dirname, '..');
const FILES = [
  'modules/home/PlanningPage.tsx',
  'modules/home/PatientsPage.tsx',
  'modules/home/PatientDetail.tsx',
  'modules/home/PatientActions.tsx',
  'modules/home/CallListPage.tsx',
  'modules/home/HomeMessagesTab.tsx',
  'components/LogDrawer.tsx',
  'components/HomeMapLayers.tsx',
  'data/store-home.ts',
];
const source = FILES.map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n');
const literal = (fn: string) => [...source.matchAll(new RegExp(`\\b${fn}\\(\\s*['\`]([A-Za-z0-9_.]+)['\`]`, 'g'))].map((m) => m[1]);
const keysOf = (o: unknown, prefix = ''): string[] =>
  o !== null && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? keysOf(v, `${prefix}${k}.`) : [`${prefix}${k}`])) : [];

describe('vocab parity for time, teams and Planning (SPEC.md § 14.6 batch 16)', () => {
  it('every key the new code passes to t() resolves to a string in sv and en', () => {
    const keys = [...new Set(literal('t'))];
    expect(keys.length).toBeGreaterThan(60);
    for (const k of keys) {
      expect(typeof at(sv, k), `sv ${k}`).toBe('string');
      expect(typeof at(en, k), `en ${k}`).toBe('string');
    }
  });

  it('plural bases and label maps used by the new code exist in both languages', () => {
    for (const base of new Set(literal('tn'))) for (const table of [sv, en]) expect(typeof at(table, `${base}_one`)).toBe('string');
    for (const branch of new Set(literal('tm'))) expect(Object.keys(at(en, branch) as object).sort(), branch).toEqual(Object.keys(at(sv, branch) as object).sort());
  });

  it('the HOME and AUDIT tables have the same keys in both languages, and no value is empty', () => {
    for (const table of ['HOME', 'AUDIT', 'EVAC']) {
      expect(keysOf(at(en, table)).sort(), table).toEqual(keysOf(at(sv, table)).sort());
    }
    for (const k of keysOf(at(sv, 'HOME'))) expect((at(sv, `HOME.${k}`) as string).length, k).toBeGreaterThan(0);
  });
});
