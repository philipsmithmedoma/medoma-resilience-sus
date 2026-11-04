import { Fragment, useMemo } from 'react';
import L from 'leaflet';
import { Circle, CircleMarker, Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import type { CareSite, HomePatient, HomeTeam, HomeZone, InfraLayer, InfraLink, InfraNode } from '@/data/types';
import type { HomeLayerKey, HomeMode } from '@/data/store-home';
import { lt, t, tm } from '@/lib/i18n';
import { isSchematic, linkedVertices, offmapEnd, offmapRotation, offmapSlots, vertexPositions } from '@/lib/home-geo';
import { cssColor } from '@/lib/theme';
import type { RoadCollection, RoadProps } from '@/lib/roadGraph';
import { RoadsLayer } from './RoadsLayer';
import type { PowerLine } from '@/lib/osmNodes';

/** What the Hospital at Home page hands to NodeMap (SPEC.md § 11.6): layers, zones, infrastructure and patient dots. */
export interface HomeOverlay {
  layers: Record<HomeLayerKey, boolean>;
  zones: HomeZone[];
  infraNodes: InfraNode[];
  infraLinks: InfraLink[];
  patients: HomePatient[];
  /** 400 and 220 kV lines from power.json, drawn in the el layer with their voltage as a label (SPEC.md § 12.5). */
  powerLines?: PowerLine[];
  /** The selected infrastructure node: everything it is not linked to is dimmed. */
  selectedId?: string | null;
  /** Click on a node (selects it) or on the empty map (null). Without it the nodes take no clicks. */
  onSelectNode?: (id: string | null) => void;
  /** Disruptions (SPEC.md § 11.5): what a tap does depends on the mode; blocked elements and outage zones are drawn in the danger colour. */
  mode?: HomeMode;
  blockedNodes?: ReadonlySet<string>;
  /** roads.json (or the fixture) and the OSM way ids closed in it (SPEC.md § 12.4). */
  roads?: RoadCollection;
  blockedWayIds?: ReadonlySet<number>;
  powerOutZones?: ReadonlySet<string>;
  waterOutZones?: ReadonlySet<string>;
  heatZones?: ReadonlySet<string>;
  coldZones?: ReadonlySet<string>;
  /** The tele layer: per zone whether the mobile network is up, falls within hours or is down; absent zones have no network event. */
  teleStatus?: ReadonlyMap<string, 'soon' | 'down'>;
  /** How a patient dot is drawn when it is affected; patients not in the map keep the neutral dot. */
  patientMarks?: ReadonlyMap<string, PatientMark>;
  onToggleNode?: (id: string) => void;
  /** A tap on a road segment in roads mode. */
  onTapWay?: (props: RoadProps, at: { lat: number; lng: number }) => void;
  onToggleZone?: (zone: string) => void;
  /** The teams: a small square in the team's colour at each base, in every mode (SPEC.md § 14.2). */
  teams?: HomeTeam[];
  /** Colour token per team id; by place in `teams` when absent. */
  teamTokens?: Record<string, string>;
  /** The Planning map: one team's visits as a numbered sequence from its base (SPEC.md § 14.3). */
  sequence?: VisitSequence;
  /** Points the map fits instead of the zones (Planning). */
  fitPoints?: Array<[number, number]>;
}

export interface VisitSequence {
  token: string;
  base: [number, number];
  stops: Array<{ id: string; n: number; lat: number; lng: number; label: string }>;
  selectedId?: string | null;
  onSelect?: (patientId: string) => void;
}

export type PatientMark = 'affected' | 'critical' | 'detour';
const EMPTY: ReadonlySet<string> = new Set();
const NO_WAYS: ReadonlySet<number> = new Set();

/** Layer colours are design tokens: water teal, electricity olive, roads text-secondary. */
export const LAYER_TOKEN: Record<InfraLayer, string> = {
  water: '--color-teal',
  el: '--color-olive',
  roads: '--color-text-secondary',
};

function stopIcon(n: number, token: string, selected: boolean): L.DivIcon {
  const key = `stop|${n}|${token}|${selected}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'home-node-wrap',
      html: `<span class="home-stop${selected ? ' home-stop-selected' : ''}" style="--node-colour:var(${token})">${n}</span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

/** Team colours come from the node palette's icon tokens, by the team's place in the pack; none of them is the danger or the layer colours. */
export const TEAM_TOKENS = ['--color-icon-primary', '--color-icon-purple', '--color-icon-indigo', '--color-icon-orange'];
export const teamToken = (index: number): string => TEAM_TOKENS[index % TEAM_TOKENS.length];

function teamIcon(token: string): L.DivIcon {
  const key = `team|${token}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'home-node-wrap',
      html: `<span class="home-team" style="--node-colour:var(${token})"></span>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

// Zone labels sit on alternating sides of their point so that the zones in the dense middle do not cover each other.
const ZONE_LABEL: Record<string, { direction: 'left' | 'right' | 'top' | 'bottom'; offset: [number, number] }> = {
  solna: { direction: 'left', offset: [-6, 0] },
  innerstaden: { direction: 'right', offset: [6, -6] },
  bromma: { direction: 'left', offset: [-6, 0] },
  sodermalm: { direction: 'left', offset: [-6, -3] },
  soderort: { direction: 'bottom', offset: [0, 6] },
  huddinge: { direction: 'right', offset: [6, 0] },
  botkyrka: { direction: 'bottom', offset: [0, 6] },
  nacka: { direction: 'right', offset: [6, 0] },
  lidingo: { direction: 'right', offset: [6, 0] },
  taby: { direction: 'top', offset: [0, -6] },
};
const DASH_SCHEMATIC = '8 6';
const DASH_DOTTED = '2 6';

const iconCache = new Map<string, L.DivIcon>();

/** Marker shapes: water circle, electricity diamond, bridge square, tunnel circle; unverified nodes are hollow with a question mark. */
function nodeIcon(node: InfraNode, selected: boolean, dim: boolean, blocked: boolean): L.DivIcon {
  const shape = node.layer === 'el' ? 'diamond' : node.kind === 'bridge' ? 'square' : 'circle';
  const key = `${node.layer}|${shape}|${node.verified}|${selected}|${dim}|${blocked}`;
  let icon = iconCache.get(key);
  if (!icon) {
    const colour = blocked ? 'var(--color-red)' : `var(${LAYER_TOKEN[node.layer]})`;
    const open = (node.verified || blocked ? '' : ' home-node-open') + (selected ? ' home-node-selected' : '') + (dim ? ' home-node-dim' : '');
    icon = L.divIcon({
      className: 'home-node-wrap',
      html: `<span class="home-node home-node-${shape}${open}" style="--node-colour:${colour}">${blocked ? '<span aria-hidden="true">×</span>' : node.verified ? '' : '<span aria-hidden="true">?</span>'}</span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

function arrowIcon(layer: InfraLayer, rotation: number, dim = false): L.DivIcon {
  const key = `arrow|${layer}|${rotation}|${dim}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: 'home-node-wrap',
      html: `<span class="home-arrow${dim ? ' home-node-dim' : ''}" style="--node-colour:var(${LAYER_TOKEN[layer]});transform:rotate(${rotation}deg)"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    iconCache.set(key, icon);
  }
  return icon;
}

/** Label placement for an off-map arrow: beyond its tip, or to alternate sides when several arrows leave one node the same way. */
function arrowLabel(dir: 'N' | 'S' | 'E' | 'W', k: number, n: number): { direction: 'top' | 'bottom' | 'left' | 'right'; offset: [number, number] } {
  if (n > 1 && (dir === 'N' || dir === 'S')) return k % 2 === 0 ? { direction: 'left', offset: [-8, 0] } : { direction: 'right', offset: [8, 0] };
  if (dir === 'N') return { direction: 'top', offset: [0, -6] };
  if (dir === 'S') return { direction: 'bottom', offset: [0, 6] };
  return dir === 'E' ? { direction: 'right', offset: [6, 0] } : { direction: 'left', offset: [-6, 0] };
}

interface HomeMapLayersProps {
  overlay: HomeOverlay;
  sites: CareSite[];
}

/** A click on the empty map clears the selection. */
function ClearOnMapClick({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

/** Leaflet children of NodeMap: zone points and circles, infrastructure links and nodes per layer, off-map arrows and the patient dots. */
export function HomeMapLayers({ overlay, sites }: HomeMapLayersProps) {
  const {
    layers, zones, infraNodes, infraLinks, patients, powerLines = [], selectedId = null, onSelectNode,
    mode = null, blockedNodes = EMPTY, roads, blockedWayIds = NO_WAYS, powerOutZones = EMPTY, waterOutZones = EMPTY, heatZones = EMPTY, coldZones = EMPTY, teleStatus, patientMarks,
    onToggleNode, onTapWay, onToggleZone, teams = [], teamTokens, sequence,
  } = overlay;
  const positions = useMemo(() => vertexPositions(sites, zones, infraNodes), [sites, zones, infraNodes]);
  const slots = useMemo(() => offmapSlots(infraLinks), [infraLinks]);
  // With a node selected, everything that is not linked to it is dimmed (SPEC.md § 11.5).
  const linked = useMemo(() => (selectedId ? linkedVertices(selectedId, infraLinks) : null), [selectedId, infraLinks]);
  const kinds = tm('HOME.kinds');
  const NEUTRAL = cssColor('--color-text-secondary');
  const MUTED = cssColor('--color-text-muted');
  const SURFACE = cssColor('--color-surface');
  const DANGER = cssColor('--color-red');
  const AMBER = cssColor('--color-orange');
  const linkDim = (l: InfraLink) => linked !== null && l.a !== selectedId && l.b !== selectedId;
  const vertexDim = (id: string) => linked !== null && !linked.has(id);
  const zoneMode = mode === 'el' || mode === 'water' || mode === 'heat' || mode === 'cold';
  // The disruption the current mode edits; outside the zone modes any of them shows.
  const zoneOut = (id: string) =>
    mode === 'el' ? powerOutZones.has(id) : mode === 'water' ? waterOutZones.has(id) : mode === 'heat' ? heatZones.has(id) : mode === 'cold' ? coldZones.has(id)
      : powerOutZones.has(id) || waterOutZones.has(id) || heatZones.has(id) || coldZones.has(id);

  return (
    <>
      {onSelectNode && mode === null ? <ClearOnMapClick onClear={() => selectedId && onSelectNode(null)} /> : null}

      {layers.el
        ? powerLines.map((l) => (
            <Polyline key={`pl-${l.id}`} positions={l.positions} pathOptions={{ color: cssColor(LAYER_TOKEN.el), weight: l.highest >= 400 ? 3 : 2, opacity: linked !== null ? 0.3 : 0.9 }} interactive={false}>
              {l.label ? (
                <Tooltip permanent className="home-map-label">
                  {l.label}
                </Tooltip>
              ) : null}
            </Polyline>
          ))
        : null}

      {roads && layers.roads ? <RoadsLayer roads={roads} blocked={blockedWayIds} interactive={mode === 'roads' && Boolean(onTapWay)} onTap={onTapWay} /> : null}

      {zones
        .filter((z) => zoneMode || zoneOut(z.id) || layers.tele)
        .map((z) => {
          const out = zoneOut(z.id);
          const tele = layers.tele ? teleStatus?.get(z.id) : undefined;
          // The tele layer: a zone without mobile network is filled in the danger colour, one that loses it within hours is dashed amber.
          const colour = tele === 'down' ? DANGER : tele === 'soon' ? AMBER : out ? DANGER : NEUTRAL;
          const strong = out || tele !== undefined;
          return (
            <Circle
              key={`area-${z.id}`}
              center={[z.lat, z.lng]}
              radius={z.radiusKm * 1000}
              pathOptions={{ color: colour, weight: strong ? 2 : 1, fillColor: colour, fillOpacity: tele === 'down' ? 0.3 : out ? 0.22 : 0.06, dashArray: tele === 'soon' || !strong ? '4 4' : undefined }}
              interactive={zoneMode}
              eventHandlers={zoneMode && onToggleZone ? { click: () => onToggleZone(z.id) } : undefined}
            />
          );
        })}

      {infraLinks
        .filter((l) => layers[l.layer])
        .map((l) => {
          const colour = cssColor(LAYER_TOKEN[l.layer]);
          const label = lt(l.label);
          const schematic = isSchematic(l);
          const dashArray = !schematic ? undefined : l.style === 'dotted' ? DASH_DOTTED : DASH_SCHEMATIC;
          const weight = 2;
          const opacity = linkDim(l) ? 0.15 : l.style === 'street' ? 0.7 : 0.9;
          const from = positions.get(l.a);
          if (!from) return null;
          if (l.offmap) {
            const slot = slots.get(l.id) ?? { k: 0, n: 1 };
            const end = offmapEnd(from, l.offmap.dir, slot.k, slot.n);
            const place = arrowLabel(l.offmap.dir, slot.k, slot.n);
            return (
              <Fragment key={`${l.id}-${linkDim(l)}`}>
                <Polyline positions={[from, end]} pathOptions={{ color: colour, weight, dashArray, opacity }} interactive={false} />
                <Marker position={end} icon={arrowIcon(l.layer, offmapRotation(l.offmap.dir), linkDim(l))} interactive={false} keyboard={false}>
                  <Tooltip permanent direction={place.direction} offset={place.offset} className={linkDim(l) ? 'home-map-label home-map-label-dim' : 'home-map-label'}>
                    {lt(l.offmap.text)}
                  </Tooltip>
                </Marker>
              </Fragment>
            );
          }
          const to = positions.get(l.b);
          if (!to) return null;
          return (
            <Polyline key={l.id} positions={[from, to]} pathOptions={{ color: colour, weight, dashArray, opacity }}>
              {label ? <Tooltip sticky>{label}</Tooltip> : null}
            </Polyline>
          );
        })}

      {zones.map((z) => {
        const dim = vertexDim(z.graphNode);
        return (
          <CircleMarker
            key={`${z.id}-${dim}`}
            center={[z.lat, z.lng]}
            radius={4}
            pathOptions={{ color: NEUTRAL, weight: 1.5, fillColor: SURFACE, fillOpacity: dim ? 0.3 : 1, opacity: dim ? 0.3 : 1 }}
            interactive={false}
          >
            <Tooltip permanent direction={(ZONE_LABEL[z.id] ?? { direction: 'bottom' }).direction} offset={(ZONE_LABEL[z.id] ?? { offset: [0, 4] }).offset} className={dim ? 'home-map-label home-map-label-dim' : 'home-map-label'}>
              {lt(z.name)}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {infraNodes
        .filter((n) => layers[n.layer] && !n.noMarker)
        .map((n) => {
          const blocked = blockedNodes.has(n.id);
          const onClick = mode === 'roads' ? (n.layer === 'roads' && onToggleNode ? () => onToggleNode(n.id) : undefined) : mode === null && onSelectNode ? () => onSelectNode(n.id) : undefined;
          return (
            <Marker
              key={n.id}
              position={[n.lat, n.lng]}
              icon={nodeIcon(n, n.id === selectedId, vertexDim(n.id), blocked)}
              title={lt(n.name)}
              alt={lt(n.name)}
              eventHandlers={onClick ? { click: onClick } : undefined}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                {lt(n.name)}
                <br />
                <span className="text-text-secondary">{kinds[n.kind]}</span>
                {n.verified ? null : (
                  <>
                    <br />
                    <span className="text-red">{t('HOME.unverified')}</span>
                  </>
                )}
              </Tooltip>
            </Marker>
          );
        })}

      {teams.map((tm, i) => {
        const detail = `${tm.name}. ${t('HOME.teams.base', { base: lt(tm.baseLabel) })}, ${t('HOME.teams.cars', { n: tm.cars })}`;
        return (
          <Marker key={tm.id} position={[tm.baseLat, tm.baseLng]} icon={teamIcon(teamTokens?.[tm.id] ?? teamToken(i))} title={detail} alt={detail} keyboard={false}>
            <Tooltip permanent direction="right" offset={[8, 12]} className="home-map-label">
              {tm.name}
            </Tooltip>
          </Marker>
        );
      })}

      {sequence ? (
        <>
          <Polyline positions={[sequence.base, ...sequence.stops.map((s): [number, number] => [s.lat, s.lng])]} pathOptions={{ color: cssColor(sequence.token), weight: 2, dashArray: '6 4', opacity: 0.8 }} interactive={false} />
          {sequence.stops.map((s) => (
            <Marker
              key={s.id}
              position={[s.lat, s.lng]}
              icon={stopIcon(s.n, sequence.token, sequence.selectedId === s.id)}
              title={s.label}
              alt={s.label}
              eventHandlers={sequence.onSelect ? { click: () => sequence.onSelect?.(s.id) } : undefined}
            />
          ))}
        </>
      ) : null}

      {layers.patients
        ? patients.map((p) => {
            const mark = patientMarks?.get(p.id);
            if (mark === 'critical') {
              return <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={4} pathOptions={{ stroke: true, color: DANGER, weight: 2, fillOpacity: 0 }} interactive={false} />;
            }
            if (mark) {
              return (
                <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={3} pathOptions={{ stroke: false, fillColor: mark === 'affected' ? DANGER : AMBER, fillOpacity: 0.95 }} interactive={false} />
              );
            }
            return <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={2} pathOptions={{ stroke: false, fillColor: MUTED, fillOpacity: vertexDim(`zone:${p.zone}`) ? 0.1 : 0.3 }} interactive={false} />;
          })
        : null}
    </>
  );
}
