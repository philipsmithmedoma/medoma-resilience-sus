import { describe, expect, it } from 'vitest';
import { KAROLINSKA_PACK as pack } from '@/test/packs';
import { detectKind, matchRoad, matchZone, parseDisruptionMessage, parseDuration } from './disruption-message';

const ROADS = ['Essingeleden', 'Essinge', 'Västerbron', 'Centralbron', 'Uppsalavägen'];
const ctx = (clock = 14 * 60 + 50) => ({ roadNames: ROADS, zones: pack.homeZones, clock });
const msg = (id: string) => pack.homeMessages.find((m) => m.id === id)!;

describe('disruption from message (SPEC.md § 13.4)', () => {
  it('the pack has three illustrative notices, each in both languages, from fictitious senders', () => {
    expect(pack.homeMessages.map((m) => m.id)).toEqual(['hmsg-road', 'hmsg-power', 'hmsg-water']);
    for (const m of pack.homeMessages) {
      expect(m.text.length).toBeGreaterThan(20);
      expect(m.textEn?.length).toBeGreaterThan(20);
      expect(m.roleEn).toBeTruthy();
    }
    expect(msg('hmsg-road').text).toBe('Trafikverket: Essingeleden avstängd i båda riktningarna efter olycka vid Fredhäll, beräknad tid 4 timmar');
    expect(msg('hmsg-power').text).toBe('Ellevio: strömavbrott i delar av Huddinge, beräknad återställning 20:30');
    expect(msg('hmsg-water').text).toBe('Stockholm Vatten och Avfall: kokningsrekommendation i Solna tills vidare');
  });

  it('the road notice prefills a road closure of Essingeleden, 4 hours, with the message id as note', () => {
    expect(parseDisruptionMessage(msg('hmsg-road'), ctx())).toEqual({ kind: 'road', target: 'Essingeleden', startedAt: 14 * 60 + 50, durationHours: 4, note: 'hmsg-road' });
  });

  it('the power notice prefills a power outage in Huddinge ending 20:30', () => {
    const p = parseDisruptionMessage(msg('hmsg-power'), ctx());
    expect(p).toMatchObject({ kind: 'power', target: 'huddinge', note: 'hmsg-power' });
    expect(p.durationHours).toBeCloseTo(5.67, 2);
    expect(Math.round(p.startedAt + p.durationHours! * 60)).toBe(20 * 60 + 30);
  });

  it('the water notice prefills a water disruption in Solna and leaves the duration empty ("tills vidare")', () => {
    expect(parseDisruptionMessage(msg('hmsg-water'), ctx())).toEqual({ kind: 'water', target: 'solna', startedAt: 14 * 60 + 50, durationHours: null, note: 'hmsg-water' });
  });

  it('reads the English texts too', () => {
    expect(parseDisruptionMessage({ id: 'x', text: msg('hmsg-road').textEn! }, ctx())).toMatchObject({ kind: 'road', target: 'Essingeleden', durationHours: 4 });
    expect(parseDisruptionMessage({ id: 'x', text: msg('hmsg-water').textEn! }, ctx())).toMatchObject({ kind: 'water', target: 'solna' });
  });

  it('matches the longest road name, a zone by its first words, and leaves the target empty when nothing matches', () => {
    expect(matchRoad('Essingeleden avstängd', ROADS)).toBe('Essingeleden');
    expect(matchRoad('Okänd väg avstängd', ROADS)).toBe('');
    expect(matchZone('kokning i Solna', pack.homeZones)).toBe('solna');
    expect(matchZone('strömavbrott i Täby', pack.homeZones)).toBe('taby');
    expect(matchZone('strömavbrott i Skåne', pack.homeZones)).toBe('');
  });

  it('parses hours, decimals and a clock time that has already passed today as tomorrow', () => {
    expect(parseDuration('beräknad tid 2,5 timmar', 0)).toBe(2.5);
    expect(parseDuration('estimated 3 hours', 0)).toBe(3);
    expect(parseDuration('återställning 08:00', 14 * 60)).toBe(18);
    expect(parseDuration('tills vidare', 0)).toBeNull();
    expect(detectKind('Stockholm Vatten och Avfall: Essingeleden stängd')).toBe('road');
  });
});
