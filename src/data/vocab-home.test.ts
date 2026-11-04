import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, sv, HOME_EQUIPMENT, MODULE_DEFS, PLATFORM_DEFS } from './vocab';
import { KAROLINSKA_PACK as pack } from '@/test/packs';

/** Walks a dotted path through a vocab table; undefined when it does not resolve. */
function at(table: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, k) => (node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[k] : undefined), table);
}

const ROOT = join(__dirname, '..');
const FILES = [
  ...readdirSync(join(ROOT, 'modules/home')).map((f) => join(ROOT, 'modules/home', f)),
  join(ROOT, 'components/HomeMapLayers.tsx'),
  join(ROOT, 'app/Nav.tsx'),
  join(ROOT, 'data/store-home.ts'),
  join(ROOT, 'lib/home-names.ts'),
  join(ROOT, 'app/Layout.tsx'),
].filter((f) => /\.tsx?$/.test(f));

const source = FILES.map((f) => readFileSync(f, 'utf8')).join('\n');
const literal = (fn: string) => [...source.matchAll(new RegExp(`\\b${fn}\\(\\s*'([A-Za-z0-9_.]+)'`, 'g'))].map((m) => m[1]);

describe('vocab parity for Hospital at Home (SPEC.md § 11.7 batch 5)', () => {
  it('every key the Hospital at Home code passes to t() resolves to a string in sv and en', () => {
    const keys = [...new Set(literal('t'))];
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) {
      expect(typeof at(sv, k), `sv ${k}`).toBe('string');
      expect(typeof at(en, k), `en ${k}`).toBe('string');
    }
  });

  it('every plural base passed to tn() has _one and _other in both languages', () => {
    for (const base of new Set(literal('tn'))) {
      for (const table of [sv, en]) {
        expect(typeof at(table, `${base}_one`), base).toBe('string');
        expect(typeof at(table, `${base}_other`), base).toBe('string');
      }
    }
  });

  it('every label map the code reads with tm() is an object with the same keys in both languages', () => {
    for (const branch of new Set(literal('tm'))) {
      const a = at(sv, branch);
      const b = at(en, branch);
      expect(typeof a, branch).toBe('object');
      expect(Object.keys(b as object).sort(), branch).toEqual(Object.keys(a as object).sort());
    }
  });

  it('keys built from data resolve: modules, equipment, infrastructure kinds, layers, modes, instructions, presets, reasons', () => {
    const dynamic: string[] = [];
    for (const m of [...MODULE_DEFS, ...PLATFORM_DEFS]) dynamic.push(`MODULES.${m.key}`);
    for (const e of HOME_EQUIPMENT) dynamic.push(`HOME.equipment.${e}`);
    for (const k of new Set(pack.infraNodes.map((n) => n.kind))) dynamic.push(`HOME.kinds.${k}`);
    for (const l of ['patients', 'roads', 'el', 'water']) dynamic.push(`HOME.layers.${l}`);
    for (const m of ['roads', 'el', 'water']) dynamic.push(`HOME.modes.${m}`, `HOME.instructions.${m}`);
    for (const r of ['unreachable', 'detour', 'power', 'water']) dynamic.push(`HOME.impact.reasons.${r}`);
    for (const k of dynamic) {
      expect(typeof at(sv, k), `sv ${k}`).toBe('string');
      expect(typeof at(en, k), `en ${k}`).toBe('string');
    }
  });

  it('the spec labels are exact', () => {
    expect(sv.MODULES.home).toBe('Sjukhus hemma');
    expect(en.MODULES.home).toBe('Hospital at Home');
    expect([sv.MODULES.patients, sv.MODULES.activities, sv.MODULES.planning, sv.MODULES.employees, sv.MODULES.reporting]).toEqual(['Patienter', 'Aktiviteter', 'Planering', 'Medarbetare', 'Rapportering']);
    expect([en.MODULES.patients, en.MODULES.activities, en.MODULES.planning, en.MODULES.employees, en.MODULES.reporting]).toEqual(['Patients', 'Activities', 'Planning', 'Employees', 'Reporting']);
    expect(sv.STUB.text).toBe('Den här modulen finns i Medoma i dag och ligger utanför prototypen.');
    expect(en.STUB.text).toBe('This module exists in Medoma today and is outside the scope of this prototype.');
    expect(sv.STUB.link).toBe('Gå till Sjukhus hemma');
    expect(en.STUB.link).toBe('Go to Hospital at Home');
    expect(sv.STUB.menu).toBe('Medoma');
    expect(pack.homePresets.map((p) => [p.name.sv, p.name.en])).toEqual([
      ['Bro avstängd', 'Bridge closed'],
      ['Elavbrott', 'Power outage'],
      ['Vattenstörning', 'Water disruption'],
      ['Värmebölja', 'Heatwave'],
      ['Kyla med elavbrott', 'Cold with power outage'],
    ]);
    expect([sv.HOME.impact.headline, en.HOME.impact.headline]).toEqual(['{n} av {total} patienter påverkade', '{n} of {total} patients affected']);
  });

  it('puts Översikt, Sjukhus hemma, Incident and Beroenden in the preparedness nav and the seven platform modules in the platform\'s order', () => {
    expect(MODULE_DEFS.map((m) => [m.key, m.path])).toEqual([['overview', '/overview'], ['home', '/home'], ['incident', '/incident'], ['dependencies', '/dependencies']]);
    expect(PLATFORM_DEFS.map((m) => m.path)).toEqual(['/patients', '/activities', '/planning', '/capacity', '/employees', '/equipment', '/reporting']);
    expect(PLATFORM_DEFS.map((m) => sv.MODULES[m.key])).toEqual(['Patienter', 'Aktiviteter', 'Planering', 'Kapacitet', 'Medarbetare', 'Utrustning', 'Rapportering']);
    expect(PLATFORM_DEFS.map((m) => en.MODULES[m.key])).toEqual(['Patients', 'Activities', 'Planning', 'Capacity', 'Employees', 'Equipment', 'Reporting']);
  });
});
