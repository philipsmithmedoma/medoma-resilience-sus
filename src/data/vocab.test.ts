import { describe, expect, it } from 'vitest';
import { en, sv } from './vocab';

/** Every dotted leaf path of a table, with its value. */
function leaves(value: unknown, path = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      for (const [p, leaf] of leaves(v, path ? `${path}.${k}` : k)) out.set(p, leaf);
    }
    return out;
  }
  out.set(path, value);
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]).sort();

describe('vocab tables (DESIGN-LANG.md § 1)', () => {
  const svLeaves = leaves(sv);
  const enLeaves = leaves(en);

  it('sv and en have identical key sets in both directions', () => {
    const missingInEn = [...svLeaves.keys()].filter((k) => !enLeaves.has(k));
    const extraInEn = [...enLeaves.keys()].filter((k) => !svLeaves.has(k));
    expect(missingInEn).toEqual([]);
    expect(extraInEn).toEqual([]);
  });

  it('every leaf is a string or number and every string has the same placeholders in both languages', () => {
    for (const [k, v] of svLeaves) {
      expect(typeof v === 'string' || typeof v === 'number', k).toBe(true);
      const e = enLeaves.get(k);
      expect(typeof e, k).toBe(typeof v);
      if (typeof v === 'string' && typeof e === 'string') expect(placeholders(e), k).toEqual(placeholders(v));
    }
  });

  it('nothing is empty in either language besides the verified chip', () => {
    const emptySv = [...svLeaves].filter(([, v]) => v === '').map(([k]) => k);
    const emptyEn = [...enLeaves].filter(([, v]) => v === '').map(([k]) => k);
    expect(emptySv).toEqual(['CONFIDENCE_CHIPS.verified']);
    expect(emptyEn).toEqual(['CONFIDENCE_CHIPS.verified']);
  });

  it('plural keys come in _one/_other pairs', () => {
    for (const k of svLeaves.keys()) {
      if (k.endsWith('_one')) expect(svLeaves.has(k.replace(/_one$/, '_other')), k).toBe(true);
      if (k.endsWith('_other')) expect(svLeaves.has(k.replace(/_other$/, '_one')), k).toBe(true);
    }
  });

  it('module names follow DESIGN-LANG.md § 3', () => {
    expect(en.MODULES).toMatchObject({ home: 'Hospital at Home', incident: 'Incident', patients: 'Patients', planning: 'Planning' });
    expect(en.LAGE_LABELS.Stabsläge).toBe('Staff mode (stabsläge)');
  });
});
