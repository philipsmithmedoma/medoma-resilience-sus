# SPEC.md – Medoma Center, preparedness mode prototype

Precedence: `SPEC.md` > `DATA.md` > `DESIGN.md` > code. Where this file is silent, the behaviour lifted from the source repository (Medoma-Resilience-KS) stands, and every choice the spec does not make is logged in `DECISIONS.md`.

## 1. Purpose and the two modes

Medoma Center is the control-centre product of the Medoma platform: the hospital's operations function follows its patients in hospital-at-home programmes (Sjukhus hemma) from one screen. This repository is a clickable, front-end-only prototype of Medoma Center with a **preparedness mode** (beredskapsläge) added to it. It was lifted out of Medoma-Resilience-KS, where the hospital-management product (capacity, flow, evacuation, resources, network, scenario engine) lives and stays; the interface between the two products is the handover file (§ 7).

Two modes, one navigation:

* **Normal operation.** The Medoma platform pages: Patienter, Aktiviteter, Planering, Kapacitet, Medarbetare, Utrustning, Rapportering. Patienter, Planering, Kapacitet and Utrustning are real pages; Aktiviteter, Medarbetare and Rapportering are stubs.
* **Preparedness mode.** Activated with the button "Beredskap", by an active incident, or by a direct link to a preparedness route. The navigation shows Översikt, Sjukhus hemma and Incident; the platform pages move into the menu "Medoma" and gain a disruption layer (flags, affected counts, the column Störning). The mode answers one question fast: when something breaks (a road, the power, the water, the mobile network, a heatwave, a supplier), which patients are affected, which cannot be reached, who is prioritised and what does the team do about it.

Medoma Center itself runs in the hospital's control centre on the hospital's backup power and is assumed never to fail in a power outage. What fails in the home is Medoma Care (the patient app and the home equipment's data) and the monitoring, in the field Medoma Go.

Product rules:

* All text in the app goes through `src/data/vocab.ts` (English keys, `sv` and `en` tables with identical key sets). Swedish is the default language.
* Every number carries confidence and source as in `DATA.md` § 1. Illustrative values are never presented as verified.
* Patients, teams, visits, staff and messages are synthetic and marked so ("Fiktiva patientuppgifter – inga verkliga patienter."). No real person's name appears. No customer logo; the customer's name appears as text only.
* In the SUS pack the patients are patients in a Sjukhus hemma programme at SUS. The word ASIH is used only in the Karolinska pack, as a team name.
* No network calls from the app beyond the map tiles. Overpass is called only by `scripts/fetch-osm.mjs` and the workflow `fetch-osm.yml`.
* No backend, auth or persistence. Minimum viewport 1280 px. No emoji, no ALL CAPS, no gradients.

## 2. Navigation

Routes are hash-based. Navigation has two states chosen by `preparednessActive(state, route)` in `src/lib/preparedness.ts` (pure), not by viewport width.

**Normal operation.** Left: the logo, the unit selector (§ 4). Tabs, in this order, sv/en: Patienter/Patients (`/patients`), Aktiviteter/Activities (`/activities`), Planering/Planning (`/planning`), Kapacitet/Capacity (`/capacity`), Medarbetare/Employees (`/employees`), Utrustning/Equipment (`/equipment`), Rapportering/Reporting (`/reporting`). A 1 px vertical divider, then one outlined button "Beredskap" / "Preparedness". The right cluster: clock, language, theme, Demo, user. The root route `/` goes to `/patients`.

**Preparedness mode.** Left: the logo, the unit selector. One menu "Medoma" holding the seven platform entries, the divider, the tabs Översikt/Overview (`/overview`), Sjukhus hemma/Hospital at Home (`/home`), Incident (`/incident`), and `Beroenden`/`Dependencies` (`/dependencies`) as a tab after Incident. The button becomes a filled indicator "Beredskapsläge" / "Preparedness mode" in the accent colour (contrast at least 4.5:1 against its background) with a close control. The root route goes to `/overview`.

**Activation.** `preparednessActive` is true when (1) the manual flag `preparednessOn` is on, or (2) an incident is active, or (3) the route belongs to a preparedness module (`/overview`, `/home`, `/incident`, `/dependencies` and their children; taken from the module list, not hard-coded). The flag defaults to off; every change goes through `logEntry()` with the reason `manual`, `incident` or `route`. The button sets the flag and navigates to `/overview`. The close control clears the flag and, on a preparedness route, navigates to `/planning`; it is disabled with the tooltip "Avsluta incidenten först" / "End the incident first" while an incident is active. A reload on a preparedness route keeps the mode because the route alone makes it active.

Both states fit at 1 280 px in Swedish and English without horizontal scroll.

Stub pages (`/activities`, `/employees`, `/reporting`) show the page title and the sentence "Den här modulen finns i Medoma i dag och ligger utanför prototypen." / "This module exists in Medoma today and is outside the scope of this prototype." with a link to `/home` labelled "Gå till Sjukhus hemma" / "Go to Hospital at Home".

## 3. Data model (`src/data/packs/types.ts`)

Confidence: `'verified' | 'reported' | 'estimate' | 'illustrative'`. `Figure = { value: number | null; confidence; source?; asOf?; basis? }`; the UI renders the chip everywhere a figure is shown.

```ts
export type HomeEquipment = 'IV stand' | 'Pump' | 'Oxygen stationary' | 'Oxygen portable' | 'Self-monitoring kit';
export type MonitoringLevel = 'none' | 'spot' | 'continuous';
export type MonitoringReason = 'arrhythmia' | 'sepsis' | 'respiratory' | 'other';

interface HomeZone { id; name: LocalizedText; lat; lng; radiusKm; graphNode; urban: boolean; coordConfidence; coordSource }
interface HomeSite { id; name; lat; lng }
interface HomePatient {
  id; familyName; givenName; personalNumber: string;   // synthetic YYYYMMDD-XXXX, Luhn-invalid by construction
  age; zone; street; houseNo; lat; lng; team: string;
  equipment: HomeEquipment[];
  batteryHours: number | null;      // battery of the powered equipment or of the phone/hub; stationary concentrator 0
  backupHours: number | null;       // spare tubes of oxygen patients, illustrative 4–10 h
  monitoringLevel: MonitoringLevel; monitoringReason: MonitoringReason | null;
  antibiotic: string | null; heatSensitive: boolean;     // pump patients only
  visitToday: boolean;
  elCritical: boolean;              // derived: has an oxygen concentrator
  enrolledOn: string; plannedDischargeOn: string; appLoggedIn: boolean;
}
interface HomeTeam { id; name; baseLat; baseLng; baseLabel; cars; phone; staff: string[] }
interface HomePack {
  id; name; customer; sites; scopes; defaultScope; scopeMenu; zones; patients; registryExtras; teams; visits;
  infraNodes; infraLinks; messages; presets; sources; osmMatches; osmExtra; geo;
  unitStock: { infusorsDays: Figure };          // cold chain (§ 6)
  equipmentStock: Record<HomeEquipment, Figure>; // spare stock added to the in-use count (§ 8)
}
```

Equipment types and what depends on what (sources in `DATA.md` § 5; every battery time per patient is illustrative within its interval):

| Type (sv / en) | Weight | Electricity | Battery | Other |
|---|---|---|---|---|
| Droppställning / IV stand | 8 % | no | – | – |
| Pump / Pump (elastomeric) | 7 % | no | – | `antibiotic`, `heatSensitive`, change every 24 h |
| Syrgaskoncentrator, stationär / Oxygen concentrator, stationary | 8 % | yes, stops at once | 0 h | reserve tubes `backupHours` 4–10 h |
| Syrgaskoncentrator, bärbar / Oxygen concentrator, portable | 2 % | yes | 2–5 h | reserve tubes 4–10 h |
| Väska för egenmonitorering / Self-monitoring kit | 25 % | phone or hub | 12–24 h | data goes dark when the mobile network falls |

50 % of patients have no equipment. A patient has at most one type. Hemrespirator and Hemdialys are not equipment types in this prototype; water disruption affects patients through a boil-water advisory (a marking in the list, nothing critical).

Monitoring: patients with a self-monitoring kit are `spot` (daily measurements) in 60 % and `continuous` in 40 %; continuous splits arrhythmia 35 %, sepsis 40 %, respiratory 20 %, other 5 %. Patients without a kit are `none`. Level and reason are illustrative; the platform's own representation of monitoring level is "to verify".

Criticality has independent grounds: **power-critical** (oxygen concentrator patients in a power outage) and **monitoring-critical** (`continuous` while the zone is without contact, or will be within 2 h); further grounds from heat, cold and the cold chain (§ 6). The red ring on the map marks any critical ground; the list names which ground applies; the summary counts them separately.

Disruptions are records in time: `{ id; kind: 'road' | 'power' | 'water' | 'tele' | 'heat' | 'cold' | 'supplier'; target; targetKind: 'way' | 'road' | 'node' | 'zone' | 'pack'; label; startedAt; expectedEnd | null; source: 'map' | 'preset' | 'message' | 'hypothesis'; createdBy; endedAt; endReason; note }`.

Realtime fields are simulated against the clock (§ 6) and arrive in the interface of § 7: `lastContactAt`, `hubBatteryPct`, `phoneBatteryPct`, `lastMeasurementAt`, `pumpNextChangeAt` (clock minutes).

## 4. Packs

`homePacks: Record<HomePackId, HomePack>`. The default pack is `sus`; the second is `karolinska`. A pack carries its own sites, zones, patients, teams, infrastructure, messages, sources and where its OpenStreetMap files are (dynamic imports under `src/data/packs/geo/<pack>/`). Nothing in the app is specific to one customer.

**Unit selector** (far left, shows the name of the selected unit, as the platform does). The menu lists SUS, Lund, Malmö, and while the Karolinska pack is selected also Karolinska, Solna, Huddinge. Choosing a unit of a pack switches the pack (logged); choosing a site selects that site's patients and reachability. The Sjukhus hemma mode bar has a pack switch that works both ways.

### 4.1 SUS (default)

Customer: Skånes universitetssjukhus. Sites `suslund` "SUS Lund" 55.7118, 13.1985 and `susmalmo` "SUS Malmö" 55.5889, 13.0010 (Google Places 2026-11-03, `reported`). Scopes: `sus` (both sites), `suslund`, `susmalmo`. 16 zones, 200 patients (seed 20261103), teams "Sjukhus hemma Lund" and "Sjukhus hemma Malmö", two cars each. Details in `DATA.md` § 3. Reachability runs from the sites of the selected unit.

### 4.2 Karolinska

Customer: Karolinska Universitetssjukhuset. Sites Solna and Huddinge, ten zones, 150 patients (seed 20261102), four teams named ASIH Nord, ASIH City, ASIH Syd and ASIH Sydväst, two cars each. Details verbatim from the source in `DATA.md` § 4. Scopes `karolinska` (both sites), `solna`, `huddinge`.

## 5. Map, layers and real geography

Three-pane layout as in the platform's planning view: list 380 px, panel 320 px, map. Leaflet with OpenStreetMap tiles. The geometry is real: `scripts/fetch-osm.mjs` writes `roads.json`, `streets.json`, `power.json`, `water.json` per pack under `src/data/packs/geo/<pack>/` (budgets in `DATA.md` § 2); a hand-made `fixture*.json` with the same schema stands in until the workflow has run. The files are loaded with dynamic `import()` from the home routes only.

Layers (chips above the map): patients and roads on by default; el, water and **Tele** off. Tele is the fourth layer, "Tele" / "Connectivity", with no nodes of its own: it draws the zones and marks, per zone, whether the mobile network is up, falls within hours or is down (§ 6).

Road graph: a vertex per shared coordinate and way end, edges weighted by haversine metres, one-way respected; sites, patients and team bases snap to the nearest vertex within 1 500 m (beyond that a patient is "no road within 1.5 km" and unreachable). Reachability is Dijkstra by length from the sites in scope. Status per patient: `unreachable` (no path), `delayed` (shortest path at least 25 % or 3 km longer than baseline) or `ok`.

Start view of `/home` fits the zones and the sites of the selected pack, not the infrastructure nodes (24 px padding). Power: 400 kV lines yellow, 220 kV thinner in a muted tone, 70 kV not drawn; one label per connected line at its midpoint, labels only from zoom level 11. Water links 1 px, dotted, 50 % opacity, without labels. Patient dots radius 3 px; in dark mode light grey at 70 % opacity. Blocked elements render in the danger colour; critical patients get a hollow ring.

Infrastructure nodes take their positions from OpenStreetMap by name match (`osmMatches`); where there is no match the node keeps its fallback coordinate and the mismatch is logged. Patients live on real residential streets (`streets.json`), each at a random vertex of a random street way within its zone radius, with `street` and `houseNo` (illustrative, 1–60).

## 6. Disruptions, impact and time

State lives in the store slice `store-home.ts`. Map modes: `roads` (a tap closes road geometry, § 6.1), `el`, `water` (a tap on a zone toggles the outage), `heat`, `cold`; with no mode a tap selects an infrastructure node and dims everything it is not linked to. A disruption of kind `tele` or `supplier` is chosen in the panel and has no map target. "Reset" clears all disruptions. A record whose expected end is reached by the clock ends automatically ("ended (expected)"). The shared clock is the only time; "+1 h" advances it 60 minutes and logs it; all derived state recomputes.

**6.1 Closing roads (bunt 5).** In `roads` mode a tap on a road segment closes every way that shares `name` or `ref` with the tapped way and lies within 250 m of the tapped point, in both directions. The disruption's label is "<name> vid <nearest locality or zone>". "Block whole road" ("Blockera hela vägen") closes every way with that name. Named infrastructure nodes (bridges, tunnels, interchanges) close their `osmWayNames`.

**6.2 Impact.** `impact(pack, state, sites, model, clock)` returns one row per affected patient with reasons and flags: `unreachable`, `delayed` (with `extraKm` = shortest path now minus baseline, shown "+N km"), `power`, `water` (boil-water marking), `noContact`, `heat`, `cold`, `noPump`; plus a summary: affected, detour, unreachable and their zones, with visit today, power-critical, monitoring-critical, run out within 2 h, out of contact within 30 min, patients out of contact in X h (counting down, "N utan kontakt" once passed), median and maximum extra km, own team cannot reach / another team can.

**Battery.** For a patient in a power-out zone with `batteryHours`, `batteryEmptyAt = startedAt + (batteryHours + backupHours) × 60` from the earliest active power disruption covering the zone. Status "battery until HH:MM" / "battery empty"; a patient whose time has passed is critical.

**Mobile network and the tele layer.** Every zone has `urban`. In a power outage the mobile network is assumed to fall after 1 h in an urban zone and after 4 h elsewhere (PTS requirement on backup power, `DATA.md` § 5). From then the zone's patients are "utan kontakt": monitoring goes dark, the phone does not get through, and the action Kontakta requires a physical visit. The team's own app is assumed to fall in the zone too; the printed call list is the fallback and the panel says so when the first zone goes dark.

**Prioritise** orders rows: (1) unreachable with a visit today; (2) monitoring-critical and out of contact, sepsis before arrhythmia before respiratory before other; (3) power-critical by shortest battery plus reserve; (4) monitoring-critical that will be out of contact within 2 h; (5) other critical grounds (heat, cold, missing pump change); (6) other affected; (7) detour. Ties by battery, then name. For a monitoring-critical patient out of contact the panel proposes "Besök inom 2 h" / "Visit within 2 h" or Ta in; Kontakta by phone is shown as not possible.

**Heatwave** ("Värmebölja" / "Heatwave", per zone with start and expected end): pump patients with `heatSensitive` become critical after 6 h and other pump patients after 12 h; actions "Kylpåse" / "Cooling pouch" and "Kortare infusion" / "Shorter infusion" (logged; give 12 h extra) and Ta in; patients 80 and older are affected with the reason "värme" / "heat". **Cold** ("Kyla" / "Cold") is active only together with a power outage in the same zone: after 6 h every patient in the zone is affected with the reason "kallt hem" / "cold home" and patients 80 and older are critical.

**Cold chain.** `unitStock.infusorsDays` (illustrative, 3 days). A road disruption that closes every road within 250 m of a site, or a disruption of kind "Leverantör" / "Supplier" (chosen in the panel, no map), counts the stock down in real clock time; at zero every pump patient is critical with the reason "pumpbyte saknas" / "no replacement pump". Pumps are changed every 24 h at a per-patient time of day.

**Realtime simulation.** `lib/realtime.ts` (pure) produces, per patient and clock, the fields of § 3 in the event format of § 7. Normally: contact every 5 minutes (a per-patient phase), hub battery falling 4 % per hour and phone 6 %, both charged to 100 % at 07:00 and 22:00, daily measurements for spot patients at a per-patient time. In a power outage charging stops; when the mobile network falls according to the rule above `lastContactAt` stops updating for the zone's patients; when the outage ends everything resumes. A view that shows these fields says "Simulerat – kommer via integration" / "Simulated – via integration" at its first occurrence. The last-contact column shows relative time, red after 30 minutes without contact for `continuous`, 4 hours for `spot`, never for `none`, and the two batteries as small bars; the summary says "N utan kontakt de senaste 30 min" whether or not a disruption is registered, since that is the signal that comes first.

**Hypothesis.** When at least 60 % of a zone's patients have lost contact within the same 15 minutes (silent for at least 10 minutes) and no disruption is registered in the zone, the panel proposes "Misstänkt störning i <zon>" with the buttons "Registrera som elavbrott" and "Registrera som telestörning". Nothing is registered automatically. The Demo popover can start an unregistered outage in a zone for the demonstration; one starting 14:02 in Rosengård gives the proposal no later than 15:20 if the user has not registered it.

**Explanation chain.** An affected patient's row unfolds to a timeline of three to five steps in plain language with clock times, each carrying its source or assumption from `DATA.md`: for example "Elavbrott Rosengård 14:02 · Mobilnätet beräknas falla 15:02 (PTS, 1 h urbant) · Hubben senast sedd 15:04 · Utan kontakt sedan 15:04 · Kontinuerlig sepsisövervakning: besök inom 2 h". The call list prints the same chain, one line per patient.

## 7. Actions and handovers

Each affected patient has a status chain Unhandled → Contacted → Planned → Confirmed ("Ohanterad", "Kontaktad", "Planerad", "Bekräftad"). Actions (each logged with user, time and patient id): **Kontakta** (note; not possible by phone for a patient out of contact), **Flytta besök** (only with a visit today; a free slot of the patient's team or "inget besök i dag"), **Skicka team** (a team that can reach the patient; `assignedTeam`), **Besök inom 2 h**, **Kylpåse**, **Kortare infusion**, **Ta in** (marks the patient for handover to the nearest site in scope), **Bekräfta**. "Kontakta alla kritiska" contacts every critical row that can be reached by phone with the note "bulk contact". Status resets to Unhandled only when the disruption that affected the patient ends; the log keeps the history. "Ringlista" opens an A4 print view with name, street, phone placeholder "0XX-XXX XX XX", equipment, battery time, status, the explanation chain and an empty line for notes, carrying the fictitious-data marking.

**Handovers to hospital.** The action Ta in writes a record to the list "Överlämningar till sjukhus" / "Handovers to hospital" on `/overview` (time, patient, team, reason). The button "Exportera" / "Export" downloads one JSON file with one record per handover. This file is the interface to the hospital-management product (Medoma-Resilience-KS):

```json
{
  "schema": "medoma-center/handover/1",
  "exportedAt": "2026-09-04T15:12:00",     // demo clock
  "synthetic": true,
  "pack": "sus",
  "handovers": [
    { "id": "ho-1", "at": "15:12", "clockMinutes": 912, "site": "suslund",
      "patient": { "id": "sp-17", "familyName": "…", "givenName": "…", "age": 71, "personalNumber": "19550214-4821", "zone": "malmo" },
      "team": "Sjukhus hemma Malmö", "reasons": ["power", "noContact"], "priority": 2,
      "monitoring": { "level": "continuous", "reason": "sepsis" }, "equipment": ["Oxygen stationary"] }
  ]
}
```

**Incoming device event** (the interface the realtime fields stand for; one event per device): `{ deviceId: string; patientId: string; kind: 'hub' | 'phone' | 'sensor'; batteryPct: number | null; lastContactAt: number; lastMeasurementAt: number | null; source: string }`, `source` naming the supplier. No supplier delivers this to the platform today; Corsano and WARD 24/7 are the first to ask (`DATA.md` § 5).

## 8. Teams, visits, Planning, Patients, Equipment and Capacity

**Teams and cars.** Each pack has teams with a base, two cars and fictional staff. Bases snap to the road graph; each patient gets `reachableBy` and `nearestTeam` by road length; blocking updates them live. The summary says "N patienter som det egna teamet inte når; M av dem nås av annat team" with "Flytta till <team>" suggestions that perform Skicka team.

**Visits and Planning (`/planning`).** Patients with `visitToday` have a visit (08:00–17:00 in 30-minute steps, 45 min, deterministic from the seed). `/planning` shows today's visits grouped by team and sorted by start; in preparedness mode each row also carries the disruption flag. Selecting a visit shows the patient detail and the actions of § 7; the map shows the team's visits as a numbered sequence over the road layer. Flytta besök is the only way to change a slot.

**Patients (`/patients`).** Built after the platform's patient list: search field "Sök patient"/"Search for patient"; buttons "Registrera patient"/"Register patient" and "Visa dagsöversikt"/"Show daily overview" (no function, each logs a click); tabs Under bedömning / Inskrivna / Pausade / Utskrivna / Alla with counts; a table with the columns Efternamn, Förnamn, Personnummer, Patienttyp, Område, Patientansvarig, Inskriven, Planerad utskrivning, Patientapp. All pack patients are under Inskrivna; Under bedömning and Pausade get two synthetic patients each, Utskrivna three (`registryExtras`). Personnummer are synthetic (`YYYYMMDD-XXXX`, birth date consistent with the age, last four digits random with an invalid check digit so they can never be real). Patienttyp is "Sjukhus hemma"/"Hospital at home" for all. Område is the zone name. Patientansvarig is a synthetic name from the team's staff, the same for every patient in a zone. Patientapp shows "Inloggad"/"Logged in" for 60 %. A row click opens the same detail panel as Sjukhus hemma. In preparedness mode the table gains the first column Störning/Disruption with the patient's flag, and the columns Senast kontakt/Last contact with the two battery bars. One row per patient, 27 px row height, thin lines, no cards.

**Equipment (`/equipment`).** Title Utrustning/Equipment; one row per type with an expandable chevron and the count "i bruk/totalt" (in use is counted from the pack's patients; total is in use plus the pack's illustrative stock, `equipmentStock`). Expanded, the row lists the patients with that type in the same row as the Sjukhus hemma list. In preparedness mode each row adds "varav N hos påverkade patienter" / "of which N with affected patients" and the column Batteri with the shortest remaining battery time of the type among affected patients.

**Capacity (`/capacity`).** After the platform's view. At the top seven days from today, each with "N inskrivna" and the number of shifts. Below it three card groups: Patienter (Inskrivna, of which M with a visit; Bedömning; Planerad inskrivning; Planerad utskrivning), Aktiviteter (Hembesök, Mottagningsbesök, Videosamtal, Administrativ uppgift, Telefonsamtal) and Arbetspass. Then rows per profession (Sjuksköterska, Läkare) × shift (Dag, Kväll, Natt) with the number of visits per type, the number of shifts and the hours available. Synthetic shifts per team and day: four nurses day, two evening, one night, one doctor day, 8 h each; home visits are `homeVisits`; video calls, phone calls, clinic visits and administrative tasks are drawn deterministically to reasonable counts. In preparedness mode every shift adds "varav N påverkade av störning"/"of which N affected by disruption", an estimated extra driving time from the detours (extra km divided by 40 km/h), the day strip marks the days a disruption with an end time covers, and the card row gains a card Störning with the number of affected visits today. Not in normal operation.

## 9. Incident

The incident module is lifted unchanged from the source: `/incident` lists the five playbooks (PB1–PB5, in Region Stockholm's terms: LSSL, RSSL, PMI) and previous incidents; activating one creates an incident with roles, tasks, channels and targets; the active incident has the tabs Översikt (targets with their due times, roles, the task summary), Uppgifter, Kanaler (message threads per channel; `/incident/kanaler/:channelId`) and Logg; the incident banner shows under the navigation; closing keeps the log under Tidigare incidenter. Only the cross-module parts are removed: the targets are shown without live measurement, a received channel message has no "create request" link, and no playbook opens another module. An active incident turns preparedness mode on.

## 10. Overview page and Dependencies

**`/overview`** (preparedness mode). Realtime cards on top: "Utan kontakt nu", "Kortaste batteri (hub) i dag", "Nästa pumpbyte inom 2 h", each with clickable counts. Then cards in the Card style for patients at home, affected now, unreachable, battery empty within 2 h, active disruptions and incident status, each a Figure with confidence `illustrative`, linked to `/home` and `/incident`. Then the list "Överlämningar till sjukhus" with the button "Exportera" (§ 7).

**`/dependencies`** "Beroenden" / "Dependencies" (preparedness mode). A table with the columns Funktion, Beror på, Faller vid, Efter, Fallback and the status Opåverkad / Påverkad om X h / Påverkad computed from the active disruptions and the clock, with the number of patients affected where it can be counted. Rows: Medoma Go, Medoma Care, kontinuerlig monitorering, punktmätningar, stationär syrgaskoncentrator, bärbar syrgaskoncentrator, elastomerisk pump (värme), elastomerisk pump (kylkedja och leverans), kylförvarade läkemedel i hemmet, värme i hemmet, porttelefon och lås, hiss, trygghetslarm, personalens bilar, att nå patienten, syrgas- och läkemedelsleveranser, dricksvatten och hygien, överlämning till sjukhus. Texts, times and sources are in `DATA.md` § 6. The row for Medoma Center says "Ej beroende: sjukhusets reservkraft" / "Not dependent: hospital backup power".

## 11. Batches

Six batches on `main` (the repository was empty), then on the branch `center-build` with a pull request against `main`. Each: finish, `npm run typecheck`, `npm test`, `npm run build`, the definition of done checked in the running app, one commit named for the batch. The text of the prompt is in `PROMPTS.md`; the definitions of done are in the pull request.

1. **Seeding and contract files.** Code lifted from the source with the hospital-management parts left out; contract files written; `/home`, `/planning`, `/patients`, `/incident` render with the Karolinska pack; nothing refers to a removed module.
2. **The SUS pack** (additive; with the data model of § 3 and the realtime simulation, since the generators write both packs).
3. **Navigation and modes** (behaviour-changing), with the platform tabs and the patient list of § 8.
4. **Overview and handovers** (additive), with Equipment, Capacity, Dependencies and the realtime cards.
5. **Closing a road and the detour** (behaviour-changing).
6. **Map, polish and screenshots** (additive).
