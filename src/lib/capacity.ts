// Capacity after the platform's view (SPEC.md § 8): seven days from today, patient and activity cards and visits per profession and
// shift. Everything is synthetic and deterministic: shifts per team and day are fixed, home visits are the pack's visits for today,
// the other activities are drawn from a hash of day, team count and row, so the page never changes between renders. Pure.
import type { DataPack, HomeDisruption, HomeVisit } from '@/data/types';
import { hash } from './signal';
import type { ImpactRow } from './reachability';

export type CapProfession = 'nurse' | 'doctor';
export type CapShift = 'day' | 'evening' | 'night';
export type CapActivity = 'homeVisit' | 'clinicVisit' | 'video' | 'admin' | 'phone';
export const CAP_PROFESSIONS: CapProfession[] = ['nurse', 'doctor'];
export const CAP_SHIFTS: CapShift[] = ['day', 'evening', 'night'];
export const CAP_ACTIVITIES: CapActivity[] = ['homeVisit', 'clinicVisit', 'video', 'admin', 'phone'];

/** The demo day (fredag 4 september 2026) as an ISO date; clock day 0. */
export const DEMO_DATE = '2026-09-04';
export const SHIFT_HOURS = 8;
/** Shifts per team and day (SPEC.md § 8): four nurses day, two evening, one night, one doctor day. */
export const SHIFTS_PER_TEAM: Record<CapProfession, Record<CapShift, number>> = {
  nurse: { day: 4, evening: 2, night: 1 },
  doctor: { day: 1, evening: 0, night: 0 },
};
/** Ranges of the drawn activities per team and shift (illustrative, DATA.md § 5.9): [low, high]. */
const RANGES: Record<CapProfession, Record<CapShift, Partial<Record<Exclude<CapActivity, 'homeVisit'>, [number, number]>>>> = {
  nurse: {
    day: { clinicVisit: [1, 3], video: [2, 5], admin: [3, 6], phone: [4, 8] },
    evening: { clinicVisit: [0, 1], video: [1, 2], admin: [1, 2], phone: [2, 4] },
    night: { video: [0, 1], admin: [0, 1], phone: [0, 2] },
  },
  doctor: { day: { clinicVisit: [2, 4], video: [3, 6], admin: [2, 4], phone: [2, 4] }, evening: {}, night: {} },
};
/** Visits starting before this minute belong to the day shift, later ones to the evening shift. */
export const EVENING_FROM_MIN = 15 * 60;
export const KM_PER_HOUR = 40;

export const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export interface CapRow {
  profession: CapProfession;
  shift: CapShift;
  visits: Record<CapActivity, number>;
  shifts: number;
  hours: number;
  /** Preparedness mode: home visits of this row that a disruption affects; and the extra driving minutes from the detours. */
  affected: number;
  extraMin: number;
}

export interface CapDay {
  index: number;
  date: string;
  enrolled: number;
  shifts: number;
  /** A disruption with an expected end covers the day. */
  disrupted: boolean;
  rows: CapRow[];
  cards: {
    enrolled: number;
    withVisit: number;
    assessment: number;
    plannedAdmission: number;
    plannedDischarge: number;
    activities: Record<CapActivity, number>;
    shifts: number;
    hours: number;
    /** Home visits affected by a disruption (preparedness mode). */
    affectedVisits: number;
  };
}

const draw = (key: string, [lo, hi]: [number, number], teams: number): number => {
  let n = 0;
  for (let t = 0; t < teams; t++) n += lo + (hash(`${key}:${t}`) % (hi - lo + 1));
  return n;
};

interface Input {
  pack: Pick<DataPack, 'homePatients' | 'homeTeams' | 'homeExtras'>;
  /** Today's visits (with their moved or cancelled status). */
  visits: readonly HomeVisit[];
  /** The impact rows of the current disruptions; used for the affected counts and the extra driving time (today only). */
  rows: readonly ImpactRow[];
  disruptions: readonly HomeDisruption[];
  clock: number;
  prep: boolean;
}

/** The seven days from today. */
export function buildCapacity({ pack, visits, rows, disruptions, clock, prep }: Input): CapDay[] {
  const today = addDays(DEMO_DATE, Math.floor(clock / 1440));
  const teams = Math.max(1, pack.homeTeams.length);
  const live = visits.filter((v) => v.status !== 'cancelled');
  const rowOf = new Map(rows.map((r) => [r.patient.id, r]));
  return Array.from({ length: 7 }, (_, index): CapDay => {
    const date = addDays(today, index);
    const enrolledPatients = pack.homePatients.filter((p) => p.enrolledOn <= date && date < p.plannedDischargeOn);
    const enrolled = enrolledPatients.length;
    const dayStart = (Math.floor(clock / 1440) + index) * 1440;
    const disrupted = disruptions.some((d) => d.endedAt === null && d.expectedEnd !== null && d.startedAt < dayStart + 1440 && d.expectedEnd > dayStart);
    // Home visits: today's real visits; later days a share of the enrolled patients, three quarters on the day shift.
    let homeDay = 0;
    let homeEvening = 0;
    let affectedDay = 0;
    let affectedEvening = 0;
    let extraDayKm = 0;
    let extraEveningKm = 0;
    if (index === 0) {
      for (const v of live) {
        const evening = v.start >= EVENING_FROM_MIN;
        const row = rowOf.get(v.patientId);
        const hit = prep && row !== undefined && row.affected;
        const km = prep && row?.extraKm ? row.extraKm : 0;
        if (evening) {
          homeEvening++;
          if (hit) affectedEvening++;
          extraEveningKm += km;
        } else {
          homeDay++;
          if (hit) affectedDay++;
          extraDayKm += km;
        }
      }
    } else {
      const total = Math.round(enrolled * 0.4) + (hash(`${date}:visits`) % 4);
      homeEvening = Math.round(total * 0.25);
      homeDay = total - homeEvening;
      // A day covered by a disruption: the share of today's visits that are affected carries over (an estimate, illustrative).
      if (prep && disrupted) {
        const todayVisits = live.length || 1;
        const share = live.filter((v) => rowOf.get(v.patientId)?.affected).length / todayVisits;
        affectedDay = Math.round(homeDay * share);
        affectedEvening = Math.round(homeEvening * share);
      }
    }
    const capRows: CapRow[] = [];
    for (const profession of CAP_PROFESSIONS) {
      for (const shift of CAP_SHIFTS) {
        const shifts = SHIFTS_PER_TEAM[profession][shift] * teams;
        const visitsBy = { homeVisit: 0, clinicVisit: 0, video: 0, admin: 0, phone: 0 } as Record<CapActivity, number>;
        if (profession === 'nurse') visitsBy.homeVisit = shift === 'day' ? homeDay : shift === 'evening' ? homeEvening : 0;
        for (const [k, range] of Object.entries(RANGES[profession][shift])) visitsBy[k as CapActivity] = draw(`${date}:${profession}:${shift}:${k}`, range as [number, number], teams);
        const affected = profession === 'nurse' ? (shift === 'day' ? affectedDay : shift === 'evening' ? affectedEvening : 0) : 0;
        const km = profession === 'nurse' ? (shift === 'day' ? extraDayKm : shift === 'evening' ? extraEveningKm : 0) : 0;
        capRows.push({ profession, shift, visits: visitsBy, shifts, hours: shifts * SHIFT_HOURS, affected, extraMin: Math.round((km / KM_PER_HOUR) * 60) });
      }
    }
    const activities = Object.fromEntries(CAP_ACTIVITIES.map((a) => [a, capRows.reduce((n, r) => n + r.visits[a], 0)])) as Record<CapActivity, number>;
    const shifts = capRows.reduce((n, r) => n + r.shifts, 0);
    const cards = {
      enrolled,
      withVisit: index === 0 ? pack.homePatients.filter((p) => p.visitToday).length : homeDay + homeEvening,
      assessment: pack.homeExtras.filter((x) => x.status === 'assessment').length,
      plannedAdmission: 2 + (hash(`${date}:admission`) % 5),
      plannedDischarge: pack.homePatients.filter((p) => p.plannedDischargeOn === date).length,
      activities,
      shifts,
      hours: shifts * SHIFT_HOURS,
      affectedVisits: affectedDay + affectedEvening,
    };
    return { index, date, enrolled, shifts, disrupted, rows: capRows, cards };
  });
}
