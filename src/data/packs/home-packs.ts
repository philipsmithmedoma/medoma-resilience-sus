// The home packs (SPEC.md § 4): `homePacks` maps a pack id to the data of one customer: sites, zones, patients, teams, visits,
// infrastructure, notices and sources. A pack also says where its OpenStreetMap geometry is (dynamic imports under geo/<pack>/),
// so nothing in the app is specific to one customer.
import type { DataPack, GeoLoader, HomePack, HomePackId, LocalizedText } from './types';
import { HOME_INFRA_LINKS_KS, HOME_MESSAGES, HOME_PRESETS, HOME_SOURCES, HOME_ZONES, INFRA_NODES, KAROLINSKA_EQUIPMENT_STOCK, KAROLINSKA_SITES, KAROLINSKA_UNIT_STOCK, KOLBOTTEN, OSM_MATCHES } from './karolinska';
import { SUS_EQUIPMENT_STOCK, SUS_INFRA_LINKS, SUS_INFRA_NODES, SUS_MESSAGES, SUS_OSM_MATCHES, SUS_PRESETS, SUS_SITES, SUS_SOURCES, SUS_TEAMS, SUS_UNIT_STOCK, SUS_ZONES } from './sus';
import { HOME_PATIENTS } from './home-patients';
import { SUS_PATIENTS } from './home-patients-sus';
import { KAROLINSKA_EXTRAS, SUS_EXTRAS } from './home-registry';
import { HOME_TEAMS } from './home-teams';
import { buildVisits } from './home-visits';
import { PLAYBOOKS, STAFF } from './incident-data';

const tx = (sv: string, en: string): LocalizedText => ({ sv, en });

type Files = Record<string, () => Promise<{ default: unknown }>>;

// Only files that exist are in the maps, so a roads.json that has not been fetched is not a build error.
const KAROLINSKA_FILES = import.meta.glob('./geo/karolinska/*.json') as Files;
const SUS_FILES = import.meta.glob('./geo/sus/*.json') as Files;

function loaders(files: Files, dir: string): HomePack['geo'] {
  const get = (name: string) => files[`./geo/${dir}/${name}.json`];
  const loader = (osm: string, fixture: string): GeoLoader => ({ osm: get(osm), fixture: get(fixture) });
  return {
    roads: loader('roads', 'fixture'),
    streets: loader('streets', 'fixture-streets'),
    power: loader('power', 'fixture-power'),
    water: loader('water', 'fixture-water'),
  };
}

export const homePacks: Record<HomePackId, HomePack> = {
  sus: {
    id: 'sus',
    name: 'SUS',
    customer: 'Skånes universitetssjukhus',
    sites: SUS_SITES,
    scopes: [
      { id: 'sus', label: tx('SUS', 'SUS'), sites: ['suslund', 'susmalmo'] },
      { id: 'suslund', label: tx('Lund', 'Lund'), sites: ['suslund'] },
      { id: 'susmalmo', label: tx('Malmö', 'Malmö'), sites: ['susmalmo'] },
    ],
    defaultScope: 'sus',
    scopeMenu: 'always',
    zones: SUS_ZONES,
    patients: SUS_PATIENTS,
    registryExtras: SUS_EXTRAS,
    teams: SUS_TEAMS,
    visits: buildVisits(SUS_PATIENTS, SUS_TEAMS, 20261103 + 2),
    infraNodes: SUS_INFRA_NODES,
    infraLinks: SUS_INFRA_LINKS,
    messages: SUS_MESSAGES,
    presets: SUS_PRESETS,
    sources: SUS_SOURCES,
    osmMatches: SUS_OSM_MATCHES,
    osmExtra: {},
    geo: loaders(SUS_FILES, 'sus'),
    unitStock: SUS_UNIT_STOCK,
    equipmentStock: SUS_EQUIPMENT_STOCK,
  },
  karolinska: {
    id: 'karolinska',
    name: 'Karolinska',
    customer: 'Karolinska Universitetssjukhuset',
    sites: KAROLINSKA_SITES,
    scopes: [
      { id: 'karolinska', label: tx('Karolinska', 'Karolinska'), sites: ['solna', 'huddinge'] },
      { id: 'solna', label: tx('Solna', 'Solna'), sites: ['solna'] },
      { id: 'huddinge', label: tx('Huddinge', 'Huddinge'), sites: ['huddinge'] },
    ],
    defaultScope: 'karolinska',
    scopeMenu: 'whenActive',
    zones: HOME_ZONES,
    patients: HOME_PATIENTS,
    registryExtras: KAROLINSKA_EXTRAS,
    teams: HOME_TEAMS,
    visits: buildVisits(HOME_PATIENTS, HOME_TEAMS, 20261102 + 2),
    infraNodes: INFRA_NODES,
    infraLinks: HOME_INFRA_LINKS_KS,
    messages: HOME_MESSAGES,
    presets: HOME_PRESETS,
    sources: HOME_SOURCES,
    osmMatches: OSM_MATCHES,
    osmExtra: { [KOLBOTTEN.id]: KOLBOTTEN },
    geo: loaders(KAROLINSKA_FILES, 'karolinska'),
    unitStock: KAROLINSKA_UNIT_STOCK,
    equipmentStock: KAROLINSKA_EQUIPMENT_STOCK,
  },
};

export const HOME_PACK_IDS: HomePackId[] = ['sus', 'karolinska'];
export const DEFAULT_HOME_PACK: HomePackId = 'sus';

/** The data pack the store holds for a home pack: the incident data plus the pack's home members. */
export function buildDataPack(id: HomePackId): DataPack {
  const h = homePacks[id];
  return {
    staff: STAFF,
    playbooks: PLAYBOOKS,
    homePackId: id,
    homeZones: h.zones,
    homePatients: h.patients,
    homeTeams: h.teams,
    homeVisits: h.visits,
    infraNodes: h.infraNodes,
    infraLinks: h.infraLinks,
    homeMessages: h.messages,
    homePresets: h.presets,
    homeSources: h.sources,
    homeExtras: h.registryExtras,
    homeUnitStock: h.unitStock,
    homeEquipmentStock: h.equipmentStock,
  };
}

/** The pack's id as a DataPack carries it. */
export const homePackIdOf = (pack: { homePackId?: HomePackId }): HomePackId => pack.homePackId ?? DEFAULT_HOME_PACK;
