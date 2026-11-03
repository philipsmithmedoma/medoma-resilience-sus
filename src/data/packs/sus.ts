// The SUS home pack (SPEC.md § 4.1, DATA.md § 3): two sites (Lund and Malmö), sixteen zones, two home teams, the water, electricity
// and road nodes around the hospitals, notices and the sources S-L1…S-L5. The Lund half is the Lund pack of the source repository
// (zones, nodes, links, sources, notices) with the counts of DATA.md § 3; the Malmö half is new. Coordinates are from Google Places,
// read 2026-10-17 for the Lund half and 2026-11-03 for the Malmö half and the sites (`reported`) unless a node says otherwise.
// The 200 patients are synthetic (`home-patients-sus.ts`).
import type { Confidence, Figure, HomeDisruptionPreset, HomeEquipment, HomeSite, HomeTeam, HomeZone, InfraFigure, InfraLayer, InfraLink, InfraNode, LocalizedText, Message, SourceRef } from './types';

const tx = (sv: string, en: string): LocalizedText => ({ sv, en });
const PLACES = 'Google Places, 2026-10-17';
const PLACES_MALMO = 'Google Places, 2026-11-03';
const noLabel = tx('', '');

export const SUS_SITES: HomeSite[] = [
  { id: 'suslund', name: 'SUS Lund', lat: 55.7118, lng: 13.1985 },
  { id: 'susmalmo', name: 'SUS Malmö', lat: 55.5889, lng: 13.001 },
];

const zone = (id: string, name: LocalizedText, lat: number, lng: number, radiusKm: number, urban: boolean, source = PLACES): HomeZone => ({
  id, name, lat, lng, radiusKm, graphNode: `zone:${id}`, urban, coordConfidence: 'reported', coordSource: source,
});

/** DATA.md § 3: the sixteen zones with their patient counts (Lund 40, 10, 10, 10, 10, 15, 5; Malmö 25, 10, 10, 15, 10, 5, 10, 5, 10 – 200 in all). */
export const SUS_ZONES: HomeZone[] = [
  zone('lund', tx('Lund', 'Lund'), 55.706, 13.192, 2.5, true),
  zone('kavlinge', tx('Kävlinge', 'Kävlinge'), 55.792, 13.112, 1.5, false),
  zone('lomma', tx('Lomma och Bjärred', 'Lomma and Bjärred'), 55.695, 13.055, 2.0, false),
  zone('staffanstorp', tx('Staffanstorp', 'Staffanstorp'), 55.642, 13.212, 1.5, false),
  zone('dalby', tx('Dalby', 'Dalby'), 55.666, 13.352, 1.5, false),
  zone('eslov', tx('Eslöv', 'Eslöv'), 55.838, 13.305, 2.0, false),
  zone('horby', tx('Hörby', 'Hörby'), 55.851, 13.66, 1.5, false),
  zone('malmo', tx('Malmö centrum', 'Malmö city'), 55.6061, 13.0002, 2.5, true, PLACES_MALMO),
  zone('limhamn', tx('Limhamn', 'Limhamn'), 55.5816, 12.9339, 2.0, true, PLACES_MALMO),
  zone('hyllie', tx('Hyllie', 'Hyllie'), 55.5644, 12.9735, 2.0, true, PLACES_MALMO),
  zone('rosengard', tx('Rosengård', 'Rosengård'), 55.586, 13.0431, 2.0, true, PLACES_MALMO),
  zone('arlov', tx('Arlöv och Burlöv', 'Arlöv and Burlöv'), 55.6398, 13.0848, 2.0, true, PLACES_MALMO),
  zone('oxie', tx('Oxie', 'Oxie'), 55.54, 13.0952, 1.5, false, PLACES_MALMO),
  zone('vellinge', tx('Vellinge', 'Vellinge'), 55.4721, 13.0205, 2.0, false, PLACES_MALMO),
  zone('svedala', tx('Svedala', 'Svedala'), 55.5083, 13.2359, 1.5, false, PLACES_MALMO),
  zone('trelleborg', tx('Trelleborg', 'Trelleborg'), 55.3744, 13.1584, 2.0, false, PLACES_MALMO),
];

const PHONE = '0XX-XXX XX XX';
export const SUS_TEAMS: HomeTeam[] = [
  { id: 'shh-lund', name: 'Sjukhus hemma Lund', baseLat: 55.704, baseLng: 13.192, baseLabel: tx('Lund centrum', 'Lund centre'), cars: 2, phone: PHONE, staff: ['Ingela Rydén', 'Tomas Wiklund', 'Susanne Ahrling'] },
  { id: 'shh-malmo', name: 'Sjukhus hemma Malmö', baseLat: 55.606, baseLng: 13.0, baseLabel: tx('Malmö centrum', 'Malmö city'), cars: 2, phone: PHONE, staff: ['Camilla Brolin', 'Henrik Savander', 'Marianne Östling'] },
];

/** Illustrative notices of the two halves, one per kind each. */
type Seed = Omit<InfraNode, 'coordConfidence' | 'coordSource'> & { coord?: [Confidence, string] };
const infra = ({ coord = ['reported', PLACES], ...rest }: Seed): InfraNode => ({ ...rest, coordConfidence: coord[0], coordSource: coord[1] });
const vehicles = tx('fordon per dygn', 'vehicles per day');

export const SUS_INFRA_NODES: InfraNode[] = [
  // --- Water ---------------------------------------------------------------
  infra({
    id: 'w-ringsjo', layer: 'water', kind: 'waterworks', name: tx('Ringsjöverket (Stehag)', 'Ringsjöverket (Stehag)'),
    lat: 55.8947, lng: 13.3949, verified: true,
    role: tx(
      'Sydvattens verk som renar Bolmenvatten, levererat genom den 80 km långa Bolmentunneln. Försörjer Lund, Lomma, Svalöv och delar av Malmö.',
      "Sydvatten's works treating Bolmen water delivered through the 80 km Bolmentunneln. Serves Lund, Lomma, Svalöv and parts of Malmö.",
    ),
    status: tx('Verifierat: Sydvatten, hållbarhets- och årsredovisningar och kvalitetsrapport 2024 (S-L1).', 'Verified: Sydvatten sustainability and annual reports and quality report 2024 (S-L1).'),
  }),
  infra({
    id: 'w-ringsjon', layer: 'water', kind: 'reserve', name: tx('Ringsjön (reserv)', 'Ringsjön (reserve)'),
    lat: 55.8642, lng: 13.556, verified: true,
    role: tx('Reservråvatten för Ringsjöverket.', 'Reserve raw water for Ringsjöverket.'),
    status: tx('Verifierat: Sydvatten, hållbarhets- och årsredovisningar och kvalitetsrapport 2024 (S-L1).', 'Verified: Sydvatten sustainability and annual reports and quality report 2024 (S-L1).'),
  }),
  infra({
    id: 'w-vomb', layer: 'water', kind: 'waterworks', name: tx('Vombverket', 'Vombverket'),
    lat: 55.6623, lng: 13.5294, verified: true,
    role: tx('Sydvattens andra verk, med råvatten från Vombsjön.', "Sydvatten's second works, with raw water from Vombsjön."),
    status: tx('Verifierat: Sydvatten, hållbarhets- och årsredovisningar och kvalitetsrapport 2024 (S-L1).', 'Verified: Sydvatten sustainability and annual reports and quality report 2024 (S-L1).'),
  }),
  infra({
    id: 'w-kallby', layer: 'water', kind: 'pumping', name: tx('Källby pumpstation', 'Källby pumping station'),
    lat: 55.6887, lng: 13.1717, verified: true,
    coord: ['estimate', 'Läget är hämtat från VA SYD:s närliggande verk (DATA.md § 14) / Position taken from the adjacent VA SYD works (DATA.md § 14)'],
    role: tx(
      'Pumpstation som styr överföringen mellan Ringsjöverkets och Vombverkets system. Den lokala distributionen sköts av VA SYD.',
      'Pumping station that controls the transfer between the Ringsjöverket and Vombverket systems. Local distribution is run by VA SYD.',
    ),
    status: tx('Funktionen verifierad (S-L1); läget är en uppskattning från det intilliggande verket.', 'Function verified (S-L1); the position is an estimate from the adjacent works.'),
  }),
  // --- Electricity ------------------------------------------------------------
  infra({
    id: 'e-hurva', layer: 'el', kind: 'transmission', name: tx('Hurva 400 kV', 'Hurva 400 kV'),
    lat: 55.8313, lng: 13.6034, verified: true,
    role: tx('Landningspunkt för SydVästlänken, 400 kV till Sege och Barsebäck. Hansa PowerBridge är planerad.', 'Landing point of SydVästlänken, 400 kV to Sege and Barsebäck. Hansa PowerBridge is planned.'),
    status: tx('Verifierat: Svenska kraftnät och Energimarknadsinspektionen (S-L2).', 'Verified: Svenska kraftnät and Energimarknadsinspektionen (S-L2).'),
  }),
  infra({
    id: 'e-barseback', layer: 'el', kind: 'transmission', name: tx('Barsebäck 400/130 kV', 'Barsebäck 400/130 kV'),
    lat: 55.7435, lng: 12.9202, verified: true,
    role: tx(
      'Aktiv stamnätsnod efter reaktorernas nedläggning, ny 400 kV-station 2018. 130 kV-sidan matar regionnätet.',
      'Active transmission node after the reactors closed, new 400 kV station in 2018. The 130 kV side feeds the regional grid.',
    ),
    status: tx('Verifierat: Svenska kraftnät och Energimarknadsinspektionen (S-L2).', 'Verified: Svenska kraftnät and Energimarknadsinspektionen (S-L2).'),
  }),
  infra({
    id: 'e-sege', layer: 'el', kind: 'transmission', name: tx('Sege 400 kV (Arlöv)', 'Sege 400 kV (Arlöv)'),
    lat: 55.6171, lng: 13.0839, verified: true,
    coord: ['estimate', 'Läget ska kontrolleras (DATA.md § 14) / The position is to be checked (DATA.md § 14)'],
    role: tx('Södra noden i stamnätet. Ledningarna till Hurva och Barsebäck är verifierade.', 'The southern node of the transmission grid. The lines to Hurva and Barsebäck are verified.'),
    status: tx('Ledningar verifierade (S-L2); läget ska kontrolleras.', 'Lines verified (S-L2); the position is to be checked.'),
  }),
  infra({
    id: 'e-ortofta', layer: 'el', kind: 'generation', name: tx('Örtoftaverket', 'Örtoftaverket'),
    lat: 55.7895, lng: 13.2557, verified: true,
    role: tx(
      'Kraftringens biobränsleeldade kraftvärmeverk, cirka 220 GWh el per år. En ny enhet planeras till 2028.',
      "Kraftringen's biomass combined heat and power plant, about 220 GWh of electricity a year. A new unit is planned for 2028.",
    ),
    status: tx('Verifierat: Kraftringen (S-L4).', 'Verified: Kraftringen (S-L4).'),
    figures: [{ label: tx('Elproduktion', 'Electricity production'), unit: tx('GWh per år', 'GWh per year'), value: 220, confidence: 'reported', source: 'S-L4', basis: 'cirka' } satisfies InfraFigure],
  }),
  infra({
    id: 'e-regionnat', layer: 'el', kind: 'transmission', name: tx('Regionnät 130 kV: ej kartlagt', 'Regional grid 130 kV: not mapped'),
    lat: 55.72, lng: 13.334, verified: false,
    coord: ['illustrative', 'Illustrativ placering mellan noderna / Illustrative placement between the nodes'],
    role: tx(
      'Hur stamnätet når de lokala näten vid SUS Lund är inte kartlagt. Vem som matar sjukhuset är att verifiera.',
      'How the transmission grid reaches the local grids at SUS Lund is not mapped. Which operator feeds the hospital is to verify.',
    ),
    status: tx('Ej verifierat. Luckan att fylla först.', 'Not verified. The gap to fill first.'),
  }),
  // --- Roads ---------------------------------------------------------------------
  infra({
    id: 'r-lund-n', layer: 'roads', kind: 'junction', osmWayNames: ['Trafikplats Lund Norra'], name: tx('Tpl Lund Norra, E22', 'Tpl Lund Norra, E22'),
    lat: 55.717, lng: 13.2225, verified: true,
    role: tx('Sjukhusets närmaste E22-anslutning. En ny anslutning till Ideon byggs 2025–2028.', "The hospital's nearest E22 access. A new access to Ideon is being built 2025–2028."),
    status: tx('Verifierat: Trafikverket (S-L3).', 'Verified: Trafikverket (S-L3).'),
  }),
  infra({
    id: 'r-lund-s', layer: 'roads', kind: 'junction', osmWayNames: ['Trafikplats Lund Södra'], name: tx('Tpl Lund Södra, E22/108', 'Tpl Lund Södra, E22/108'),
    lat: 55.6803, lng: 13.1828, verified: true,
    role: tx('E22:s södra anslutning till Lund, med väg 108. Alla broar byts ut 2024–2026.', "E22's southern access to Lund, with road 108. All bridges are being replaced 2024–2026."),
    status: tx('Verifierat: Trafikverket (S-L3).', 'Verified: Trafikverket (S-L3).'),
    figures: [{ label: tx('Trafik', 'Traffic'), unit: vehicles, value: 50000, confidence: 'reported', source: 'S-L3', basis: 'mer än' } satisfies InfraFigure],
  }),
  infra({
    id: 'r-gardstanga', layer: 'roads', kind: 'junction', osmWayNames: ['Trafikplats Gårdstånga'], name: tx('Tpl Gårdstånga, E22', 'Tpl Gårdstånga, E22'),
    lat: 55.7712, lng: 13.3226, verified: true,
    role: tx('E22:s port i nordost, i Kävlingeådalen.', "E22's gate to the north-east, in the Kävlingeån valley."),
    status: tx('Verifierat: Trafikverket (S-L3). Själva passagen över Kävlingeån är inte verifierad.', 'Verified: Trafikverket (S-L3). The Kävlingeån crossing itself is not verified.'),
  }),
  infra({
    id: 'r-hoje', layer: 'roads', kind: 'bridge', name: tx('E22 över Höje å', 'E22 over Höje å'),
    lat: 55.6895, lng: 13.1975, verified: true,
    role: tx('E22 passerar Höje å söder om centrala Lund.', 'E22 passes Höje å south of central Lund.'),
    status: tx('Verifierad passage: Trafikverket (S-L3).', 'Verified passage: Trafikverket (S-L3).'),
  }),
];

const link = (id: string, layer: InfraLayer, a: string, b: string, style: InfraLink['style'], verified: boolean, label: LocalizedText = noLabel, offmap?: InfraLink['offmap']): InfraLink => ({
  id, layer, a, b, label, style, verified, ...(offmap ? { offmap } : {}),
});
const SITE = 'suslund';
const MALMO = 'susmalmo';

/**
 * The roads come from OpenStreetMap, so there are no corridor links (DATA.md § 14). The three transmission lines between the
 * 400 kV nodes are drawn from power.json, as in § 12.5, and are not repeated here; the off-map arrows stay.
 */
export const SUS_INFRA_LINKS: InfraLink[] = [
  link('wl-ringsjo-kallby', 'water', 'w-ringsjo', 'w-kallby', 'dashed', true, tx('Överföring mellan systemen, schematisk dragning', 'Transfer between the systems, schematic routing')),
  link('wl-vomb-kallby', 'water', 'w-vomb', 'w-kallby', 'dashed', true, tx('Överföring mellan systemen, schematisk dragning', 'Transfer between the systems, schematic routing')),
  link('wl-ringsjon-ringsjo', 'water', 'w-ringsjon', 'w-ringsjo', 'dotted', true, tx('Reservråvatten', 'Reserve raw water')),
  link('wl-kallby-site', 'water', 'w-kallby', SITE, 'dotted', false, tx('lokal distribution VA SYD: ska verifieras', 'local distribution VA SYD: to verify')),
  link('wl-ringsjo-bolmen', 'water', 'w-ringsjo', 'w-ringsjo', 'solid', true, noLabel, { dir: 'N', text: tx('Bolmentunneln till Bolmen, 80 km', 'Bolmentunneln to Bolmen, 80 km') }),
  link('el-regionnat-site', 'el', 'e-regionnat', SITE, 'dashed', false, tx('regionnät, ej kartlagt', 'regional grid, not mapped')),
  link('el-ortofta-site', 'el', 'e-ortofta', SITE, 'dashed', false),
  link('el-hurva-sydvastlanken', 'el', 'e-hurva', 'e-hurva', 'solid', true, noLabel, { dir: 'N', text: tx('SydVästlänken', 'SydVästlänken') }),
  link('el-barseback-soderasen', 'el', 'e-barseback', 'e-barseback', 'solid', true, noLabel, { dir: 'N', text: tx('mot Söderåsen', 'to Söderåsen') }),
  link('wl-vomb-malmo', 'water', 'w-vomb', MALMO, 'dotted', false, tx('Vombverket är även Malmös nod; distribution VA SYD: ska verifieras', 'Vombverket is also a node of Malmö; distribution VA SYD: to verify')),
  link('wl-ringsjo-malmo', 'water', 'w-ringsjo', MALMO, 'dotted', false, tx('Ringsjöverket försörjer delar av Malmö (S-L1); dragning schematisk', 'Ringsjöverket serves parts of Malmö (S-L1); routing schematic')),
  link('el-sege-malmo', 'el', 'e-sege', MALMO, 'dashed', false, tx('Sege är Malmös södra stamnätsnod; matning ej kartlagd', 'Sege is the southern transmission node of Malmö; feed not mapped')),
  link('el-hurva-hansa', 'el', 'e-hurva', 'e-hurva', 'dashed', false, tx('planerad', 'planned'), { dir: 'S', text: tx('Hansa PowerBridge, planerad', 'Hansa PowerBridge, planned') }),
];

export const SUS_SOURCES: SourceRef[] = [
  { key: 'S-L1', name: 'Sydvatten – hållbarhets- och årsredovisningar och kvalitetsrapport 2024', date: '2024' },
  { key: 'S-L2', name: 'Svenska kraftnät / Energimarknadsinspektionen – Hurva–Sege, Hurva–Barsebäck, Barsebäck–Sege och Barsebäck 400/130 kV-station; Wikipedia om SydVästlänken', date: 'undated' },
  { key: 'S-L3', name: 'Trafikverket – E22 Lund Södra och väg 108; E22 genom Skåne', date: 'undated' },
  { key: 'S-L4', name: 'Kraftringen – Örtoftaverket', date: 'undated' },
  { key: 'S-L5', name: 'Trafikverket – vägnumrering (väg 102, väg 108)', date: 'undated' },
];

/** How the nodes find their OpenStreetMap object (SPEC.md § 12.5 applied to Lund, DATA.md § 14): substations and water works by name. */
export const SUS_OSM_MATCHES: Array<{ nodeId: string; term: string; file: 'power' | 'water' }> = [
  { nodeId: 'e-hurva', term: 'Hurva', file: 'power' },
  { nodeId: 'e-barseback', term: 'Barsebäck', file: 'power' },
  { nodeId: 'e-sege', term: 'Sege', file: 'power' },
  { nodeId: 'w-ringsjo', term: 'Ringsjöverket', file: 'water' },
  { nodeId: 'w-vomb', term: 'Vombverket', file: 'water' },
];

/** SPEC.md § 13.4 for Lund: the same three kinds with Lund names; illustrative, the organisations exist and the senders are fictitious. */
export const SUS_MESSAGES: Message[] = [
  {
    id: 'smsg-road', author: 'Mats Hallin', role: 'Trafikledare, Trafikverket', roleEn: 'Traffic controller, Trafikverket', at: '14:12',
    text: 'Trafikverket: E22 vid Lund Södra avstängd i båda riktningarna, beräknad tid 3 timmar',
    textEn: 'Trafikverket: E22 at Lund Södra closed in both directions, estimated time 3 hours',
  },
  {
    id: 'smsg-power', author: 'Pia Norrby', role: 'Driftledare, Kraftringen', roleEn: 'Operations controller, Kraftringen', at: '14:18',
    text: 'Kraftringen: strömavbrott i Dalby, beräknad återställning 19:30',
    textEn: 'Kraftringen: power outage in Dalby, estimated restoration 19:30',
  },
  {
    id: 'smsg-water', author: 'Ola Sandell', role: 'Driftlarm, VA SYD', roleEn: 'Operations alarm, VA SYD', at: '14:25',
    text: 'VA SYD: kokningsrekommendation i Kävlinge tills vidare',
    textEn: 'VA SYD: boil-water advisory in Kävlinge until further notice',
  },
  {
    id: 'smsg-m-road', author: 'Lena Brodin', role: 'Trafikledare, Trafikverket', roleEn: 'Traffic controller, Trafikverket', at: '14:15',
    text: 'Trafikverket: Inre Ringvägen avstängd i båda riktningarna efter olycka, beräknad tid 2 timmar',
    textEn: 'Trafikverket: Inre Ringvägen closed in both directions after an accident, estimated time 2 hours',
  },
  {
    id: 'smsg-m-power', author: 'Anders Wihlborg', role: 'Driftledare, elnätsägaren', roleEn: 'Operations controller, the grid owner', at: '14:20',
    text: 'Elnätsägaren: strömavbrott i Rosengård, beräknad återställning 19:00',
    textEn: 'The grid owner: power outage in Rosengård, estimated restoration 19:00',
  },
  {
    id: 'smsg-m-water', author: 'Katja Nordenfelt', role: 'Driftlarm, VA SYD', roleEn: 'Operations alarm, VA SYD', at: '14:28',
    text: 'VA SYD: kokningsrekommendation i Limhamn tills vidare',
    textEn: 'VA SYD: boil-water advisory in Limhamn until further notice',
  },
];

/** The five demo scenarios of the SUS pack: the interchanges at Lund, power in Rosengård and Dalby, water in Limhamn and Kävlinge, heat, and cold with a power outage. */
export const SUS_PRESETS: HomeDisruptionPreset[] = [
  {
    key: 'bridge', name: tx('Trafikplatser avstängda', 'Interchanges closed'), blockedNodes: ['r-lund-n', 'r-lund-s'], powerOutZones: [], waterOutZones: [],
    description: tx('Stänger Trafikplats Lund Norra och Södra.', 'Closes Trafikplats Lund Norra and Södra.'),
  },
  {
    key: 'power', name: tx('Elavbrott', 'Power outage'), blockedNodes: [], powerOutZones: ['rosengard', 'dalby'], waterOutZones: [],
    description: tx('Slår ut elen i Rosengård (urban) och Dalby.', 'Cuts the power in Rosengård (urban) and Dalby.'),
  },
  {
    key: 'water', name: tx('Vattenstörning', 'Water disruption'), blockedNodes: [], powerOutZones: [], waterOutZones: ['limhamn', 'kavlinge'],
    description: tx('Kokningsrekommendation i Limhamn och Kävlinge.', 'Boil-water advisory in Limhamn and Kävlinge.'),
  },
  {
    key: 'heat', name: tx('Värmebölja', 'Heatwave'), blockedNodes: [], powerOutZones: [], waterOutZones: [], heatZones: ['malmo', 'lund'],
    description: tx('Värmebölja i Malmö centrum och Lund.', 'Heatwave in Malmö city and Lund.'),
  },
  {
    key: 'cold', name: tx('Kyla med elavbrott', 'Cold with power outage'), blockedNodes: [], powerOutZones: ['svedala'], waterOutZones: [], coldZones: ['svedala'],
    description: tx('Kyla och elavbrott i Svedala.', 'Cold and a power outage in Svedala.'),
  },
];

/** Illustrative stock added to the in-use count of each equipment type (SPEC.md § 8): Droppställning +4, Pump +3, Syrgaskoncentrator +2 (one of each kind), Väska +6. */
const stock = (value: number): Figure => ({ value, confidence: 'illustrative', basis: 'scenariobaslinje' });
export const SUS_EQUIPMENT_STOCK: Record<HomeEquipment, Figure> = {
  'IV stand': stock(4), Pump: stock(3), 'Oxygen stationary': stock(1), 'Oxygen portable': stock(1), 'Self-monitoring kit': stock(6),
};
/** The cold chain: days of infusers in stock at the unit, illustrative. */
export const SUS_UNIT_STOCK = { infusorsDays: { value: 3, confidence: 'illustrative', basis: 'scenariobaslinje' } satisfies Figure };
