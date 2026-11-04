import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { CareSite } from '@/data/types';
import { t } from '@/lib/i18n';
import { cssColor, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { HomeMapLayers, type HomeOverlay } from './HomeMapLayers';
import { homeFitPoints } from '@/lib/home-geo';

interface NodeMapProps {
  /** The hospital sites of the active pack, drawn as circle markers. */
  sites: CareSite[];
  className?: string;
  /** Pixels of padding when the map fits its points. */
  fitPadding?: number;
  /** Extra attribution after the tile attribution (the ODbL text for OpenStreetMap data). */
  attributionExtra?: string;
  scrollWheelZoom?: boolean;
  /** The Medoma Center overlay (SPEC.md § 5): infrastructure layers, zones, patient dots and teams; the map fits the zones and sites. */
  home: HomeOverlay;
}

function FitBounds({ points, padding }: { points: Array<[number, number]>; padding: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const lats = points.map((p) => p[0]);
    const lngs = points.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [padding, padding], animate: false },
    );
    // Fit once per point set size; a pack switch re-fits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length, points[0]?.[0], points[0]?.[1]]);
  return null;
}

/** OpenStreetMap tiles with the home overlay; the sites are circle markers labelled with their name. */
export function NodeMap({ sites, className, scrollWheelZoom = false, fitPadding = 24, attributionExtra, home }: NodeMapProps) {
  // Leaflet paints SVG paths with literal colours: resolve the tokens for the current theme.
  useTheme((s) => s.theme);
  const GREEN = cssColor('--color-green');
  const fitPoints = useMemo(() => homeFitPoints(home, sites), [home, sites]);
  const attribution = t('HOME.tileAttribution');
  return (
    <MapContainer center={[59.35, 18.0]} zoom={9} scrollWheelZoom={scrollWheelZoom} className={cn('h-full w-full', className)} attributionControl>
      <TileLayer key={attributionExtra ?? ''} attribution={attributionExtra ? `${attribution} | ${attributionExtra}` : attribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds points={fitPoints} padding={fitPadding} />
      <HomeMapLayers overlay={home} sites={sites} />
      {sites.map((n) => (
        <CircleMarker key={n.id} center={[n.lat, n.lng]} radius={10} pathOptions={{ color: GREEN, fillColor: GREEN, fillOpacity: 0.9, weight: 2 }}>
          <Tooltip direction="top" offset={[0, -8]}>
            {n.shortName}
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
