import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { loadRoadModel } from '@/lib/roadModel';
import { freeSlots } from './packs/home-visits';

const s = () => useStore.getState();
const last = () => s().log[s().log.length - 1];
const status = (id: string) => s().home.work[id]?.status ?? 'Unhandled';

beforeAll(async () => {
  await loadRoadModel(useStore.getState().pack);
  useStore.getState().setHomeGeoReady();
});

/** A critical patient and a patient with a visit today, both in Huddinge, once the power is out there. */
function setup() {
  s().togglePowerOut('huddinge');
  const pack = s().pack;
  const critical = pack.homePatients.find((p) => p.zone === 'huddinge' && p.elCritical)!;
  const visit = pack.homePatients.find((p) => p.zone === 'huddinge' && p.visitToday)!;
  return { critical, visit };
}

describe('actions per patient (SPEC.md § 13.3)', () => {
  beforeEach(() => s().reset());

  it('every patient starts Unhandled', () => {
    const { critical } = setup();
    expect(status(critical.id)).toBe('Unhandled');
  });

  it('Contact sets Contacted, keeps the note and logs the user, time and patient id', () => {
    const { critical } = setup();
    const at = s().clock;
    s().contactPatient(critical.id, '  ringde, ingen svar ');
    expect(status(critical.id)).toBe('Contacted');
    expect(s().home.work[critical.id].note).toBe('ringde, ingen svar');
    expect(last()).toMatchObject({ action: 'Kontaktade patient', object: `${critical.familyName}, ${critical.givenName}`, actor: 'Eva Lind', ref: critical.id, detail: 'ringde, ingen svar' });
    expect(last().at).toBe(`${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`);
  });

  it('Send team sets Planned and records the team on the patient', () => {
    const { critical } = setup();
    s().sendTeam(critical.id, 'asih-nord');
    expect(status(critical.id)).toBe('Planned');
    expect(s().home.work[critical.id].assignedTeam).toBe('asih-nord');
    expect(last()).toMatchObject({ action: 'Skickade team till patient', detail: 'ASIH Nord', ref: critical.id });
    s().sendTeam(critical.id, 'no-such-team');
    expect(s().home.work[critical.id].assignedTeam).toBe('asih-nord');
  });

  it('Bring in sets Planned and marks the nearest site in scope; Huddinge patients go to Huddinge', () => {
    const { critical } = setup();
    s().bringInPatient(critical.id);
    expect(status(critical.id)).toBe('Planned');
    expect(s().home.work[critical.id].bringInSite).toBe('huddinge');
    expect(last()).toMatchObject({ action: 'Tog in patient', ref: critical.id });
    s().setScope('solna');
    s().bringInPatient(critical.id);
    expect(s().home.work[critical.id].bringInSite).toBe('solna');
  });

  it('Confirm sets Confirmed, and the status never moves backwards', () => {
    const { critical } = setup();
    s().confirmPatient(critical.id);
    expect(status(critical.id)).toBe('Confirmed');
    expect(last()).toMatchObject({ action: 'Bekräftade åtgärd för patient', ref: critical.id });
    s().contactPatient(critical.id, 'igen');
    expect(status(critical.id)).toBe('Confirmed');
    expect(s().home.work[critical.id].note).toBe('igen');
  });

  it('Move visit picks a free slot of the patient\'s team, or cancels, and sets Planned', () => {
    const { visit } = setup();
    const team = s().pack.homeTeams.find((x) => x.name === visit.team)!;
    const before = s().home.visits.find((v) => v.patientId === visit.id)!;
    const free = freeSlots(s().home.visits.filter((v) => v.id !== before.id), team, s().clock);
    expect(free.length).toBeGreaterThan(0);
    s().moveVisit(visit.id, free[0]);
    expect(s().home.visits.find((v) => v.patientId === visit.id)).toMatchObject({ start: free[0], status: 'moved' });
    expect(status(visit.id)).toBe('Planned');
    expect(last()).toMatchObject({ action: 'Flyttade besök', ref: visit.id });
    s().moveVisit(visit.id, 7 * 60); // not a free slot: ignored
    expect(s().home.visits.find((v) => v.patientId === visit.id)!.start).toBe(free[0]);
    s().moveVisit(visit.id, null);
    expect(s().home.visits.find((v) => v.patientId === visit.id)!.status).toBe('cancelled');
    expect(last().action).toBe('Ställde in besök');
  });

  it('Move visit does nothing for a patient without a visit today', () => {
    setup();
    const none = s().pack.homePatients.find((p) => p.zone === 'huddinge' && !p.visitToday)!;
    const n = s().log.length;
    s().moveVisit(none.id, 15 * 60);
    expect(s().log).toHaveLength(n);
  });

  it('a critical row goes Unhandled → Contacted → Planned → Confirmed', () => {
    const { critical } = setup();
    const seen = [status(critical.id)];
    s().contactPatient(critical.id, '');
    seen.push(status(critical.id));
    s().sendTeam(critical.id, 'asih-syd');
    seen.push(status(critical.id));
    s().confirmPatient(critical.id);
    seen.push(status(critical.id));
    expect(seen).toEqual(['Unhandled', 'Contacted', 'Planned', 'Confirmed']);
  });

  it('"Contact all critical" sets Contacted on every critical row with the note "bulk contact", in one log entry', () => {
    s().applyHomePreset('power');
    const critical = [...s().pack.homePatients].filter((p) => ['soderort', 'huddinge'].includes(p.zone) && (p.elCritical || p.waterCritical));
    expect(critical.length).toBeGreaterThan(0);
    const n = s().log.length;
    s().contactAllCritical();
    expect(s().log).toHaveLength(n + 1);
    expect(last()).toMatchObject({ action: 'Kontaktade alla kritiska', detail: `${critical.length} patienter` });
    for (const p of critical) {
      expect(status(p.id)).toBe('Contacted');
      expect(s().home.work[p.id].note).toBe('samlad kontakt');
    }
    const others = s().pack.homePatients.filter((p) => !critical.includes(p));
    expect(others.every((p) => status(p.id) === 'Unhandled')).toBe(true);
  });

  it('status resets to Unhandled only when the disruption that affected the patient ends; the log keeps the history', () => {
    const { critical } = setup();
    s().togglePowerOut('soderort'); // a second, unrelated disruption
    s().contactPatient(critical.id, 'x');
    s().sendTeam(critical.id, 'asih-syd');
    s().togglePowerOut('soderort'); // other zone ends: the patient is still affected
    expect(status(critical.id)).toBe('Planned');
    const before = s().log.length;
    s().togglePowerOut('huddinge'); // the disruption affecting the patient ends
    expect(status(critical.id)).toBe('Unhandled');
    expect(s().home.work[critical.id]).toBeUndefined();
    expect(s().log.slice(before).map((e) => e.action)).toContain('Återställde status till Ohanterad');
    expect(s().log.filter((e) => e.ref === critical.id && e.action !== 'Återställde status till Ohanterad').map((e) => e.action)).toEqual(['Kontaktade patient', 'Skickade team till patient']); // the history stays
    expect(s().log.filter((e) => e.action === 'Återställde status till Ohanterad').at(-1)!.ref).toContain(critical.id);
  });

  it('status also resets when the disruption ends by its expected time', () => {
    const { critical } = setup();
    const id = s().home.disruptions.find((d) => d.target === 'huddinge')!.id;
    s().endHomeDisruption(id);
    s().startHomeDisruption({ kind: 'power', target: 'huddinge', targetKind: 'zone', source: 'message', expectedEnd: s().clock + 60 });
    s().contactPatient(critical.id, '');
    expect(status(critical.id)).toBe('Contacted');
    s().advanceClock(60);
    expect(status(critical.id)).toBe('Unhandled');
  });
});
