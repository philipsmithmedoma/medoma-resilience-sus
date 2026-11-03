import { describe, expect, it } from 'vitest';
import { SUS_PACK } from '@/test/packs';
import { FALL_OTHER_MIN, FALL_URBAN_MIN, contactAtOrBefore, deviceEvents, hypotheses, networkDownAt, realtimeOf, silentTooLong } from './signal';

const zone = (id: string) => SUS_PACK.homeZones.find((z) => z.id === id)!;
const patientIn = (id: string) => SUS_PACK.homePatients.find((p) => p.zone === id)!;
const at = (h: number, m: number) => h * 60 + m;

describe('the mobile network (SPEC.md § 6)', () => {
  it('falls 1 h after a power outage begins in an urban zone and 4 h after in other zones', () => {
    const start = at(14, 2);
    expect(zone('rosengard').urban).toBe(true);
    expect(networkDownAt(zone('rosengard'), { powerStart: new Map([['rosengard', start]]) })).toBe(start + FALL_URBAN_MIN);
    expect(networkDownAt(zone('dalby'), { powerStart: new Map([['dalby', start]]) })).toBe(start + FALL_OTHER_MIN);
    expect(networkDownAt(zone('dalby'), {})).toBeNull();
  });

  it('is taken down at once by a tele disturbance, and by the earliest of several causes', () => {
    expect(networkDownAt(zone('dalby'), { teleStart: new Map([['dalby', 900]]), powerStart: new Map([['dalby', 800]]) })).toBe(900);
    expect(networkDownAt(zone('dalby'), { teleStart: new Map([['dalby', 1500]]), powerStart: new Map([['dalby', 800]]) })).toBe(800 + FALL_OTHER_MIN);
  });
});

describe('the simulated realtime fields (SPEC.md § 6, § 7)', () => {
  const p = patientIn('rosengard');
  const z = zone('rosengard');

  it('has contact every 5 minutes on a per-patient phase, never newer than the clock', () => {
    for (let t = at(14, 0); t < at(14, 30); t++) {
      const last = contactAtOrBefore(p, t);
      expect(last).toBeLessThanOrEqual(t);
      expect(t - last).toBeLessThan(5);
      expect(last % 5).toBe(contactAtOrBefore(p, at(14, 0)) % 5);
    }
  });

  it('drains the hub 4 % and the phone 6 % an hour from the last charge at 07:00 and 22:00', () => {
    const rt = realtimeOf(p, z, {}, at(14, 0)); // seven hours after the charge at 07:00
    expect(rt.hubBatteryPct).toBe(72);
    expect(rt.phoneBatteryPct).toBe(58);
    const evening = realtimeOf(p, z, {}, at(21, 59));
    expect([evening.hubBatteryPct, evening.phoneBatteryPct]).toEqual([40, 10]);
    const after = realtimeOf(p, z, {}, at(22, 30)); // charged at 22:00
    expect(after.hubBatteryPct).toBeGreaterThan(95);
  });

  it('stops charging in a power outage and stops updating the contact when the network has fallen', () => {
    const start = at(21, 0);
    const state = { powerStart: new Map([['rosengard', start]]) };
    const before = realtimeOf(p, z, state, at(21, 30));
    expect(before.noContact).toBe(false);
    const dark = realtimeOf(p, z, state, at(23, 30)); // the network fell 22:00; no charge at 22:00
    expect(dark.noContact).toBe(true);
    expect(dark.lastContactAt).toBeLessThanOrEqual(at(22, 0));
    expect(dark.lastContactAt).toBeGreaterThan(at(22, 0) - 5);
    expect(dark.hubBatteryPct).toBe(100 - 4 * (at(23, 30) - at(7, 0)) / 60 > 0 ? Math.round(100 - 4 * (at(23, 30) - at(7, 0)) / 60) : 0);
    expect(realtimeOf(p, z, state, at(23, 55)).lastContactAt).toBe(dark.lastContactAt);
    // After the outage ends the registered state is empty again: contact and charge resume.
    expect(realtimeOf(p, z, {}, at(23, 55)).noContact).toBe(false);
  });

  it('has a pump change every 24 h for pump patients only and a daily measurement for spot patients', () => {
    const pump = SUS_PACK.homePatients.find((x) => x.equipment.includes('Pump'))!;
    const a = realtimeOf(pump, zone(pump.zone), {}, at(14, 40)).pumpNextChangeAt!;
    expect(a).toBeGreaterThan(at(14, 40));
    expect(a - at(14, 40)).toBeLessThanOrEqual(1440);
    expect(realtimeOf(pump, zone(pump.zone), {}, a + 1).pumpNextChangeAt).toBe(a + 1440);
    expect(realtimeOf(p, z, {}, at(14, 40)).pumpNextChangeAt).toBeNull();
    const spot = SUS_PACK.homePatients.find((x) => x.monitoringLevel === 'spot')!;
    expect(realtimeOf(spot, zone(spot.zone), {}, at(14, 40)).lastMeasurementAt).toBeLessThanOrEqual(at(11, 0));
  });

  it('is red after 30 minutes without contact for continuous, 4 h for spot and never for none', () => {
    const rt = { lastContactAt: 1000 };
    expect(silentTooLong({ monitoringLevel: 'continuous' }, rt, 1030)).toBe(false);
    expect(silentTooLong({ monitoringLevel: 'continuous' }, rt, 1031)).toBe(true);
    expect(silentTooLong({ monitoringLevel: 'spot' }, rt, 1000 + 240)).toBe(false);
    expect(silentTooLong({ monitoringLevel: 'spot' }, rt, 1000 + 241)).toBe(true);
    expect(silentTooLong({ monitoringLevel: 'none' }, rt, 99999)).toBe(false);
  });

  it('produces the device events of SPEC.md § 7: hub and phone for everyone, a sensor for a kit', () => {
    const kit = SUS_PACK.homePatients.find((x) => x.equipment.includes('Self-monitoring kit'))!;
    const ev = deviceEvents(kit, realtimeOf(kit, zone(kit.zone), {}, at(14, 40)));
    expect(ev.map((e) => e.kind)).toEqual(['hub', 'phone', 'sensor']);
    expect(ev.every((e) => e.patientId === kit.id && e.deviceId.startsWith(kit.id) && e.source === 'simulated')).toBe(true);
    expect(deviceEvents(p, realtimeOf(p, z, {}, at(14, 40))).map((e) => e.kind)).toEqual(['hub', 'phone']);
  });
});

describe('the suspected disruption (SPEC.md § 6)', () => {
  const START = at(14, 2); // an outage in Rosengård that nobody registers
  const hidden = { hiddenPower: new Map([['rosengard', START]]) };
  const run = (clock: number, registered: ReadonlySet<string> = new Set()) => hypotheses(SUS_PACK.homePatients, SUS_PACK.homeZones, hidden, registered, clock);

  it('proposes nothing while the contact is still coming in', () => {
    expect(run(at(14, 30))).toEqual([]);
    expect(run(at(15, 5))).toEqual([]); // the network falls 15:02; the first silence needs 10 minutes
  });

  it('proposes the zone no later than 15:20 when nobody has registered the outage', () => {
    const found = run(at(15, 20));
    expect(found.map((h) => h.zone)).toEqual(['rosengard']);
    expect(found[0].share).toBe(1);
    expect(found[0].firstSilentAt).toBeGreaterThanOrEqual(at(14, 58));
    expect(found[0].firstSilentAt).toBeLessThanOrEqual(at(15, 2));
  });

  it('proposes nothing in a zone with a registered disruption, and registers nothing by itself', () => {
    expect(run(at(15, 20), new Set(['rosengard']))).toEqual([]);
  });
});
