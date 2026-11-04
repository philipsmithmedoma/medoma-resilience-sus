import { describe, expect, it } from 'vitest';
import { SUS_PACK as pack } from '@/test/packs';
import { detectKind, matchRoad, matchZone, parseDisruptionMessage, parseDuration } from './disruption-message';

const ROADS = ['E22', 'Trafikplats Lund Södra', 'Inre Ringvägen', 'Yttre Ringvägen', 'Lundavägen'];
const ctx = (clock = 14 * 60 + 50) => ({ roadNames: ROADS, zones: pack.homeZones, clock });
const msg = (id: string) => pack.homeMessages.find((m) => m.id === id)!;

describe('disruption from message (SPEC.md § 13.4)', () => {
  it('the pack has three Lund and three Malmö illustrative notices, each in both languages, from fictitious senders', () => {
    expect(pack.homeMessages.map((m) => m.id)).toEqual(['smsg-road', 'smsg-power', 'smsg-water', 'smsg-m-road', 'smsg-m-power', 'smsg-m-water']);
    for (const m of pack.homeMessages) {
      expect(m.text.length).toBeGreaterThan(20);
      expect(m.textEn?.length).toBeGreaterThan(20);
      expect(m.roleEn).toBeTruthy();
    }
    expect(msg('smsg-road').text).toBe('Trafikverket: E22 vid Lund Södra avstängd i båda riktningarna, beräknad tid 3 timmar');
    expect(msg('smsg-power').text).toBe('Kraftringen: strömavbrott i Dalby, beräknad återställning 19:30');
    expect(msg('smsg-water').text).toBe('VA SYD: kokningsrekommendation i Kävlinge tills vidare');
  });

  it('the road notice prefills a closure of the interchange Trafikplats Lund Södra (named without "Trafikplats"), 3 hours, with the message id as note', () => {
    expect(parseDisruptionMessage(msg('smsg-road'), ctx())).toEqual({ kind: 'road', target: 'Trafikplats Lund Södra', startedAt: 14 * 60 + 50, durationHours: 3, note: 'smsg-road' });
    expect(parseDisruptionMessage(msg('smsg-m-road'), ctx())).toEqual({ kind: 'road', target: 'Inre Ringvägen', startedAt: 14 * 60 + 50, durationHours: 2, note: 'smsg-m-road' });
  });

  it('the power notice prefills a power outage in Dalby ending 19:30', () => {
    const p = parseDisruptionMessage(msg('smsg-power'), ctx());
    expect(p).toMatchObject({ kind: 'power', target: 'dalby', note: 'smsg-power' });
    expect(p.durationHours).toBeCloseTo(4.67, 2);
    expect(Math.round(p.startedAt + p.durationHours! * 60)).toBe(19 * 60 + 30);
    expect(parseDisruptionMessage(msg('smsg-m-power'), ctx())).toMatchObject({ kind: 'power', target: 'rosengard' });
  });

  it('the water notice prefills a water disruption in Kävlinge and leaves the duration empty ("tills vidare")', () => {
    expect(parseDisruptionMessage(msg('smsg-water'), ctx())).toEqual({ kind: 'water', target: 'kavlinge', startedAt: 14 * 60 + 50, durationHours: null, note: 'smsg-water' });
    expect(parseDisruptionMessage(msg('smsg-m-water'), ctx())).toMatchObject({ kind: 'water', target: 'limhamn', durationHours: null });
  });

  it('reads the English texts too', () => {
    expect(parseDisruptionMessage({ id: 'x', text: msg('smsg-road').textEn! }, ctx())).toMatchObject({ kind: 'road', target: 'Trafikplats Lund Södra', durationHours: 3 });
    expect(parseDisruptionMessage({ id: 'x', text: msg('smsg-water').textEn! }, ctx())).toMatchObject({ kind: 'water', target: 'kavlinge' });
  });

  it('matches the longest road name, a zone by its name, and leaves the target empty when nothing matches', () => {
    expect(matchRoad('E22 avstängd', ROADS)).toBe('E22');
    expect(matchRoad('Inre Ringvägen avstängd', ROADS)).toBe('Inre Ringvägen');
    expect(matchRoad('E22 vid Lund Södra avstängd', ROADS)).toBe('Trafikplats Lund Södra');
    expect(matchRoad('Okänd väg avstängd', ROADS)).toBe('');
    expect(matchZone('kokning i Limhamn', pack.homeZones)).toBe('limhamn');
    expect(matchZone('strömavbrott i Hörby', pack.homeZones)).toBe('horby');
    expect(matchZone('strömavbrott i Stockholm', pack.homeZones)).toBe('');
  });

  it('parses hours, decimals and a clock time that has already passed today as tomorrow', () => {
    expect(parseDuration('beräknad tid 2,5 timmar', 0)).toBe(2.5);
    expect(parseDuration('estimated 3 hours', 0)).toBe(3);
    expect(parseDuration('återställning 08:00', 14 * 60)).toBe(18);
    expect(parseDuration('tills vidare', 0)).toBeNull();
    expect(detectKind('Trafikverket: E22 stängd')).toBe('road');
  });
});
