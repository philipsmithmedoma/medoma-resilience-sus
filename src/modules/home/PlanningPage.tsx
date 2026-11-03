import { useMemo, useState } from 'react';
import { useStore } from '@/data/store';
import { t, tm, lt } from '@/lib/i18n';
import { formatClock } from '@/lib/time';
import { planningGroups, teamSequence, type VisitRow } from '@/lib/planning';
import { blockedWayIdSet, type ImpactRow } from '@/lib/reachability';
import { getRoadModel } from '@/lib/roadModel';
import { fictionalMarking } from '@/lib/home-sites';
import type { ChipTone } from '@/data/vocab';
import { cn } from '@/lib/utils';
import { Chip } from '@/components/Chip';
import { NodeMap } from '@/components/NodeMap';
import { PageTitle } from '@/components/PageTitle';
import { teamToken, type HomeOverlay } from '@/components/HomeMapLayers';
import { PatientDetail } from './PatientDetail';
import { useHomeGeo } from './useHomeGeo';
import { useHomeImpact } from './useHomeImpact';
import { usePreparednessActive } from './usePreparednessActive';

import { REASON_TONE } from '@/components/ReasonChips';
const VISIT_TONE: Record<string, ChipTone> = { planned: 'grey', moved: 'blue', cancelled: 'warning', done: 'green' };

function VisitItem({ r, row, selected, prep, onSelect }: { r: VisitRow; row?: ImpactRow; selected: boolean; prep: boolean; onSelect: () => void }) {
  const equipment = tm('HOME.equipment');
  const reasons = tm('HOME.impact.reasons');
  return (
    <li className="border-b border-border">
      <button type="button" aria-pressed={selected} onClick={onSelect} className={cn('flex w-full flex-col gap-1 px-4 py-2 text-left hover:bg-bg-muted', selected && 'bg-bg-muted')}>
        <span className="flex w-full items-center gap-2">
          <span className="w-12 shrink-0 font-medium tabular">{formatClock(r.visit.start)}</span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {r.patient.familyName}, {r.patient.givenName} <span className="font-normal text-text-secondary tabular">{r.patient.age}</span>
          </span>
          <Chip tone={VISIT_TONE[r.status]}>{tm('HOME.planning.status')[r.status]}</Chip>
        </span>
        <span className="flex w-full items-center gap-2 pl-14 text-small text-text-secondary">
          <span className="truncate">
            {r.patient.street} {r.patient.houseNo}
          </span>
          <span className="ml-auto truncate text-text-muted">{r.patient.equipment.length ? r.patient.equipment.map((e) => equipment[e]).join(', ') : t('HOME.list.noEquipment')}</span>
        </span>
        {prep && row ? (
          <span className="flex flex-wrap gap-1 pl-14">
            {row.reasons.map((reason) => (
              <Chip key={reason} tone={REASON_TONE[reason]}>
                {reasons[reason]}
              </Chip>
            ))}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * SPEC.md § 14.3 – Planering: today's home visits grouped by team and sorted by start (list 380 px), the patient pane with the
 * actions, and the map with the selected team's visits as a numbered sequence over the road layer. In preparedness mode each
 * row carries its disruption flags and the pane the actions of § 13.3; without it the page is the same minus those.
 */
export function PlanningPage() {
  const prep = usePreparednessActive();
  const pack = useStore((s) => s.pack);
  const visits = useStore((s) => s.home.visits);
  const work = useStore((s) => s.home.work);
  const clock = useStore((s) => s.clock);
  const home = useStore((s) => s.home);
  const incident = useStore((s) => s.incident);
  const geo = useHomeGeo();
  const { impact } = useHomeImpact();
  const [selected, setSelected] = useState<string | null>(null);
  const [teamPick, setTeamPick] = useState<string | null>(null);

  const groups = useMemo(() => planningGroups(visits, work, pack.homePatients, pack.homeTeams, clock), [visits, work, pack, clock]);
  const rowOf = useMemo(() => new Map(impact.rows.map((r) => [r.patient.id, r])), [impact]);
  const selectedRow = groups.flatMap((g) => g.rows).find((r) => r.patient.id === selected);
  // The map shows the team of the selected visit, else the chosen team, else the first team that has visits.
  const teamId = selectedRow?.team.id ?? teamPick ?? groups.find((g) => g.rows.length)?.team.id ?? pack.homeTeams[0].id;
  const group = groups.find((g) => g.team.id === teamId)!;
  const teamIndex = pack.homeTeams.findIndex((x) => x.id === teamId);
  const token = teamToken(teamIndex);
  const stops = useMemo(() => teamSequence(group), [group]);
  const total = visits.length;

  const blockedWayIds = useMemo(() => {
    const model = getRoadModel();
    return prep && model ? blockedWayIdSet(model, home, pack) : new Set<number>();
    // geoReady: the model exists once the geometry has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep, home.blockedWays, home.blockedRoads, home.blockedNodes, home.geoReady, pack]);
  const osmData = geo !== null && Object.values(geo.source).includes('osm');
  const overlay = useMemo<HomeOverlay>(() => {
    const base: [number, number] = [group.team.baseLat, group.team.baseLng];
    const pts: Array<[number, number]> = [base, ...stops.map((s): [number, number] => [s.row.patient.lat, s.row.patient.lng])];
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const pad = 0.01;
    return {
      layers: { patients: false, roads: true, el: false, water: false, tele: false },
      zones: [],
      infraNodes: [],
      infraLinks: [],
      patients: [],
      roads: geo?.roads,
      blockedWayIds,
      teams: [group.team],
      teamTokens: { [group.team.id]: token },
      fitPoints: [
        [Math.min(...lats) - pad, Math.min(...lngs) - pad],
        [Math.max(...lats) + pad, Math.max(...lngs) + pad],
      ],
      sequence: {
        token,
        base,
        stops: stops.map((s) => ({ id: s.row.patient.id, n: s.n, lat: s.row.patient.lat, lng: s.row.patient.lng, label: `${s.n}. ${s.row.patient.familyName}, ${s.row.patient.givenName} ${formatClock(s.row.visit.start)}` })),
        selectedId: selected,
        onSelect: setSelected,
      },
    };
  }, [group, stops, geo, blockedWayIds, token, selected]);

  return (
    <div className="flex flex-col" style={{ height: incident ? 'calc(100vh - 136px)' : 'calc(100vh - 96px)' }}>
      <div className="mb-4">
        <PageTitle title={t('MODULES.planning')} />
      </div>
      <div className="-mx-6 flex min-h-[520px] flex-1 border-t border-border">
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-border">
          <div className="sticky top-0 z-10 space-y-1 border-b border-border bg-surface px-4 py-3">
            <h2 className="text-heading">{t('HOME.planning.visits', { n: total })}</h2>
            <p className="text-small text-text-muted">{fictionalMarking(pack.homePackId)}</p>
          </div>
          {groups.map((g) => (
            <section key={g.team.id} aria-label={g.team.name}>
              <h3 className="bg-bg-muted px-4 py-1.5 text-body font-medium">
                {t('HOME.planning.teamHeading', { team: g.team.name, n: g.rows.length })} <span className="font-normal text-text-secondary">{lt(g.team.baseLabel)}</span>
              </h3>
              {g.rows.length === 0 ? <p className="px-4 py-2 text-text-secondary">{t('HOME.planning.noVisits')}</p> : null}
              <ul>
                {g.rows.map((r) => (
                  <VisitItem key={r.visit.id} r={r} row={rowOf.get(r.patient.id)} prep={prep} selected={selected === r.patient.id} onSelect={() => setSelected(r.patient.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="w-[320px] shrink-0 overflow-y-auto border-r border-border">
          {selectedRow ? <PatientDetail patientId={selectedRow.patient.id} row={rowOf.get(selectedRow.patient.id)} prep={prep} /> : <p className="px-4 py-4">{t('HOME.planning.select')}</p>}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2" role="group" aria-label={t('HOME.planning.teamsLabel')}>
            <span className="text-small text-text-secondary">{t('HOME.planning.teamsLabel')}</span>
            {pack.homeTeams.map((tm2) => (
              <button
                key={tm2.id}
                type="button"
                aria-pressed={teamId === tm2.id}
                onClick={() => {
                  setTeamPick(tm2.id);
                  setSelected(null);
                }}
                className={cn(
                  'h-7 rounded-full border px-3 text-small whitespace-nowrap transition-colors duration-150',
                  teamId === tm2.id ? 'border-primary-text bg-primary text-primary-foreground' : 'border-border bg-surface text-text hover:bg-bg-muted',
                )}
              >
                {tm2.name}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1" role="region" aria-label={t('HOME.planning.mapAria')}>
            <NodeMap key={teamId} sites={[]} home={overlay} scrollWheelZoom fitPadding={24} attributionExtra={osmData ? t('HOME.attribution') : undefined} className="h-full" />
          </div>
          <p className="border-t border-border px-4 py-2 text-small text-text-secondary">{t('HOME.planning.sequence', { team: group.team.name })}</p>
        </div>
      </div>
    </div>
  );
}
