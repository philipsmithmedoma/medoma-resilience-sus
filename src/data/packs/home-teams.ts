// The four ASIH teams of the Karolinska pack (SPEC.md § 8); staff are fictional. Bases are illustrative, placed at the centres of the zones
// they are named for (DATA.md § 13); every team has two cars; the phone numbers are placeholders.
import type { HomeTeam } from './types';

const PHONE = '0XX-XXX XX XX';

export const HOME_TEAMS: HomeTeam[] = [
  { id: 'asih-nord', name: 'ASIH Nord', baseLat: 59.3597, baseLng: 18.0005, baseLabel: { sv: 'Solna', en: 'Solna' }, cars: 2, phone: PHONE, staff: ['Birgit Almroth', 'Kenneth Sälgö', 'Marita Hjelm'] },
  { id: 'asih-city', name: 'ASIH City', baseLat: 59.3312, baseLng: 18.0407, baseLabel: { sv: 'Innerstaden norr', en: 'Inner city north' }, cars: 2, phone: PHONE, staff: ['Gunnel Rubin', 'Stig Lagerman', 'Ewa Tidestad'] },
  { id: 'asih-syd', name: 'ASIH Syd', baseLat: 59.2986, baseLng: 18.0459, baseLabel: { sv: 'Söderort', en: 'Southern suburbs' }, cars: 2, phone: PHONE, staff: ['Roland Hägg', 'Siv Wetterlind', 'Dan Mellgren'] },
  { id: 'asih-sydvast', name: 'ASIH Sydväst', baseLat: 59.1988, baseLng: 17.8332, baseLabel: { sv: 'Botkyrka', en: 'Botkyrka' }, cars: 2, phone: PHONE, staff: ['Anita Fröberg', 'Ove Skarin', 'Lilian Kärrman'] },
];
