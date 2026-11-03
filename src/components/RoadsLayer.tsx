import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import type { RoadCollection, RoadFeature, RoadProps } from '@/lib/roadGraph';
import { cssColor, useTheme } from '@/lib/theme';

interface RoadsLayerProps {
  roads: RoadCollection;
  /** OSM way ids that are closed (drawn in the danger colour). */
  blocked: ReadonlySet<number>;
  /** In roads mode a tap on a segment calls `onTap`; otherwise the roads take no clicks. */
  interactive: boolean;
  onTap?: (props: RoadProps) => void;
}

const WIDTH: Record<string, number> = {
  motorway: 3, motorway_link: 3, trunk: 3, trunk_link: 3,
  primary: 2.5, primary_link: 2.5,
  secondary: 2, secondary_link: 2,
};
const widthOf = (p: RoadProps) => WIDTH[p.highway] ?? 2;

/**
 * SPEC.md § 12.4: roads.json as one Leaflet GeoJSON layer on a canvas renderer (thousands of ways): motorway and trunk 3 px,
 * primary 2.5 px, secondary 2 px, bridges with a lighter 1 px casing, tunnels dashed, closed ways in the danger colour.
 */
export function RoadsLayer({ roads, blocked, interactive, onTap }: RoadsLayerProps) {
  const map = useMap();
  const theme = useTheme((s) => s.theme);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const style = (f?: RoadFeature | GeoJSON.Feature): L.PathOptions => {
    const p = (f as RoadFeature).properties;
    const isBlocked = blockedRef.current.has(p.id);
    return {
      color: isBlocked ? cssColor('--color-red') : cssColor('--color-text-secondary'),
      weight: widthOf(p) + (isBlocked ? 1 : 0),
      opacity: isBlocked ? 1 : 0.85,
      dashArray: p.tunnel ? '4 4' : undefined,
      lineCap: 'butt',
    };
  };

  // Built once per data set and per interactivity (the canvas renderer needs the flag at creation).
  useEffect(() => {
    const renderer = L.canvas({ padding: 0.3, tolerance: interactive ? 6 : 0 });
    const casing = L.geoJSON(
      { type: 'FeatureCollection', features: roads.features.filter((f) => f.properties.bridge) } as GeoJSON.FeatureCollection,
      { renderer, interactive: false, style: (f) => ({ color: cssColor('--color-text-muted'), weight: widthOf((f as unknown as RoadFeature).properties) + 2, opacity: 0.6 }) } as L.GeoJSONOptions,
    );
    const layer = L.geoJSON(roads as unknown as GeoJSON.FeatureCollection, { renderer, interactive, style: style as L.StyleFunction } as L.GeoJSONOptions);
    const hover = L.tooltip({ sticky: true, direction: 'top', offset: [0, -6] });
    if (interactive) {
      layer.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        tapRef.current?.(((e.propagatedFrom as L.Layer & { feature: RoadFeature }).feature).properties);
      });
      layer.on('mousemove', (e: L.LeafletMouseEvent) => {
        const p = ((e.propagatedFrom as L.Layer & { feature: RoadFeature }).feature).properties;
        const text = [p.name, p.ref].filter(Boolean).join(' ');
        if (text) hover.setLatLng(e.latlng).setContent(text).addTo(map);
        else hover.remove();
      });
      layer.on('mouseout', () => hover.remove());
    }
    casing.addTo(map);
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      hover.remove();
      layer.remove();
      casing.remove();
      layerRef.current = null;
    };
    // The style function reads refs and the theme, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roads, interactive, map]);

  // Closed ways and the theme change the style only.
  useEffect(() => {
    layerRef.current?.setStyle(style as L.StyleFunction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, theme]);

  return null;
}
