import { describe, expect, it } from 'vitest';
import { sumFigures, weakest } from './figure';

describe('sumFigures and weakest (DATA.md § 1)', () => {
  it('sums values and takes the weakest confidence', () => {
    const s = sumFigures([
      { value: 10, confidence: 'verified', source: 'S-L1' },
      { value: 5, confidence: 'illustrative', source: 'S-L1' },
    ])!;
    expect(s.value).toBe(15);
    expect(s.confidence).toBe('illustrative');
    expect(s.source).toBe('S-L1');
    expect(weakest('verified', 'reported', 'estimate')).toBe('estimate');
  });

  it('a null part makes the sum unknown', () => {
    const s = sumFigures([{ value: 5, confidence: 'verified' }, { value: null, confidence: 'verified' }])!;
    expect(s.value).toBeNull();
  });
});
