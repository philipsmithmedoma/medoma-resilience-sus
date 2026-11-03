# Medoma Center – preparedness mode prototype

This repository holds the prototype of **Medoma Center with a preparedness mode** (beredskapsläge), lifted out of the public repository `Medoma-Resilience-KS`, where the hospital-management product for Karolinska lives together with the Hospital at Home module. Everything that belongs to Medoma Center and Sjukhus hemma moved here, with **Skånes universitetssjukhus (SUS: Lund and Malmö)** as the default data pack and **Karolinska** as the second pack. The hospital-management parts (capacity, flow, evacuation, resources, network, scenario engine, start page, sources) stay in the source repository.

Read `CLAUDE.md`, `SPEC.md`, `DATA.md` and `DESIGN.md` completely, then inspect the actual code before writing anything. `DECISIONS.md` starts with `## Seeded from Medoma-Resilience-KS`; keep every entry and append new ones.

Precedence when documents disagree: `SPEC.md` > `DATA.md` > `DESIGN.md` > code. Where `SPEC.md` is silent, the existing behaviour stands.

**Decision: the hospital-management product lives in Medoma-Resilience-KS. The interface between the two products is the handover file** (SPEC.md § 7): the action "Ta in" writes a record to the list "Överlämningar till sjukhus" and the button "Exportera" downloads it as JSON. Nothing in this repository imports from, or links to, the hospital-management modules.

## Hard constraints

- **Data lives in data packs** (`src/data/packs/`), never in components. Every figure carries confidence (`verified | reported | estimate | illustrative`) and source; the UI renders the confidence wherever the figure is shown. Illustrative values are never presented as verified.
- **All user-visible text goes through `src/data/vocab.ts`** with English keys and `sv`/`en` tables of identical key sets. Keys, enum values, types, file names, commit messages and code comments are English. Swedish typography rules are in `DESIGN.md`.
- **Synthetic people.** Patients, teams, visits, staff and messages are synthetic and marked so. No real person's name, no customer logo (the customer's name as text only). In the SUS pack the patients are patients in a Sjukhus hemma programme at SUS; the word ASIH is used only in the Karolinska pack, as a team name.
- **No network calls from the app beyond the map tiles.** Overpass is called only by `scripts/fetch-osm.mjs` and the workflow `.github/workflows/fetch-osm.yml`.
- No backend, auth or persistence. Minimum viewport 1280 px. No emoji, no ALL CAPS, no gradients.
- Medoma Center runs in the hospital's control centre on the hospital's backup power and is assumed never to fail in a power outage; what falls in the home is Medoma Care and the monitoring (Medoma Go).

## Decision protocol – never ask

When the spec is silent, choose the simplest option consistent with `SPEC.md`, implement it, and record it in `DECISIONS.md` (date, decision, rejected alternative, spec section). Never block, never leave a TODO in place of a decision. Where a later addendum of the prompt changes an earlier one, the later one applies and the change is logged.

## No guessing

- Use only labels, names, numbers and vocabularies defined in `SPEC.md`, `DATA.md` and `vocab.ts`.
- Inspect the existing store, routes, components and tests before changing them; reuse components rather than creating parallel ones.
- A batch is done when `npm run typecheck`, `npm test` and `npm run build` pass and every item of its definition of done has been checked in the running app.

## Repository layout

```
src/app/              nav, routes, layout, theme and language toggles, unit selector
src/components/       shared components (cards, chips, map layers, message thread, log drawer)
src/data/vocab.ts     every UI string, sv and en
src/data/packs/       data packs (sus, karolinska), types.ts, geo/<pack>/ OpenStreetMap files and fixtures
src/data/store*.ts    zustand store: home, incident, clock, audit log, locale, theme, preparedness
src/lib/              pure logic: reachability, roadGraph, osmNodes, preparedness, disruptions, realtime, time, scope, format
src/modules/          home, planning, patients, equipment, capacity, overview, dependencies, incident, platform stubs
scripts/              fetch-osm.mjs, osm-convert, generate-patients, make-geo-fixtures, overpass queries
docs/                 screenshots
```

## Conventions

TypeScript strict, named exports, one component per file, vitest for `src/lib/` and the store, conventional commits (one commit per batch, named for it), accessibility floor, every state change logged to the audit log with the clock's time.
