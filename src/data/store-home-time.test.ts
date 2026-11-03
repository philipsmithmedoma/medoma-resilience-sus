import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { loadRoadModel } from '@/lib/roadModel';
import { disruptionCount } from '@/lib/reachability';
import { formatClock } from '@/lib/time';

const s = () => useStore.getState();
const last = () => s().log[s().log.length - 1];

beforeAll(async () => {
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

describe('disruptions in time (SPEC.md § 13.2)', () => {
  beforeEach(() => s().reset());

  it('a preset power outage creates records for Söderort and Huddinge with the start time and no end', () => {
    const t0 = s().clock;
    s().applyHomePreset('power');
    const records = s().home.disruptions.filter((d) => d.endedAt === null);
    expect(records.map((d) => d.target).sort()).toEqual(['huddinge', 'soderort']);
    expect(records.every((d) => d.kind === 'power' && d.source === 'preset' && d.startedAt === t0 && d.expectedEnd === null && d.createdBy === 'Eva Lind')).toBe(true);
    expect(s().home.powerStart.get('huddinge')).toBe(t0);
  });

  it('"+1 h" advances the shared clock by 60 minutes and logs it', () => {
    const t0 = s().clock;
    const n = s().log.length;
    s().advanceClock(60);
    expect(s().clock).toBe(t0 + 60);
    expect(s().log).toHaveLength(n + 1);
    expect(last()).toMatchObject({ action: 'Flyttade fram klockan', object: 'Sjukhus hemma', detail: '+60 min', at: formatClock(t0 + 60) });
  });

  it('a record with an expected end ends when the clock passes it and is logged as ended (expected)', () => {
    const end = s().clock + 120;
    s().startHomeDisruption({ kind: 'power', target: 'taby', targetKind: 'zone', source: 'message', expectedEnd: end });
    expect(s().home.powerOutZones.has('taby')).toBe(true);
    s().advanceClock(60);
    expect(s().home.powerOutZones.has('taby')).toBe(true);
    s().advanceClock(60);
    expect(s().home.powerOutZones.has('taby')).toBe(false);
    expect(s().home.powerStart.has('taby')).toBe(false);
    const rec = s().home.disruptions.find((d) => d.target === 'taby')!;
    expect(rec).toMatchObject({ endReason: 'expected' });
    expect(s().log.some((e) => e.action === 'Störning avslutad (beräknad tid nådd)' && e.object === 'Elavbrott: Täby')).toBe(true);
  });

  it('ending a disruption by hand restores the rows and logs it; the record stays as history', () => {
    s().applyHomePreset('power');
    const id = s().home.disruptions.find((d) => d.target === 'huddinge')!.id;
    s().endHomeDisruption(id);
    expect(s().home.powerOutZones.has('huddinge')).toBe(false);
    expect(s().home.powerOutZones.has('soderort')).toBe(true);
    expect(last()).toMatchObject({ action: 'Avslutade störning', object: 'Elavbrott: Huddinge', detail: '20 av 150 patienter påverkade' });
    expect(s().home.disruptions.find((d) => d.id === id)).toMatchObject({ endReason: 'manual' });
    s().endHomeDisruption(id); // already ended: nothing happens
    expect(s().log.filter((e) => e.action === 'Avslutade störning')).toHaveLength(1);
  });

  it('the map toggles create and end records, so the sets stay what they were before', () => {
    s().togglePowerOut('huddinge');
    expect(s().home.disruptions).toHaveLength(1);
    expect(s().home.disruptions[0]).toMatchObject({ source: 'map', kind: 'power' });
    s().togglePowerOut('huddinge');
    expect(disruptionCount(s().home)).toBe(0);
    expect(s().home.disruptions[0].endReason).toBe('manual');
    s().toggleBlockedNode('r-essingeleden');
    s().toggleBlockedWay('9000004');
    s().toggleBlockedRoad('Uppsalavägen|E4');
    expect(s().home.disruptions.filter((d) => d.endedAt === null)).toHaveLength(3);
    s().resetHomeDisruptions();
    expect(s().home.disruptions.every((d) => d.endedAt !== null)).toBe(true);
  });

  it('starting the same target twice is ignored; the earliest start decides the battery deadline', () => {
    const t0 = s().clock;
    expect(s().startHomeDisruption({ kind: 'power', target: 'huddinge', targetKind: 'zone', source: 'map' })).not.toBeNull();
    s().advanceClock(60);
    expect(s().startHomeDisruption({ kind: 'power', target: 'huddinge', targetKind: 'zone', source: 'map' })).toBeNull();
    expect(s().home.powerStart.get('huddinge')).toBe(t0);
  });

  it('the audit log shows every step: start, clock, end', () => {
    s().applyHomePreset('power');
    s().advanceClock(60);
    s().advanceClock(60);
    s().resetHomeDisruptions();
    const actions = s().log.map((e) => e.action);
    const i = actions.lastIndexOf('Aktiverade störningsscenario');
    expect(actions.slice(i)).toEqual(['Aktiverade störningsscenario', 'Flyttade fram klockan', 'Flyttade fram klockan', 'Återställde alla störningar']);
  });
});
