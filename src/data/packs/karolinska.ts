// The Karolinska home pack (DATA.md § 4): two sites, ten zones, four ASIH teams, the water, electricity and road nodes around the
// hospitals, three illustrative notices and the sources S-H1…S-H14. Coordinates from Google Places, read 2026-11-02 (`reported`).
// Copied from the source (Medoma-Resilience-KS); the hospital-management data of the source is not part of this repository.
import type { Confidence, Figure, HomeDisruptionPreset, HomeEquipment, HomeSite, HomeZone, InfraLayer, InfraLink, InfraNode, LocalizedText, Message, SourceRef } from './types';

/** A text in both languages (DESIGN-LANG.md § 3). */
const tx = (svText: string, enText: string): LocalizedText => ({ sv: svText, en: enText });

export const KAROLINSKA_SITES: HomeSite[] = [
  { id: 'solna', name: 'Karolinska Solna', lat: 59.3522, lng: 18.0322 },
  { id: 'huddinge', name: 'Karolinska Huddinge', lat: 59.2215, lng: 17.939 },
];

// ---------------------------------------------------------------------------
// SPEC.md § 13.4, DATA.md § 13 – three illustrative notices. The organisations are real, the senders are fictitious and the events never happened.
export const HOME_MESSAGES: Message[] = [
  {
    id: 'hmsg-road',
    author: 'Gunnar Salo',
    role: 'Trafikledare, Trafikverket',
    roleEn: 'Traffic controller, Trafikverket',
    at: '14:12',
    text: 'Trafikverket: Essingeleden avstängd i båda riktningarna efter olycka vid Fredhäll, beräknad tid 4 timmar',
    textEn: 'Trafikverket: Essingeleden closed in both directions after an accident at Fredhäll, estimated time 4 hours',
  },
  {
    id: 'hmsg-power',
    author: 'Irene Falkman',
    role: 'Driftledare, Ellevio',
    roleEn: 'Operations controller, Ellevio',
    at: '14:18',
    text: 'Ellevio: strömavbrott i delar av Huddinge, beräknad återställning 20:30',
    textEn: 'Ellevio: power outage in parts of Huddinge, estimated restoration 20:30',
  },
  {
    id: 'hmsg-water',
    author: 'Bo Strandman',
    role: 'Driftlarm, Stockholm Vatten och Avfall',
    roleEn: 'Operations alarm, Stockholm Vatten och Avfall',
    at: '14:25',
    text: 'Stockholm Vatten och Avfall: kokningsrekommendation i Solna tills vidare',
    textEn: 'Stockholm Vatten och Avfall: boil-water advisory in Solna until further notice',
  },
];

// ---------------------------------------------------------------------------
// Hospital at Home (SPEC.md § 11, DATA.md § 11). Coordinates read from Google Places on 2026-11-02 are
// `reported`; where Places returned an adjacent object the coordinate is `estimate` with its basis in
// coordSource. Routing of every link is schematic unless the link is marked verified.
const PLACES = 'Google Places, 2026-11-02';

const zoneVertex = (id: string) => `zone:${id}`;
const zone = (id: string, name: LocalizedText, lat: number, lng: number, radiusKm: number, urban = true): HomeZone => ({
  id,
  name,
  lat,
  lng,
  radiusKm,
  graphNode: zoneVertex(id),
  urban,
  coordConfidence: 'reported',
  coordSource: PLACES,
});

export const HOME_ZONES: HomeZone[] = [
  zone('solna', tx('Solna och Sundbyberg', 'Solna and Sundbyberg'), 59.3597, 18.0005, 2.5),
  zone('innerstaden', tx('Innerstaden norr', 'Inner city north'), 59.3312, 18.0407, 2.0),
  zone('bromma', tx('Bromma', 'Bromma'), 59.3383, 17.9401, 2.5),
  zone('sodermalm', tx('Södermalm', 'Södermalm'), 59.3125, 18.0616, 1.8),
  zone('soderort', tx('Söderort', 'Southern suburbs'), 59.2986, 18.0459, 2.5),
  zone('huddinge', tx('Huddinge', 'Huddinge'), 59.2365, 17.9818, 2.5),
  zone('botkyrka', tx('Botkyrka', 'Botkyrka'), 59.1988, 17.8332, 2.5, false),
  zone('nacka', tx('Nacka', 'Nacka'), 59.31, 18.1648, 2.5),
  zone('lidingo', tx('Lidingö', 'Lidingö'), 59.3661, 18.1352, 2.0),
  zone('taby', tx('Täby', 'Täby'), 59.4451, 18.0717, 2.5),
];

type InfraSeed = Omit<InfraNode, 'coordConfidence' | 'coordSource'> & { coord: [Confidence, string] };
const infra = ({ coord, ...rest }: InfraSeed): InfraNode => ({ ...rest, coordConfidence: coord[0], coordSource: coord[1] });
const placesCoord: [Confidence, string] = ['reported', PLACES];
const vehicles = tx('fordon per dygn', 'vehicles per day');

export const INFRA_NODES: InfraNode[] = [
  // --- Water ---------------------------------------------------------------
  infra({
    id: 'w-gorvaln', layer: 'water', kind: 'waterworks', name: tx('Görvälnverket (Norrvatten)', 'Görvälnverket (Norrvatten)'),
    lat: 59.4349, lng: 17.7873, verified: true,
    coord: ['estimate', 'Fallback estimate, used when OpenStreetMap has no matching object (DATA.md § 12)'],
    role: tx(
      'Norrvattens ytvattenverk vid Mälaren i Järfälla. Producerar dricksvatten till de 14 medlemskommunerna i norra Storstockholm, bland dem Solna och Sundbyberg: omkring 700 000 invånare, flera stora sjukhus och Arlanda. Går nära maxkapacitet under varma dagar; ett nytt verk byggs intill.',
      "Norrvatten's surface-water works on Mälaren in Järfälla. Produces drinking water for the 14 member municipalities in northern Greater Stockholm, including Solna and Sundbyberg: about 700 000 people, several large hospitals and Arlanda. Runs near maximum capacity on warm days; a new works is being built beside it.",
    ),
    status: tx(
      'Verifierat: Länsstyrelsen Stockholm (riksintresse Görvälnverket), Norrvatten, Solna stads riktlinje för nödvattenförsörjning 2023.',
      'Verified: Länsstyrelsen Stockholm (riksintresse Görvälnverket), Norrvatten, Solna stad nödvattenriktlinje 2023.',
    ),
  }),
  infra({
    id: 'w-norrvatten-reserve', layer: 'water', kind: 'reserve', name: tx('Norrvattens reservförsörjning', 'Norrvatten reserve supply'),
    lat: 59.4349, lng: 17.7873, verified: true, noMarker: true,
    coord: ['estimate', 'Off-map arrow N from w-gorvaln, no own marker; same position as Görvälnverket'],
    role: tx(
      'Om Görvälnverket inte kan producera kan Norrvatten leverera reservvatten från sina egna grundvattenverk i Stockholmsåsen eller via Stockholm Vatten och Avfalls distributionsnät.',
      "If Görvälnverket cannot produce, Norrvatten can deliver reserve water from its own groundwater works in Stockholmsåsen or via Stockholm Vatten och Avfall's distribution network.",
    ),
    status: tx('Verifierat: Solna stads riktlinje för nödvattenförsörjning 2023.', 'Verified: Solna stad nödvattenriktlinje 2023.'),
  }),
  infra({
    id: 'w-lovo', layer: 'water', kind: 'waterworks', name: tx('Lovö vattenverk (SVOA)', 'Lovö vattenverk (SVOA)'),
    lat: 59.33, lng: 17.8088, verified: true, coord: placesCoord,
    role: tx(
      'Stockholm Vatten och Avfalls verk på Lovön i Ekerö, med råvatten från Mälaren. Ett av SVOA:s två verk för Stockholm och Huddinge (Huddinges vatten drivs av SVOA sedan sammanslagningen). Vilka stadsdelar respektive verk försörjer är inte verifierat här.',
      "Stockholm Vatten och Avfall's works on Lovön, Ekerö, raw water from Mälaren. One of SVOA's two works for Stockholm and Huddinge (Huddinge's water is run by SVOA since the merger). Which districts each works serves is not verified here.",
    ),
    status: tx(
      'Verifierad existens och råvattenkälla: Länsstyrelsens beslut om vattenskyddsområde Östra Mälaren 2008. Fördelning mellan Lovö och Norsborg: ska verifieras.',
      'Verified existence and raw-water source: Länsstyrelsen vattenskyddsområde Östra Mälaren 2008. Supply split Lovö/Norsborg: to verify.',
    ),
  }),
  infra({
    id: 'w-norsborg', layer: 'water', kind: 'waterworks', name: tx('Norsborg vattenverk (SVOA)', 'Norsborg vattenverk (SVOA)'),
    lat: 59.2525, lng: 17.7953, verified: true, coord: placesCoord,
    role: tx(
      'SVOA:s verk i Norsborg, Botkyrka, med råvatten från Mälaren. Det andra benet i SVOA:s system.',
      "SVOA's works at Norsborg, Botkyrka, raw water from Mälaren. The second leg of the SVOA system.",
    ),
    status: tx(
      'Verifierad existens och råvattenkälla: Länsstyrelsen 2008. Försörjningsområde: ska verifieras.',
      'Verified existence and raw-water source: Länsstyrelsen 2008. Supply area: to verify.',
    ),
  }),
  infra({
    id: 'w-malaren', layer: 'water', kind: 'reserve', name: tx('Östra Mälaren – gemensam råvattenkälla', 'Östra Mälaren – common raw-water source'),
    lat: 59.33, lng: 17.8088, verified: true, noMarker: true,
    coord: ['estimate', 'No own marker; shown as the status text on the three works; same position as Lovö vattenverk'],
    role: tx(
      'Alla tre verken tar råvatten från Östra Mälaren, som har ett gemensamt vattenskyddsområde. En förorening av sjön drabbar Solna och Huddinge lika.',
      'All three works take raw water from Östra Mälaren, which has one shared water protection area. A contamination of the lake hits Solna and Huddinge alike.',
    ),
    status: tx('Verifierat: Länsstyrelsen 2008.', 'Verified: Länsstyrelsen 2008.'),
  }),
  // --- Electricity ---------------------------------------------------------
  infra({
    id: 'e-overby', layer: 'el', kind: 'transmission', name: tx('Överby 400 kV (Sollentuna)', 'Överby 400 kV (Sollentuna)'),
    lat: 59.4757, lng: 17.8844, verified: true,
    coord: ['estimate', 'Fallback estimate, used when OpenStreetMap has no matching object (DATA.md § 12)'],
    role: tx(
      'Svenska kraftnäts stamnätsnod i Sollentuna. En ny gasisolerad 400 kV-station byggs för att ansluta nya 400 kV-ledningar mot Odensala, Beckomberga och Hamra. Hamra–Överby beskrivs av Svenska kraftnät som en viktig huvudmatning in i Stockholms nät.',
      "Svenska kraftnät transmission node in Sollentuna. A new gas-insulated 400 kV station is being built to connect new 400 kV lines towards Odensala, Beckomberga and Hamra. Hamra–Överby is described by Svenska kraftnät as an important main feed into Stockholm's grid.",
    ),
    status: tx(
      'Verifierat: Svenska kraftnät (samrådsunderlag Storstockholm Väst, Hamra–Överby och Överby–Beckomberga; Ei:s alternativredovisning 2023).',
      'Verified: Svenska kraftnät (Storstockholm Väst, Hamra–Överby, Överby–Beckomberga consultation documents; Ei alternativredovisning 2023).',
    ),
  }),
  infra({
    id: 'e-beckomberga', layer: 'el', kind: 'transmission', name: tx('Beckomberga (Bromma)', 'Beckomberga (Bromma)'),
    lat: 59.3571, lng: 17.9003, verified: true, coord: ['estimate', 'Fallback estimate, used when OpenStreetMap has no matching object (DATA.md § 12)'],
    role: tx(
      'Befintlig 220 kV-station i västra Stockholm; en ny 400 kV-station planeras här som en del av Storstockholm Väst, där ledningen Överby–Beckomberga höjs från 220 till 400 kV och vidare ledningar planeras mot Bredäng och Kolbotten.',
      'Existing 220 kV transmission station in western Stockholm; a new 400 kV station is planned here as part of Storstockholm Väst, with the line Överby–Beckomberga raised from 220 to 400 kV and onward lines towards Bredäng and Kolbotten.',
    ),
    status: tx(
      'Verifierat: Svenska kraftnäts samrådsunderlag; tioårsplanen 2020–2029. Tidplanen i planen kan ha flyttats: ska verifieras.',
      'Verified: Svenska kraftnät consultation documents; 10-year plan 2020–2029. Timelines in the plan may have moved: to verify.',
    ),
  }),
  infra({
    id: 'e-hagby', layer: 'el', kind: 'transmission', name: tx('Hagby 400 kV (Täby)', 'Hagby 400 kV (Täby)'),
    lat: 59.4721, lng: 18.0212, verified: true, coord: ['estimate', 'Fallback estimate, used when OpenStreetMap has no matching object (DATA.md § 12)'],
    role: tx(
      'Befintlig 400 kV-station nordost om Stockholm, matad av 400 kV-ledningen från Odensala.',
      'Existing 400 kV station north-east of Stockholm, fed by the 400 kV line from Odensala.',
    ),
    status: tx(
      'Verifierad ledning Odensala–Hagby: Ei/Svenska kraftnät 2023. Stationsdetaljer: ska verifieras.',
      'Verified line Odensala–Hagby: Ei/Svenska kraftnät 2023. Station details: to verify.',
    ),
  }),
  infra({
    id: 'e-skanstull', layer: 'el', kind: 'transmission', name: tx('Skanstull (Citylänkens ändpunkt)', 'Skanstull (City Link terminal)'),
    lat: 59.3029, lng: 18.0795, verified: true,
    coord: ['estimate', 'Fallback estimate, used when OpenStreetMap has no matching object (DATA.md § 12)'],
    role: tx(
      'Ändpunkt för 400 kV-kabelsystemet Anneberg–Skanstull i Svenska kraftnäts program Stockholms Ström, som matar innerstaden från norr.',
      "Terminal of the 400 kV cable system Anneberg–Skanstull in Svenska kraftnät's Stockholms Ström programme, feeding the inner city from the north.",
    ),
    status: tx(
      'Rapporterat: Svenska kraftnäts tioårsplan 2020–2029 (planerad 2026). Nuvarande status: ska verifieras.',
      'Reported: Svenska kraftnät 10-year plan 2020–2029 (planned 2026). Current status: to verify.',
    ),
  }),
  infra({
    id: 'e-regionnat', layer: 'el', kind: 'transmission', name: tx('Regionnät 70–220 kV: ej kartlagt', 'Regional grid 70–220 kV: not mapped'),
    lat: 59.31, lng: 17.97, verified: false, coord: ['illustrative', 'Illustrative placement between the nodes'],
    role: tx(
      'Hur stamnätet når de lokala näten vid Solna och Huddinge är inte kartlagt. Regionnätet i Stockholm ägs av Ellevio och Vattenfall Eldistribution, som samarbetar med Svenska kraftnät i Stockholms Ström; vilket av dem som matar respektive sjukhus ska verifieras.',
      "How the transmission grid reaches the local grids at Solna and Huddinge is not mapped. The regional grid in Stockholm is owned by Ellevio and Vattenfall Eldistribution, which cooperate with Svenska kraftnät in Stockholms Ström; which of them feeds each site is to verify.",
    ),
    status: tx('Ej verifierat. Luckan att fylla först.', 'Not verified. The gap to fill first.'),
  }),
  // --- Roads and bridges ---------------------------------------------------
  infra({
    id: 'r-norra-lanken', layer: 'roads', osmWayNames: ['Norra länken'], kind: 'tunnel', name: tx('Norra länken (E4/E20)', 'Norra länken (E4/E20)'),
    lat: 59.3526, lng: 18.0696, verified: true, coord: placesCoord,
    role: tx(
      'Tunnellänk som binder ihop E4/E20 norr om innerstaden; sjukhuset i Solna ligger alldeles intill. Norra änden av Essingeleden.',
      'Tunnel link joining E4/E20 north of the inner city; the hospital in Solna sits directly beside it. Northern end of Essingeleden.',
    ),
    status: tx('Verifierat: Trafikverket.', 'Verified: Trafikverket.'),
  }),
  infra({
    id: 'r-essingeleden', layer: 'roads', osmWayNames: ['Essingeleden'], kind: 'bridge', name: tx('Essingeleden (E4)', 'Essingeleden (E4)'),
    lat: 59.3257, lng: 18.0045, verified: true, coord: ['reported', `${PLACES} (midpoint of the route)`],
    role: tx(
      'Sveriges mest trafikerade väg och den viktigaste vägförbindelsen mellan regionens norra och södra halva. Nio broar och viadukter mellan Västberga och Norra länken. Mycket av trafiken saknar alternativ väg.',
      "Sweden's busiest road and the main road connection between the northern and southern halves of the region. Nine bridges and viaducts between Västberga and Norra länken. Much of its traffic has no alternative route.",
    ),
    status: tx('Verifierat: Trafikverket 2026.', 'Verified: Trafikverket 2026.'),
    figures: [
      {
        label: tx('Trafik', 'Traffic'), unit: vehicles, value: 140000, valueMax: 170000, confidence: 'verified', source: 'S-H12', asOf: '2026-08',
      },
      {
        label: tx(
          'Snittet Saltsjö–Mälaren totalt (Essingeleden, Västerbron, Centralbron, Munkbroleden, Skeppsbron, Slussen)',
          'Saltsjö–Mälaren section total (Essingeleden, Västerbron, Centralbron, Munkbroleden, Skeppsbron, Slussen)',
        ),
        unit: vehicles, value: 309000, confidence: 'reported', source: 'S-H13', asOf: '2019', basis: 'cirka',
      },
    ],
  }),
  infra({
    id: 'r-vasterbron', layer: 'roads', osmWayNames: ['Västerbron'], kind: 'bridge', name: tx('Västerbron', 'Västerbron'),
    lat: 59.3243, lng: 18.0275, verified: true, coord: placesCoord,
    role: tx(
      'Bro mellan Kungsholmen och Södermalm över Riddarfjärden; en av innerstadens förbindelser i snittet Saltsjö–Mälaren.',
      'Bridge Kungsholmen–Södermalm over Riddarfjärden; one of the inner-city crossings in the Saltsjö–Mälaren section.',
    ),
    status: tx('Verifierat.', 'Verified.'),
    figures: [{ label: tx('Trafik', 'Traffic'), unit: vehicles, value: 24500, confidence: 'reported', source: 'S-H13', asOf: '2019' }],
  }),
  infra({
    id: 'r-centralbron', layer: 'roads', osmWayNames: ['Centralbron'], kind: 'bridge', name: tx('Centralbron', 'Centralbron'),
    lat: 59.3264, lng: 18.0635, verified: true, coord: placesCoord,
    role: tx(
      'Innerstadens huvudförbindelse intill Gamla stan mellan Norrmalm och Södermalm.',
      'The inner-city main crossing beside Gamla stan between Norrmalm and Södermalm.',
    ),
    status: tx('Verifierat.', 'Verified.'),
    figures: [{ label: tx('Trafik', 'Traffic'), unit: vehicles, value: 102000, confidence: 'reported', source: 'S-H13', asOf: '2019' }],
  }),
  infra({
    id: 'r-liljeholmsbron', layer: 'roads', osmWayNames: ['Liljeholmsbron'], kind: 'bridge', name: tx('Liljeholmsbron', 'Liljeholmsbron'),
    lat: 59.3134, lng: 18.0319, verified: true, coord: placesCoord,
    role: tx(
      'Bro mellan Södermalm och Liljeholmen, den västra förbindelsen från Södermalm till söderförorterna.',
      'Bridge Södermalm–Liljeholmen, the western crossing from Södermalm to the southern suburbs.',
    ),
    status: tx('Verifierat.', 'Verified.'),
    figures: [
      {
        label: tx('Trafik', 'Traffic'), unit: vehicles, value: 37000, confidence: 'reported', source: 'S-H14', basis: 'cirka; årtal ej fastställt (Stockholms stad)',
      },
    ],
  }),
  infra({
    id: 'r-skanstullsbron', layer: 'roads', osmWayNames: ['Skanstullsbron'], kind: 'bridge', name: tx('Skanstullsbron', 'Skanstullsbron'),
    lat: 59.3029, lng: 18.0795, verified: true, coord: placesCoord,
    role: tx(
      'Bro mellan Södermalm och Gullmarsplan över Hammarby kanal, som leder till Södra länken och söderförorterna.',
      'Bridge Södermalm–Gullmarsplan over Hammarby kanal, leading to Södra länken and the southern suburbs.',
    ),
    status: tx('Verifierad existens. Trafikuppgift: ska verifieras.', 'Verified existence. Traffic figure: to verify.'),
  }),
  infra({
    id: 'r-sodra-lanken', layer: 'roads', osmWayNames: ['Södra länken'], kind: 'tunnel', name: tx('Södra länken (E4/E20 / 222)', 'Södra länken (E4/E20 / 222)'),
    lat: 59.301, lng: 18.1054, verified: true, coord: placesCoord,
    role: tx(
      'Tunnellänk söder om innerstaden som binder ihop Essingeleden/E4 med Nacka och söderförorterna.',
      'Tunnel link south of the inner city joining Essingeleden/E4 with Nacka and the southern suburbs.',
    ),
    status: tx('Verifierat: Trafikverket.', 'Verified: Trafikverket.'),
  }),
];

/**
 * How the pack's nodes find their OpenStreetMap object (SPEC.md § 12.5): the object whose `name` contains `term`
 * (case-insensitive) in power.json or water.json gives the node its position.
 */
export const OSM_MATCHES: Array<{ nodeId: string; term: string; file: 'power' | 'water' }> = [
  { nodeId: 'w-gorvaln', term: 'Görväln', file: 'water' },
  { nodeId: 'e-overby', term: 'Överby', file: 'power' },
  { nodeId: 'e-beckomberga', term: 'Beckomberga', file: 'power' },
  { nodeId: 'e-hagby', term: 'Hagby', file: 'power' },
  { nodeId: 'e-skanstull', term: 'Skanstull', file: 'power' },
  { nodeId: 'e-kolbotten', term: 'Kolbotten', file: 'power' },
];

/** Kolbotten has no coordinate until OpenStreetMap supplies one (DATA.md § 11.2); it is added to the nodes when it matches. */
export const KOLBOTTEN: Omit<InfraNode, 'lat' | 'lng' | 'coordConfidence' | 'coordSource'> = {
  id: 'e-kolbotten',
  layer: 'el',
  kind: 'transmission',
  name: tx('Kolbotten', 'Kolbotten'),
  verified: true,
  role: tx(
    'Mål för de planerade 400 kV-ledningarna från Beckomberga i Svenska kraftnäts Storstockholm Väst, tillsammans med Bredäng. Stationens egen roll är inte verifierad här; läget kommer från OpenStreetMap.',
    "Destination of the planned 400 kV lines from Beckomberga in Svenska kraftnät's Storstockholm Väst, together with Bredäng. The station's own role is not verified here; its position comes from OpenStreetMap.",
  ),
  status: tx(
    'Namnet finns i Svenska kraftnäts samrådsunderlag och tioårsplan (S-H7, S-H9). Roll och tidplan: ska verifieras.',
    "The name is in Svenska kraftnät's consultation documents and 10-year plan (S-H7, S-H9). Role and timeline: to verify.",
  ),
};

const noLabel = tx('', '');
const link = (
  id: string,
  layer: InfraLayer,
  a: string,
  b: string,
  style: InfraLink['style'],
  verified: boolean,
  label: LocalizedText = noLabel,
  offmap?: InfraLink['offmap'],
): InfraLink => ({ id, layer, a, b, label, style, verified, ...(offmap ? { offmap } : {}) });
const z = zoneVertex;

export const HOME_INFRA_LINKS_KS: InfraLink[] = [
  // --- Water: schematic routing; only the connections the sources establish are verified ---------------
  link('wl-gorvaln-solna', 'water', 'w-gorvaln', z('solna'), 'dashed', true, tx('Norrvattens huvudledning, schematisk dragning', 'Norrvatten main, schematic routing')),
  link('wl-gorvaln-taby', 'water', 'w-gorvaln', z('taby'), 'dashed', false),
  link('wl-gorvaln-lidingo', 'water', 'w-gorvaln', z('lidingo'), 'dotted', false, tx('Lidingös leverantör: ska verifieras', 'Lidingö supplier: to verify')),
  link('wl-lovo-innerstaden', 'water', 'w-lovo', z('innerstaden'), 'dashed', false, tx('SVOA:s huvudledning, schematisk', 'SVOA main, schematic')),
  link('wl-lovo-bromma', 'water', 'w-lovo', z('bromma'), 'dashed', false),
  link('wl-norsborg-soderort', 'water', 'w-norsborg', z('soderort'), 'dashed', false),
  link('wl-norsborg-huddinge', 'water', 'w-norsborg', z('huddinge'), 'dashed', false),
  link('wl-norsborg-botkyrka', 'water', 'w-norsborg', z('botkyrka'), 'dashed', false),
  link(
    'wl-gorvaln-lovo', 'water', 'w-gorvaln', 'w-lovo', 'dotted', true,
    tx('Förbindelse mellan Norrvatten och SVOA finns; läget är schematiskt', 'Norrvatten–SVOA interconnection exists; location schematic'),
  ),
  link('wl-lovo-sodermalm', 'water', 'w-lovo', z('sodermalm'), 'dotted', false, tx('leverantör ska verifieras', 'supplier to verify')),
  link('wl-lovo-nacka', 'water', 'w-lovo', z('nacka'), 'dotted', false, tx('leverantör ska verifieras', 'supplier to verify')),
  link(
    'wl-gorvaln-reserve', 'water', 'w-gorvaln', 'w-norrvatten-reserve', 'dotted', true, noLabel,
    { dir: 'N', text: tx('Norrvattens reservförsörjning', 'Norrvatten reserve supply') },
  ),
  // --- Electricity: planned lines are dashed and not verified as existing connections ---------------------
  link('el-overby-hamra', 'el', 'e-overby', 'e-overby', 'solid', true, noLabel, { dir: 'N', text: tx('mot Hamra, huvudmatning', 'to Hamra, main feed') }),
  link('el-overby-odensala', 'el', 'e-overby', 'e-overby', 'dashed', false, tx('400 kV planerad', '400 kV planned'), { dir: 'N', text: tx('mot Odensala', 'to Odensala') }),
  link('el-hagby-odensala', 'el', 'e-hagby', 'e-hagby', 'solid', true, noLabel, { dir: 'N', text: tx('från Odensala, 400 kV', 'from Odensala, 400 kV') }),
  link(
    'el-beckomberga-bredang', 'el', 'e-beckomberga', 'e-beckomberga', 'dashed', false, tx('400 kV planerad', '400 kV planned'),
    { dir: 'S', text: tx('mot Bredäng och Kolbotten (400 kV planerad)', 'to Bredäng and Kolbotten (400 kV planned)') },
  ),
  link('el-skanstull-anneberg', 'el', 'e-skanstull', 'e-skanstull', 'dashed', false, noLabel, { dir: 'N', text: tx('kabel från Anneberg', 'cable from Anneberg') }),
  link('el-regionnat-solna', 'el', 'e-regionnat', 'solna', 'dashed', false, tx('regionnät, ej kartlagt', 'regional grid, not mapped')),
  link('el-regionnat-huddinge', 'el', 'e-regionnat', 'huddinge', 'dashed', false, tx('regionnät, ej kartlagt', 'regional grid, not mapped')),
];

/** Sources for DATA.md § 11 (S-H1…S-H14); coordinates are from Google Places, read 2026-11-02. */
export const HOME_SOURCES: SourceRef[] = [
  { key: 'S-H1', name: 'Länsstyrelsen Stockholm – riksintresse för Görvälnverket (catalog.lansstyrelsen.se)', date: '2013' },
  { key: 'S-H2', name: 'Norrvatten – projektinformation framtida vattenproduktion (Cision)', date: 'undated' },
  { key: 'S-H3', name: 'Solna stad – Riktlinje för nödvattenförsörjning', date: '2023-11' },
  { key: 'S-H4', name: 'Länsstyrelsen Stockholm – beslut om vattenskyddsområde Östra Mälaren', date: '2008-11-25' },
  { key: 'S-H5', name: 'Kommunalförbundet Norrvatten – SPAT-överenskommelse (medlemskommuner)', date: '2023' },
  { key: 'S-H6', name: 'Energimarknadsinspektionen – Svenska kraftnäts alternativredovisning Odensala–Överby', date: '2023' },
  { key: 'S-H7', name: 'Svenska kraftnät – samrådsunderlag Hamra–Överby 2020 och Överby–Beckomberga 2017–2020; informationsmöte Hamra–Överby', date: '2026-03-31' },
  { key: 'S-H8', name: 'Svenska kraftnät – lokaliserings-PM Hamra–Överby', date: '2020' },
  { key: 'S-H9', name: 'Svenska kraftnät – 10-year development plan 2020–2029', date: '2020' },
  { key: 'S-H10', name: 'Energimarknadsinspektionen – ändring av nätkoncession Odensala–Hagby', date: '2023' },
  { key: 'S-H11', name: 'Trafikverket – Essingeleden och fler broar i Stockholm får mer underhåll', date: '2026-06' },
  { key: 'S-H12', name: 'Trafikverket – Essingeleden fyller 60', date: '2026-08' },
  { key: 'S-H13', name: 'Stockholms stad – Stockholms trafikutveckling 2019, motorfordon', date: '2019' },
  { key: 'S-H14', name: 'Stockholms stad, trafikkontoret – tjänsteutlåtande om Liljeholmsbron (insynsverige.se)', date: 'undated' },
];

/** The three demo scenarios: the bridges, the power, the water. */
export const HOME_PRESETS: HomeDisruptionPreset[] = [
  { key: 'bridge', name: tx('Bro avstängd', 'Bridge closed'), blockedNodes: ['r-essingeleden', 'r-centralbron'], powerOutZones: [], waterOutZones: [], description: tx('Stänger Essingeleden och Centralbron.', 'Closes Essingeleden and Centralbron.') },
  { key: 'power', name: tx('Elavbrott', 'Power outage'), blockedNodes: [], powerOutZones: ['soderort', 'huddinge'], waterOutZones: [], description: tx('Slår ut elen i Söderort och Huddinge.', 'Cuts the power in the southern suburbs and Huddinge.') },
  { key: 'water', name: tx('Vattenstörning', 'Water disruption'), blockedNodes: [], powerOutZones: [], waterOutZones: ['solna'], description: tx('Kokningsrekommendation i Solna och Sundbyberg.', 'Boil-water advisory in Solna and Sundbyberg.') },
  { key: 'heat', name: tx('Värmebölja', 'Heatwave'), blockedNodes: [], powerOutZones: [], waterOutZones: [], heatZones: ['soderort', 'innerstaden'], description: tx('Värmebölja i Söderort och Innerstaden.', 'Heatwave in the southern suburbs and the inner city.') },
  { key: 'cold', name: tx('Kyla med elavbrott', 'Cold with power outage'), blockedNodes: [], powerOutZones: ['botkyrka'], waterOutZones: [], coldZones: ['botkyrka'], description: tx('Kyla och elavbrott i Botkyrka.', 'Cold and a power outage in Botkyrka.') },
];

/** Illustrative stock added to the in-use count of each equipment type (SPEC.md § 8). */
const stock = (value: number): Figure => ({ value, confidence: 'illustrative', basis: 'scenariobaslinje' });
export const KAROLINSKA_EQUIPMENT_STOCK: Record<HomeEquipment, Figure> = {
  'IV stand': stock(4), Pump: stock(3), 'Oxygen stationary': stock(1), 'Oxygen portable': stock(1), 'Self-monitoring kit': stock(6),
};
/** The cold chain: days of infusers in stock at the unit, illustrative. */
export const KAROLINSKA_UNIT_STOCK = { infusorsDays: { value: 3, confidence: 'illustrative', basis: 'scenariobaslinje' } satisfies Figure };
