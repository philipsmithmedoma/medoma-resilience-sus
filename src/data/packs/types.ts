// Domain model of a data pack (SPEC.md § 3). Every enum value string has a Swedish and an English label in vocab.ts.

// ---------------------------------------------------------------------------
// Figures and confidence (SPEC.md § 4, DATA.md § 0)
export type Confidence = 'verified' | 'reported' | 'estimate' | 'illustrative';

export interface Figure {
  value: number | null; // null = unknown ("Okänt")
  confidence: Confidence;
  source?: string; // key into DataPack.sources (DATA.md § 9)
  asOf?: string; // date string
  basis?: string; // basis of an estimate or an illustrative value
}


export type NodeId = string;
export type Priority = 'Low' | 'Normal' | 'High' | 'Critical';


/** A text the pack carries in both languages (DESIGN-LANG.md § 3); proper nouns stay plain strings. */
export interface LocalizedText {
  sv: string;
  en: string;
}


export interface Message {
  id: string;
  author: string;
  role: string;
  at: string;
  text: string;
  nodeId?: NodeId;
  /** English form of a message written for the prototype in both languages (SPEC.md § 13.4); absent for messages that stay Swedish. */
  textEn?: string;
  roleEn?: string;
}

// ---------------------------------------------------------------------------
// Incidents and playbooks (SPEC.md § 6.6, DATA.md § 8)
export type BeredskapsLage = 'Normalläge' | 'Stabsläge' | 'Förstärkningsläge' | 'Katastrofläge';

export interface PlaybookTask {
  title: LocalizedText;
  area: LocalizedText;
  ownerRole: LocalizedText; // its sv form is the role key
  dueOffsetMin: number;
  note?: string;
}

export type TargetMeasure =
  | 'triageSolna'
  | 'theatresAvailable'
  | 'icuAdded'
  | 'bedsFreed'
  | 'wardsOnMirror'
  | 'receivingBeds'
  | 'patientsMoved'
  | 'icuAddedDays';

export interface PlaybookTarget {
  label: LocalizedText;
  target: number;
  unit: string;
  withinMin: number;
  withinUnit?: 'min' | 'dygn'; // PB5 counts in days
}

export type PlaybookKey = 'masskada' | 'journalbortfall' | 'mottagande' | 'evakuering' | 'pandemi';

export interface Playbook {
  id: string;
  key: PlaybookKey;
  code: string; // PB1–PB5
  name: LocalizedText;
  trigger: LocalizedText;
  summary: LocalizedText;
  defaultLage: BeredskapsLage;
  roles: LocalizedText[]; // sv forms are the role keys
  tasks: PlaybookTask[];
  channels: LocalizedText[]; // sv forms are the channel keys
  targets: PlaybookTarget[];
}

export type TaskStatus = 'Not started' | 'In progress' | 'Done';

export interface IncidentTask extends PlaybookTask {
  id: string;
  status: TaskStatus;
  due: string;
  owner?: string;
}

export interface Channel {
  id: string;
  name: LocalizedText;
  memberRoles: LocalizedText[];
  messages: Message[];
}

export interface IncidentTarget {
  label: LocalizedText;
  target: number;
  unit: string;
  dueAt: string;
  withinUnit?: 'min' | 'dygn';
}

export interface Incident {
  playbookId: string;
  playbookKey: PlaybookKey;
  name: LocalizedText;
  lage: BeredskapsLage;
  activatedAt: string;
  activatedBy: string;
  commander: string;
  roles: Record<string, string | undefined>;
  tasks: IncidentTask[];
  channels: Channel[];
  note?: string;
  targets: IncidentTarget[];
  logStartId?: string;
}

export interface ClosedIncident {
  incident: Incident;
  closedAt: string;
  log: AuditEntry[];
}


// ---------------------------------------------------------------------------
// Audit log, staff, sources, sites
export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  object: string;
  detail?: string;
  ref?: string;
  /** The module the entry belongs to, for the log drawer's filter (SPEC.md § 14.4). */
  area?: 'home';
}

export type Profession = 'Doc' | 'Nrs' | 'AsPr' | 'Supp';

export interface Staff {
  name: string;
  title: string;
  profession: Profession;
  nodeId?: NodeId;
}

export interface SourceRef {
  key: string;
  name: string;
  url?: string;
  date: string;
}


// ---------------------------------------------------------------------------
// Hospital at Home (SPEC.md § 11.3, DATA.md § 11) – additive
export type HomeEquipment = 'Oxygen' | 'IV infusion' | 'Monitoring' | 'Home ventilator' | 'Home dialysis';
export type ZoneId = string;

/**
 * A vertex of the road graph: a SiteId ('solna', 'huddinge'), a road InfraNode id, or a zone vertex written
 * `zone:<ZoneId>` (zone ids 'solna' and 'huddinge' would otherwise collide with the sites).
 */
export type GraphNodeId = string;

/** A locality that patients live in and that outages are reported per. */
export interface HomeZone {
  id: ZoneId;
  name: LocalizedText;
  lat: number;
  lng: number;
  radiusKm: number;
  graphNode: GraphNodeId; // the road-graph vertex the zone hangs on (usually itself: `zone:<id>`)
  coordConfidence: Confidence;
  coordSource: string;
}

export interface HomePatient {
  id: string;
  familyName: string;
  givenName: string;
  age: number;
  zone: ZoneId;
  street: string; // the street the patient lives on (OpenStreetMap, or the fixture's) – SPEC.md § 12.5
  houseNo: number; // illustrative, 1–60
  lat: number; // synthetic, a vertex of a street within the zone radius
  lng: number;
  team: string; // illustrative ASIH team name
  equipment: HomeEquipment[];
  batteryHours: number | null; // null when no powered equipment
  visitToday: boolean;
  elCritical: boolean; // derived: Oxygen, IV infusion or Home ventilator
  waterCritical: boolean; // derived: Home dialysis
}

export type InfraLayer = 'water' | 'el' | 'roads';
export type InfraKind = 'waterworks' | 'reserve' | 'pumping' | 'transmission' | 'generation' | 'junction' | 'bridge' | 'tunnel';

/** A figure on an infrastructure node with its label and unit; a range keeps its upper bound in valueMax. */
export interface InfraFigure extends Figure {
  label: LocalizedText;
  unit: LocalizedText;
  valueMax?: number;
}

export interface InfraNode {
  id: string;
  layer: InfraLayer;
  kind: InfraKind;
  name: LocalizedText;
  lat: number;
  lng: number;
  role: LocalizedText; // two or three sentences
  status: LocalizedText; // verification status text shown in the panel
  verified: boolean; // false renders the node hollow with a question mark
  coordConfidence: Confidence;
  coordSource: string;
  figures?: InfraFigure[]; // e.g. vehicles per day, each with confidence and source
  noMarker?: boolean; // drawn as an arrow or as status text on other nodes, not as a marker
  /** Road nodes: the OpenStreetMap way names this node blocks when it is closed (SPEC.md § 12.5). */
  osmWayNames?: string[];
}

export interface InfraLink {
  id: string;
  layer: InfraLayer;
  a: GraphNodeId;
  b: GraphNodeId; // for an off-map arrow: the node the arrow stands for, else equal to a
  label: LocalizedText; // empty when the source gives no label
  style: 'solid' | 'dashed' | 'dotted' | 'road' | 'street';
  verified: boolean; // the connection exists per the source; dashed/dotted or verified=false renders as schematic
  offmap?: { dir: 'N' | 'S' | 'E' | 'W'; text: LocalizedText }; // an arrow leaving the map instead of a second node
}

/** A demo scenario: a set of disruptions applied with one button (SPEC.md § 6). */
export interface HomeDisruptionPreset {
  key: 'bridge' | 'power' | 'water';
  name: LocalizedText;
  blockedNodes: string[];
  powerOutZones: ZoneId[];
  waterOutZones: ZoneId[];
  /** The sentence under the demo scenario button. */
  description: LocalizedText;
}

/** A disruption as a record in time (SPEC.md § 13.2); the blocked and outage sets are derived from the active ones. */
export type HomeDisruptionKind = 'road' | 'power' | 'water';
export type HomeDisruptionSource = 'map' | 'preset' | 'message';
/** What `target` names: an OSM way id, a road key (`name` or `name|ref`), a road InfraNode id, or a ZoneId. */
export type HomeDisruptionTargetKind = 'way' | 'road' | 'node' | 'zone';
export type HomeDisruptionEnd = 'manual' | 'expected' | 'reset' | 'replaced';
export interface HomeDisruption {
  id: string;
  kind: HomeDisruptionKind;
  target: string;
  targetKind: HomeDisruptionTargetKind;
  label: LocalizedText;
  startedAt: number; // clock minutes
  expectedEnd: number | null; // clock minutes
  source: HomeDisruptionSource;
  createdBy: string;
  /** Set when the record stops being active; the record stays as history. */
  endedAt: number | null;
  endReason: HomeDisruptionEnd | null;
  /** Free text, e.g. the id of the message the disruption was created from (SPEC.md § 13.4). */
  note?: string | null;
}

// Teams, visits and the work on affected patients (SPEC.md § 13.3, § 14.2, § 14.3)
export type TeamId = string;
export interface HomeTeam {
  id: TeamId;
  name: string; // "ASIH Nord"; HomePatient.team carries the same string
  baseLat: number;
  baseLng: number;
  baseLabel: LocalizedText;
  cars: number;
  phone: string; // placeholder "0XX-XXX XX XX"
}

export type HomeVisitStatus = 'planned' | 'moved' | 'cancelled' | 'done';
export interface HomeVisit {
  id: string;
  patientId: string;
  teamId: TeamId;
  start: number; // minutes since 00:00 of the demo day, 08:00–17:00 in 30-minute steps
  durationMin: number;
  status: HomeVisitStatus;
}

/** The status chain of an affected patient (SPEC.md § 13.3): Ohanterad, Kontaktad, Planerad, Bekräftad. */
export type HomeWorkStatus = 'Unhandled' | 'Contacted' | 'Planned' | 'Confirmed';
export interface HomeWork {
  status: HomeWorkStatus;
  note: string | null;
  assignedTeam: TeamId | null;
  /** The site the patient is brought in to ("Ta in"); listed under "Överlämningar till sjukhus" on the overview page. */
  bringInSite: string | null;
}

// ---------------------------------------------------------------------------
// Home packs (SPEC.md § 14.5): the Hospital at Home data of one hospital, kept apart from the hospital pack.
export type HomePackId = 'karolinska';
export interface HomeSite {
  id: string; // 'solna', 'huddinge'
  name: string;
  lat: number;
  lng: number;
}
export type GeoFileKind = 'roads' | 'streets' | 'power' | 'water';
/** The OpenStreetMap file of a pack (absent until it has been fetched) and the fixture that stands in for it; both are dynamic imports. */
export interface GeoLoader {
  osm?: () => Promise<{ default: unknown }>;
  fixture: () => Promise<{ default: unknown }>;
}
export interface HomeOsmMatch {
  nodeId: string;
  term: string;
  file: 'power' | 'water';
}
/** A unit the scope selector offers: one site or all sites of the pack (SPEC.md § 4). */
export interface HomeScope {
  id: string;
  /** The name shown on the selector button and in the menu. */
  label: LocalizedText;
  sites: string[];
}
export interface HomePack {
  id: HomePackId;
  name: string;
  /** The customer's name as text (no logo). */
  customer: string;
  sites: HomeSite[];
  scopes: HomeScope[];
  defaultScope: string;
  /** Whether the scope selector always lists this pack's units, or only while the pack is the active one (SPEC.md § 4). */
  scopeMenu: 'always' | 'whenActive';
  zones: HomeZone[];
  patients: HomePatient[];
  teams: HomeTeam[];
  visits: HomeVisit[];
  infraNodes: InfraNode[];
  infraLinks: InfraLink[];
  messages: Message[];
  /** The demo scenarios and the sources of this pack's infrastructure (DECISIONS.md). */
  presets: HomeDisruptionPreset[];
  sources: SourceRef[];
  /** How nodes take positions from OpenStreetMap, and nodes that exist only once OpenStreetMap has a match (Kolbotten). */
  osmMatches: HomeOsmMatch[];
  osmExtra: Record<string, Omit<InfraNode, 'lat' | 'lng' | 'coordConfidence' | 'coordSource'>>;
  geo: Record<GeoFileKind, GeoLoader>;
}


// ---------------------------------------------------------------------------
// The pack the store holds: the home members of the active home pack (SPEC.md § 4) and the incident data (SPEC.md § 9).
export interface DataPack {
  staff: Staff[];
  playbooks: Playbook[];
  /** The home pack the home members below belong to; the store swaps them when the pack is switched. */
  homePackId: HomePackId;
  homeZones: HomeZone[];
  homePatients: HomePatient[];
  infraNodes: InfraNode[];
  infraLinks: InfraLink[];
  homeSources: SourceRef[]; // the pack's own source list (DATA.md § 4)
  homePresets: HomeDisruptionPreset[];
  homeTeams: HomeTeam[];
  homeVisits: HomeVisit[];
  /** Illustrative notices that can become disruptions (SPEC.md § 6, DATA.md § 5). */
  homeMessages: Message[];
}

/** A hospital site as a map node. */
export interface CareSite {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
}
