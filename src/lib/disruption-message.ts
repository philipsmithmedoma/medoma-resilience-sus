// Message → disruption form prefill – SPEC.md § 13.4. Pure. Reads a notice (Swedish or English) and proposes the kind, the
// target (a road name from roads.json, or a zone by its name), the expected duration in hours and a note with the message
// id. Nothing is created from here: the user confirms in the form.
import type { HomeDisruptionKind, HomeZone, Message } from '@/data/types';
import { nextClockTime } from './disruptions';

export interface DisruptionPrefill {
  kind: HomeDisruptionKind;
  /** A road name (kind road) or a zone id; empty when the text names nothing that matches. */
  target: string;
  /** Start of the disruption: the clock now. */
  startedAt: number;
  /** Expected duration in hours, or null when the text gives none. */
  durationHours: number | null;
  note: string;
}

const POWER = ['strömavbrott', 'elavbrott', 'power outage', 'power cut', 'blackout'];
const WATER = ['kokningsrekommendation', 'vattenstörning', 'vattenavbrott', 'vattenläcka', 'boil-water', 'boil water', 'water outage', 'water disruption', 'kokning'];

const has = (text: string, stems: string[]) => stems.some((s) => text.includes(s));

/** Power and water are named by their own words; everything else that is closed or blocked is a road. */
export function detectKind(text: string): HomeDisruptionKind {
  const lower = text.toLowerCase();
  if (has(lower, POWER)) return 'power';
  if (has(lower, WATER)) return 'water';
  return 'road';
}

/**
 * The longest road name that occurs in the text (case-insensitive), or '' when none does. An interchange is named in a notice
 * without its "Trafikplats" ("E22 vid Lund Södra"), so a name also matches by what follows that word.
 */
export function matchRoad(text: string, roadNames: readonly string[]): string {
  const lower = text.toLowerCase();
  let best = { name: '', len: 0 };
  for (const name of roadNames) {
    for (const form of [name, name.replace(/^Trafikplats /i, '')]) {
      if (form.length > best.len && lower.includes(form.toLowerCase())) best = { name, len: form.length };
    }
  }
  return best.name;
}

/** A zone by the longest of its names, or the first words of them ("Solna" for "Solna och Sundbyberg"), found in the text. */
export function matchZone(text: string, zones: readonly Pick<HomeZone, 'id' | 'name'>[]): string {
  const lower = text.toLowerCase();
  let best = { id: '', len: 0 };
  for (const z of zones) {
    const names = [z.name.sv, z.name.en, ...[z.name.sv, z.name.en].map((n) => n.split(/ och | and /)[0])];
    for (const n of names) if (n.length > best.len && lower.includes(n.toLowerCase())) best = { id: z.id, len: n.length };
  }
  return best.id;
}

/** "4 timmar" / "4 hours" gives the hours; a clock time ("20:30") gives the hours from `clock` to its next occurrence. */
export function parseDuration(text: string, clock: number): number | null {
  const hours = /(\d+(?:[.,]\d+)?)\s*(?:timmar|timme|hours|hour|h)\b/i.exec(text);
  if (hours) return Number(hours[1].replace(',', '.'));
  const time = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (time) {
    const end = nextClockTime(clock, Number(time[1]), Number(time[2]));
    return Math.round(((end - clock) / 60) * 100) / 100;
  }
  return null;
}

export function parseDisruptionMessage(
  message: Pick<Message, 'id' | 'text' | 'textEn'>,
  ctx: { roadNames: readonly string[]; zones: readonly Pick<HomeZone, 'id' | 'name'>[]; clock: number },
): DisruptionPrefill {
  const text = message.text;
  const kind = detectKind(text);
  const target = kind === 'road' ? matchRoad(text, ctx.roadNames) : matchZone(text, ctx.zones);
  return { kind, target, startedAt: ctx.clock, durationHours: parseDuration(text, ctx.clock), note: message.id };
}
