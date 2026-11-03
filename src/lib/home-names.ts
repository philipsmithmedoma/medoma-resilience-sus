// Display names of road-graph vertices and links for the panel and the audit log. Pure given the locale.
import type { DataPack, InfraLink } from '@/data/types';
import { homePacks } from '@/data/packs/home-packs';
import { lt } from '@/lib/i18n';

type NamePack = Pick<DataPack, 'homeZones' | 'infraNodes' | 'homePackId'>;

/** A site, a zone vertex (`zone:<id>`) or an infrastructure node by its display name. */
export function vertexLabel(id: string, pack: NamePack): string {
  const site = homePacks[pack.homePackId].sites.find((s) => s.id === id);
  if (site) return site.name;
  const zone = pack.homeZones.find((z) => z.graphNode === id);
  if (zone) return lt(zone.name);
  const node = pack.infraNodes.find((n) => n.id === id);
  return node ? lt(node.name) : id;
}

/** A link by its label when it has one, else by its two ends. */
export function linkLabel(link: InfraLink, pack: NamePack): string {
  const label = lt(link.label);
  const ends = `${vertexLabel(link.a, pack)} – ${vertexLabel(link.b, pack)}`;
  return label ? `${ends} (${label})` : ends;
}
