// The home packs (SPEC.md § 4): `homePacks` maps a pack id to the data of one customer: sites, zones, patients, teams, visits,
// infrastructure, notices and sources. A pack also says where its OpenStreetMap geometry is (dynamic imports under geo/<pack>/),
// so nothing in the app is specific to one customer.
import type { DataPack, GeoLoader, HomePack, HomePackId, LocalizedText } from './types';
import { HOME_INFRA_LINKS_KS, HOME_MESSAGES, HOME_PRESETS, HOME_SOURCES, HOME_ZONES, INFRA_NODES, KAROLINSKA_SITES, KOLBOTTEN, OSM_MATCHES } from './karolinska';
import { HOME_PATIENTS } from './home-patients';
import { HOME_TEAMS } from './home-teams';
import { buildVisits } from './home-visits';
import { PLAYBOOKS, STAFF } from './incident-data';

const tx = (sv: string, en: string): LocalizedText => ({ sv, en });

type Files = Record<string, () => Promise<{ default: unknown }>>;

// Only files that exist are in the maps, so a roads.json that has not been fetched is not a build error.
const KAROLINSKA_FILES = import.meta.glob('./geo/karolinska/*.json') as Files;

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
  },
};

export const HOME_PACK_IDS: HomePackId[] = ['karolinska'];
export const DEFAULT_HOME_PACK: HomePackId = 'karolinska';

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
  };
}

/** The pack's id as a DataPack carries it. */
export const homePackIdOf = (pack: { homePackId?: HomePackId }): HomePackId => pack.homePackId ?? DEFAULT_HOME_PACK;
