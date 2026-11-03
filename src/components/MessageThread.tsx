import { useId, useState, type FormEvent } from 'react';
import { SendIcon } from 'lucide-react';
import type { Message } from '@/data/types';
import { CURRENT_USER, SYSTEM_ACTOR } from '@/data/vocab';
import { t, useLocale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface MessageThreadProps {
  messages: Message[];
  onSend: (text: string) => void;
  emptyText?: string;
  className?: string;
  /** Hides the input (a list of notices, not a conversation). */
  readOnly?: boolean;
  /** When set, received messages (not the current user, not System) carry this link text and call `onAction`. */
  actionLabel?: string;
  onAction?: (message: Message) => void;
}

/**
 * DESIGN.md § 4 message thread: sent messages right-aligned in primary bubbles, received left-aligned
 * in border-colour bubbles, sender line "Namn, Roll, HH:MM" above each; bg-muted input area.
 */
export function MessageThread({ messages, onSend, actionLabel, onAction, emptyText = t('INCIDENT.noMessages'), className, readOnly = false }: MessageThreadProps) {
  const locale = useLocale();
  const [text, setText] = useState('');
  const inputId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };
  return (
    <div className={cn('flex flex-col rounded-lg border border-border', className)}>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? <p className="text-text-secondary">{emptyText}</p> : null}
        {messages.map((m) => {
          const sent = m.author === CURRENT_USER.name;
          const system = m.author === SYSTEM_ACTOR;
          const received = !sent && !system;
          const en = locale === 'en' && m.textEn !== undefined;
          return (
            <div key={m.id} className={cn('flex flex-col', sent ? 'items-end' : 'items-start')}>
              <div className="mb-1 text-small text-text-secondary">
                {m.author}, {locale === 'en' && m.roleEn ? m.roleEn : m.role}, <span className="tabular">{m.at}</span>
              </div>
              <div lang={sent ? undefined : en ? 'en' : 'sv'} className={cn('max-w-[70%] rounded-lg px-3 py-2 text-body', sent ? 'bg-primary text-primary-foreground' : 'bg-bg-muted text-text')}>{en ? m.textEn : m.text}</div>
              {received && onAction && actionLabel ? (
                <button type="button" className="mt-1 text-small text-primary-text hover:text-primary-hover hover:underline" onClick={() => onAction(m)}>
                  {actionLabel}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {readOnly ? null : (
      <form onSubmit={submit} className="flex items-center gap-2 border-t border-border bg-bg-muted p-3">
        <label htmlFor={inputId} className="sr-only">
          {t('INCIDENT.messagePlaceholder')}
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('INCIDENT.messagePlaceholder')}
          className="h-9 flex-1 rounded-md border border-border-input bg-surface px-3 text-body"
        />
        <button
          type="submit"
          aria-label={t('INCIDENT.send')}
          disabled={!text.trim()}
          className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-border-input"
        >
          <SendIcon className="size-5" strokeWidth={1.5} aria-hidden />
        </button>
      </form>
      )}
    </div>
  );
}
