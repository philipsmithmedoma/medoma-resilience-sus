// Confidence of figures (SPEC.md § 3, DATA.md § 1).
import type { Confidence, Figure } from '@/data/types';

const RANK: Record<Confidence, number> = { verified: 0, reported: 1, estimate: 2, illustrative: 3 };

/** The weakest of several confidences: a sum takes the weakest confidence of its parts. */
export function weakest(...confidences: Confidence[]): Confidence {
  return confidences.reduce<Confidence>((a, b) => (RANK[b] > RANK[a] ? b : a), 'verified');
}

/** Sum several figures into one aggregate with the weakest confidence; null parts make the sum null. */
export function sumFigures(figures: Figure[]): Figure | undefined {
  if (figures.length === 0) return undefined;
  const anyNull = figures.some((f) => f.value === null);
  const sources = [...new Set(figures.map((f) => f.source).filter(Boolean))] as string[];
  return {
    value: anyNull ? null : figures.reduce((n, f) => n + (f.value ?? 0), 0),
    confidence: weakest(...figures.map((f) => f.confidence)),
    source: sources.length === 1 ? sources[0] : undefined,
    basis: figures.length > 1 ? 'summa av delar; svagaste klass' : figures[0].basis,
  };
}
