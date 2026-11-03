import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { BeredskapsLage, Playbook } from '@/data/types';
import { useStore } from '@/data/store';
import { CURRENT_USER, LAGEN } from '@/data/vocab';
import { lt, t, tm } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StaffSelect } from '@/components/StaffSelect';

interface ActivateDialogProps {
  playbook: Playbook | null;
  onOpenChange: (open: boolean) => void;
}

/** SPEC.md § 6.6 – "Aktivera {spelbok}?" with Sjukvårdsledare, Beredskapsläge and note. */
export function ActivateDialog({ playbook, onOpenChange }: ActivateDialogProps) {
  const activatePlaybook = useStore((s) => s.activatePlaybook);
  const navigate = useNavigate();
  const [commander, setCommander] = useState<string>(CURRENT_USER.name);
  const [lage, setLage] = useState<BeredskapsLage>('Förstärkningsläge');
  const [note, setNote] = useState('');
  const ids = { commander: useId(), lage: useId(), note: useId() };

  useEffect(() => {
    if (playbook) {
      setCommander(CURRENT_USER.name);
      setLage(playbook.defaultLage);
      setNote('');
    }
  }, [playbook]);

  const activate = () => {
    if (!playbook) return;
    activatePlaybook(playbook.id, commander, lage, note);
    onOpenChange(false);
    toast(t('INCIDENT.incidentActivated'));
    navigate('/incident');
  };

  return (
    <Dialog open={playbook !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {playbook ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('INCIDENT.activateTitle', { name: lt(playbook.name) })}</DialogTitle>
              <DialogDescription>{t('INCIDENT.activateBody', { roles: playbook.roles.length, tasks: playbook.tasks.length, channels: playbook.channels.length, targets: playbook.targets.length })}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label htmlFor={ids.commander}>{t('INCIDENT.fields.commander')}</label>
                <StaffSelect id={ids.commander} value={commander} onChange={setCommander} />
              </div>
              <div className="space-y-1">
                <label htmlFor={ids.lage}>{t('INCIDENT.fields.lage')}</label>
                <Select value={lage} onValueChange={(v) => setLage(v as BeredskapsLage)}>
                  <SelectTrigger id={ids.lage} className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAGEN.filter((l) => l !== 'Normalläge').map((l) => (
                      <SelectItem key={l} value={l}>
                        {tm('LAGE_LABELS')[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label htmlFor={ids.note}>{t('INCIDENT.fields.note')}</label>
                <Textarea id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                {t('LABELS.cancel')}
              </Button>
              <Button onClick={activate}>{t('INCIDENT.activateIncident')}</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
