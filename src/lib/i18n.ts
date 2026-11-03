// Locale (sv/en) – DESIGN-LANG.md § 1. One small module: the locale store, t() with {name} interpolation,
// tm() for label maps, tn() for explicit plural keys and lt() for { sv, en } texts in the data pack.
import { create } from 'zustand';
import type { LocalizedText } from '@/data/types';
import { en, sv, type Vocab } from '@/data/vocab';

export type Locale = 'sv' | 'en';

export const DEFAULT_LOCALE: Locale = 'sv';
export const LOCALE_STORAGE_KEY = 'locale';
export const LOCALES: Locale[] = ['sv', 'en'];

export type { LocalizedText } from '@/data/types';

// Dotted paths to the string leaves of the vocab (t keys) and to its branches (tm keys).
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends readonly unknown[] ? never : T[K] extends object ? Leaves<T[K], `${P}${K}.`> : never;
}[keyof T & string];
type Branches<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? never : T[K] extends readonly unknown[] ? `${P}${K}` : T[K] extends object ? `${P}${K}` | Branches<T[K], `${P}${K}.`> : never;
}[keyof T & string];
type Get<T, K extends string> = K extends `${infer H}.${infer R}` ? (H extends keyof T ? Get<T[H], R> : never) : K extends keyof T ? T[K] : never;

export type VocabKey = Leaves<Vocab>;
export type VocabBranch = Branches<Vocab>;
/** Base of a plural pair: "{base}_one" and "{base}_other" are both keys. */
export type PluralKey = VocabKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;
export type TParams = Record<string, string | number>;

const TABLES: Record<Locale, Vocab> = { sv, en };

function readStoredLocale(): Locale | null {
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    return stored === 'sv' || stored === 'en' ? stored : null;
  } catch {
    return null;
  }
}

/** Sets the document language and stores the choice. */
export function applyLocale(locale: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Storage unavailable: the locale still applies for the session.
  }
}

interface I18nStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

/** A stored value wins over DEFAULT_LOCALE on load. */
export const useI18n = create<I18nStore>()((set, get) => ({
  locale: readStoredLocale() ?? DEFAULT_LOCALE,
  setLocale: (locale) => {
    applyLocale(locale);
    set({ locale });
  },
  toggleLocale: () => get().setLocale(get().locale === 'sv' ? 'en' : 'sv'),
}));

/** Applies the initial locale to the document before the first render. */
export function initLocale(): void {
  if (typeof document !== 'undefined') document.documentElement.lang = useI18n.getState().locale;
}

export function getLocale(): Locale {
  return useI18n.getState().locale;
}

/** Hook: the current locale; components that read it re-render on a switch. */
export function useLocale(): Locale {
  return useI18n((s) => s.locale);
}

/** BCP 47 tag for Intl formatting (DESIGN-LANG.md § 2). */
export function localeTag(locale: Locale = getLocale()): 'sv-SE' | 'en-GB' {
  return locale === 'en' ? 'en-GB' : 'sv-SE';
}

function resolve(table: Vocab, key: string): unknown {
  let node: unknown = table;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

/** Interpolates "{name}" placeholders; missing params are left as they are. */
export function interpolate(text: string, params?: TParams): string {
  if (!params) return text;
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** The string at a dotted key in the current locale, with {name} placeholders filled in. */
export function t(key: VocabKey, params?: TParams, locale: Locale = getLocale()): string {
  const value = resolve(TABLES[locale], key);
  if (typeof value !== 'string') return key;
  return interpolate(value, params);
}

/** Plural by explicit keys: "{base}_one" for exactly one, "{base}_other" otherwise; n is available as {n}. */
export function tn(base: PluralKey, n: number, params?: TParams, locale: Locale = getLocale()): string {
  const key = `${base}_${n === 1 ? 'one' : 'other'}` as VocabKey;
  return t(key, { n, ...params }, locale);
}

/** A branch of the vocab (a label map, a list) in the current locale. */
export function tm<K extends VocabBranch>(key: K, locale: Locale = getLocale()): Get<Vocab, K> {
  return resolve(TABLES[locale], key) as Get<Vocab, K>;
}

/** A pack text in the current locale; plain strings (proper nouns) pass through. */
export function lt(text: LocalizedText | string, locale: Locale = getLocale()): string {
  return typeof text === 'string' ? text : text[locale];
}

/** Builds a { sv, en } text; used for user-typed texts that have one form. */
export function same(text: string): LocalizedText {
  return { sv: text, en: text };
}

/** The Swedish form, which is the key form for matching (roles, task titles, channel names). */
export function key(text: LocalizedText | string): string {
  return typeof text === 'string' ? text : text.sv;
}
