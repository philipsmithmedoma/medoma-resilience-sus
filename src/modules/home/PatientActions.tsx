import { useState } from 'react';
import { useStore } from '@/data/store';
import { WORK_STATUSES } from '@/data/store-home';
import { t, tm, lt } from '@/lib/i18n';
import { effectiveVisits, freeSlots } from '@/data/packs/home-visits';
import { formatClock } from '@/lib/time';
import { homeSiteName } from '@/lib/home-sites';
import { StatusChain } from '@/components/StatusChain';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Form = null | 'contact' | 'move' | 'team';

/**
 * The status chain and the five actions of one patient (SPEC.md § 13.3): Contact, Move visit (only with a visit today),
 * Send team, Bring in, Confirm. Used in the expanded row of /home and in the detail pane of /planning.
 */
export function PatientActions({ patientId, reachableBy, moveOnly = false }: { patientId: string; reachableBy?: string[]; moveOnly?: boolean }) {
  const pack = useStore((s) => s.pack);
  const work = useStore((s) => s.home.work[patientId]);
  const visits = useStore((s) => s.home.visits);
  const allWork = useStore((s) => s.home.work);
  const clock = useStore((s) => s.clock);
  const contactPatient = useStore((s) => s.contactPatient);
  const moveVisit = useStore((s) => s.moveVisit);
  const sendTeam = useStore((s) => s.sendTeam);
  const bringInPatient = useStore((s) => s.bringInPatient);
  const confirmPatient = useStore((s) => s.confirmPatient);
  const [form, setForm] = useState<Form>(null);
  const [note, setNote] = useState('');
  const [slot, setSlot] = useState<string>('');
  const [team, setTeam] = useState<string>('');

  const patient = pack.homePatients.find((p) => p.id === patientId);
  if (!patient) return null;
  const status = work?.status ?? 'Unhandled';
  const labels = tm('HOME.work.status');
  const visit = visits.find((v) => v.patientId === patientId);
  const visitTeam = pack.homeTeams.find((x) => x.id === (work?.assignedTeam ?? visit?.teamId));
  const slots = visit && visitTeam ? freeSlots(effectiveVisits(visits, allWork).filter((v) => v.id !== visit.id), visitTeam, clock) : [];
  // Send team offers the teams that can reach the patient (SPEC.md § 14.2); without road data every team.
  const teamOptions = reachableBy ? pack.homeTeams.filter((x) => reachableBy.includes(x.id)) : pack.homeTeams;
  const done = () => setForm(null);
  const toggle = (f: Exclude<Form, null>) => setForm(form === f ? null : f);

  return (
    <div className="space-y-3 pt-2" onClick={(e) => e.stopPropagation()}>
      <h4 className="text-small font-medium text-text-secondary">{t('HOME.work.title')}</h4>
      {moveOnly ? null : (
        <>
          <StatusChain steps={WORK_STATUSES} labels={labels} current={status} label={t('HOME.work.statusLabel')} />
          {work?.note ? <p className="text-small text-text-secondary">{work.note}</p> : null}
          {work?.assignedTeam ? <p className="text-small text-text-secondary">{t('HOME.work.assigned', { team: pack.homeTeams.find((x) => x.id === work.assignedTeam)?.name ?? work.assignedTeam })}</p> : null}
          {work?.bringInSite ? <p className="text-small text-text-secondary">{t('HOME.work.broughtIn', { site: homeSiteName(pack.homePackId, work.bringInSite) })}</p> : null}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {moveOnly ? null : (
          <Button size="sm" variant="secondary" aria-expanded={form === 'contact'} onClick={() => toggle('contact')}>
            {t('HOME.work.contact')}
          </Button>
        )}
        {patient.visitToday && visit && visit.status !== 'cancelled' ? (
          <Button size="sm" variant="secondary" aria-expanded={form === 'move'} onClick={() => toggle('move')}>
            {t('HOME.work.moveVisit')}
          </Button>
        ) : null}
        {moveOnly ? null : (
          <>
            <Button size="sm" variant="secondary" aria-expanded={form === 'team'} onClick={() => toggle('team')}>
              {t('HOME.work.sendTeam')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bringInPatient(patientId)}>
              {t('HOME.work.bringIn')}
            </Button>
            <Button size="sm" onClick={() => confirmPatient(patientId)}>
              {t('HOME.work.confirm')}
            </Button>
          </>
        )}
      </div>
      {form === 'contact' ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            contactPatient(patientId, note);
            setNote('');
            done();
          }}
        >
          <Input aria-label={t('HOME.work.note')} placeholder={t('HOME.work.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} className="h-8" />
          <Button size="sm" type="submit">
            {t('HOME.work.save')}
          </Button>
        </form>
      ) : null}
      {form === 'move' ? (
        <div className="flex items-center gap-2">
          <Select value={slot} onValueChange={setSlot}>
            <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={t('HOME.work.slot')}>
              <SelectValue placeholder={slots.length ? t('HOME.work.slot') : t('HOME.work.noSlots')} />
            </SelectTrigger>
            <SelectContent>
              {slots.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {formatClock(s)}
                </SelectItem>
              ))}
              <SelectItem value="none">{t('HOME.work.noVisit')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!slot}
            onClick={() => {
              moveVisit(patientId, slot === 'none' ? null : Number(slot));
              setSlot('');
              done();
            }}
          >
            {t('HOME.work.save')}
          </Button>
        </div>
      ) : null}
      {form === 'team' ? (
        <div className="flex items-center gap-2">
          <Select value={team} onValueChange={setTeam}>
            <SelectTrigger size="sm" className="min-w-0 flex-1" aria-label={t('HOME.work.team')}>
              <SelectValue placeholder={t('HOME.work.selectTeam')} />
            </SelectTrigger>
            <SelectContent>
              {teamOptions.map((x) => (
                <SelectItem key={x.id} value={x.id}>
                  {x.name} ({lt(x.baseLabel)})
                </SelectItem>
              ))}
              {teamOptions.length === 0 ? <div className="px-2 py-1.5 text-small text-text-secondary">{t('HOME.work.noTeam')}</div> : null}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!team}
            onClick={() => {
              sendTeam(patientId, team);
              setTeam('');
              done();
            }}
          >
            {t('HOME.work.save')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
