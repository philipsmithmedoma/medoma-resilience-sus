import { useStore } from '@/data/store';
import { t, tm, lt } from '@/lib/i18n';
import { formatClock } from '@/lib/time';
import { fictionalMarking } from '@/lib/home-sites';
import { visitStatusAt } from '@/data/packs/home-visits';
import type { ImpactRow } from '@/lib/reachability';
import { ReasonChips } from '@/components/ReasonChips';
import { RealtimeCells, SimulatedNote } from '@/components/Realtime';
import { ExplanationChain } from './ExplanationChain';
import { PatientActions } from './PatientActions';


interface PatientDetailProps {
  patientId: string;
  /** The patient's row when preparedness mode is on and a disruption affects them; the flags and the disruption actions show with it. */
  row?: ImpactRow;
  /** Preparedness mode: the flags and, for an affected patient, the status chain and the five actions (SPEC.md § 14.3). */
  prep: boolean;
}

/**
 * The patient detail pane of /planning and /patients (SPEC.md § 14.3): who, where, team, equipment, today's visit, and the
 * actions of § 13.3. Without preparedness mode only the plain planning action, Move visit, is offered.
 */
export function PatientDetail({ patientId, row, prep }: PatientDetailProps) {
  const pack = useStore((s) => s.pack);
  const visits = useStore((s) => s.home.visits);
  const work = useStore((s) => s.home.work[patientId]);
  const clock = useStore((s) => s.clock);
  const p = pack.homePatients.find((x) => x.id === patientId);
  if (!p) return null;
  const equipment = tm('HOME.equipment');
  const zone = pack.homeZones.find((z) => z.id === p.zone);
  const visit = visits.find((v) => v.patientId === p.id);
  const team = pack.homeTeams.find((x) => x.id === (work?.assignedTeam ?? visit?.teamId)) ?? pack.homeTeams.find((x) => x.name === p.team);
  const status = visit ? visitStatusAt(visit, clock) : null;
  const names = (ids: string[]) => ids.map((id) => pack.homeTeams.find((x) => x.id === id)?.name ?? id).join(', ');
  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <h2 className="text-heading">
          {p.familyName}, {p.givenName} <span className="font-normal text-text-secondary tabular">{p.age}</span>
        </h2>
        <p className="text-small text-text-muted">{fictionalMarking(pack.homePackId)}</p>
      </div>
      {prep && row ? (
        <div className="flex flex-wrap gap-1" aria-label={t('HOME.detail.flags')}>
          <ReasonChips row={row} />
        </div>
      ) : null}
      <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-text-secondary">{t('HOME.detail.address')}</dt>
        <dd>
          {p.street} {p.houseNo}
          {zone ? <span className="text-text-muted"> {lt(zone.name)}</span> : null}
        </dd>
        <dt className="text-text-secondary">{t('HOME.detail.team')}</dt>
        <dd>{team?.name ?? p.team}</dd>
        <dt className="text-text-secondary">{t('HOME.detail.equipment')}</dt>
        <dd>{p.equipment.length ? p.equipment.map((e) => equipment[e]).join(', ') : t('HOME.list.noEquipment')}</dd>
        {p.batteryHours !== null ? (
          <>
            <dt className="text-text-secondary">{t('HOME.detail.battery')}</dt>
            <dd className="tabular">
              {prep && row?.power && row.batteryEmptyAt != null ? (row.batteryEmpty ? t('HOME.time.batteryEmpty') : t('HOME.time.batteryUntil', { hhmm: formatClock(row.batteryEmptyAt) })) : t('HOME.list.battery', { n: p.batteryHours })}
            </dd>
          </>
        ) : null}
        {p.monitoringLevel !== 'none' ? (
          <>
            <dt className="text-text-secondary">{t('HOME.detail.monitoring')}</dt>
            <dd>{p.monitoringReason ? t('HOME.monitoring.line', { level: tm('HOME.monitoring.level')[p.monitoringLevel], reason: tm('HOME.monitoring.reason')[p.monitoringReason] }) : tm('HOME.monitoring.level')[p.monitoringLevel]}</dd>
          </>
        ) : null}
        {p.antibiotic ? (
          <>
            <dt className="text-text-secondary">{t('HOME.detail.antibiotic')}</dt>
            <dd>{p.antibiotic}</dd>
          </>
        ) : null}
        {prep ? (
          <>
            <dt className="text-text-secondary">{t('HOME.realtime.lastContact')}</dt>
            <dd>
              <RealtimeCells p={p} />
              <SimulatedNote />
            </dd>
          </>
        ) : null}
        <dt className="text-text-secondary">{t('HOME.detail.visit')}</dt>
        <dd className="tabular">
          {visit && status ? (
            <>
              {formatClock(visit.start)}–{formatClock(visit.start + visit.durationMin)} <span className="text-text-secondary">{tm('HOME.planning.status')[status]}</span>
            </>
          ) : (
            t('HOME.detail.noVisit')
          )}
        </dd>
        {prep && row?.reachableBy ? (
          <>
            <dt className="text-text-secondary">{t('HOME.detail.reachedBy')}</dt>
            <dd>{row.reachableBy.length ? names(row.reachableBy) : t('HOME.detail.noTeamReaches')}</dd>
          </>
        ) : null}
      </dl>
      {prep && row?.affected ? <ExplanationChain row={row} /> : null}
      {prep && row?.affected ? <PatientActions patientId={p.id} reachableBy={row.reachableBy} row={row} /> : visit && status !== 'cancelled' && p.visitToday ? <PatientActions patientId={p.id} moveOnly /> : null}
    </div>
  );
}
