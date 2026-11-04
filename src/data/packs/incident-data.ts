// The incident data of the product (SPEC.md § 9): fictional staff and the five playbooks, copied unchanged from the source
// (Medoma-Resilience-KS). The playbooks use Region Stockholm's terms (LSSL, RSSL, PMI); a Region Skåne version is future work (DECISIONS.md).
import type { LocalizedText, Playbook, Staff } from './types';

/** A text in both languages (DESIGN-LANG.md § 3). */
const tx = (svText: string, enText: string): LocalizedText => ({ sv: svText, en: enText });

// ---------------------------------------------------------------------------
// § 7 People (all fictional)
export const STAFF: Staff[] = [
  { name: 'Eva Lind', title: 'Kapacitetskoordinator, Stab Produktion', profession: 'Supp', nodeId: 'hospital' },
  { name: 'Johan Ek', title: 'Överläkare, PMI', profession: 'Doc', nodeId: 'solna' },
  { name: 'Maria Holm', title: 'Verksamhetschef IVA Solna', profession: 'Doc', nodeId: 'solna' },
  { name: 'Omar Haddad', title: 'Anestesiläkare, PMI', profession: 'Doc', nodeId: 'huddinge' },
  { name: 'Peter Nord', title: 'Chefssjuksköterska, Akutmottagningen Huddinge', profession: 'Nrs', nodeId: 'huddinge' },
  { name: 'Sara Lund', title: 'Sjuksköterska, Intensivakuten', profession: 'Nrs', nodeId: 'solna' },
  { name: 'Karin Sjö', title: 'Logistiksamordnare, Stab Produktion', profession: 'Supp', nodeId: 'huddinge' },
  { name: 'Erik Falk', title: 'Samordnare, Ambulanssjukvården', profession: 'Supp', nodeId: 'ambulans' },
  { name: 'Lena Åkesson', title: 'Kommunikatör (KiB)', profession: 'Supp', nodeId: 'hospital' },
  { name: 'Helena Berg', title: 'Chefläkare, Södersjukhuset', profession: 'Doc', nodeId: 'sos' },
  { name: 'Mats Öberg', title: 'Vårdhubbsansvarig', profession: 'Nrs' },
  { name: 'Jonas Vik', title: 'Fältsjukhuschef', profession: 'Doc' },
  { name: 'Anna Ek', title: 'Verksamhetschef ASIH', profession: 'Nrs', nodeId: 'asih' },
];

// ---------------------------------------------------------------------------
// § 8.2 Playbooks – names, triggers, summaries, roles, tasks, channels and targets carry { sv, en } (DESIGN-LANG.md § 3)
const R = {
  ledare: tx('Sjukvårdsledare LSSL', 'Medical commander (LSSL)'),
  medicinsk: tx('Medicinskt ansvarig', 'Medical lead'),
  akut: tx('Akutansvarig', 'ED lead'),
  operation: tx('Operationsansvarig (PMI)', 'Surgery lead (PMI)'),
  iva: tx('IVA-ansvarig', 'ICU lead (IVA)'),
  logistik: tx('Logistikansvarig', 'Logistics lead'),
  kommunikation: tx('Kommunikationsansvarig (KiB)', 'Communications lead (KiB)'),
  krisstod: tx('Krisstödsansvarig (PKL)', 'Crisis support lead (PKL)'),
  it: tx('IT-kontakt', 'IT contact'),
  reserv: tx('Ansvarig reservrutiner', 'Fallback procedures lead'),
};
const A = {
  akuten: tx('Akuten', 'Emergency department'),
  opIva: tx('Operation och IVA', 'Surgery and IVA'),
  avd: tx('Vårdavdelningar', 'Wards'),
  logTransport: tx('Logistik och transport', 'Logistics and transport'),
  samverkanKomm: tx('Samverkan och kommunikation', 'Liaison and communication'),
  it: tx('IT', 'IT'),
  avdelningar: tx('Avdelningar', 'Wards'),
  samverkan: tx('Samverkan', 'Liaison'),
  logistik: tx('Logistik', 'Logistics'),
};
const C = {
  lssl: tx('LSSL', 'LSSL'),
  akuten: tx('Akuten', 'Emergency department'),
  opIva: tx('Operation och IVA', 'Surgery and IVA'),
  logTransport: tx('Logistik och transport', 'Logistics and transport'),
  samverkanRssl: tx('Samverkan RSSL', 'Liaison RSSL'),
  itAvd: tx('IT och avdelningar', 'IT and wards'),
};
const t = (area: LocalizedText, title: LocalizedText, ownerRole: LocalizedText, dueOffsetMin: number, note?: string): Playbook['tasks'][number] => ({ area, title, ownerRole, dueOffsetMin, note });

export const PLAYBOOKS: Playbook[] = [
  {
    id: 'pb1',
    key: 'masskada',
    code: 'PB1',
    name: tx('Allvarlig händelse: masskada', 'Major incident: mass casualty'),
    trigger: tx('Larm från TiB eller TCK om många skadade', 'Alert from TiB or TCK about many casualties'),
    summary: tx(
      'Etablerar LSSL, frigör operations- och intensivvårdskapacitet, startar överföringar till region och ASIH och säkrar förråd och transport.',
      'Establishes LSSL, frees surgical and intensive care capacity, starts transfers to the region and ASIH, and secures supplies and transport.',
    ),
    defaultLage: 'Förstärkningsläge',
    roles: [R.ledare, R.medicinsk, R.akut, R.operation, R.iva, R.logistik, R.kommunikation, R.krisstod],
    channels: [C.lssl, C.akuten, C.opIva, C.logTransport, C.samverkanRssl],
    targets: [
      { label: tx('Triagekapacitet akuten Solna', 'Triage capacity ED Solna'), target: 40, unit: 'patienter', withinMin: 30 },
      { label: tx('Operationssalar tillgängliga', 'Operating theatres available'), target: 8, unit: 'salar', withinMin: 60 },
      { label: tx('IVA-platser tillkomna', 'IVA beds added'), target: 6, unit: 'platser', withinMin: 120 },
      { label: tx('Vårdplatser frigjorda', 'Beds freed'), target: 40, unit: 'platser', withinMin: 240 },
    ],
    tasks: [
      t(A.akuten, tx('Upprätta triagezoner röd/gul/grön', 'Set up triage zones red/yellow/green'), R.akut, 15),
      t(A.akuten, tx('Töm akuten på färdigbedömda patienter', 'Clear the ED of assessed patients'), R.akut, 20),
      t(A.akuten, tx('Öppna andra traumabayen', 'Open the second trauma bay'), R.medicinsk, 30),
      t(A.opIva, tx('Stryk elektiv operation och frigör salar', 'Cancel elective surgery and free theatres'), R.operation, 30),
      t(A.opIva, tx('Kalla in anestesiteam', 'Call in anaesthesia teams'), R.operation, 45),
      t(A.opIva, tx('Öppna IMA som IVA-överflöd', 'Open IMA as IVA overflow'), R.iva, 90),
      t(A.avd, tx('Identifiera patienter för tidigare utskrivning', 'Identify patients for earlier discharge'), R.medicinsk, 45),
      t(A.avd, tx('Starta överföringsplanering till region och ASIH', 'Start transfer planning to the region and ASIH'), R.medicinsk, 60),
      t(A.avd, tx('Frigör 40 vårdplatser', 'Free 40 beds'), R.medicinsk, 240),
      t(A.logTransport, tx('Begär ventilatorer till Huddinge', 'Request ventilators for Huddinge'), R.logistik, 30),
      t(A.logTransport, tx('Begär transportresurser från Ambulanssjukvården', 'Request transport resources from Ambulanssjukvården'), R.logistik, 45),
      t(A.logTransport, tx('Kontrollera blodprodukter och syrgas', 'Check blood products and oxygen'), R.logistik, 30),
      t(A.samverkanKomm, tx('Anmäl läget till TiB och RSSL', 'Report the situation to TiB and RSSL'), R.ledare, 10),
      t(A.samverkanKomm, tx('Öppna kanaler och starta inkallning', 'Open channels and start call-in'), R.kommunikation, 15),
      t(A.samverkanKomm, tx('Aktivera PKL', 'Activate PKL'), R.krisstod, 30),
    ],
  },
  {
    id: 'pb2',
    key: 'journalbortfall',
    code: 'PB2',
    name: tx('Journalsystem otillgängligt', 'EHR unavailable'),
    trigger: tx('Journalsystemet eller sjukhusets nät otillgängligt', 'The EHR or the hospital network is unavailable'),
    summary: tx(
      'Växlar sjukhuset till den operativa spegeln och manuella reservrutiner, som i juni 2022 (S16) när RSSL gick till stabsläge.',
      'Switches the hospital to the operational mirror and manual fallback procedures, as in June 2022 (S16) when RSSL went to stabsläge.',
    ),
    defaultLage: 'Stabsläge',
    roles: [R.ledare, R.it, R.reserv],
    channels: [C.lssl, C.itAvd],
    targets: [{ label: tx('Avdelningar bekräftade på reservrutin', 'Wards confirmed on fallback procedures'), target: 4, unit: 'avdelningar', withinMin: 30 }],
    tasks: [
      t(A.it, tx('Bekräfta störningens omfattning med IT', 'Confirm the extent of the outage with IT'), R.it, 10),
      t(A.avdelningar, tx('Gå över till operativ spegel och läskopia på alla avdelningar', 'Switch to the operational mirror and read-only copy on all wards'), R.reserv, 30),
      t(A.avdelningar, tx('Utse avdelningsrunners för pappersordinationer', 'Appoint ward runners for paper orders'), R.reserv, 20),
      t(A.avdelningar, tx('Frys icke-akuta överflyttningar', 'Freeze non-urgent transfers'), R.ledare, 15),
      t(A.avdelningar, tx('Verifiera kritiska läkemedelslistor mot senaste spegling', 'Verify critical medication lists against the latest mirror'), R.reserv, 45),
      t(A.it, tx('Förbered återsynkronisering', 'Prepare resynchronisation'), R.it, 60),
    ],
  },
  {
    id: 'pb3',
    key: 'mottagande',
    code: 'PB3',
    name: tx('Mottagande av evakuerade patienter', 'Receiving evacuated patients'),
    trigger: tx('RSSL fördelar patienter från annan region eller annat land', 'RSSL distributes patients from another region or country'),
    summary: tx(
      'Tar emot patienter som RSSL fördelar till sjukhuset, som övat i Sjukvårdsövning 26 (S15) med ett scenario på cirka 260 patienter.',
      'Receives patients that RSSL distributes to the hospital, as exercised in Sjukvårdsövning 26 (S15) with a scenario of about 260 patients.',
    ),
    defaultLage: 'Stabsläge',
    roles: [R.ledare, R.medicinsk, R.logistik],
    channels: [C.lssl, C.samverkanRssl],
    targets: [{ label: tx('Mottagningsplatser bekräftade', 'Receiving beds confirmed'), target: 60, unit: 'platser', withinMin: 120 }],
    tasks: [
      t(A.samverkan, tx('Bekräfta tilldelning från RSSL', 'Confirm the allocation from RSSL'), R.ledare, 10),
      t(A.avd, tx('Reservera mottagningsplatser per tema', 'Reserve receiving beds per tema'), R.medicinsk, 30),
      t(A.logistik, tx('Ordna mottagningsplats vid ambulanshallen Huddinge', 'Arrange a receiving point at the Huddinge ambulance hall'), R.logistik, 45),
      t(A.avd, tx('Aktivera ASIH för utskrivningsklara', 'Activate ASIH for patients ready for discharge'), R.medicinsk, 60),
      t(A.samverkan, tx('Rapportera läge till RSSL', 'Report the situation to RSSL'), R.ledare, 90),
    ],
  },
  {
    id: 'pb4',
    key: 'evakuering',
    code: 'PB4',
    name: tx('Evakuering av sjukvårdsinrättning', 'Evacuation of a healthcare facility'),
    trigger: tx('Del av sjukhuset måste utrymmas', 'Part of the hospital must be evacuated'),
    summary: tx(
      'Klassificerar patienter för flytt, begär mottagningskapacitet via RSSL och transport, och startar evakueringsplaneringen.',
      'Classifies patients for moving, requests receiving capacity via RSSL and transport, and starts the evacuation planning.',
    ),
    defaultLage: 'Förstärkningsläge',
    roles: [R.ledare, R.medicinsk, R.logistik],
    channels: [C.lssl, C.logTransport],
    targets: [{ label: tx('Patienter flyttade', 'Patients moved'), target: 60, unit: 'patienter', withinMin: 240 }],
    tasks: [
      t(A.avd, tx('Klassificera patienter för flytt', 'Classify patients for moving'), R.medicinsk, 20),
      t(A.samverkan, tx('Begär mottagningskapacitet via RSSL', 'Request receiving capacity via RSSL'), R.ledare, 20),
      t(A.logTransport, tx('Begär transportresurser', 'Request transport resources'), R.logistik, 30),
      t(A.avd, tx('Starta evakueringsplanering', 'Start evacuation planning'), R.medicinsk, 30),
    ],
  },
  {
    id: 'pb5',
    key: 'pandemi',
    code: 'PB5',
    name: tx('Pandemisk våg', 'Pandemic wave'),
    trigger: tx('Snabbt ökande behov av intensivvård', 'Rapidly rising need for intensive care'),
    summary: tx(
      'Bygger ut intensivvården stegvis och stryker elektiv verksamhet; referensen är ombyggnaden av O-huset till 64 IVA-platser på 10 dagar 2020 (S9).',
      'Expands intensive care step by step and cancels elective activity; the reference is the conversion of O-huset to 64 IVA beds in 10 days in 2020 (S9).',
    ),
    defaultLage: 'Förstärkningsläge',
    roles: [R.ledare, R.iva, R.logistik],
    channels: [C.lssl, C.opIva],
    targets: [{ label: tx('IVA-platser tillkomna', 'IVA beds added'), target: 20, unit: 'platser', withinMin: 10 * 1440, withinUnit: 'dygn' }],
    tasks: [
      t(A.opIva, tx('Aktivera plan för IVA-utbyggnad i O-huset', 'Activate the plan for IVA expansion in O-huset'), R.iva, 60, 'Referens: O-huset Huddinge byggdes om till 64 IVA-platser på 10 dagar 2020 (S9).'),
      t(A.opIva, tx('Stryk elektiv verksamhet stegvis', 'Cancel elective activity step by step'), R.ledare, 120),
      t(A.logistik, tx('Säkra ventilatorer och syrgas', 'Secure ventilators and oxygen'), R.logistik, 120),
    ],
  },
];
