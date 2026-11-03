import { beforeAll, describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { loadGeoData, type GeoData } from '@/lib/geoData';
import { homeFitPoints } from '@/lib/home-geo';

let geo: GeoData;
beforeAll(async () => {
  geo = await loadGeoData();
});

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => Math.hypot((bLat - aLat) * 111.32, (bLng - aLng) * 111.32 * Math.cos((aLat * Math.PI) / 180));

describe('patients on streets (SPEC.md § 12.5)', () => {
  it('gives every patient a street and a house number of 1–60', () => {
    for (const p of pack.homePatients) {
      expect(p.street.length, p.id).toBeGreaterThan(0);
      expect(Number.isInteger(p.houseNo) && p.houseNo >= 1 && p.houseNo <= 60, p.id).toBe(true);
    }
  });

  it('puts all 150 on a vertex of a street of that name within the zone radius', () => {
    expect(pack.homePatients).toHaveLength(150);
    const streets = geo.streets.features;
    for (const p of pack.homePatients) {
      const zone = pack.homeZones.find((z) => z.id === p.zone)!;
      expect(km(zone.lat, zone.lng, p.lat, p.lng), p.id).toBeLessThanOrEqual(zone.radiusKm);
      const onStreet = streets.some((s) => s.properties.name === p.street && s.geometry.coordinates.some(([lng, lat]) => lat === p.lat && lng === p.lng));
      expect(onStreet, `${p.id} on ${p.street}`).toBe(true);
    }
  });

  it('places each patient in the zone whose centre is nearest, so that no patient lives in a neighbouring zone', () => {
    for (const p of pack.homePatients) {
      const own = pack.homeZones.find((z) => z.id === p.zone)!;
      for (const z of pack.homeZones) expect(km(p.lat, p.lng, own.lat, own.lng), `${p.id} vs ${z.id}`).toBeLessThanOrEqual(km(p.lat, p.lng, z.lat, z.lng) + 1e-6);
    }
  });

  it('keeps the attributes the earlier tests pin: 20 Huddinge patients, a visit share and el-critical patients', () => {
    expect(pack.homePatients.filter((p) => p.zone === 'huddinge')).toHaveLength(20);
    expect(pack.homePatients.filter((p) => p.visitToday)).toHaveLength(66);
    expect(pack.homePatients.filter((p) => p.zone === 'huddinge' && p.elCritical).map((p) => p.batteryHours)).toContain(4);
  });
});

describe('the map fits the zones (SPEC.md § 12.6 batch 9)', () => {
  it('fits the box around every zone circle and nothing else', () => {
    const pts = homeFitPoints({ zones: pack.homeZones });
    expect(pts).toHaveLength(pack.homeZones.length * 2);
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    for (const z of pack.homeZones) {
      expect(Math.min(...lats)).toBeLessThanOrEqual(z.lat - z.radiusKm / 111.32 + 1e-9);
      expect(Math.max(...lats)).toBeGreaterThanOrEqual(z.lat + z.radiusKm / 111.32 - 1e-9);
      expect(Math.min(...lngs)).toBeLessThanOrEqual(z.lng);
      expect(Math.max(...lngs)).toBeGreaterThanOrEqual(z.lng);
    }
    // Täby is the northernmost zone, Botkyrka the southernmost.
    expect(Math.max(...lats)).toBeCloseTo(59.4451 + 2.5 / 111.32, 4);
    expect(Math.min(...lats)).toBeCloseTo(59.1988 - 2.5 / 111.32, 4);
  });
});
