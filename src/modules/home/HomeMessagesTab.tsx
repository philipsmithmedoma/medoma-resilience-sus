import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { HomeDisruptionKind, Message } from '@/data/types';
import { useStore } from '@/data/store';
import { t, tm, lt } from '@/lib/i18n';
import { parseDisruptionMessage, type DisruptionPrefill } from '@/lib/disruption-message';
import { formatClock } from '@/lib/time';
import { MessageThread } from '@/components/MessageThread';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KINDS: HomeDisruptionKind[] = ['road', 'power', 'water'];

/**
 * SPEC.md § 13.4 – "Från meddelande": the notices, each with "Skapa störning", which prefills a form (kind, target, start now,
 * expected duration, a note with the message id). Nothing is created until the user confirms.
 */
export function HomeMessagesTab({ roadNames, onCreated }: { roadNames: string[]; onCreated: () => void }) {
  const messages = useStore((s) => s.pack.homeMessages);
  const zones = useStore((s) => s.pack.homeZones);
  const clock = useStore((s) => s.clock);
  const startHomeDisruption = useStore((s) => s.startHomeDisruption);
  const [open, setOpen] = useState<Message | null>(null);
  const [form, setForm] = useState<DisruptionPrefill | null>(null);
  const [hours, setHours] = useState('');
  const listId = useId();
  const kinds = tm('HOME.disruptionKinds');

  const openMessage = (m: Message) => {
    const p = parseDisruptionMessage(m, { roadNames, zones, clock });
    setOpen(m);
    setForm(p);
    setHours(p.durationHours === null ? '' : String(p.durationHours));
  };
  const close = () => {
    setOpen(null);
    setForm(null);
  };

  if (open && form) {
    const duration = hours.trim() === '' ? null : Number(hours.replace(',', '.'));
    const validDuration = duration === null || (Number.isFinite(duration) && duration > 0);
    const canCreate = form.target.trim() !== '' && validDuration;
    return (
      <form
        className="space-y-3 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canCreate) return;
          const id = startHomeDisruption({
            kind: form.kind,
            target: form.target,
            targetKind: form.kind === 'road' ? 'road' : 'zone',
            source: 'message',
            expectedEnd: duration === null ? null : clock + Math.round(duration * 60),
            note: t('HOME.fromMessage.note', { id: open.id }),
          });
          toast(id ? t('HOME.fromMessage.created') : t('HOME.fromMessage.exists'));
          close();
          onCreated();
        }}
      >
        <h3 className="text-heading">{t('HOME.fromMessage.formTitle')}</h3>
        <p lang="sv" className="rounded-md bg-bg-muted p-2 text-small">
          {open.text}
        </p>
        <label className="block space-y-1">
          <span className="text-small text-text-secondary">{t('HOME.fromMessage.kind')}</span>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as HomeDisruptionKind, target: '' })}>
            <SelectTrigger size="sm" className="w-full" aria-label={t('HOME.fromMessage.kind')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {kinds[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-1">
          <span className="text-small text-text-secondary">{t('HOME.fromMessage.target')}</span>
          {form.kind === 'road' ? (
            <>
              <Input list={listId} aria-label={t('HOME.fromMessage.target')} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="h-8" />
              <datalist id={listId}>
                {roadNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </>
          ) : (
            <Select value={form.target} onValueChange={(v) => setForm({ ...form, target: v })}>
              <SelectTrigger size="sm" className="w-full" aria-label={t('HOME.fromMessage.target')}>
                <SelectValue placeholder={t('HOME.fromMessage.selectZone')} />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {lt(z.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-small text-text-secondary">{t('HOME.fromMessage.start')}</span>
            <Input readOnly value={t('HOME.fromMessage.now', { hhmm: formatClock(form.startedAt) })} className="h-8" aria-label={t('HOME.fromMessage.start')} />
          </label>
          <label className="block space-y-1">
            <span className="text-small text-text-secondary">{t('HOME.fromMessage.duration')}</span>
            <Input inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} aria-label={t('HOME.fromMessage.duration')} aria-invalid={!validDuration} className="h-8" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-small text-text-secondary">{t('HOME.fromMessage.noteLabel')}</span>
          <Input readOnly value={t('HOME.fromMessage.note', { id: open.id })} className="h-8" aria-label={t('HOME.fromMessage.noteLabel')} />
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={!canCreate}>
            {t('HOME.fromMessage.create')}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={close}>
            {t('HOME.work.cancel')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4">
      <p className="text-small text-text-muted">{t('HOME.fromMessage.illustrative')}</p>
      <MessageThread messages={messages} readOnly actionLabel={t('HOME.fromMessage.open')} onSend={() => undefined} onAction={openMessage} className="max-h-[calc(100vh-330px)] min-h-[320px]" />
    </div>
  );
}
