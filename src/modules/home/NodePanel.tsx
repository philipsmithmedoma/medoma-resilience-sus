import type { InfraFigure, InfraLink, InfraNode } from '@/data/types';
import { useStore } from '@/data/store';
import { t, tm, lt } from '@/lib/i18n';
import { homeSiteName } from '@/lib/home-sites';
import { fmt } from '@/lib/format';
import { linksOf } from '@/lib/home-geo';
import { Chip } from '@/components/Chip';
import { ConfidenceChip } from '@/components/ConfidenceChip';
import { Button } from '@/components/ui/button';

const COMMON_SOURCE_ID = 'w-malaren';
const WORKS = new Set(['w-gorvaln', 'w-lovo', 'w-norsborg']);

function figureText(f: InfraFigure): string {
  const range = f.valueMax !== undefined ? `${fmt(f.value ?? 0)}–${fmt(f.valueMax)}` : fmt(f.value ?? 0);
  return `${range} ${lt(f.unit)}`;
}

/** What a link end is called in the "Linked to" list: a site, a zone or another infrastructure node. */
function useVertexName() {
  const pack = useStore((s) => s.pack);
  const infraNodes = useStore((s) => s.home.infraNodes);
  return (id: string): { name: string; node?: InfraNode } => {
    if (pack.homeZones.every((z) => z.graphNode !== id) && infraNodes.every((n) => n.id !== id)) {
      const site = homeSiteName(pack.homePackId, id);
      if (site !== id) return { name: site };
    }
    const zone = pack.homeZones.find((z) => z.graphNode === id);
    if (zone) return { name: lt(zone.name) };
    const node = infraNodes.find((n) => n.id === id);
    return { name: node ? lt(node.name) : id, node };
  };
}

function LinkedTo({ node, links }: { node: InfraNode; links: InfraLink[] }) {
  const selectHomeNode = useStore((s) => s.selectHomeNode);
  const vertexName = useVertexName();
  const rows = links.map((l) => {
    const otherId = l.a === node.id ? l.b : l.a;
    if (l.offmap) return { key: l.id, text: t('HOME.panel.offmap', { text: lt(l.offmap.text) }), label: lt(l.label) };
    const other = vertexName(otherId);
    return { key: l.id, text: other.name, label: lt(l.label), select: other.node && !other.node.noMarker ? other.node.id : undefined };
  });
  return (
    <section className="space-y-1">
      <h3 className="text-body font-medium">{t('HOME.panel.linkedTo')}</h3>
      {rows.length === 0 ? (
        <p className="text-text-secondary">{t('HOME.panel.noLinks')}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.key}>
              {r.select ? (
                <button type="button" onClick={() => selectHomeNode(r.select!)} className="text-left text-primary-text hover:text-primary-hover hover:underline">
                  {r.text}
                </button>
              ) : (
                <span>{r.text}</span>
              )}
              {r.label ? <span className="block text-small text-text-secondary">{r.label}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Middle pane with a node selected (SPEC.md § 11.6): layer tag, name, role, linked nodes and status; the status is red when the node is unverified. */
export function NodePanel({ node }: { node: InfraNode }) {
  const pack = useStore((s) => s.pack);
  const selectHomeNode = useStore((s) => s.selectHomeNode);
  const links = linksOf(node.id, pack.infraLinks);
  const layerLabel = tm('HOME.layers')[node.layer];
  const kinds = tm('HOME.kinds');
  const infraNodes = useStore((s) => s.home.infraNodes);
  const common = WORKS.has(node.id) ? infraNodes.find((n) => n.id === COMMON_SOURCE_ID) : undefined;
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center gap-2">
        <Chip tone="grey">{layerLabel}</Chip>
        <span className="text-small text-text-secondary">{kinds[node.kind]}</span>
      </div>
      <h2 className="text-heading">{lt(node.name)}</h2>
      <p>{lt(node.role)}</p>
      {common ? (
        <section className="space-y-1">
          <h3 className="text-body font-medium">{t('HOME.panel.commonSource')}</h3>
          <p>{lt(common.role)}</p>
          <p className="text-small text-text-secondary">{lt(common.status)}</p>
        </section>
      ) : null}
      <LinkedTo node={node} links={links} />
      <section className="space-y-1">
        <h3 className="text-body font-medium">{t('HOME.panel.status')}</h3>
        <p className={node.verified ? undefined : 'font-medium text-red'}>{lt(node.status)}</p>
      </section>
      {node.figures?.length ? (
        <section>
          <ul className="space-y-2">
            {node.figures.map((f, i) => (
              <li key={i} className="space-y-0.5">
                <div className="text-small text-text-secondary">{lt(f.label)}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular">{figureText(f)}</span>
                  <ConfidenceChip figure={f} showSource />
                </div>
                {f.asOf ? <div className="text-small text-text-muted">{f.asOf}</div> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="space-y-1">
        <h3 className="text-body font-medium">{t('HOME.panel.position')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceChip figure={{ value: null, confidence: node.coordConfidence, basis: node.coordSource }} />
        </div>
        {/* The basis texts are the English wording of DATA.md § 11 (the spec types coordSource as one string). */}
        <p lang="en" className="text-small text-text-secondary">
          {node.coordSource}
        </p>
      </section>
      <Button variant="link" onClick={() => selectHomeNode(null)}>
        {t('HOME.panel.deselect')}
      </Button>
    </div>
  );
}

/** Middle pane with nothing selected. */
export function PanelEmpty() {
  return <p className="px-4 py-4 text-text-secondary">{t('HOME.panel.empty')}</p>;
}
