import { describe, expect, it } from 'vitest';
import { SUS_PACK as pack } from '@/test/packs';
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
    expect(positions.get('zone:lund')).toEqual([55.706, 13.192]);
    expect(positions.get('suslund')).toEqual([sites[0].lat, sites[0].lng]);
    expect(positions.get('susmalmo')).toEqual([sites[1].lat, sites[1].lng]);
  });

  it('ends an off-map arrow in its direction and fans out arrows that share a node and direction', () => {
    const from: [number, number] = [55.4, 13.1];
    expect(offmapEnd(from, 'N', 0, 1)[0]).toBeGreaterThan(from[0]);
    expect(offmapEnd(from, 'S', 0, 1)[0]).toBeLessThan(from[0]);
    expect(offmapEnd(from, 'E', 0, 1)[1]).toBeGreaterThan(from[1]);
    expect(offmapEnd(from, 'W', 0, 1)[1]).toBeLessThan(from[1]);
    // In the SUS pack no two arrows leave one node the same way (Hurva has one north and one south): each is alone in its group.
    const slots = offmapSlots(pack.infraLinks);
    expect(slots.get('el-hurva-sydvastlanken')).toEqual({ k: 0, n: 1 });
    expect(slots.get('el-hurva-hansa')).toEqual({ k: 0, n: 1 });
    expect(slots.get('el-barseback-soderasen')).toEqual({ k: 0, n: 1 });
    expect(slots.get('wl-ringsjo-bolmen')).toEqual({ k: 0, n: 1 });
    // Two arrows that do share a node and a direction are numbered in order.
    const north = pack.infraLinks.find((l) => l.id === 'el-hurva-sydvastlanken')!;
    const shared = offmapSlots([north, { ...north, id: 'second' }]);
    expect(shared.get('el-hurva-sydvastlanken')).toEqual({ k: 0, n: 2 });
    expect(shared.get('second')).toEqual({ k: 1, n: 2 });
    expect(offmapEnd(from, 'N', 0, 2)[1]).not.toBe(offmapEnd(from, 'N', 1, 2)[1]);
  });

  it('draws unverified, dashed and dotted links as schematic and verified solid ones as solid', () => {
    const byId = (id: string) => pack.infraLinks.find((l) => l.id === id)!;
    expect(isSchematic(byId('wl-ringsjo-kallby'))).toBe(true); // verified but dashed
    expect(isSchematic(byId('wl-ringsjon-ringsjo'))).toBe(true); // verified but dotted
    expect(isSchematic(byId('el-regionnat-site'))).toBe(true); // unverified
    expect(isSchematic(byId('el-hurva-hansa'))).toBe(true); // unverified and dashed
    expect(isSchematic(byId('el-hurva-sydvastlanken'))).toBe(false);
    expect(isSchematic(byId('el-barseback-soderasen'))).toBe(false);
    expect(isSchematic(byId('wl-ringsjo-bolmen'))).toBe(false);
  });
});
