// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ModeChips } from '@/modules/home/ModeChips';
import { sv, en } from './vocab';
import { useStore } from './store';

const SRC = join(__dirname, '..');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

// The name is built so that this file does not contain it.
const REMOVED_PACK = new RegExp(['karo', 'linska'].join(''), 'i');

describe('one organisation per environment (SPEC.md § 1)', () => {
  afterEach(cleanup);

  it('nothing in src/ refers to the removed second pack: no data, geometry, fixture, test, vocab key or id', () => {
    const hits = files(SRC).filter((p) => /\.(ts|tsx|json|md|css)$/.test(p) && REMOVED_PACK.test(`${p}\n${readFileSync(p, 'utf8')}`));
    expect(hits.map((p) => p.slice(SRC.length))).toEqual([]);
  });

  it('has no pack switch: no store action, no vocab key, no control in the Sjukhus hemma mode bar', () => {
    expect('setHomePack' in useStore.getState()).toBe(false);
    expect('packSwitch' in sv.HOME).toBe(false);
    expect('packSwitch' in en.HOME).toBe(false);
    const { container } = render(<ModeChips />);
    expect(container.querySelector('[role="radiogroup"], [role="tablist"]')).toBeNull();
    expect(container.textContent).not.toMatch(/SUS|Sjukhus$/);
  });
});
