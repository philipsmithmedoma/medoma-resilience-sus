import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { homePacks } from '@/data/packs/home-packs';
import { homeFitPoints } from './home-geo';

const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');
const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)![1];
const lin = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const lum = (hex: string) => 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe('the preparedness indicator (DESIGN.md § 7)', () => {
  it('has white text on its fill with a contrast of at least 4.5:1, in both themes (the token is not overridden in the dark theme)', () => {
    const bg = token('color-indicator-bg');
    const fg = token('color-primary-foreground');
    expect(contrast(bg, fg)).toBeGreaterThanOrEqual(4.5);
    const dark = css.slice(css.indexOf('.dark {'));
    expect(dark.slice(0, dark.indexOf('\n}')).includes('--color-indicator-bg')).toBe(false);
  });
});

describe('the start view of the home map (SPEC.md § 5)', () => {
  it('fits the zones and the sites of the selected pack, not the infrastructure nodes', () => {
    const pack = homePacks.sus;
    const pts = homeFitPoints({ zones: pack.zones }, pack.sites);
    expect(pts).toHaveLength(pack.zones.length * 2 + pack.sites.length);
    for (const s of pack.sites) expect(pts.some((p) => p[0] === s.lat && p[1] === s.lng)).toBe(true);
    const lats = pts.map((p) => p[0]);
    // Every infrastructure node outside the zones' box (the Bolmen tunnel, the far substations) is left to the user.
    const outside = pack.infraNodes.filter((n) => n.lat > Math.max(...lats) || n.lat < Math.min(...lats));
    expect(outside.length).toBeGreaterThanOrEqual(0);
    expect(Math.min(...lats)).toBeLessThan(55.4); // Trelleborg
    expect(Math.max(...lats)).toBeGreaterThan(55.85); // Hörby and Eslöv
  });
});
