import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import type { Incident } from '@/data/types';
import { useStore } from '@/data/store';
import { key, lt, t } from '@/lib/i18n';
import { areasOf, roleLabel } from '@/lib/incident';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AddTaskDialogProps {
  incident: Incident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "Lägg till uppgift": Titel, Område, Ansvarig roll, Klar inom minuter (default 30). */
export function AddTaskDialog({ incident, open, onOpenChange }: AddTaskDialogProps) {
  const addTask = useStore((s) => s.addTask);
  const playbooks = useStore((s) => s.playbooks);
  const playbook = playbooks.find((p) => p.id === incident.playbookId);
  const areas = areasOf(incident).map((a) => ({ key: key(a), label: lt(a) }));
  const roles = Object.keys(incident.roles);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState(areas[0]?.key ?? '');
  const [ownerRole, setOwnerRole] = useState(roles[0] ?? '');
  const [dueIn, setDueIn] = useState('30');
  const ids = { title: useId(), area: useId(), role: useId(), due: useId() };

  useEffect(() => {
    if (open) {
      setTitle('');
      setArea(areas[0]?.key ?? '');
      setOwnerRole(roles[0] ?? '');
      setDueIn('30');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const valid = title.trim().length > 0 && area && ownerRole && Number(dueIn) > 0;
  const submit = () => {
    if (!valid) return;
    addTask({ title: title.trim(), area, ownerRole, dueInMin: Number(dueIn) });
    onOpenChange(false);
    toast(t('INCIDENT.taskAdded'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('INCIDENT.addTask')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <label htmlFor={ids.title}>{t('INCIDENT.fields.title')}</label>
            <Input id={ids.title} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.area}>{t('INCIDENT.fields.area')}</label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger id={ids.area} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.role}>{t('INCIDENT.fields.ownerRole')}</label>
            <Select value={ownerRole} onValueChange={setOwnerRole}>
              <SelectTrigger id={ids.role} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel(playbook, r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor={ids.due}>{t('INCIDENT.fields.dueIn')}</label>
            <Input id={ids.due} type="number" min={1} value={dueIn} onChange={(e) => setDueIn(e.target.value)} className="w-32" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('LABELS.cancel')}
          </Button>
          <Button onClick={submit} disabled={!valid}>
            {t('INCIDENT.addTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
