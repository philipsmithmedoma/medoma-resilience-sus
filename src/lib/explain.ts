// The explanation chain of an affected patient (SPEC.md § 6): three to five steps in plain language with clock times, each
// carrying its source or assumption. Pure given the locale; the call list prints the same chain, one line per patient.
import type { DataPack } from '@/data/types';
import { lt, t, tm } from '@/lib/i18n';
import { formatClock } from '@/lib/time';
import { COLD_AFTER_H, HEAT_CRITICAL_H, supplyStartOf, type Disruptions, type ImpactRow } from './reachability';
import { realtimeOf, FALL_OTHER_MIN, FALL_URBAN_MIN } from './signal';

type ChainPack = Pick<DataPack, 'homeZones' | 'infraNodes' | 'homePackId'> & Partial<Pick<DataPack, 'homeUnitStock'>>;

/** The steps explaining one row, in order; empty for a row with nothing to explain. */
export function explainRow(row: ImpactRow, pack: ChainPack, state: Disruptions, clock: number): string[] {
  const p = row.patient;
  const zone = pack.homeZones.find((z) => z.id === p.zone);
  if (!zone) return [];
  const zoneName = lt(zone.name);
  const steps: string[] = [];
  const hhmm = (m: number) => formatClock(m);
  const powerStart = state.powerStart?.get(p.zone);
  const teleStart = state.teleStart?.get(p.zone);
  if (row.unreachable || row.delayed) {
    steps.push(t('HOME.chain.road', { names: t(row.unreachable ? 'HOME.chain.unreachable' : 'HOME.chain.detour', { km: row.extraKm ?? 0 }) }));
  }
  if (powerStart !== undefined) steps.push(t('HOME.chain.power', { zone: zoneName, hhmm: hhmm(powerStart) }));
  if (teleStart !== undefined) steps.push(t('HOME.chain.tele', { zone: zoneName, hhmm: hhmm(teleStart) }));
  if (row.noContactAt !== null) {
    const fromPower = powerStart !== undefined && powerStart + (zone.urban ? FALL_URBAN_MIN : FALL_OTHER_MIN) === row.noContactAt;
    const basis = fromPower ? t(zone.urban ? 'HOME.chain.basisUrban' : 'HOME.chain.basisOther') : t('HOME.chain.basisTele');
    steps.push(t('HOME.chain.network', { hhmm: hhmm(row.noContactAt), basis }));
    if (row.noContact) {
      const rt = realtimeOf(p, zone, { powerStart: state.powerStart, teleStart: state.teleStart, hiddenPower: state.hiddenPower }, clock);
      steps.push(t('HOME.chain.hubSeen', { hhmm: hhmm(rt.lastContactAt) }));
      steps.push(t('HOME.chain.noContactSince', { hhmm: hhmm(rt.lastContactAt) }));
    }
  }
  if (row.monitoringCritical && p.monitoringReason) {
    const what = t('HOME.monitoring.line', { level: tm('HOME.monitoring.level')[p.monitoringLevel], reason: tm('HOME.monitoring.reason')[p.monitoringReason] });
    steps.push(t('HOME.chain.visit2h', { what }));
  } else if (row.power && row.batteryEmptyAt != null && !row.noContact) {
    steps.push(t('HOME.chain.battery', { hhmm: hhmm(row.batteryEmptyAt) }));
  }
  const heatStart = state.heatStart?.get(p.zone);
  if (heatStart !== undefined && row.heat) {
    steps.push(t('HOME.chain.heat', { zone: zoneName, hhmm: hhmm(heatStart) }));
    if (p.equipment.includes('Pump') && p.antibiotic) {
      const h = (p.heatSensitive ? HEAT_CRITICAL_H.sensitive : HEAT_CRITICAL_H.other) + (state.heatExtraHours?.get(p.id) ?? 0);
      steps.push(t('HOME.chain.heatPump', { antibiotic: p.antibiotic, sens: t(p.heatSensitive ? 'HOME.chain.heatSensitive' : 'HOME.chain.heatOther'), h, hhmm: hhmm(heatStart + h * 60) }));
    } else steps.push(t('HOME.chain.heatAge'));
  }
  const coldStart = state.coldStart?.get(p.zone);
  if (row.cold && coldStart !== undefined && powerStart !== undefined) {
    steps.push(t('HOME.chain.cold', { zone: zoneName, hhmm: hhmm(coldStart) }));
    steps.push(t('HOME.chain.coldHome', { hhmm: hhmm(Math.max(coldStart, powerStart) + COLD_AFTER_H * 60) }));
    if (row.grounds.includes('cold')) steps.push(t('HOME.chain.coldAge'));
  }
  if (row.noPump) {
    const start = supplyStartOf(state);
    const days = pack.homeUnitStock?.infusorsDays.value ?? 0;
    if (start !== null) steps.push(t('HOME.chain.supply', { hhmm: hhmm(start), d: Math.max(0, Math.round((days - (clock - start) / 1440) * 10) / 10) }));
    steps.push(t('HOME.chain.noPump'));
  }
  if (row.water) steps.push(t('HOME.chain.water', { zone: zoneName, hhmm: hhmm(clock) }));
  return steps;
}

