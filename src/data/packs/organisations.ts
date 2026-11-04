// The organisations (SPEC.md § 1, § 4): one care provider per environment. A provider never sees another provider's environment, so
// the pack, the units, the zones, the teams, the infrastructure, the geometry, the notices, the presets and the demo story are all
// reached through the organisation. SUS is the only entry now; the start page `/start-org` exists in the code for the ones to come.
import type { HomePack, HomePackId, Organisation } from './types';
import { homePacks, DEFAULT_HOME_PACK } from './home-packs';

/** The organisations of this build. A mutable list so that a test can register a second one; the app never changes it. */
export const organisations: Organisation[] = [
  {
    id: 'sus',
    name: 'Skånes universitetssjukhus',
    careForm: 'hospital-at-home',
    units: homePacks.sus.sites,
    pack: 'sus',
  },
];

export const DEFAULT_ORGANISATION = 'sus';

export const organisationById = (id: string | null | undefined): Organisation | null => organisations.find((o) => o.id === id) ?? null;

/** The data pack of an organisation: `homePacks` is reached through here (SPEC.md § 4). */
export const packOfOrganisation = (org: Pick<Organisation, 'pack'>): HomePack => homePacks[org.pack];

/** The pack id of an organisation id; the default pack for an unknown id. */
export const packIdOfOrganisation = (id: string | null | undefined): HomePackId => organisationById(id)?.pack ?? DEFAULT_HOME_PACK;

/** The first organisation that uses a pack (a test helper's and the store's way from a pack id back to an organisation). */
export const organisationOfPack = (packId: HomePackId): Organisation | null => organisations.find((o) => o.pack === packId) ?? null;
