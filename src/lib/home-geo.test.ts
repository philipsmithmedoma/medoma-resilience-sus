import { describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { homeSiteNodes } from './home-sites';
import { isSchematic, offmapEnd, offmapSlots, vertexPositions } from './home-geo';

describe('home geometry (SPEC.md § 11.5–11.6)', () => {
  const sites = homeSiteNodes(pack.homePackId);
  const positions = vertexPositions(sites, pack.homeZones, pack.infraNodes);

  it('places every link endpoint on the map', () => {
    for (const l of pack.infraLinks) {
      expect(positions.has(l.a), `${l.id}: ${l.a}`).toBe(true);
      expect(positions.has(l.b), `${l.id}: ${l.b}`).toBe(true);
    }
    expect(positions.get('zone:solna')).toEqual([59.3597, 18.0005]);
    expect(positions.get('solna')).toEqual([sites[0].lat, sites[0].lng]);
  });

  it('ends an off-map arrow in its direction and fans out arrows that share a node and direction', () => {
    const from: [number, number] = [59.4757, 17.8844];
    expect(offmapEnd(from, 'N', 0, 1)[0]).toBeGreaterThan(from[0]);
    expect(offmapEnd(from, 'S', 0, 1)[0]).toBeLessThan(from[0]);
    expect(offmapEnd(from, 'E', 0, 1)[1]).toBeGreaterThan(from[1]);
    expect(offmapEnd(from, 'W', 0, 1)[1]).toBeLessThan(from[1]);
    const slots = offmapSlots(pack.infraLinks);
    expect(slots.get('el-overby-hamra')).toEqual({ k: 0, n: 2 });
    expect(slots.get('el-overby-odensala')).toEqual({ k: 1, n: 2 });
    expect(slots.get('el-hagby-odensala')).toEqual({ k: 0, n: 1 });
    expect(offmapEnd(from, 'N', 0, 2)[1]).not.toBe(offmapEnd(from, 'N', 1, 2)[1]);
  });

  it('draws unverified, dashed and dotted links as schematic and verified solid ones as solid', () => {
    const byId = (id: string) => pack.infraLinks.find((l) => l.id === id)!;
    expect(isSchematic(byId('wl-gorvaln-solna'))).toBe(true);
    expect(isSchematic(byId('el-overby-hamra'))).toBe(false);
    expect(isSchematic(byId('el-hagby-odensala'))).toBe(false);
    expect(isSchematic(byId('el-regionnat-solna'))).toBe(true);
  });
});
